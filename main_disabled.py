"""MicroPython main loop for ESP32 gate ticket validation."""

import time

from api_client import ESP32TicketClient
from gate_control import GateController
from scanner import QRSerialScanner
from wifi import connect_wifi

try:
    import config
except ImportError:
    raise RuntimeError("Copy config.py.sample to config.py and fill in WiFi, server, and device values")


def run() -> None:
    connect_wifi(config.WIFI_SSID, config.WIFI_PASSWORD)
    scanner = QRSerialScanner()
    heartbeat_endpoint = config.HEARTBEAT_ENDPOINT_TEMPLATE.format(device_id=config.DEVICE_ID)
    client = ESP32TicketClient(
        config.BACKEND_BASE_URL,
        config.VERIFY_ENDPOINT,
        config.DEVICE_ID,
        config.API_TOKEN,
        heartbeat_endpoint,
    )
    gate = GateController(
        config.RELAY_PIN,
        getattr(config, "VALID_LED_PIN", None),
        getattr(config, "INVALID_LED_PIN", None),
        getattr(config, "BUZZER_PIN", None),
    )
    next_heartbeat = 0

    while True:
        try:
            now = time.time()
            if now >= next_heartbeat:
                client.heartbeat("active")
                next_heartbeat = now + config.HEARTBEAT_INTERVAL_SECONDS

            ticket_id = scanner.wait_for_scan()
            result = client.verify_ticket(ticket_id)
            valid = bool(result.get("success", True) and result.get("valid", False))
            message = result.get("message", "No response message")
            if valid:
                open_ms = int(result.get("openDurationMs", config.GATE_OPEN_MS))
                print("VALID", ticket_id, message)
                gate.open_for(open_ms)
            else:
                print("INVALID", ticket_id, message)
                gate.deny()
        except Exception as exc:
            print("ERROR", exc)
            try:
                gate.deny()
            except Exception:
                pass
            time.sleep(1)


run()
