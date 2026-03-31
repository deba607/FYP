from __future__ import annotations

from typing import Any, Dict, Tuple

from protocols.http_client import HTTPClient, HTTPClientConfig
from protocols.mqtt_client import MQTTClientConfig, MQTTRequestResponseClient
from raspberry_pi.config import RaspberryPiConfig


class TicketValidationClient:
    """Validates scanned ticket IDs against backend over HTTP or MQTT."""

    def __init__(self, config: RaspberryPiConfig, logger) -> None:
        self.config = config
        self.logger = logger
        self.transport = config.transport
        self._mqtt_client = None

        auth_headers = {}
        if config.api_auth_token:
            auth_headers["Authorization"] = f"Bearer {config.api_auth_token}"

        self._http_client = HTTPClient(
            HTTPClientConfig(
                base_url=config.backend_base_url,
                verify_tls=config.tls_verify,
                default_headers=auth_headers,
            ),
            logger=logger,
        )

        if self.transport == "mqtt":
            self._mqtt_client = MQTTRequestResponseClient(
                MQTTClientConfig(
                    broker_host=config.mqtt_broker_host,
                    broker_port=config.mqtt_broker_port,
                    username=config.mqtt_username,
                    password=config.mqtt_password,
                ),
                logger=logger,
            )

    def connect(self) -> None:
        if self._mqtt_client:
            self._mqtt_client.connect()

    def close(self) -> None:
        if self._mqtt_client:
            self._mqtt_client.disconnect()

    def verify_ticket(self, ticket_id: str) -> Tuple[bool, Dict[str, Any]]:
        request_body = {
            "ticketId": ticket_id,
            "deviceId": self.config.device_id,
        }

        if self.transport == "mqtt" and self._mqtt_client:
            response = self._mqtt_client.verify_ticket(request_body)
        else:
            response = self._http_client.post(self.config.verify_endpoint, request_body)

        valid = bool(response.get("valid", False))
        return valid, response
