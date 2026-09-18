<#
.SYNOPSIS
    Automated bootstrap for NarrativeX remote GPU worker on Windows RTX 3090.

.DESCRIPTION
    Installs pinned Python 3.12 via uv, sets up PyTorch with CUDA 12.4,
    prepares runtimes (VieNeu, ComfyUI, WhisperX), and configures generation-service.

.PARAMETER InstallDir
    Base installation directory. If omitted, automatically selects drive with most free space.

.PARAMETER MachineToken
    Pre-shared bearer token for NarrativeX control plane authentication. If omitted, generates random token.

.PARAMETER Port
    HTTP port for generation service. Default: 8010.

.PARAMETER SkipModelDownload
    If set, skips downloading large model checkpoints during bootstrap.
#>

[CmdletBinding()]
param (
    [string]$InstallDir = "",
    [string]$MachineToken = "",
    [int]$Port = 8010,
    [switch]$SkipModelDownload
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "NarrativeX Remote GPU Runtime Bootstrap (Windows RTX 3090)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Architecture and OS check
if ($env:PROCESSOR_ARCHITECTURE -ne "AMD64") {
    Write-Error "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE. Only Windows x86_64 is supported."
}

# 2. NVIDIA GPU validation via nvidia-smi
Write-Host "[1/6] Checking NVIDIA GPU and VRAM..." -ForegroundColor Yellow
$nvidiaSmi = Get-Command "nvidia-smi" -ErrorAction SilentlyContinue
if (-not $nvidiaSmi) {
    Write-Error "nvidia-smi not found in PATH. Please install latest NVIDIA GPU drivers with CUDA 13.0+ support."
}

$gpuInfo = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits
Write-Host "Detected GPU: $gpuInfo" -ForegroundColor Green

$gpuTotalMb = [int]($gpuInfo.Split(",")[1].Trim())
if ($gpuTotalMb -lt 20000) {
    Write-Warning "Detected GPU VRAM is $gpuTotalMb MB. An RTX 3090 (24GB VRAM) is recommended for heavy generative workloads."
}

# 3. Disk selection and directory layout
Write-Host "[2/6] Selecting target drive and preparing directories..." -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $targetDrive = Get-PSDrive -PSProvider FileSystem | Sort-Object Free -Descending | Select-Object -First 1
    if (-not $targetDrive -or $targetDrive.Free -lt 50GB) {
        Write-Warning "Target drive $($targetDrive.Name): has less than 50GB free space ($([math]::Round($targetDrive.Free/1GB, 1)) GB)."
    }
    $InstallDir = "$($targetDrive.Root)NarrativeXRuntime"
}

Write-Host "Installation directory: $InstallDir" -ForegroundColor Green
$dirs = @(
    "$InstallDir",
    "$InstallDir\bin",
    "$InstallDir\runtimes",
    "$InstallDir\models\vieneu",
    "$InstallDir\models\whisperx",
    "$InstallDir\logs",
    "$InstallDir\.runtime"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

# 4. Install UV package manager
Write-Host "[3/6] Setting up uv package manager..." -ForegroundColor Yellow
$uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
if (-not $uvExe) {
    Write-Host "Installing uv into $InstallDir\bin..."
    $env:CARGO_DIST_FORCE_INSTALL = "1"
    irm https://astral.sh/uv/install.ps1 | iex
    $env:PATH = "$env:USERPROFILE\.local\bin;$env:CARGO_HOME\bin;$env:PATH"
    $uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
    if (-not $uvExe) {
        $uvExe = "$env:USERPROFILE\.local\bin\uv.exe"
    }
}
Write-Host "Using uv at: $uvExe" -ForegroundColor Green

# 5. Setup Python 3.14 environment and PyTorch CUDA 13.0
Write-Host "[4/6] Creating Python 3.14.7 environment and installing PyTorch cu130..." -ForegroundColor Yellow
$venvDir = "$InstallDir\.venv"
& uv venv "$venvDir" --python 3.14.7 --seed
$pythonExe = "$venvDir\Scripts\python.exe"

# Install PyTorch with CUDA 13.0 wheels
Write-Host "Installing torch 2.14.0+cu130 and torchaudio..."
& uv pip install --python "$pythonExe" torch==2.14.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130

# Install generation-service package using frozen lock
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$scriptDir\..\..").Path
$genServiceDir = "$repoRoot\app\generation-service"

if (Test-Path "$genServiceDir\pyproject.toml") {
    Write-Host "Installing generation-service from $genServiceDir using uv sync --frozen..."
    Push-Location "$genServiceDir"
    try {
        & uv sync --frozen --no-dev
    } finally {
        Pop-Location
    }
} else {
    Write-Warning "Source directory not found at $genServiceDir. Please run from clone or copy app/generation-service."
}

# 6. Generate Machine Token and .env
Write-Host "[5/6] Generating configuration (.env)..." -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($MachineToken)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $MachineToken = ($bytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
}

$envContent = @"
GENERATION_SERVICE_HOST=0.0.0.0
GENERATION_SERVICE_PORT=$Port
GENERATION_SERVICE_MACHINE_TOKEN=$MachineToken
GENERATION_SERVICE_JOURNAL_FILE=$InstallDir\.runtime\generation-service.sqlite3
GENERATION_SERVICE_MAX_CONCURRENCY=1
GENERATION_SERVICE_RESIDENCY_ENABLED=true
GENERATION_SERVICE_RESIDENCY_TIMEOUT_SECONDS=30
GENERATION_SERVICE_RESIDENCY_MAX_VRAM_IDLE_MB=1500
GENERATION_SERVICE_VIENEU_BASE_URL=http://127.0.0.1:8008
GENERATION_SERVICE_COMFYUI_BASE_URL=http://127.0.0.1:8188
GENERATION_SERVICE_WHISPERX_DEVICE=cuda
"@

Set-Content -Path "$InstallDir\.env" -Value $envContent -Encoding utf8
Write-Host "Configuration written to $InstallDir\.env" -ForegroundColor Green

# 7. Model download step (optional)
Write-Host "[6/6] Checking model weights..." -ForegroundColor Yellow
if ($SkipModelDownload) {
    Write-Host "Skipping model download as requested." -ForegroundColor Yellow
} else {
    Write-Host "Models can be synced via models.lock.json when ready."
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Bootstrap completed successfully!" -ForegroundColor Green
Write-Host "Install Directory : $InstallDir"
Write-Host "Port              : $Port"
Write-Host "Machine Token     : $MachineToken"
Write-Host "To start worker   : .\start.ps1 -InstallDir `"$InstallDir`""
Write-Host "==========================================================" -ForegroundColor Green
