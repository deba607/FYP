from __future__ import annotations

import threading
import time
from typing import Optional


class GateController:
    """Controls a gate servo and optional invalid-ticket LED indicator."""

    def __init__(
        self,
        servo_pin: int,
        invalid_led_pin: Optional[int],
        hardware_mode: str,
        logger,
    ) -> None:
        self.servo_pin = servo_pin
        self.invalid_led_pin = invalid_led_pin
        self.hardware_mode = hardware_mode
        self.logger = logger
        self._lock = threading.Lock()

        self._servo = None
        self._led = None
        self._gpio_mode = "mock"

        self._init_hardware()

    def _init_hardware(self) -> None:
        if self.hardware_mode == "mock":
            self.logger.warning("Gate controller running in mock mode")
            return

        try:
            from gpiozero import LED, Servo  # type: ignore

            self._servo = Servo(self.servo_pin)
            if self.invalid_led_pin is not None:
                self._led = LED(self.invalid_led_pin)
            self._gpio_mode = "gpiozero"
            self.logger.info("Gate controller initialized with gpiozero")
            return
        except Exception as exc:
            self.logger.warning("gpiozero init failed: %s", exc)
            if self.hardware_mode == "gpiozero":
                raise

        try:
            import RPi.GPIO as GPIO  # type: ignore

            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.servo_pin, GPIO.OUT)
            self._pwm = GPIO.PWM(self.servo_pin, 50)
            self._pwm.start(0)

            if self.invalid_led_pin is not None:
                GPIO.setup(self.invalid_led_pin, GPIO.OUT)
                GPIO.output(self.invalid_led_pin, GPIO.LOW)

            self._gpio = GPIO
            self._gpio_mode = "rpi_gpio"
            self.logger.info("Gate controller initialized with RPi.GPIO")
        except Exception as exc:
            self.logger.warning("RPi.GPIO init failed: %s", exc)
            if self.hardware_mode in {"rpi_gpio", "auto"}:
                self.logger.warning("Falling back to mock gate control")
            self._gpio_mode = "mock"

    def open_gate(self) -> None:
        with self._lock:
            if self._gpio_mode == "gpiozero":
                self._servo.max()
            elif self._gpio_mode == "rpi_gpio":
                self._set_servo_angle(90)
            self.logger.info("Gate opened")

    def close_gate(self) -> None:
        with self._lock:
            if self._gpio_mode == "gpiozero":
                self._servo.min()
            elif self._gpio_mode == "rpi_gpio":
                self._set_servo_angle(0)
            self.logger.info("Gate closed")

    def pulse_open(self, open_seconds: float) -> None:
        self.open_gate()
        time.sleep(open_seconds)
        self.close_gate()

    def signal_invalid_ticket(self, duration_seconds: float = 1.0) -> None:
        if self._gpio_mode == "gpiozero" and self._led is not None:
            self._led.on()
            time.sleep(duration_seconds)
            self._led.off()
        elif self._gpio_mode == "rpi_gpio" and self.invalid_led_pin is not None:
            self._gpio.output(self.invalid_led_pin, self._gpio.HIGH)
            time.sleep(duration_seconds)
            self._gpio.output(self.invalid_led_pin, self._gpio.LOW)
        self.logger.warning("Invalid ticket indication triggered")

    def cleanup(self) -> None:
        if self._gpio_mode == "gpiozero":
            if self._led is not None:
                self._led.close()
            if self._servo is not None:
                self._servo.close()
        elif self._gpio_mode == "rpi_gpio":
            self._pwm.stop()
            self._gpio.cleanup()
        self.logger.info("Gate controller cleaned up")

    def _set_servo_angle(self, angle: int) -> None:
        # Standard hobby servo duty-cycle transform for 50Hz PWM.
        duty_cycle = 2 + (angle / 18)
        self._pwm.ChangeDutyCycle(duty_cycle)
        time.sleep(0.35)
        self._pwm.ChangeDutyCycle(0)
