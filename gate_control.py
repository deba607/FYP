"""Relay, LED, and buzzer control for ESP32 MicroPython gate hardware."""

from machine import Pin
import time


class GateController:
    def __init__(
        self,
        relay_pin,
        valid_led_pin=None,
        invalid_led_pin=None,
        buzzer_pin=None,
    ):
        self.relay = Pin(relay_pin, Pin.OUT)

        self.valid_led = (
            Pin(valid_led_pin, Pin.OUT)
            if valid_led_pin is not None
            else None
        )

        self.invalid_led = (
            Pin(invalid_led_pin, Pin.OUT)
            if invalid_led_pin is not None
            else None
        )

        self.buzzer = (
            Pin(buzzer_pin, Pin.OUT)
            if buzzer_pin is not None
            else None
        )

        self.lock()

    def lock(self):
        self.relay.value(0)

        if self.valid_led:
            self.valid_led.value(0)

    def open_for(self, duration_ms):
        self.relay.value(1)

        if self.valid_led:
            self.valid_led.value(1)

        self.beep(2, 80)

        time.sleep_ms(duration_ms)

        self.lock()

    def deny(self):
        if self.invalid_led:
            self.invalid_led.value(1)

        self.beep(1, 350)

        time.sleep_ms(500)

        if self.invalid_led:
            self.invalid_led.value(0)

    def beep(self, count, duration_ms):
        if not self.buzzer:
            return

        for _ in range(count):
            self.buzzer.value(1)
            time.sleep_ms(duration_ms)

            self.buzzer.value(0)
            time.sleep_ms(80)