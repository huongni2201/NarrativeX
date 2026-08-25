[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot

function Resolve-Executable {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) {
      return $command.Source
    }
  }

  throw "Required executable not found. Tried: $($Candidates -join ', ')"
}

function Invoke-NativeStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Write-Host "$Executable $($Arguments -join ' ')"

  $exitCode = 0
  Push-Location $WorkingDirectory
  try {
    & $Executable @Arguments
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode."
  }
}

try {
  $python = Resolve-Executable @("python")

  Invoke-NativeStep `
    -Name "Secret scan" `
    -Executable $python `
    -Arguments @("scripts/check-secrets.py") `
    -WorkingDirectory $repoRoot

  Invoke-NativeStep `
    -Name "Backend Maven verify" `
    -Executable (Join-Path $repoRoot "app/backend-service/mvnw.cmd") `
    -Arguments @("verify") `
    -WorkingDirectory (Join-Path $repoRoot "app/backend-service")

  $npm = Resolve-Executable @("npm.cmd", "npm")
  $workerDirectory = Join-Path $repoRoot "app/ai-worker"
  Invoke-NativeStep -Name "AI worker tests" -Executable $python -Arguments @("-m", "pytest") -WorkingDirectory $workerDirectory
  Invoke-NativeStep -Name "AI worker Ruff" -Executable $python -Arguments @("-m", "ruff", "check", ".") -WorkingDirectory $workerDirectory
  Invoke-NativeStep -Name "AI worker mypy" -Executable $python -Arguments @("-m", "mypy", "src") -WorkingDirectory $workerDirectory

  $desktopDirectory = Join-Path $repoRoot "app/desktop"
  Invoke-NativeStep -Name "Desktop dependency install" -Executable $npm -Arguments @("ci") -WorkingDirectory $desktopDirectory
  Invoke-NativeStep -Name "Desktop tests" -Executable $npm -Arguments @("test") -WorkingDirectory $desktopDirectory
  Invoke-NativeStep -Name "Desktop type-check" -Executable $npm -Arguments @("run", "type-check") -WorkingDirectory $desktopDirectory
  Invoke-NativeStep -Name "Desktop build" -Executable $npm -Arguments @("run", "build") -WorkingDirectory $desktopDirectory

  $docker = Resolve-Executable @("docker")
  Invoke-NativeStep `
    -Name "Docker Compose validation" `
    -Executable $docker `
    -Arguments @("compose", "config", "--quiet") `
    -WorkingDirectory $repoRoot

  Write-Host "`nLocal verification passed." -ForegroundColor Green
  exit 0
}
catch {
  Write-Error $_
  exit 1
}
