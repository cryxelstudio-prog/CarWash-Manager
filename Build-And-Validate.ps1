$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "=== Build-And-Validate ==="
try {
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python not found" }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm not found" }
  if (-not (Test-Path .venv)) { python -m venv .venv }
  & .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  Push-Location frontend
  npm install
  npm run build
  Pop-Location
  $env:PYTHONPATH = Join-Path (Get-Location) "backend"
  $env:CARWASH_DATA_DIR = Join-Path (Get-Location) "data"
  pytest -q
  Write-Host "Validation OK"
} catch {
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Pause
  exit 1
}
Pause
