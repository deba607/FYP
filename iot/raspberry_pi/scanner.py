from __future__ import annotations

import importlib
import time
from typing import Optional


class QRScanner:
    """Camera-based QR scanner for Raspberry Pi ticket checkpoints."""

    def __init__(self, camera_index: int, scan_interval_seconds: float, logger) -> None:
        self.camera_index = camera_index
        self.scan_interval_seconds = scan_interval_seconds
        self.logger = logger
        self._capture = None
        self._cv2 = None
        self._decode = None

    def start(self) -> None:
        self._cv2 = importlib.import_module("cv2")
        pyzbar_module = importlib.import_module("pyzbar.pyzbar")
        self._decode = getattr(pyzbar_module, "decode")

        self._capture = self._cv2.VideoCapture(self.camera_index)
        if not self._capture.isOpened():
            raise RuntimeError(f"Unable to open camera index {self.camera_index}")
        self.logger.info("QR scanner camera initialized")

    def stop(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
            self.logger.info("QR scanner camera released")

    def wait_for_scan(self) -> Optional[str]:
        if self._capture is None:
            raise RuntimeError("Scanner is not started")

        while True:
            ok, frame = self._capture.read()
            if not ok:
                self.logger.warning("Camera frame read failed; retrying")
                time.sleep(self.scan_interval_seconds)
                continue

            decoded = self._decode(frame)
            if decoded:
                qr_bytes = decoded[0].data
                payload = qr_bytes.decode("utf-8", errors="ignore").strip()
                if payload:
                    return payload
                self.logger.warning("QR decoded but empty payload was received")

            time.sleep(self.scan_interval_seconds)
