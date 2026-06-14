import re
from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class IntentResult:
    intent: str
    entities: Dict[str, Any]
    confidence: float


class ProductionIntentDetector:
    BOOKING_ID_RE = re.compile(r"\b(?:BM|BK)\d+\b", re.IGNORECASE)

    def detect(self, message: str) -> IntentResult:
        text = str(message or "").strip()
        lower = text.lower()
        booking_id = self.extract_booking_id(text)

        if any(key in lower for key in ("cancel", "refund")):
            return IntentResult("cancel_ticket", {"bookingId": booking_id}, 0.95)

        if "qr" in lower or "barcode" in lower:
            return IntentResult("generate_qr", {"bookingId": booking_id}, 0.95)

        if booking_id or any(key in lower for key in ("booking status", "check booking", "existing booking")):
            return IntentResult("check_booking", {"bookingId": booking_id}, 0.9)

        if any(key in lower for key in ("available", "availability", "slot", "slots")):
            return IntentResult("check_availability", {}, 0.9)

        if (
            any(key in lower for key in ("museum in", "museums in", "list museum", "list museums", "show museums", "find museums", "search museums"))
            or lower.startswith("museums ")
        ):
            return IntentResult("search_museums", {}, 0.9)

        if any(key in lower for key in ("timing", "timings", "open", "close", "hours")):
            return IntentResult("museum_timings", {}, 0.9)

        if any(key in lower for key in ("price", "prices", "cost", "rate", "fee", "charges")):
            return IntentResult("ticket_prices", {}, 0.9)

        if any(key in lower for key in ("detail", "details", "information", "about", "location", "address", "description")):
            return IntentResult("museum_details", {}, 0.9)

        if any(key in lower for key in ("book", "reserve", "buy ticket", "purchase ticket")):
            return IntentResult("book_ticket", {}, 0.9)

        if any(key in lower for key in ("faq", "question", "help", "what can you do")):
            return IntentResult("faq", {}, 0.7)

        return IntentResult("unknown", {}, 0.2)

    def extract_booking_id(self, message: str) -> str:
        match = self.BOOKING_ID_RE.search(message or "")
        return match.group(0).upper() if match else ""
