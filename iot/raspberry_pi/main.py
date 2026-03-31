from __future__ import annotations

import signal
import sys
import time
from typing import Optional

from raspberry_pi.api_client import TicketValidationClient
from raspberry_pi.config import load_config
from raspberry_pi.gate_control import GateController
from raspberry_pi.scanner import QRScanner
from utils.helpers import parse_qr_payload
from utils.logger import setup_logger


class TicketingDeviceApp:
    """Main orchestrator for scan -> validate -> actuate gate flow."""

    def __init__(self) -> None:
        self.config = load_config()
        self.logger = setup_logger(
            name="bharat_iot_device",
            device_id=self.config.device_id,
            log_level=self.config.log_level,
        )

        self.scanner = QRScanner(
            camera_index=self.config.camera_index,
            scan_interval_seconds=self.config.scan_interval_seconds,
            logger=self.logger,
        )

        self.gate = GateController(
            servo_pin=self.config.servo_pin,
            invalid_led_pin=self.config.invalid_led_pin,
            hardware_mode=self.config.hardware_mode,
            logger=self.logger,
        )

        self.api = TicketValidationClient(config=self.config, logger=self.logger)
        self._running = True
        self._last_ticket_id: Optional[str] = None
        self._last_ticket_ts = 0.0

    def start(self) -> None:
        self.logger.info("Starting Bharat Museum IoT device")
        self.api.connect()
        self.scanner.start()
        self._register_signal_handlers()

        while self._running:
            try:
                payload = self.scanner.wait_for_scan()
                if not payload:
                    continue

                ticket_id, metadata = parse_qr_payload(payload)
                if not ticket_id:
                    self.logger.warning("Invalid QR payload: %s", payload)
                    self.gate.signal_invalid_ticket()
                    continue

                if self._is_duplicate_scan(ticket_id):
                    self.logger.info("Duplicate scan ignored: ticketId=%s", ticket_id)
                    continue

                self.logger.info("Ticket scanned: ticketId=%s meta=%s", ticket_id, metadata)
                valid, response = self.api.verify_ticket(ticket_id)

                if valid:
                    self.logger.info("Ticket valid. Opening gate: ticketId=%s", ticket_id)
                    self.gate.pulse_open(self.config.gate_open_seconds)
                else:
                    self.logger.warning(
                        "Ticket invalid. Access denied: ticketId=%s response=%s",
                        ticket_id,
                        response,
                    )
                    self.gate.signal_invalid_ticket()

                self._remember_scan(ticket_id)

            except Exception as exc:
                self.logger.exception("Processing error: %s", exc)
                # Delay briefly to avoid rapid fault loops if camera/network is down.
                time.sleep(1.0)

        self.shutdown()

    def shutdown(self) -> None:
        self.logger.info("Shutting down Bharat Museum IoT device")
        try:
            self.scanner.stop()
        finally:
            self.api.close()
            self.gate.cleanup()

    def _remember_scan(self, ticket_id: str) -> None:
        self._last_ticket_id = ticket_id
        self._last_ticket_ts = time.time()

    def _is_duplicate_scan(self, ticket_id: str) -> bool:
        if self._last_ticket_id != ticket_id:
            return False
        return (time.time() - self._last_ticket_ts) <= 2.0

    def _register_signal_handlers(self) -> None:
        def _handle_signal(_signal_num, _frame):
            self._running = False

        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)


def main() -> None:
    app = TicketingDeviceApp()
    app.start()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
