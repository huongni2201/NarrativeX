<#
.SYNOPSIS
    Stop the NarrativeX GPU Worker on Windows.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$pidFile = "$InstallDir\.runtime\worker.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "Worker is not running (PID file not found at $pidFile)." -ForegroundColor Yellow
    exit 0
}

$pidVal = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $pidVal) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

$proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Host "Process $pidVal already terminated." -ForegroundColor Green
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

Write-Host "Stopping NarrativeX GPU Worker (PID $pidVal)..." -ForegroundColor Yellow
if ($Force) {
    Stop-Process -Id $pidVal -Force
} else {
    Stop-Process -Id $pidVal
    $proc.WaitForExit(10000) | Out-Null
    if (-not $proc.HasExited) {
        Write-Warning "Process did not exit within 10s, killing..."
        Stop-Process -Id $pidVal -Force
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Worker stopped successfully." -ForegroundColor Green
