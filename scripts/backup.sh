#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
. .venv/bin/activate
export PYTHONPATH="$ROOT/backend"
export CARWASH_DATA_DIR="${CARWASH_DATA_DIR:-$ROOT/data}"
python -c "from app.services.backup import create_backup; print(create_backup())"
