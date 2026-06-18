"""ESP32 QR scanner abstraction.

Most ESP32 deployments use an external UART barcode/QR module.
This scanner expects one line per scan from UART.
"""

from machine import UART


class QRSerialScanner:
    def __init__(self, uart_id=1, baudrate=9600):
        self.uart = UART(uart_id, baudrate=baudrate)

    def wait_for_scan(self):
        while True:
            if self.uart.any():
                line = self.uart.readline()

                if line:
                    return line.decode("utf-8").strip()