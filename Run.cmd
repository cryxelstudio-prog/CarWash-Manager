@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Virtual environment missing. Run BUILD.cmd first.
  pause
  exit /b 1
)
if not exist frontend\dist\index.html (
  echo Frontend not built. Run BUILD.cmd first.
  pause
  exit /b 1
)
if not exist data mkdir data
if not exist logs mkdir logs
set PYTHONPATH=%CD%\backend
set CARWASH_DATA_DIR=%CD%\data
echo Starting on http://localhost:8787 ...
echo Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8787
if errorlevel 1 (
  echo Server exited with an error.
  pause
)
