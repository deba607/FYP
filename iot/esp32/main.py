"""MicroPython main loop for optional ESP32 deployment."""

import time

from api_client import ESP32TicketClient
from scanner import QRSerialScanner
from wifi import connect_wifi

WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"
BACKEND_BASE_URL = "http://your-server:3000"
VERIFY_ENDPOINT = "/api/verify-ticket"
DEVICE_ID = "bharat-esp32-001"
API_TOKEN = ""


def run() -> None:
    connect_wifi(WIFI_SSID, WIFI_PASSWORD)
    scanner = QRSerialScanner()
    client = ESP32TicketClient(BACKEND_BASE_URL, VERIFY_ENDPOINT, DEVICE_ID, API_TOKEN)

    while True:
        try:
            ticket_id = scanner.wait_for_scan()
            valid = client.verify_ticket(ticket_id)
            if valid:
                print("VALID", ticket_id)
                # Add gate pin control here if servo is connected to ESP32.
            else:
                print("INVALID", ticket_id)
        except Exception as exc:
            print("ERROR", exc)
            time.sleep(1)


run()
