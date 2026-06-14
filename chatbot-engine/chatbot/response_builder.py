from typing import Any, Dict


class ResponseBuilder:
    def museum_search(self, museums: list[Dict[str, Any]], query: str = "") -> Dict[str, Any]:
        if not museums:
            return {
                "message": "I could not find matching museums in Firestore. Please try another city, state, or museum name.",
                "intent": "search_museums",
                "data": {"museums": [], "query": query},
            }

        lines = ["Museums found in Firestore:"]
        for index, museum in enumerate(museums, start=1):
            location = museum.get("location") or "Location not available"
            state = museum.get("state") or "State not available"
            lines.append(f"{index}. {museum.get('name', 'Unnamed Museum')} - {location}, {state}")

        return {
            "message": "\n".join(lines),
            "intent": "search_museums",
            "data": {"museums": museums, "query": query},
        }

    def museum_details(self, result: Dict[str, Any]) -> Dict[str, Any]:
        museum = result.get("museum", {})
        timings = result.get("timings", {})
        prices = result.get("prices", {})
        closed_days = ", ".join(timings.get("closedDays") or []) or "None"
        price_lines = ", ".join(f"{label}: INR {amount}" for label, amount in prices.items()) or "Not available"
        details = [
            f"{museum.get('name', 'Museum')} details:",
            f"Location: {museum.get('location') or 'Not available'}",
            f"State: {museum.get('state') or 'Not available'}",
            f"Category: {museum.get('category') or 'Not available'}",
            f"Timings: {timings.get('open', '10:00')} to {timings.get('close', '17:00')}",
            f"Closed days: {closed_days}",
            f"Ticket prices: {price_lines}",
        ]
        if museum.get("description"):
            details.append(f"Description: {museum.get('description')}")

        return {
            "message": "\n".join(details),
            "intent": "museum_details",
            "data": result,
        }

    def availability(self, result: Dict[str, Any]) -> Dict[str, Any]:
        museum = result.get("museum", {})
        return {
            "message": f"{museum.get('name', 'This museum')} has tickets available. Remaining: {result.get('remaining', 0)}.",
            "intent": "check_availability",
            "data": result,
        }

    def timings(self, result: Dict[str, Any]) -> Dict[str, Any]:
        museum = result.get("museum", {})
        timings = result.get("timings", {})
        closed_days = ", ".join(timings.get("closedDays") or []) or "None"
        return {
            "message": f"{museum.get('name', 'Museum')} timings: {timings.get('open', '10:00')} to {timings.get('close', '17:00')}. Closed days: {closed_days}.",
            "intent": "museum_timings",
            "data": result,
        }

    def prices(self, result: Dict[str, Any]) -> Dict[str, Any]:
        museum = result.get("museum", {})
        prices = result.get("prices", {})
        lines = [f"- {label}: INR {amount}" for label, amount in prices.items()]
        return {
            "message": f"{museum.get('name', 'Museum')} ticket prices:\n" + "\n".join(lines),
            "intent": "ticket_prices",
            "data": result,
        }

    def booking_status(self, booking: Dict[str, Any]) -> Dict[str, Any]:
        booking_id = booking.get("bookingId") or booking.get("id")
        return {
            "message": f"Booking {booking_id} is {booking.get('status', 'unknown')}. Payment: {booking.get('paymentStatus', 'unknown')}.",
            "intent": "check_booking",
            "data": booking,
            "action": {
                "type": "show_ticket_by_id",
                "bookingId": booking_id,
            },
        }

    def qr_ticket(self, booking: Dict[str, Any]) -> Dict[str, Any]:
        booking_id = booking.get("bookingId") or booking.get("id")
        return {
            "message": f"Here is your QR ticket for booking {booking_id}.",
            "intent": "generate_qr",
            "data": booking,
            "action": {
                "type": "show_ticket_by_id",
                "bookingId": booking_id,
            },
        }

    def booking_cancelled(self, booking: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "message": f"Booking {booking.get('bookingId')} has been cancelled.",
            "intent": "cancel_ticket",
            "data": booking,
        }

    def faq(self, answer: str) -> Dict[str, Any]:
        return {"message": answer, "intent": "faq", "data": {}}

    def start_booking(self) -> Dict[str, Any]:
        return {
            "message": "Sure. Tell me the museum name, visit date, time slot, and ticket categories so I can help book from live Firestore data.",
            "intent": "book_ticket",
            "data": {},
            "action": {"type": "start_booking"},
        }

    def error(self, message: str, intent: str = "error") -> Dict[str, Any]:
        return {"message": message, "intent": intent, "data": {}}
