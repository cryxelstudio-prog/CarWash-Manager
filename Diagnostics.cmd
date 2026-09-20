@echo off
setlocal
cd /d "%~dp0"
echo === Diagnostics ===
python --version
node --version
npm --version
if exist .venv (echo venv: OK) else (echo venv: MISSING)
if exist frontend\dist\index.html (echo frontend dist: OK) else (echo frontend dist: MISSING)
curl -s http://127.0.0.1:8787/health || echo Server not responding on 8787
pause
