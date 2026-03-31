# Bharat Museum IoT Module

Production-ready IoT runtime for the Bharat Museum Ticketing System.

## Features

- QR code ticket scanning on Raspberry Pi (camera + OpenCV + pyzbar)
- Ticket verification with backend API (`POST /api/verify-ticket`)
- Optional MQTT request-response transport
- Gate actuation using servo (`gpiozero` or `RPi.GPIO`)
- Invalid ticket signaling through optional LED pin
- Device logging with rotating log files
- Retry logic and fault-tolerant main loop
- Optional ESP32 MicroPython implementation

## Folder Structure

```text
iot/
├── raspberry_pi/
│   ├── scanner.py
│   ├── gate_control.py
│   ├── api_client.py
│   ├── config.py
│   └── main.py
├── esp32/
│   ├── scanner.py
│   ├── wifi.py
│   ├── api_client.py
│   └── main.py
├── protocols/
│   ├── mqtt_client.py
│   └── http_client.py
├── utils/
│   ├── logger.py
│   └── helpers.py
└── README.md
```

## Raspberry Pi Setup

1. Create and activate a Python environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy and configure environment variables:

```bash
cp .env.example .env
```

4. Update `.env` values:
- `IOT_BACKEND_BASE_URL`
- `IOT_VERIFY_ENDPOINT` (default: `/api/verify-ticket`)
- `IOT_DEVICE_ID`
- `IOT_API_AUTH_TOKEN` (if backend is protected)
- GPIO pin assignments and hardware mode

## Run on Raspberry Pi

From the `iot` directory:

```bash
python -m raspberry_pi.main
```

## Runtime Flow

1. Wait for QR scan.
2. Extract `ticketId` from raw payload.
3. Send verification payload:

```json
{
  "ticketId": "...",
  "deviceId": "..."
}
```

4. Receive backend response:

```json
{
  "valid": true
}
```

5. If valid, gate opens for configured duration, then closes.
6. If invalid, gate remains closed and LED/error indication triggers.
7. All activity is logged to console and `iot/logs/device.log`.

## Error Handling

- HTTP request retries with exponential backoff for timeouts and connection errors.
- Main loop catches processing errors and continues operation.
- Camera frame read failures are retried automatically.
- Hardware initialization falls back to mock mode if GPIO libraries are unavailable.

## ESP32 (Optional)

ESP32 implementation is provided in `esp32/` for MicroPython deployments.

- `wifi.py`: WiFi connection logic
- `scanner.py`: UART-based QR scanner abstraction
- `api_client.py`: HTTP verification using `urequests`
- `main.py`: Continuous scanning and verification loop

Update constants in `esp32/main.py` before flashing.

## Security Notes

- Never commit a real `.env` file with secrets.
- Keep `IOT_API_AUTH_TOKEN` device-scoped and revocable.
- Use HTTPS backend URLs in production.
- Restrict MQTT broker access with credentials and network rules.
