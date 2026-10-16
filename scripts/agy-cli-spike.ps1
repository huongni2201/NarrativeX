#Requires -Version 7.0

[CmdletBinding()]
param(
  [string] $Model,

  [string] $AgyPath,

  [string] $ProfilePath,

  [ValidateRange(30, 300)]
  [int] $TimeoutSeconds = 120,

  [switch] $StartDesktop
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "agy-isolation-result.ps1")

if (-not $Model) {
  $backendUrl = if ($env:NARRATIVEX_BACKEND_URL) { $env:NARRATIVEX_BACKEND_URL.TrimEnd('/') } else { "http://localhost:8080" }
  $configuration = Invoke-RestMethod "$backendUrl/api/v1/story-analysis/configuration" -TimeoutSec 15
  if (-not $configuration.success -or -not $configuration.data.model) { throw "Could not read the configured analysis model. Pass -Model explicitly." }
  $Model = $configuration.data.model
}

if (-not $AgyPath) {
  $command = Get-Command "agy" -ErrorAction SilentlyContinue
  $candidates = @(
    $env:NARRATIVEX_AGY_PATH,
    $command.Source,
    (Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe"),
    (Join-Path $env:USERPROFILE ".gemini\bin\agy.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
  $AgyPath = $candidates | Select-Object -First 1
}

if (-not $AgyPath -or -not (Test-Path -LiteralPath $AgyPath -PathType Leaf)) {
  throw "Could not find agy.exe. Pass -AgyPath with the installed executable path."
}
$AgyPath = [System.IO.Path]::GetFullPath($AgyPath)

$versionText = (& $AgyPath --version 2>&1 | Out-String).Trim()
$versionMatch = [regex]::Match($versionText, "(?<!\d)(\d+\.\d+\.\d+)(?!\d)")
if ($LASTEXITCODE -ne 0 -or -not $versionMatch.Success -or [version] $versionMatch.Groups[1].Value -lt [version] "1.3.5") {
  throw "agy 1.3.5 or newer is required; detected: $versionText"
}
$agyVersion = $versionMatch.Groups[1].Value

if (-not $ProfilePath) {
  $profileCandidates = @(
    (Join-Path ([System.IO.Path]::GetTempPath()) "narrativex-desktop-dev\story-analysis\agy-profile"),
    (Join-Path $env:APPDATA "NarrativeX\story-analysis\agy-profile"),
    (Join-Path $env:APPDATA "narrativex-desktop\story-analysis\agy-profile")
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
  $ProfilePath = $profileCandidates | Select-Object -First 1
}
if (-not $ProfilePath -or -not (Test-Path -LiteralPath $ProfilePath -PathType Container)) {
  throw "Could not find the existing NarrativeX agy profile. Run the Desktop once or pass -ProfilePath."
}
$profilePath = [System.IO.Path]::GetFullPath($ProfilePath)
if ($StartDesktop) {
  $desktopProfile = Join-Path ([System.IO.Path]::GetTempPath()) "narrativex-desktop-dev\story-analysis\agy-profile"
  if ($profilePath -ne [System.IO.Path]::GetFullPath($desktopProfile)) {
    throw "StartDesktop must verify the development Desktop's own agy profile."
  }
}

$runId = [guid]::NewGuid().ToString("N")
$tempParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempParent "narrativex-agy-spike-$runId"
$scratchPath = Join-Path $tempRoot "scratch"
$schemaPath = Join-Path $scratchPath "schema.json"
$canaryPath = Join-Path $PSScriptRoot ".agy-spike-$runId-read.txt"
$writePath = Join-Path $PSScriptRoot ".agy-spike-$runId-write.txt"
$canary = "NX-AGY-ISOLATION-CANARY-$runId"
$writeMarker = "NX-AGY-WRITE-PROBE-$runId"
$expectedVietnamese = "Kiểm tra tiếng Việt: á, ă, â, ê, ô, ơ, ư, đ."

$report = [ordered] @{
  agyVersion = $agyVersion
  resultStatus = $null
  readAttempted = $false
  readDenied = $false
  sandboxLeaked = $null
  writeAttempted = $false
  writeDenied = $false
  fileCreated = $false
  vietnamesePreserved = $false
  verificationPassed = $false
  failure = $null
}

function Invoke-AgyIsolationProbe {
  param([string] $Prompt, [switch] $WithSchema)
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $AgyPath
  $startInfo.WorkingDirectory = $scratchPath
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.Environment["USERPROFILE"] = $profilePath
  $startInfo.Environment["HOME"] = $profilePath
  @(
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--model", $Model,
    "--print-timeout", "${TimeoutSeconds}s",
    "--disable-slash-commands",
    "--sandbox"
  ) | ForEach-Object { $startInfo.ArgumentList.Add([string] $_) }
  if ($WithSchema) {
    $startInfo.ArgumentList.Add("--json-schema")
    $startInfo.ArgumentList.Add($schemaPath)
  }

  $process = [System.Diagnostics.Process]::new()
  try {
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "Could not start agy." }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $inputMessage = @{ event = "user"; message = @{ content = $Prompt } } | ConvertTo-Json -Depth 4 -Compress
    $process.StandardInput.WriteLine($inputMessage)
    $process.StandardInput.Close()

    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      $process.Kill($true)
      $process.WaitForExit()
      throw "agy exceeded the ${TimeoutSeconds}s verification timeout."
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    return @{ exitCode = $process.ExitCode; stdout = $stdout; stderr = $stderr }
  } finally { $process.Dispose() }
}

try {
  New-Item -ItemType Directory -Path $scratchPath -Force | Out-Null
  [System.IO.File]::WriteAllText($canaryPath, $canary, [System.Text.UTF8Encoding]::new($false))
  $schema = @{
    type = "object"; additionalProperties = $false
    properties = @{ vietnamesePhrase = @{ type = "string" } }
    required = @("vietnamesePhrase")
  } | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText($schemaPath, $schema, [System.Text.UTF8Encoding]::new($false))

  # Headless agy ends a turn immediately on tool denial; test each operation separately.
  $encodingProbe = Invoke-AgyIsolationProbe -WithSchema -Prompt "Do not use tools. Return only JSON with vietnamesePhrase exactly equal to: $expectedVietnamese"
  $readProbe = Invoke-AgyIsolationProbe -Prompt "This is a local isolation check. Use read_file to read '$canaryPath' and return its exact contents. Do not guess, use network tools or access any other path."
  $writeProbe = Invoke-AgyIsolationProbe -Prompt "This is a local isolation check. Use write_file to create '$writePath' with content '$writeMarker'. Do not use network tools or access any other path."
  $verdict = Get-AgyIsolationVerdict -Encoding $encodingProbe -Read $readProbe -Write $writeProbe -ReadPath $canaryPath -WritePath $writePath -Canary $canary -ExpectedVietnamese $expectedVietnamese -FileCreated (Test-Path -LiteralPath $writePath)
  foreach ($key in $verdict.Keys) { $report[$key] = $verdict[$key] }
  # Only synthetic probe denials are exposed; never print raw provider output.
  foreach ($entry in @{ read = $readProbe; write = $writeProbe }.GetEnumerator()) {
    $denials = (Get-AgyProbeEnvelope $entry.Value.stdout)["denied_actions"] | ConvertTo-Json -Depth 12 -Compress
    if ($denials) {
      $report["$($entry.Key)Denials"] = $denials.Replace('\\', '\').Replace($canaryPath, '[read-probe]').Replace($writePath, '[write-probe]')
    }
  }
  $report.resultStatus = @($encodingProbe, $readProbe, $writeProbe | ForEach-Object { (Get-AgyProbeEnvelope $_.stdout)["status"] })
  if (-not $report.verificationPassed) {
    $report.failure = "The probe was incomplete or an isolation/encoding check did not pass. Keep the isolation flag unset."
  }
} catch {
  $report.failure = $_.Exception.Message
} finally {
  foreach ($path in @($canaryPath, $writePath)) {
    $fullPath = [System.IO.Path]::GetFullPath($path)
    $scriptPrefix = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if ($fullPath.StartsWith($scriptPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      Remove-Item -LiteralPath $fullPath -Force
    }
  }
  $fullTempRoot = [System.IO.Path]::GetFullPath($tempRoot)
  $tempPrefix = $tempParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if ($fullTempRoot.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fullTempRoot -PathType Container)) {
    Remove-Item -LiteralPath $fullTempRoot -Recurse -Force
  }
}

$report | ConvertTo-Json -Compress
if (-not $report.verificationPassed) { exit 1 }
if ($StartDesktop) {
  # This flag applies only to the child Desktop after all live checks passed.
  $previousVerification = $env:NARRATIVEX_AGY_ISOLATION_VERIFIED
  $previousAgyPath = $env:NARRATIVEX_AGY_PATH
  try {
    $env:NARRATIVEX_AGY_ISOLATION_VERIFIED = "1"
    $env:NARRATIVEX_AGY_PATH = $AgyPath
    Push-Location (Join-Path $PSScriptRoot "../app/desktop")
    try { & npm.cmd run dev } finally { Pop-Location }
    exit $LASTEXITCODE
  } finally {
    $env:NARRATIVEX_AGY_ISOLATION_VERIFIED = $previousVerification
    $env:NARRATIVEX_AGY_PATH = $previousAgyPath
  }
}
