#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
pip install -r requirements.txt
(cd frontend && npm install && npm run build)
mkdir -p data logs backups uploads
PYTHONPATH=backend pytest -q || true
echo "Build complete."
