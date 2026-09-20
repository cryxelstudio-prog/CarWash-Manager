@echo off
setlocal
cd /d "%~dp0"
echo Portable mode: use BUILD.cmd + Run.cmd from this folder.
echo Optional copy to Program Files\CarWashManager
set TARGET=%ProgramFiles%\CarWashManager
if not exist "%TARGET%" mkdir "%TARGET%"
xcopy /E /I /Y "%CD%\*" "%TARGET%\" >nul
echo Installed files to %TARGET%
pause
