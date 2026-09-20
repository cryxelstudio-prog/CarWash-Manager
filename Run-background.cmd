@echo off
setlocal
cd /d "%~dp0"
REM Portable headless start for any Windows PC (no console window required).
if not exist .venv\Scripts\python.exe (
  echo Virtual environment missing. Run BUILD.cmd first.
  exit /b 1
)
if not exist frontend\dist\index.html (
  echo Frontend not built. Run BUILD.cmd first.
  exit /b 1
)
if not exist data mkdir data
if not exist logs mkdir logs
set PYTHONPATH=%CD%\backend
set CARWASH_DATA_DIR=%CD%\data
echo Starting Car Wash Manager in background on http://localhost:8787 ...
start "CarWash-Manager" /MIN ".venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8787
echo Started. Open http://localhost:8787
exit /b 0
