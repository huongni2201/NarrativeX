<#
.SYNOPSIS
    Health and capability probe for NarrativeX GPU Worker.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [string]$HostUrl = "http://127.0.0.1:8010"
)

$ErrorActionPreference = "Continue"

Write-Host "=== GPU Status (nvidia-smi) ===" -ForegroundColor Cyan
nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader

# Read token from .env
$envFile = "$InstallDir\.env"
$token = ""
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*GENERATION_SERVICE_MACHINE_TOKEN\s*=\s*(.*)$") {
            $token = $matches[1].Trim()
        }
    }
}

Write-Host ""
Write-Host "=== Worker API Capabilities ($HostUrl) ===" -ForegroundColor Cyan
try {
    $headers = @{
        "Accept" = "application/vnd.narrativex.compute.v1+json"
    }
    if ($token) {
        $headers["Authorization"] = "Bearer $token"
    }
    $response = Invoke-RestMethod -Uri "$HostUrl/v1/capabilities" -Headers $headers -Method GET -TimeoutSec 5
    Write-Host "Worker Status: HEALTHY" -ForegroundColor Green
    Write-Host "Protocol Version: $($response.protocolVersion)"
    Write-Host ""
    Write-Host "Available Executors:" -ForegroundColor Yellow
    foreach ($name in $response.executors.PSObject.Properties.Name) {
        $exec = $response.executors.$name
        $status = if ($exec.ready) { "READY" } else { "NOT READY" }
        Write-Host " - ${name} : $status (tasks: $($exec.taskTypes -join ', '))"
    }
} catch {
    Write-Error "Failed to probe worker capabilities at ${HostUrl}: $_"
}
