$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
$log = Join-Path $PSScriptRoot "logs\build-validate.log"
function Log([string]$msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -Path $log -Value $line
  Write-Host $msg
}

Log "=== Build-And-Validate ==="
try {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm/Node.js not found. Install Node 18+ from https://nodejs.org/" }

  $pyCmd = $null
  $pyArgs = @()
  foreach ($ver in @("3.11", "3.12", "3.13")) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
      & py "-$ver" -c "import sys" 2>$null
      if ($LASTEXITCODE -eq 0) {
        $pyCmd = "py"
        $pyArgs = @("-$ver")
        break
      }
    }
  }
  if (-not $pyCmd) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
      throw "Python 3.11–3.13 not found. Install from https://www.python.org/downloads/ (tick 'Add to PATH')."
    }
    $verOut = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ($verOut -notmatch '^3\.(11|12|13)$') {
      throw "Need Python 3.11–3.13. Found $verOut (Python 3.14 is not supported yet)."
    }
    $pyCmd = "python"
    $pyArgs = @()
  }

  Log "Using: $pyCmd $($pyArgs -join ' ')"
  & $pyCmd @pyArgs --version | ForEach-Object { Log $_ }

  if (Test-Path .venv) {
    Log "Removing old .venv to match selected Python..."
    Remove-Item -Recurse -Force .venv
  }
  Log "Creating venv..."
  & $pyCmd @pyArgs -m venv .venv
  $vpy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
  if (-not (Test-Path $vpy)) { throw "venv python missing at $vpy" }

  Log "pip install..."
  & $vpy -m pip install --upgrade pip
  & $vpy -m pip install -r requirements.txt

  Push-Location frontend
  try {
    Log "npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Log "npm run build..."
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  } finally {
    Pop-Location
  }

  foreach ($d in @("data", "logs", "backups", "uploads")) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
  }

  $env:PYTHONPATH = Join-Path $PSScriptRoot "backend"
  $env:CARWASH_DATA_DIR = Join-Path $PSScriptRoot "data"
  Log "Running pytest..."
  & $vpy -m pytest -q
  if ($LASTEXITCODE -ne 0) { throw "pytest failed (exit $LASTEXITCODE)" }

  Log "Validation OK"
  Write-Host ""
  Write-Host "Next: double-click Run.cmd then open http://localhost:8787"
} catch {
  Log "FAILED: $($_.Exception.Message)"
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Full log: $log"
  Pause
  exit 1
}
Pause
