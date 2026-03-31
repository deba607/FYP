import logging
import logging.handlers
import os
from pathlib import Path
from typing import Optional

_DEFAULT_FORMAT = (
    "%(asctime)s | %(levelname)s | %(name)s | device=%(device_id)s | %(message)s"
)


class DeviceContextFilter(logging.Filter):
    """Injects a device_id into log records for consistent traceability."""

    def __init__(self, device_id: str) -> None:
        super().__init__()
        self.device_id = device_id

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "device_id"):
            record.device_id = self.device_id
        return True


def setup_logger(
    name: str,
    device_id: str,
    log_level: str = "INFO",
    log_file: Optional[str] = None,
) -> logging.Logger:
    """Create a process-safe rotating logger configured for device workloads."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if logger.handlers:
        return logger

    formatter = logging.Formatter(_DEFAULT_FORMAT)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    if log_file:
        log_path = Path(log_file)
    else:
        logs_dir = Path(__file__).resolve().parent.parent / "logs"
        log_path = logs_dir / "device.log"

    log_path.parent.mkdir(parents=True, exist_ok=True)

    file_handler = logging.handlers.RotatingFileHandler(
        filename=os.fspath(log_path),
        maxBytes=2_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    logger.addFilter(DeviceContextFilter(device_id=device_id))
    logger.propagate = False
    return logger
