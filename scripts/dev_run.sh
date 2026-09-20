#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT/backend"
export CARWASH_DATA_DIR="${CARWASH_DATA_DIR:-$ROOT/data}"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  # shellcheck disable=SC1091
  . .venv/bin/activate
  pip install -r requirements.txt
else
  # shellcheck disable=SC1091
  . .venv/bin/activate
fi
if [[ ! -d frontend/node_modules ]]; then
  (cd frontend && npm install)
fi
if [[ ! -f frontend/dist/index.html ]]; then
  (cd frontend && npm run build)
fi
mkdir -p data logs backups uploads
echo "Starting Car Wash Manager on http://127.0.0.1:${CARWASH_PORT:-8787}"
exec python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "${CARWASH_PORT:-8787}"
