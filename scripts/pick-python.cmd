@echo off
REM Sets PYLAUNCHER=3.11|3.12|3.13 or PYEXE=python
set PYLAUNCHER=
set PYEXE=
where py >nul 2>&1 && py -3.11 -c "import sys" >nul 2>&1 && set PYLAUNCHER=3.11&& exit /b 0
where py >nul 2>&1 && py -3.12 -c "import sys" >nul 2>&1 && set PYLAUNCHER=3.12&& exit /b 0
where py >nul 2>&1 && py -3.13 -c "import sys" >nul 2>&1 && set PYLAUNCHER=3.13&& exit /b 0
where python >nul 2>&1 || exit /b 1
for /f "usebackq tokens=*" %%V in (`python -c "import sys; print(str(sys.version_info.major)+'.'+str(sys.version_info.minor))"`) do set _PV=%%V
echo %_PV%| findstr /R "^3\.11$ ^3\.12$ ^3\.13$" >nul || exit /b 2
set PYEXE=python
exit /b 0
