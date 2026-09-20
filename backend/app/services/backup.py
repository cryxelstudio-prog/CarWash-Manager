"""Backup and restore for SQLite portable mode."""
from __future__ import annotations

import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path

from app.core.config import PROJECT_ROOT, get_settings


def create_backup(label: str | None = None) -> Path:
    settings = get_settings()
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"backup-{stamp}{('-' + label) if label else ''}.zip"
    dest = settings.backups_dir / name

    db_path = Path(settings.database_url.replace("sqlite:///", ""))
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if db_path.exists():
            zf.write(db_path, arcname="carwash.db")
        for suffix in ("-wal", "-shm"):
            side = Path(str(db_path) + suffix)
            if side.exists():
                zf.write(side, arcname=side.name)
        meta = {
            "created_at": datetime.now().isoformat(),
            "version": settings.app_version,
            "app": settings.app_name,
        }
        zf.writestr("backup-meta.json", json.dumps(meta, indent=2))
        uploads = settings.uploads_dir
        if uploads.exists():
            for f in uploads.rglob("*"):
                if f.is_file():
                    zf.write(f, arcname=f"uploads/{f.relative_to(uploads)}")
    return dest


def restore_backup(backup_path: Path) -> None:
    settings = get_settings()
    if not backup_path.exists():
        raise FileNotFoundError(str(backup_path))
    db_path = Path(settings.database_url.replace("sqlite:///", ""))
    # safety copy of current DB
    if db_path.exists():
        safety = settings.backups_dir / f"pre-restore-{datetime.now().strftime('%Y%m%d-%H%M%S')}.db"
        shutil.copy2(db_path, safety)

    with zipfile.ZipFile(backup_path, "r") as zf:
        names = zf.namelist()
        if "carwash.db" not in names:
            raise ValueError("Invalid backup: missing carwash.db")
        # extract db
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with zf.open("carwash.db") as src, open(db_path, "wb") as dst:
            shutil.copyfileobj(src, dst)
        for side in ("carwash.db-wal", "carwash.db-shm"):
            side_path = Path(str(db_path) + side.replace("carwash.db", ""))
            # map correctly
            if side == "carwash.db-wal":
                side_path = Path(str(db_path) + "-wal")
            else:
                side_path = Path(str(db_path) + "-shm")
            if side in names:
                with zf.open(side) as src, open(side_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)
            elif side_path.exists():
                side_path.unlink()
        # uploads
        for name in names:
            if name.startswith("uploads/") and not name.endswith("/"):
                target = settings.uploads_dir / name[len("uploads/"):]
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(name) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)


def list_backups() -> list[dict]:
    settings = get_settings()
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for p in sorted(settings.backups_dir.glob("backup-*.zip"), reverse=True):
        items.append({"name": p.name, "path": str(p), "size": p.stat().st_size, "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat()})
    return items
