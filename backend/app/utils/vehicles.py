"""Vehicle display helpers — description-first, plate optional."""
from __future__ import annotations

from typing import Any


def vehicle_description(vehicle: Any | None) -> str | None:
    """Human label like 'White Polo' from colour + make + model."""
    if not vehicle:
        return None
    colour = (getattr(vehicle, "colour", None) or "").strip()
    make = (getattr(vehicle, "make", None) or "").strip()
    model = (getattr(vehicle, "model", None) or "").strip()
    make_model = f"{make} {model}".strip()
    if colour and make_model:
        return f"{colour} {make_model}"
    if make_model:
        return make_model
    if colour:
        return colour
    size = (getattr(vehicle, "size", None) or "").strip()
    return size.replace("_", " ").title() if size else None


def normalize_registration(value: str | None) -> str | None:
    """Uppercase plate or None when blank (never use plate as required id)."""
    if value is None:
        return None
    cleaned = str(value).strip().upper()
    return cleaned or None
