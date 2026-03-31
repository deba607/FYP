"""MicroPython HTTP client for ticket verification."""

import importlib


class ESP32TicketClient:
    def __init__(self, base_url: str, verify_endpoint: str, device_id: str, token: str = ""):
        self.base_url = base_url.rstrip("/")
        self.verify_endpoint = verify_endpoint
        self.device_id = device_id
        self.token = token
        self._ujson = importlib.import_module("ujson")
        self._urequests = importlib.import_module("urequests")

    def verify_ticket(self, ticket_id: str) -> bool:
        url = self.base_url + "/" + self.verify_endpoint.lstrip("/")
        payload = {"ticketId": ticket_id, "deviceId": self.device_id}
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token

        response = self._urequests.post(url, data=self._ujson.dumps(payload), headers=headers)
        try:
            if response.status_code >= 400:
                return False
            body = response.json()
            return bool(body.get("valid", False))
        finally:
            response.close()
