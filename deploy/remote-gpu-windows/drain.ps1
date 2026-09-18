<#
.SYNOPSIS
    Drain active tasks and safely stop the worker for deallocation.
#>
[CmdletBinding()]
param (
    [string]$InstallDir = "C:\NarrativeXRuntime",
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
Write-Host "Draining NarrativeX GPU Worker tasks before shutdown..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$scriptDir\stop.ps1" -InstallDir $InstallDir
Write-Host "Drained and stopped." -ForegroundColor Green
