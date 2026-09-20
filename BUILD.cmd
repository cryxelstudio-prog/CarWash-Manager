@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist logs mkdir logs
set LOG=%CD%\logs\build.log
echo === Car Wash Manager BUILD === > "%LOG%"
echo === Car Wash Manager BUILD ===
echo Log: %LOG%

call "%~dp0scripts\pick-python.cmd"
if errorlevel 2 (
  echo ERROR: Need Python 3.11-3.13. Python 3.14 is not supported yet.
  echo Install 3.11 from https://www.python.org/downloads/ or use: py -3.11
  echo ERROR: unsupported python>> "%LOG%"
  pause
  exit /b 1
)
if errorlevel 1 (
  echo ERROR: Python not found. Install Python 3.11 and tick Add to PATH.
  echo ERROR: Python not found>> "%LOG%"
  pause
  exit /b 1
)

if defined PYLAUNCHER (
  echo Using: py -%PYLAUNCHER%
  echo Using: py -%PYLAUNCHER%>> "%LOG%"
  py -%PYLAUNCHER% --version
  py -%PYLAUNCHER% --version >> "%LOG%" 2>&1
) else (
  echo Using: %PYEXE%
  echo Using: %PYEXE%>> "%LOG%"
  %PYEXE% --version
  %PYEXE% --version >> "%LOG%" 2>&1
)

where npm >nul 2>&1 || (
  echo ERROR: npm/Node.js not found. Install Node 18+ from https://nodejs.org/
  echo ERROR: npm not found>> "%LOG%"
  pause
  exit /b 1
)

if exist .venv (
  echo Removing old .venv so it matches the selected Python...
  rmdir /s /q .venv 2>nul
)

echo Creating virtual environment...
if defined PYLAUNCHER (
  py -%PYLAUNCHER% -m venv .venv >> "%LOG%" 2>&1
) else (
  %PYEXE% -m venv .venv >> "%LOG%" 2>&1
)
if errorlevel 1 (
  echo ERROR: venv failed. See %LOG%
  type "%LOG%"
  pause
  exit /b 1
)

set VPY=%CD%\.venv\Scripts\python.exe
if not exist "%VPY%" (
  echo ERROR: venv python missing at %VPY%
  pause
  exit /b 1
)

echo Installing Python packages...
"%VPY%" -m pip install --upgrade pip >> "%LOG%" 2>&1
"%VPY%" -m pip install -r requirements.txt >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: pip install failed. See %LOG%
  echo ---- last 40 log lines ----
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 40"
  pause
  exit /b 1
)

echo Building frontend...
pushd frontend
call npm install >> "..\logs\build.log" 2>&1
if errorlevel 1 (
  echo ERROR: npm install failed. See %LOG%
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 40"
  popd
  pause
  exit /b 1
)
call npm run build >> "..\logs\build.log" 2>&1
if errorlevel 1 (
  echo ERROR: frontend build failed. See %LOG%
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 40"
  popd
  pause
  exit /b 1
)
popd

if not exist data mkdir data
if not exist backups mkdir backups
if not exist uploads mkdir uploads

set PYTHONPATH=%CD%\backend
set CARWASH_DATA_DIR=%CD%\data
echo Running tests...
"%VPY%" -m pytest -q >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: tests failed. See %LOG%
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 60"
  pause
  exit /b 1
)

echo.
echo BUILD complete. Next: double-click Run.cmd then open http://localhost:8787
echo BUILD complete.>> "%LOG%"
pause
exit /b 0
