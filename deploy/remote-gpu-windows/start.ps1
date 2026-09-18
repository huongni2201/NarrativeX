<#
.SYNOPSIS
    Start the NarrativeX GPU Worker on Windows.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [switch]$Foreground
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$InstallDir\.env")) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if (Test-Path "$scriptDir\.env") {
        $InstallDir = $scriptDir
    } else {
        Write-Error "Could not find .env in $InstallDir. Please run bootstrap.ps1 first."
    }
}

$pidFile = "$InstallDir\.runtime\worker.pid"
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
        Write-Host "Worker is already running with PID $oldPid." -ForegroundColor Green
        exit 0
    }
}

$pythonExe = "$InstallDir\.venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Python executable not found at $pythonExe. Run bootstrap.ps1 first."
}

# Parse .env
Get-Content "$InstallDir\.env" | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

$port = [System.Environment]::GetEnvironmentVariable("GENERATION_SERVICE_PORT")
if (-not $port) { $port = "8010" }

Write-Host "Starting NarrativeX GPU Worker on port $port..." -ForegroundColor Yellow

if ($Foreground) {
    & "$pythonExe" -m narrativex_gpu_worker.main
} else {
    $stdoutLog = "$InstallDir\logs\worker.log"
    $stderrLog = "$InstallDir\logs\worker.err.log"

    $proc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m", "narrativex_gpu_worker.main" `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    Set-Content -Path $pidFile -Value $proc.Id -Force
    Write-Host "Worker started in background (PID=$($proc.Id))." -ForegroundColor Green
    Write-Host "Logs: $stdoutLog"
}
