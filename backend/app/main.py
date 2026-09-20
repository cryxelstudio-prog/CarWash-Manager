"""Car Wash Management Platform — FastAPI application."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import PROJECT_ROOT, get_settings
from app.core.database import SessionLocal, init_db
from app.core.logging_config import setup_logging
from app.schemas.common import HealthOut
from app.services.bootstrap import ensure_bootstrap, setup_required

logger = logging.getLogger("startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.logs_dir, settings.log_level)
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    init_db()
    db = SessionLocal()
    try:
        ensure_bootstrap(db)
    finally:
        db.close()
    logger.info("Application ready on port %s", settings.port)
    yield
    logger.info("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        logging.getLogger("app").exception("Unhandled error on %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred. Please try again or check Diagnostics."})

    @app.get("/health", response_model=HealthOut, tags=["health"])
    def health():
        db = SessionLocal()
        try:
            needed = setup_required(db)
            db_status = "ok"
            try:
                from sqlalchemy import text
                db.execute(text("SELECT 1"))
            except Exception:
                db_status = "error"
        finally:
            db.close()
        return HealthOut(
            status="ok" if db_status == "ok" else "degraded",
            version=settings.app_version,
            database=db_status,
            timezone=settings.timezone,
            setup_required=needed,
            timestamp=datetime.utcnow(),
        )

    app.include_router(api_router)

    # Serve built SPA
    dist = settings.frontend_dist
    if dist.exists():
        assets = dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{full_path:path}")
        async def spa(full_path: str):
            # don't swallow API
            if full_path.startswith("api") or full_path == "health":
                return JSONResponse({"detail": "Not found"}, status_code=404)
            candidate = dist / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(candidate)
            index = dist / "index.html"
            if index.exists():
                return FileResponse(index)
            return JSONResponse({"detail": "Frontend not built"}, status_code=404)

    return app


app = create_app()
