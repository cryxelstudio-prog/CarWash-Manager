@echo off
setlocal
cd /d "%~dp0"
echo === Car Wash Manager BUILD ===
where python >nul 2>&1 || (echo ERROR: Python not found & pause & exit /b 1)
where npm >nul 2>&1 || (echo ERROR: npm not found & pause & exit /b 1)
if not exist .venv (
  python -m venv .venv || (echo ERROR: venv failed & pause & exit /b 1)
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo ERROR: pip install failed & pause & exit /b 1)
cd frontend
call npm install || (echo ERROR: npm install failed & pause & exit /b 1)
call npm run build || (echo ERROR: frontend build failed & pause & exit /b 1)
cd ..
if not exist data mkdir data
if not exist logs mkdir logs
if not exist backups mkdir backups
if not exist uploads mkdir uploads
set PYTHONPATH=%CD%\backend
pytest -q
echo.
echo BUILD complete. Run Run.cmd next.
pause
