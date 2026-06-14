from datetime import datetime, timezone
import re
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from firebase_admin_helper import get_firestore_client
except Exception:
    get_firestore_client = None


class FirestoreUnavailableError(RuntimeError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_json_value(value: Any) -> Any:
    if hasattr(value, "to_datetime"):
        return value.to_datetime().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _to_json_value(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_to_json_value(item) for item in value]
    return value


def serialize_document(doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": doc_id, **_to_json_value(data or {})}


def sanitize_visitor_combo(combo: Any) -> Any:
    if not combo or not isinstance(combo, dict):
        return combo
    return {k.replace("/", "-"): v for k, v in combo.items()}


def desanitize_visitor_combo(combo: Any) -> Any:
    if not combo or not isinstance(combo, dict):
        return combo
    return {k.replace("-", "/"): v for k, v in combo.items()}


class BaseRepository:
    def __init__(self):
        self.db = get_firestore_client() if get_firestore_client else None
        if not self.db:
            raise FirestoreUnavailableError("Firestore Admin client is not configured")


class MuseumRepository(BaseRepository):
    def get(self, museum_id: str) -> Optional[Dict[str, Any]]:
        if not museum_id:
            return None

        doc = self.db.collection("museums").document(museum_id).get()
        if doc.exists:
            data = serialize_document(doc.id, doc.to_dict() or {})
            return data if data.get("active", True) else None

        query = (
            self.db.collection("museums")
            .where("museum_id", "==", museum_id)
            .limit(1)
            .stream()
        )
        for matched in query:
            data = serialize_document(matched.id, matched.to_dict() or {})
            return data if data.get("active", True) else None

        return None

    def list_active(self) -> List[Dict[str, Any]]:
        museums = []
        for doc in self.db.collection("museums").stream():
            data = serialize_document(doc.id, doc.to_dict() or {})
            if data.get("active", True):
                museums.append(data)
        return sorted(museums, key=lambda item: (str(item.get("location", "")), str(item.get("name", ""))))

    def search(self, query: str) -> List[Dict[str, Any]]:
        needle = self._clean_museum_query(query)
        if not needle:
            return self.list_active()

        scored_results = []
        query_tokens = [token for token in needle.split() if len(token) >= 3]
        for museum in self.list_active():
            name = str(museum.get("name", "")).lower()
            location = str(museum.get("location", "")).lower()
            state = str(museum.get("state", "")).lower()
            category = str(museum.get("category", "")).lower()
            museum_id = str(museum.get("museum_id", "")).lower()
            searchable = " ".join(
                str(museum.get(field, ""))
                for field in ("name", "location", "state", "category", "description", "museum_id")
            ).lower()

            score = 0
            if needle == name or needle == museum_id:
                score += 100
            if needle in name:
                score += 60
            if name and name in needle:
                score += 55
            if needle in location or needle in state:
                score += 25
            if needle in category:
                score += 15
            score += sum(8 for token in query_tokens if token in name)
            score += sum(3 for token in query_tokens if token in searchable)

            if score > 0:
                scored_results.append((score, museum))

        scored_results.sort(key=lambda item: item[0], reverse=True)
        return [museum for _, museum in scored_results]

    def _clean_museum_query(self, query: str) -> str:
        text = str(query or "").strip().lower()
        text = re.sub(r"[^a-z0-9 ]+", " ", text)
        stop_phrases = (
            "tell me about", "details of", "detail of", "details for", "detail for",
            "information about", "info about", "show details of", "show detail of",
            "what is", "where is", "location of", "address of", "ticket prices for",
            "ticket price for", "prices for", "price for", "timings of", "timing of",
            "hours of", "opening time of", "closing time of", "list of museums",
            "list museums", "show museums", "find museums", "search museums",
            "museums", "museum", "please",
        )
        for phrase in stop_phrases:
            text = text.replace(phrase, " ")
        text = re.sub(r"\b(in|at|near|for|of|the|a|an)\b", " ", text)
        return re.sub(r"\s+", " ", text).strip()


class BookingRepository(BaseRepository):
    def get(self, booking_id: str) -> Optional[Dict[str, Any]]:
        if not booking_id:
            return None

        # Read from Realtime Database (RTDB)
        try:
            from firebase_admin import db
            ref = db.reference(f"bookings/{booking_id}")
            data = ref.get()
            if data:
                data = _to_json_value(data)
                if isinstance(data, dict) and "visitorCombo" in data:
                    data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
                return data
        except Exception as e:
            logger.warning("Error fetching booking %s from RTDB: %s", booking_id, e)

        # Fallback to Firestore
        try:
            doc = self.db.collection("bookings").document(booking_id).get()
            if doc.exists:
                data = serialize_document(doc.id, doc.to_dict() or {})
                if "visitorCombo" in data:
                    data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
                return data
        except Exception:
            pass

        return None

    def list_for_user(self, user_id: str = "", email: str = "") -> List[Dict[str, Any]]:
        bookings: Dict[str, Dict[str, Any]] = {}

        # Read from Realtime Database (RTDB)
        try:
            from firebase_admin import db
            if user_id:
                ref = db.reference(f"bookingsByUser/{user_id}")
                data = ref.get()
                if data:
                    items = data.values() if isinstance(data, dict) else [x for x in data if x]
                    for item in items:
                        if item:
                            item_val = _to_json_value(item)
                            if isinstance(item_val, dict) and "visitorCombo" in item_val:
                                item_val["visitorCombo"] = desanitize_visitor_combo(item_val["visitorCombo"])
                            bookings[str(item.get("bookingId") or "")] = item_val

            if email:
                normalized_email = email.strip().lower()
                ref = db.reference("bookings")
                snapshot = ref.order_by_child("email").equal_to(normalized_email).get()
                if snapshot:
                    items = snapshot.values() if isinstance(snapshot, dict) else [x for x in snapshot if x]
                    for item in items:
                        if item:
                            item_val = _to_json_value(item)
                            if isinstance(item_val, dict) and "visitorCombo" in item_val:
                                item_val["visitorCombo"] = desanitize_visitor_combo(item_val["visitorCombo"])
                            bookings[str(item.get("bookingId") or "")] = item_val
        except Exception as e:
            logger.warning("Error listing bookings from RTDB: %s", e)

        # Fallback to Firestore
        if not bookings:
            try:
                if user_id:
                    for doc in self.db.collection("bookings").where("userId", "==", user_id).stream():
                        data = serialize_document(doc.id, doc.to_dict() or {})
                        if "visitorCombo" in data:
                            data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
                        bookings[str(data.get("bookingId") or doc.id)] = data
                if email:
                    normalized_email = email.strip().lower()
                    for doc in self.db.collection("bookings").where("email", "==", normalized_email).stream():
                        data = serialize_document(doc.id, doc.to_dict() or {})
                        if "visitorCombo" in data:
                            data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
                        bookings[str(data.get("bookingId") or doc.id)] = data
            except Exception:
                pass

        return sorted(
            bookings.values(),
            key=lambda item: str(item.get("createdAt") or item.get("visitDate") or ""),
            reverse=True,
        )

    def create(self, booking_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = _now()
        document = {
            **payload,
            "bookingId": booking_id,
            "status": payload.get("status") or "confirmed",
            "paymentStatus": payload.get("paymentStatus") or "paid",
            "qrValue": booking_id,
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
        }
        if "visitorCombo" in document:
            document["visitorCombo"] = sanitize_visitor_combo(document["visitorCombo"])

        # Save to Realtime Database (RTDB)
        try:
            from firebase_admin import db
            ref = db.reference(f"bookings/{booking_id}")
            ref.set(document)
            if document.get("userId"):
                user_ref = db.reference(f"bookingsByUser/{document['userId']}/{booking_id}")
                user_ref.set(document)
        except Exception as e:
            logger.warning("Error writing booking to RTDB: %s", e)

        # Save to Firestore
        try:
            self.db.collection("bookings").document(booking_id).set(serialize_document(booking_id, document))
        except Exception:
            pass

        return_doc = dict(document)
        if "visitorCombo" in return_doc:
            return_doc["visitorCombo"] = desanitize_visitor_combo(return_doc["visitorCombo"])
        return serialize_document(booking_id, return_doc)

    def update_status(self, booking_id: str, status: str) -> Dict[str, Any]:
        now_str = _now().isoformat()

        # Update in Realtime Database (RTDB)
        try:
            from firebase_admin import db
            ref = db.reference(f"bookings/{booking_id}")
            booking_data = ref.get()
            if booking_data:
                ref.update({"status": status, "updatedAt": now_str})
                user_id = booking_data.get("userId")
                if user_id:
                    user_ref = db.reference(f"bookingsByUser/{user_id}/{booking_id}")
                    user_ref.update({"status": status, "updatedAt": now_str})
        except Exception as e:
            logger.warning("Error updating booking status in RTDB: %s", e)

        # Update in Firestore
        try:
            doc_ref = self.db.collection("bookings").document(booking_id)
            doc_ref.update({"status": status, "updatedAt": _now()})
            updated = doc_ref.get()
            data = serialize_document(updated.id, updated.to_dict() or {})
            if "visitorCombo" in data:
                data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
            return data
        except Exception:
            pass

        # Return the data from RTDB if Firestore failed
        try:
            from firebase_admin import db
            data = db.reference(f"bookings/{booking_id}").get() or {}
            if "visitorCombo" in data:
                data["visitorCombo"] = desanitize_visitor_combo(data["visitorCombo"])
            return data
        except Exception:
            return {}


class FAQRepository(BaseRepository):
    def answer(self, question: str) -> Optional[str]:
        needle = str(question or "").strip().lower()
        if not needle:
            return None

        for doc in self.db.collection("faqs").stream():
            data = doc.to_dict() or {}
            if not data.get("active", True):
                continue
            haystack = " ".join([
                str(data.get("question", "")),
                str(data.get("answer", "")),
                " ".join(str(tag) for tag in data.get("tags", [])),
            ]).lower()
            if needle in haystack or any(word and word in haystack for word in needle.split()):
                return str(data.get("answer") or "").strip() or None

        return None
