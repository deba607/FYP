from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from requests import Response

from utils.helpers import RetryPolicy, run_with_retry


@dataclass
class HTTPClientConfig:
    base_url: str
    timeout_seconds: float = 6.0
    retry_attempts: int = 3
    retry_base_delay_seconds: float = 0.75
    verify_tls: bool = True
    default_headers: Optional[Dict[str, str]] = None


class HTTPClient:
    """HTTP client with retries for intermittent network issues."""

    def __init__(self, config: HTTPClientConfig, logger) -> None:
        self.config = config
        self.logger = logger
        self.session = requests.Session()
        if config.default_headers:
            self.session.headers.update(config.default_headers)

    def _should_retry(self, exc: Exception) -> bool:
        if isinstance(exc, requests.Timeout):
            return True
        if isinstance(exc, requests.ConnectionError):
            return True
        if isinstance(exc, requests.HTTPError):
            response = getattr(exc, "response", None)
            if response is not None and response.status_code >= 500:
                return True
        return False

    def post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.config.base_url.rstrip('/')}/{path.lstrip('/')}"
        policy = RetryPolicy(
            attempts=self.config.retry_attempts,
            base_delay_seconds=self.config.retry_base_delay_seconds,
        )

        def _execute() -> Dict[str, Any]:
            response: Response = self.session.post(
                url,
                json=payload,
                timeout=self.config.timeout_seconds,
                verify=self.config.verify_tls,
            )
            if response.status_code >= 400:
                error = requests.HTTPError(
                    f"HTTP {response.status_code} for {url}",
                    response=response,
                )
                raise error
            return self._decode_json(response)

        self.logger.debug("Sending POST request to %s", url)
        return run_with_retry(_execute, policy, self._should_retry)

    def _decode_json(self, response: Response) -> Dict[str, Any]:
        try:
            return response.json()
        except json.JSONDecodeError as exc:
            raise ValueError(f"Response was not valid JSON: {response.text[:160]}") from exc
