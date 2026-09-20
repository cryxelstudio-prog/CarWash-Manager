"""SQLAlchemy engine and session — SQLite WAL by default."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}
engine = create_engine(
    _settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)

if _settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):  # noqa: ARG001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _column_names(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {r[1] for r in rows}


def ensure_schema_patches() -> None:
    """Lightweight SQLite column patches for upgrades without Alembic."""
    settings = get_settings()
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        if "wash_bays" not in {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}:
            return
        cols = _column_names(conn, "wash_bays")
        if "status" not in cols:
            conn.execute(text("ALTER TABLE wash_bays ADD COLUMN status VARCHAR(32) DEFAULT 'AVAILABLE'"))
        if "status_locked" not in cols:
            conn.execute(text("ALTER TABLE wash_bays ADD COLUMN status_locked BOOLEAN DEFAULT 0"))
        if "assigned_employee_id" not in cols:
            conn.execute(text("ALTER TABLE wash_bays ADD COLUMN assigned_employee_id INTEGER"))

        # users.easy_mode (v0.4.0) — nullable boolean preference
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "users" in tables:
            ucols = _column_names(conn, "users")
            if "easy_mode" not in ucols:
                conn.execute(text("ALTER TABLE users ADD COLUMN easy_mode BOOLEAN"))

        # v0.5.0 — wash ticket numbers; registration optional
        if "bookings" in tables:
            bcols = _column_names(conn, "bookings")
            if "ticket_number" not in bcols:
                conn.execute(text("ALTER TABLE bookings ADD COLUMN ticket_number VARCHAR(32)"))
                # Backfill tickets for existing rows (T-0001…)
                rows = conn.execute(text("SELECT id FROM bookings ORDER BY id")).fetchall()
                for i, (bid,) in enumerate(rows, start=1):
                    conn.execute(
                        text("UPDATE bookings SET ticket_number = :tn WHERE id = :id"),
                        {"tn": f"T-{i:04d}", "id": bid},
                    )


def init_db() -> None:
    """Create tables if needed (Alembic preferred; fallback for smoke)."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_schema_patches()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
