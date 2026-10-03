<#
.SYNOPSIS
    Start the NarrativeX GPU Worker on Windows.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [switch]$Foreground,
    [ValidateRange(1, 300)][int]$StartupTimeoutSeconds = 30
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
$bindHost = [System.Environment]::GetEnvironmentVariable("GENERATION_SERVICE_HOST")
if (-not $bindHost -or $bindHost -eq '0.0.0.0') { $bindHost = '127.0.0.1' }
$healthUrl = "http://${bindHost}:$port/health"
$pidFile = "$InstallDir\.runtime\worker.pid"
if (Test-Path -LiteralPath $pidFile) {
    $oldPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
    $existingProcess = if ($oldPid) { Get-Process -Id $oldPid -ErrorAction SilentlyContinue }
    if ($existingProcess) {
        if ($existingProcess.Path -ne $pythonExe) { throw "Worker PID file belongs to another process." }
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
        if ($health.status -ne 'ok') { throw "Existing worker is not healthy." }
        Write-Host "Worker is already running with PID $oldPid." -ForegroundColor Green
        exit 0
    }
    Remove-Item -LiteralPath $pidFile
}
& $pythonExe -c "import narrativex_gpu_worker.__main__"
if ($LASTEXITCODE) { throw "Worker package is not installed in $InstallDir\.venv." }
New-Item -ItemType Directory -Path "$InstallDir\logs", "$InstallDir\.runtime" -Force | Out-Null

Write-Host "Starting NarrativeX GPU Worker on port $port..." -ForegroundColor Yellow

if ($Foreground) {
    & "$pythonExe" -m narrativex_gpu_worker
    exit $LASTEXITCODE
} else {
    $stdoutLog = "$InstallDir\logs\worker.log"
    $stderrLog = "$InstallDir\logs\worker.err.log"

    $proc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m", "narrativex_gpu_worker" `
        -WorkingDirectory $InstallDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    $startupClock = [System.Diagnostics.Stopwatch]::StartNew()
    $healthy = $false
    while ($startupClock.Elapsed.TotalSeconds -lt $StartupTimeoutSeconds) {
        if ($proc.HasExited) { throw "Worker exited before startup completed (exit $($proc.ExitCode)). See $stderrLog." }
        try {
            $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop
            if ($health.status -eq 'ok') { $healthy = $true; break }
        } catch {
            Start-Sleep -Milliseconds 200
        }
    }
    if (-not $healthy) {
        if (-not $proc.HasExited) { $proc.Kill() }
        throw "Worker did not become healthy before the startup timeout. See $stderrLog."
    }
    if ($proc.HasExited) { throw "Worker exited during startup (exit $($proc.ExitCode))." }
    Set-Content -LiteralPath $pidFile -Value $proc.Id -Force
    Write-Host "Worker started in background (PID=$($proc.Id))." -ForegroundColor Green
    Write-Host "Logs: $stdoutLog"
}
