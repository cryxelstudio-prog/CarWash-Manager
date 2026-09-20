@echo off
setlocal
cd /d "%~dp0"
call .venv\Scripts\activate.bat
set PYTHONPATH=%CD%\backend
set CARWASH_DATA_DIR=%CD%\data
python -c "from app.services.backup import create_backup; print(create_backup())"
if errorlevel 1 (echo Backup failed & pause & exit /b 1)
echo Backup created in backups\
pause
