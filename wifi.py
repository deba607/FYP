"""MicroPython WiFi helper for ESP32."""

import network
import time


def connect_wifi(ssid, password, timeout_seconds=15):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        return wlan

    wlan.connect(ssid, password)

    start = time.time()

    while not wlan.isconnected():
        if (time.time() - start) > timeout_seconds:
            raise Exception("WiFi connection timed out")

        time.sleep(0.25)

    print("WiFi connected")
    print(wlan.ifconfig())

    return wlan