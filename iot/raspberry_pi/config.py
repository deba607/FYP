from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


@dataclass(frozen=True)
class RaspberryPiConfig:
    device_id: str
    transport: str
    backend_base_url: str
    verify_endpoint: str
    api_auth_token: Optional[str]

    # MQTT settings
    mqtt_broker_host: str
    mqtt_broker_port: int
    mqtt_username: Optional[str]
    mqtt_password: Optional[str]

    # Scanner settings
    camera_index: int
    scan_interval_seconds: float

    # Gate settings
    gate_open_seconds: float
    servo_pin: int
    invalid_led_pin: Optional[int]
    hardware_mode: str

    # General
    log_level: str
    tls_verify: bool


def _load_env() -> None:
    root_dir = Path(__file__).resolve().parent.parent
    env_file = root_dir / ".env"
    if load_dotenv and env_file.exists():
        load_dotenv(dotenv_path=env_file)


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_config() -> RaspberryPiConfig:
    _load_env()

    device_id = os.getenv("IOT_DEVICE_ID", "bharat-rpi-001")
    transport = os.getenv("IOT_TRANSPORT", "http").lower()

    return RaspberryPiConfig(
        device_id=device_id,
        transport=transport,
        backend_base_url=os.getenv("IOT_BACKEND_BASE_URL", "http://localhost:3000"),
        verify_endpoint=os.getenv("IOT_VERIFY_ENDPOINT", "/api/verify-ticket"),
        api_auth_token=os.getenv("IOT_API_AUTH_TOKEN"),
        mqtt_broker_host=os.getenv("IOT_MQTT_BROKER_HOST", "localhost"),
        mqtt_broker_port=int(os.getenv("IOT_MQTT_BROKER_PORT", "1883")),
        mqtt_username=os.getenv("IOT_MQTT_USERNAME") or None,
        mqtt_password=os.getenv("IOT_MQTT_PASSWORD") or None,
        camera_index=int(os.getenv("IOT_CAMERA_INDEX", "0")),
        scan_interval_seconds=float(os.getenv("IOT_SCAN_INTERVAL_SECONDS", "0.25")),
        gate_open_seconds=float(os.getenv("IOT_GATE_OPEN_SECONDS", "3")),
        servo_pin=int(os.getenv("IOT_SERVO_PIN", "18")),
        invalid_led_pin=(
            int(os.getenv("IOT_INVALID_LED_PIN"))
            if os.getenv("IOT_INVALID_LED_PIN")
            else None
        ),
        hardware_mode=os.getenv("IOT_HARDWARE_MODE", "auto").lower(),
        log_level=os.getenv("IOT_LOG_LEVEL", "INFO"),
        tls_verify=_get_bool("IOT_TLS_VERIFY", True),
    )
