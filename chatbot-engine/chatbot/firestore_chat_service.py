from typing import Any, Dict, Optional

from .production_intent_detector import ProductionIntentDetector
from .production_services import BookingService, FAQService, MuseumService, ServiceError
from .response_builder import ResponseBuilder


class FirestoreFirstChatbotService:
    def __init__(self):
        self.intent_detector = ProductionIntentDetector()
        self.museums = MuseumService()
        self.bookings = BookingService()
        self.faqs = FAQService()
        self.responses = ResponseBuilder()

    def handle(self, message: str, auth_context: Dict[str, Any], context: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        detected = self.intent_detector.detect(message)
        context = context or {}
        user = self._user_from_auth(auth_context)

        try:
            if detected.intent == "book_ticket":
                # Existing conversational booking flow collects date/time/visitor details.
                # Live Firestore pricing/details are used by downstream handlers.
                return None

            if detected.intent == "cancel_ticket":
                self._require_auth(user)
                booking_id = detected.entities.get("bookingId") or context.get("bookingId")
                booking = self.bookings.cancel_ticket(user, booking_id)
                return self.responses.booking_cancelled(booking)

            if detected.intent == "check_availability":
                result = self.bookings.check_availability(
                    museum_id=context.get("museumId", ""),
                    query=message,
                    visit_date=context.get("visitDate", ""),
                    tickets=int(context.get("tickets") or 1),
                )
                return self.responses.availability(result)

            if detected.intent == "search_museums":
                return self.responses.museum_search(self.museums.search(message), message)

            if detected.intent == "museum_timings":
                result = self.museums.get_timings(context.get("museumId", ""), message)
                return self.responses.timings(result)

            if detected.intent == "ticket_prices":
                result = self.museums.get_prices(context.get("museumId", ""), message)
                return self.responses.prices(result)

            if detected.intent == "museum_details":
                result = self.museums.get_details(context.get("museumId", ""), message)
                return self.responses.museum_details(result)

            if detected.intent == "generate_qr":
                self._require_auth(user)
                booking_id = detected.entities.get("bookingId") or context.get("bookingId")
                booking = self.bookings.generate_qr_ticket(user, booking_id)
                return self.responses.qr_ticket(booking)

            if detected.intent == "check_booking":
                self._require_auth(user)
                booking_id = detected.entities.get("bookingId") or context.get("bookingId")
                booking = self.bookings.get_owned_booking(user, booking_id)
                return self.responses.booking_status(booking)

            if detected.intent == "faq":
                return self.responses.faq(self.faqs.answer(message))

            return None
        except ServiceError as err:
            return self.responses.error(str(err), detected.intent)
        except Exception as err:
            return self.responses.error(f"Unable to complete this action right now: {err}", detected.intent)

    def _user_from_auth(self, auth_context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": auth_context.get("userId") or auth_context.get("id") or "",
            "userId": auth_context.get("userId") or auth_context.get("id") or "",
            "email": auth_context.get("email") or "",
            "phone": auth_context.get("phone") or "",
            "name": auth_context.get("name") or "",
            "role": auth_context.get("role") or "user",
            "isLoggedIn": bool(auth_context.get("isLoggedIn") or auth_context.get("token") or auth_context.get("userId")),
        }

    def _require_auth(self, user: Dict[str, Any]) -> None:
        if not user.get("isLoggedIn") and not user.get("email") and not user.get("id"):
            raise ServiceError("Please sign in first to use this service.")
