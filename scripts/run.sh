#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT/backend"
export CARWASH_DATA_DIR="${CARWASH_DATA_DIR:-$ROOT/data}"
# shellcheck disable=SC1091
. .venv/bin/activate
mkdir -p data logs backups uploads
exec python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "${CARWASH_PORT:-8787}"
