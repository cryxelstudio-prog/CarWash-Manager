"""Structured logging without secrets."""
from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


SENSITIVE_KEYS = {"password", "token", "secret", "authorization", "cookie", "csrf", "api_key", "apikey"}


class RedactFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = str(record.getMessage())
        lower = msg.lower()
        for key in SENSITIVE_KEYS:
            if key in lower:
                record.msg = "[redacted log line containing sensitive key]"
                record.args = ()
                break
        return True


def setup_logging(logs_dir: Path, level: str = "INFO") -> None:
    logs_dir.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers.clear()

    fmt = logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    redact = RedactFilter()

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    console.addFilter(redact)
    root.addHandler(console)

    for name in ("app", "security", "integration", "db", "auth", "startup"):
        fh = RotatingFileHandler(logs_dir / f"{name}.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        fh.setFormatter(fmt)
        fh.addFilter(redact)
        logging.getLogger(name).addHandler(fh)
        logging.getLogger(name).propagate = True

    logging.getLogger("startup").info("Logging initialised")
