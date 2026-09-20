"""Application configuration — local-first, zero cloud required."""
from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve project root (repo root containing backend/, data/, etc.)
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


def _default_data_dir() -> Path:
    env = os.environ.get("CARWASH_DATA_DIR")
    if env:
        return Path(env)
    # Portable / dev mode
    return PROJECT_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CARWASH_", env_file=".env", extra="ignore")

    app_name: str = "Car Wash Manager"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8787

    # Paths
    data_dir: Path = _default_data_dir()
    database_url: str = ""
    secret_key: str = ""
    session_cookie_name: str = "carwash_session"
    session_max_age: int = 60 * 60 * 12  # 12 hours
    csrf_header: str = "X-CSRF-Token"

    # Locale defaults (South Africa)
    currency: str = "ZAR"
    currency_symbol: str = "R"
    timezone: str = "Africa/Johannesburg"
    date_format: str = "DD/MM/YYYY"
    locale: str = "en-ZA"

    # Security
    bcrypt_rounds: int = 12
    cors_origins: list[str] = ["http://localhost:8787", "http://127.0.0.1:8787", "http://localhost:5173"]

    # Logging
    log_level: str = "INFO"

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "uploads").mkdir(parents=True, exist_ok=True)
        logs = PROJECT_ROOT / "logs"
        logs.mkdir(parents=True, exist_ok=True)
        backups = PROJECT_ROOT / "backups"
        backups.mkdir(parents=True, exist_ok=True)
        uploads = PROJECT_ROOT / "uploads"
        uploads.mkdir(parents=True, exist_ok=True)

        if not self.database_url:
            db_path = (self.data_dir / "carwash.db").resolve()
            self.database_url = f"sqlite:///{db_path}"

        secret_file = self.data_dir / ".secret_key"
        if not self.secret_key:
            if secret_file.exists():
                self.secret_key = secret_file.read_text(encoding="utf-8").strip()
            else:
                self.secret_key = secrets.token_urlsafe(48)
                secret_file.write_text(self.secret_key, encoding="utf-8")
                try:
                    secret_file.chmod(0o600)
                except OSError:
                    pass

    @property
    def logs_dir(self) -> Path:
        return PROJECT_ROOT / "logs"

    @property
    def backups_dir(self) -> Path:
        return PROJECT_ROOT / "backups"

    @property
    def uploads_dir(self) -> Path:
        return PROJECT_ROOT / "uploads"

    @property
    def frontend_dist(self) -> Path:
        return PROJECT_ROOT / "frontend" / "dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
