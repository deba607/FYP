# Bharat Museum IoT Gate Controller

This folder contains the hardware-side code for connecting an ESP32 gate device to the Bharat Museum ticket system.

## Flow

1. A visitor scans a QR/ticket code at the gate.
2. The ESP32 sends the ticket id and controller device id to the Next.js backend.
3. The backend validates booking status, payment status, visit date, and duplicate scans.
4. If the ticket is valid, the ESP32 energizes the relay/servo output for the configured gate-open duration.
5. Scan results are stored in Firestore and shown in the Controller Dashboard.

## Backend APIs Used By ESP32

Ticket verification:

```http
POST /api/bookings/validate-ticket
Content-Type: application/json

{
  "ticketId": "BM...",
  "deviceId": "controller-document-id"
}
```

Expected response:

```json
{
  "success": true,
  "valid": true,
  "openGate": true,
  "openDurationMs": 7000,
  "message": "Access granted - Ticket is valid",
  "booking": {}
}
```

Heartbeat/device status:

```http
PATCH /api/controllers/{deviceId}/status
Content-Type: application/json

{
  "status": "active"
}
```

## ESP32 Setup

1. Flash MicroPython to the ESP32.
2. Copy these files to the ESP32:
   - `esp32/main.py`
   - `esp32/api_client.py`
   - `esp32/scanner.py`
   - `esp32/wifi.py`
   - `esp32/gate_control.py`
3. Copy `esp32/config.py.sample` to `config.py`.
4. Fill in Wi-Fi, backend URL, controller device id, and pin values.
5. Register or select a controller device from the Controller Dashboard and use that Firestore document id as `DEVICE_ID`.

## Wiring Defaults

| ESP32 pin | Purpose |
| --- | --- |
| GPIO 26 | Relay signal for gate lock/servo controller |
| GPIO 2 | Valid ticket LED |
| GPIO 4 | Invalid ticket LED |
| GPIO 27 | Buzzer |
| UART 1 RX | QR/barcode scanner serial output |

Use a relay module with proper isolation for any real gate lock. Do not power gate hardware directly from an ESP32 GPIO pin.

## Local Testing

When the backend runs on your laptop, set `BACKEND_BASE_URL` to your laptop LAN IP, not `localhost`, because `localhost` on the ESP32 means the ESP32 itself.

Example:

```python
BACKEND_BASE_URL = "http://192.168.1.10:3000"
```

Then scan or send a ticket id. The board prints `VALID` or `INVALID`, and the dashboard scan log should update for the selected controller device.
