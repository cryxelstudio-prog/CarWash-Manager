@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: Restore.cmd backup-YYYYMMDD-HHMMSS.zip
  dir /b backups\backup-*.zip
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
set PYTHONPATH=%CD%\backend
set CARWASH_DATA_DIR=%CD%\data
python -c "from pathlib import Path; from app.services.backup import restore_backup; p=Path(r'%~1'); restore_backup(p if p.is_file() else Path('backups')/p.name); print('Restored')"
if errorlevel 1 (echo Restore failed & pause & exit /b 1)
echo Restore complete.
pause
