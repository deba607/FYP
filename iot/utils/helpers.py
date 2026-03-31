import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar
from urllib.parse import parse_qs, urlparse

T = TypeVar("T")


@dataclass(frozen=True)
class RetryPolicy:
    attempts: int = 3
    base_delay_seconds: float = 0.75
    max_delay_seconds: float = 5.0


def run_with_retry(
    func: Callable[[], T],
    policy: RetryPolicy,
    should_retry: Callable[[Exception], bool],
) -> T:
    """Runs a callable with bounded exponential backoff."""
    delay = policy.base_delay_seconds
    for attempt in range(1, policy.attempts + 1):
        try:
            return func()
        except Exception as exc:  # pragma: no cover - generic retry guard
            if attempt >= policy.attempts or not should_retry(exc):
                raise
            time.sleep(delay)
            delay = min(delay * 2, policy.max_delay_seconds)

    raise RuntimeError("Retry loop exhausted unexpectedly")


def parse_qr_payload(payload: str) -> Tuple[Optional[str], Dict[str, Any]]:
    """Extracts ticketId from plain text, URL query, or JSON payload QR data."""
    if not payload:
        return None, {}

    text = payload.strip()

    # JSON QR payload: {"ticketId":"..."}
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            ticket_id = parsed.get("ticketId") or parsed.get("ticket_id")
            return str(ticket_id) if ticket_id else None, parsed
        except json.JSONDecodeError:
            pass

    # URL QR payload: https://example/t?ticketId=ABC123
    if text.startswith("http://") or text.startswith("https://"):
        url = urlparse(text)
        query = parse_qs(url.query)
        ticket_id = query.get("ticketId", [None])[0] or query.get("ticket_id", [None])[0]
        metadata = {"url": text, "query": query}
        return str(ticket_id) if ticket_id else None, metadata

    # Label payload: ticketId: ABC123
    match = re.search(r"ticket(?:Id|_id)?\s*[:=]\s*([A-Za-z0-9_-]+)", text, re.IGNORECASE)
    if match:
        return match.group(1), {"raw": text}

    # Fallback: assume payload itself is the ticket id.
    return text, {"raw": text}
