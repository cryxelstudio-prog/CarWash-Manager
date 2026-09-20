@echo off
setlocal
cd /d "%~dp0"
echo === Build-And-Validate ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-And-Validate.ps1"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo FAILED with exit code %ERR%. See logs\build-validate.log if present.
  pause
  exit /b %ERR%
)
exit /b 0
