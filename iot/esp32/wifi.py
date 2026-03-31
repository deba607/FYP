"""MicroPython WiFi helper for ESP32."""

import importlib
import time


def connect_wifi(ssid: str, password: str, timeout_seconds: int = 15):
    network = importlib.import_module("network")
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        return wlan

    wlan.connect(ssid, password)
    start = time.time()
    while not wlan.isconnected():
        if (time.time() - start) > timeout_seconds:
            raise TimeoutError("WiFi connection timed out")
        time.sleep(0.25)

    return wlan
