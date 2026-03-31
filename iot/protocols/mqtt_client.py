from __future__ import annotations

import importlib
import json
import threading
import time
import uuid
from dataclasses import dataclass
from queue import Empty, Queue
from typing import Any, Dict, Optional


@dataclass
class MQTTClientConfig:
    broker_host: str
    broker_port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    keepalive_seconds: int = 60
    request_topic: str = "museum/ticket/verify/request"
    response_topic: str = "museum/ticket/verify/response"
    timeout_seconds: float = 5.0


class MQTTRequestResponseClient:
    """MQTT helper that provides request-response semantics for ticket validation."""

    def __init__(self, config: MQTTClientConfig, logger) -> None:
        self.config = config
        self.logger = logger
        self._pending: Dict[str, Queue] = {}
        self._lock = threading.Lock()

        mqtt = importlib.import_module("paho.mqtt.client")
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        if config.username and config.password:
            self.client.username_pw_set(config.username, config.password)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

    def connect(self) -> None:
        self.client.connect(self.config.broker_host, self.config.broker_port, self.config.keepalive_seconds)
        self.client.loop_start()
        # Give the client a short time window for the connect callback to subscribe.
        time.sleep(0.5)

    def disconnect(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()

    def verify_ticket(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        correlation_id = str(uuid.uuid4())
        envelope = {"correlationId": correlation_id, "payload": payload}
        response_queue: Queue = Queue(maxsize=1)

        with self._lock:
            self._pending[correlation_id] = response_queue

        self.client.publish(self.config.request_topic, json.dumps(envelope), qos=1)

        try:
            return response_queue.get(timeout=self.config.timeout_seconds)
        except Empty as exc:
            raise TimeoutError("Timed out waiting for MQTT validation response") from exc
        finally:
            with self._lock:
                self._pending.pop(correlation_id, None)

    def _on_connect(self, _client, _userdata, _flags, reason_code, _properties):
        if reason_code != 0:
            self.logger.error("MQTT connection failed: reason=%s", reason_code)
            return
        self.client.subscribe(self.config.response_topic, qos=1)
        self.logger.info("MQTT connected and subscribed to response topic")

    def _on_disconnect(self, _client, _userdata, _disconnect_flags, reason_code, _properties):
        if reason_code != 0:
            self.logger.warning("MQTT disconnected unexpectedly: reason=%s", reason_code)

    def _on_message(self, _client, _userdata, msg):
        try:
            data = json.loads(msg.payload.decode("utf-8"))
            correlation_id = data.get("correlationId")
            payload = data.get("payload", {})
            if not correlation_id:
                return
            with self._lock:
                queue = self._pending.get(correlation_id)
            if queue:
                queue.put_nowait(payload)
        except Exception as exc:  # pragma: no cover - defensive callback handling
            self.logger.error("Failed to process MQTT message: %s", exc)
