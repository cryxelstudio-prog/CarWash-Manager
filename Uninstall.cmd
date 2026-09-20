@echo off
setlocal
cd /d "%~dp0"
set TARGET=%ProgramFiles%\CarWashManager
if exist "%TARGET%" (
  rmdir /S /Q "%TARGET%"
  echo Removed %TARGET%
) else (
  echo No system install found.
)
pause
