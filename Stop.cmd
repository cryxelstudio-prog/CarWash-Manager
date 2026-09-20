@echo off
cd /d "%~dp0"
echo Stopping Car Wash Manager...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8787 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Done.
pause
