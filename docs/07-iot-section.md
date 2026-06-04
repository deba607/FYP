# IoT Section

## Location

Source directory: `iot/`

The IoT section implements ticket validation devices for museum entry gates.

## Raspberry Pi Flow

Main source: `iot/raspberry_pi/main.py`

The Raspberry Pi app performs:

1. Load device configuration.
2. Initialize logger.
3. Start QR scanner.
4. Connect API transport.
5. Wait for QR scans.
6. Parse QR payload into ticket ID and metadata.
7. Ignore duplicate scans within a short window.
8. Validate ticket with backend over HTTP or MQTT.
9. Open gate for valid tickets.
10. Signal invalid ticket for rejected scans.
11. Cleanly stop scanner, API client, and GPIO hardware on shutdown.

## Raspberry Pi Modules

| File | Purpose |
| --- | --- |
| `iot/raspberry_pi/main.py` | Device orchestrator for scan, validate, and gate actuation. |
| `iot/raspberry_pi/config.py` | Runtime configuration and environment loading. |
| `iot/raspberry_pi/scanner.py` | Camera QR scanning using OpenCV and pyzbar. |
| `iot/raspberry_pi/api_client.py` | Ticket validation over HTTP or MQTT. |
| `iot/raspberry_pi/gate_control.py` | Servo/LED gate signaling and cleanup. |

## Protocol Modules

| File | Purpose |
| --- | --- |
| `iot/protocols/http_client.py` | HTTP POST client for backend validation. |
| `iot/protocols/mqtt_client.py` | MQTT request/response validation client. |

## Utilities

| File | Purpose |
| --- | --- |
| `iot/utils/helpers.py` | QR payload parsing helpers. |
| `iot/utils/logger.py` | Device logger setup. |

## ESP32 Flow

Main source: `iot/esp32/main.py`

The ESP32 implementation is a MicroPython-oriented variant:

1. Connects to Wi-Fi.
2. Reads QR ticket IDs through a serial scanner.
3. Calls the backend validation endpoint.
4. Prints `VALID` or `INVALID`.
5. Leaves gate pin control as a device-specific extension point.

## Backend Validation Contract

The IoT client expects a validation response shaped like:

```json
{
  "valid": true
}
```

The Raspberry Pi client sends:

```json
{
  "ticketId": "BOOKING_OR_TICKET_ID",
  "deviceId": "DEVICE_ID"
}
```

The configured backend endpoint should return `valid: true` only when the ticket can be accepted at the gate.

