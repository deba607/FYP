from datetime import date
from typing import Any, Dict
from uuid import uuid4

from .firestore_repositories import BookingRepository, FAQRepository, MuseumRepository
from .qr_service import QRService


DEFAULT_PRICES = {
    "Adult": 200,
    "Child": 100,
    "Senior Citizen": 150,
    "Student": 120,
    "Professor": 180,
    "Researcher/Scientist": 180,
}


class ServiceError(Exception):
    pass


class MuseumService:
    def __init__(self):
        self.museums = MuseumRepository()

    def search(self, query: str):
        return self.museums.search(query)

    def resolve_museum(self, museum_id: str = "", query: str = "") -> Dict[str, Any]:
        if museum_id:
            museum = self.museums.get(museum_id)
            if museum:
                return museum

        matches = self.museums.search(query)
        if matches:
            return matches[0]

        raise ServiceError("Museum not found in Firestore.")

    def get_timings(self, museum_id: str = "", query: str = "") -> Dict[str, Any]:
        museum = self.resolve_museum(museum_id, query)
        timings = museum.get("timings") or {
            "open": museum.get("openingTime") or "10:00",
            "close": museum.get("closingTime") or "17:00",
            "closedDays": museum.get("closedDays") or [],
        }
        return {"museum": museum, "timings": timings}

    def get_details(self, museum_id: str = "", query: str = "") -> Dict[str, Any]:
        museum = self.resolve_museum(museum_id, query)
        timings = museum.get("timings") or {
            "open": museum.get("openingTime") or "10:00",
            "close": museum.get("closingTime") or "17:00",
            "closedDays": museum.get("closedDays") or [],
        }
        prices = self.get_prices(museum_id=museum.get("id") or museum.get("museum_id") or "", query=museum.get("name", "")).get("prices", {})
        return {
            "museum": museum,
            "timings": timings,
            "prices": prices,
        }

    def get_prices(self, museum_id: str = "", query: str = "") -> Dict[str, Any]:
        museum = self.resolve_museum(museum_id, query)
        prices = museum.get("prices") or {}
        if not prices:
            base_price = int(float(museum.get("price") or DEFAULT_PRICES["Adult"]))
            prices = {
                "Adult": base_price,
                "Child": round(base_price * 0.5),
                "Student": round(base_price * 0.6),
                "Senior Citizen": round(base_price * 0.75),
            }
        return {"museum": museum, "prices": prices}


class BookingService:
    def __init__(self):
        self.bookings = BookingRepository()
        self.museums = MuseumRepository()
        self.qr = QRService()

    def check_availability(self, museum_id: str = "", query: str = "", visit_date: str = "", tickets: int = 1) -> Dict[str, Any]:
        museum = self._resolve_museum(museum_id, query)
        if visit_date and visit_date < date.today().isoformat():
            raise ServiceError("Visit date cannot be in the past.")

        return {
            "available": True,
            "remaining": 500,
            "museum": museum,
            "visitDate": visit_date,
            "requestedTickets": tickets,
        }

    def create_booking(self, user: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
        museum = self._resolve_museum(payload.get("museumId", ""), payload.get("museumName", ""))
        prices = museum.get("prices") or DEFAULT_PRICES
        visitor_combo = payload.get("visitorCombo") or {payload.get("visitorType") or "Adult": int(payload.get("numberOfTickets") or 1)}
        total = sum(int(prices.get(kind, DEFAULT_PRICES.get(kind, 200))) * int(count) for kind, count in visitor_combo.items())
        count = sum(int(value) for value in visitor_combo.values())
        booking_id = f"BM{uuid4().int % 10**16}"

        booking = self.bookings.create(booking_id, {
            "userId": user.get("id") or user.get("userId") or "",
            "email": (user.get("email") or payload.get("email") or "").strip().lower(),
            "phone": user.get("phone") or payload.get("phone") or "",
            "name": user.get("name") or payload.get("name") or "",
            "museumId": museum.get("museum_id") or museum.get("id"),
            "museumName": museum.get("name"),
            "museumLocation": museum.get("location"),
            "museumCategory": museum.get("category"),
            "visitDate": payload.get("visitDate"),
            "timeSlot": payload.get("timeSlot"),
            "visitorCombo": visitor_combo,
            "visitorType": ", ".join(f"{amount} x {kind}" for kind, amount in visitor_combo.items()),
            "numberOfTickets": count,
            "totalAmount": total,
        })
        return {**booking, "qrDataUrl": self.qr.generate_data_url(booking_id)}

    def cancel_ticket(self, user: Dict[str, Any], booking_id: str) -> Dict[str, Any]:
        booking = self.get_owned_booking(user, booking_id)
        if booking.get("status") == "cancelled":
            return booking
        return self.bookings.update_status(booking_id, "cancelled")

    def get_owned_booking(self, user: Dict[str, Any], booking_id: str) -> Dict[str, Any]:
        if not booking_id:
            raise ServiceError("Booking ID is required.")

        booking = self.bookings.get(booking_id)
        if not booking:
            raise ServiceError("Booking not found.")

        user_id = str(user.get("id") or user.get("userId") or "")
        email = str(user.get("email") or "").strip().lower()
        booking_user_id = str(booking.get("userId") or "")
        booking_email = str(booking.get("email") or "").strip().lower()
        is_admin = user.get("role") == "admin"

        if not is_admin and user_id != booking_user_id and email != booking_email:
            raise ServiceError("This booking does not belong to your account.")

        return booking

    def generate_qr_ticket(self, user: Dict[str, Any], booking_id: str) -> Dict[str, Any]:
        booking = self.get_owned_booking(user, booking_id)
        return {**booking, "qrDataUrl": self.qr.generate_data_url(str(booking.get("bookingId") or booking_id))}

    def _resolve_museum(self, museum_id: str = "", query: str = "") -> Dict[str, Any]:
        if museum_id:
            museum = self.museums.get(museum_id)
            if museum:
                return museum
        matches = self.museums.search(query)
        if matches:
            return matches[0]
        raise ServiceError("Museum not found in Firestore.")


class FAQService:
    def __init__(self):
        self.faqs = FAQRepository()

    def answer(self, question: str) -> str:
        answer = self.faqs.answer(question)
        return answer or "I can help with booking tickets, cancellation, QR tickets, timings, prices, availability, and booking status."
