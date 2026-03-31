"""ESP32 QR scanner abstraction.

Most ESP32 deployments use an external UART barcode/QR module.
This scanner expects one line per scan from UART.
"""

import importlib


class QRSerialScanner:
    def __init__(self, uart_id: int = 1, baudrate: int = 9600):
        machine = importlib.import_module("machine")
        uart_class = getattr(machine, "UART")
        self.uart = uart_class(uart_id, baudrate=baudrate)

    def wait_for_scan(self) -> str:
        while True:
            if self.uart.any():
                line = self.uart.readline()
                if line:
                    return line.decode("utf-8").strip()
