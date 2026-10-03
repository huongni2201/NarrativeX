<#
.SYNOPSIS
    Health and capability probe for NarrativeX GPU Worker.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [string]$HostUrl = "http://127.0.0.1:8010",
    [string[]]$RequiredExecutors = @('ltx')
)

$ErrorActionPreference = "Stop"

Write-Host "=== GPU Status (nvidia-smi) ===" -ForegroundColor Cyan
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader
} else {
    Write-Warning "nvidia-smi is unavailable; GPU readiness has not been verified."
}

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
        "Accept" = "application/vnd.narrativex.compute-v1+json"
    }
    if ($token) {
        $headers["Authorization"] = "Bearer $token"
    }
    $response = Invoke-RestMethod -Uri "$HostUrl/v1/capabilities" -Headers $headers -Method GET -TimeoutSec 5
    if ('1.0' -notin $response.protocolVersions) { throw "Unsupported Compute Protocol version." }
    Write-Host "Worker service: ALIVE" -ForegroundColor Green
    Write-Host "Protocol Versions: $($response.protocolVersions -join ', ')"
    Write-Host ""
    Write-Host "Available Executors:" -ForegroundColor Yellow
    foreach ($exec in $response.executors) {
        $status = if ($exec.ready) { "READY" } else { "NOT READY" }
        Write-Host " - $($exec.name): $status (tasks: $($exec.taskTypes -join ', '))"
    }
    foreach ($name in $RequiredExecutors) {
        $executor = @($response.executors | Where-Object { $_.name -eq $name -and $_.ready })
        if ($executor.Count -eq 0) { throw "Required executor $name is NOT READY." }
        if ($name -eq 'ltx' -and 'video.generate' -notin $executor[0].taskTypes) { throw "LTX video generation is not advertised." }
        if ($name -eq 'ltx') {
            $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'models.lock.json') -Raw | ConvertFrom-Json
            if ($manifest.ltx_manifest_status -ne 'PROVISIONED' -or @($manifest.models | Where-Object { $_.executor -eq 'ltx' }).Count -eq 0) {
                throw "LTX model manifest is NOT PROVISIONED; video readiness cannot be verified."
            }
            $profile = @($executor[0].workflowProfiles | Where-Object { $_.profileId -eq $manifest.ltx_profile_id })
            if ($profile.Count -ne 1 -or -not $profile[0].nativeAudio -or -not $profile[0].t2v -or $profile[0].voiceConditioning -or $profile[0].i2v -or $profile[0].firstLastFrame) {
                throw "Pinned native T2V capability profile mismatch."
            }
            if ('1.1' -notin $executor[0].taskSchemaVersions.'video.generate') {
                throw "Closed native video schema 1.1 is not advertised."
            }
        }
    }
    exit 0
} catch {
    Write-Host "Worker readiness probe failed at ${HostUrl}: $_" -ForegroundColor Red
    exit 1
}
