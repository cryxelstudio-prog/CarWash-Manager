"""API helpers."""
from __future__ import annotations

from fastapi import HTTPException


def not_found(msg: str = "Not found"):
    raise HTTPException(status_code=404, detail=msg)


def bad_request(msg: str):
    raise HTTPException(status_code=400, detail=msg)
