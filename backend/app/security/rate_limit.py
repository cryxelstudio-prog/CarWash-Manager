"""Lightweight in-memory rate limiter for public auth endpoints."""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

_lock = Lock()
_hits: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, limit: int = 20, window_seconds: int = 60) -> bool:
    """Return True if allowed; False if rate exceeded."""
    now = time.time()
    with _lock:
        bucket = _hits[key]
        cutoff = now - window_seconds
        _hits[key] = [t for t in bucket if t >= cutoff]
        if len(_hits[key]) >= limit:
            return False
        _hits[key].append(now)
        return True


def client_key(request, suffix: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{suffix}"
