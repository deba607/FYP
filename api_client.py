"""MicroPython HTTP client for ESP32 gate controller."""

import ujson
import urequests


class ESP32TicketClient:
    def __init__(
        self,
        base_url,
        verify_endpoint,
        device_id,
        token="",
        heartbeat_endpoint="",
    ):
        self.base_url = base_url.rstrip("/")
        self.verify_endpoint = verify_endpoint
        self.heartbeat_endpoint = heartbeat_endpoint
        self.device_id = device_id
        self.token = token

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        return headers

    def _request_json(self, method, endpoint, payload):
        url = self.base_url + "/" + endpoint.lstrip("/")

        data = ujson.dumps(payload)
        headers = self._headers()

        if method == "PATCH":
            response = urequests.request(
                "PATCH",
                url,
                data=data,
                headers=headers
            )
        else:
            response = urequests.post(
                url,
                data=data,
                headers=headers
            )

        try:
            if response.status_code >= 400:
                return {
                    "success": False,
                    "valid": False,
                    "message": "HTTP " + str(response.status_code),
                }

            return response.json()
        finally:
            response.close()

    def verify_ticket(self, ticket_id):
        payload = {
            "ticketId": ticket_id,
            "deviceId": self.device_id,
        }
        return self._request_json(
            "POST",
            self.verify_endpoint,
            payload
        )

    def heartbeat(self, status="active"):
        if not self.heartbeat_endpoint:
            return False

        payload = {
            "deviceId": self.device_id,
            "status": status,
        }

        body = self._request_json(
            "PATCH",
            self.heartbeat_endpoint,
            payload
        )

        return bool(body.get("success", False))