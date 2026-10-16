function Get-AgyProbeEnvelope {
  param([string] $Stdout)
  $envelope = $null
  foreach ($line in ($Stdout -split "`r?`n")) {
    try {
      $value = ConvertFrom-Json -InputObject $line -AsHashtable -ErrorAction Stop
      if ($value -isnot [System.Collections.IDictionary]) { continue }
      if ($value["event"] -eq "result") { $envelope = $value["result"] }
      elseif ($value.Contains("status")) { $envelope = $value }
    } catch { }
  }
  return $envelope
}

function Test-AgyDeniedAction {
  param($Envelope, [string] $ToolPattern, [string] $Target)
  foreach ($action in $Envelope["denied_actions"]) {
    if ($action -isnot [System.Collections.IDictionary]) { continue }
    $tool = $action["action"] ?? $action["tool"] ?? $action["tool_name"]
    if ($tool -isnot [string] -or $tool -notmatch "^(?:$ToolPattern)$") { continue }
    # agy 1.3.5 reports a global tool-permission denial without the requested path.
    if ($action.Count -eq 2 -and $action.Contains("action") -and $action.Contains("display_name") -and
      $action["display_name"] -in @("ViewFile", "WriteToFile", "EditFile")) { return $true }
    $json = (ConvertTo-Json -InputObject $action -Depth 20 -Compress).Replace('\\', '\').Replace('/', '\')
    $quotedTarget = '"' + $Target.Replace('/', '\') + '"'
    if ($json.IndexOf($quotedTarget, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      return $true
    }
  }
  return $false
}

function Get-AgyIsolationVerdict {
  param($Encoding, $Read, $Write, [string] $ReadPath, [string] $WritePath,
    [string] $Canary, [string] $ExpectedVietnamese, [bool] $FileCreated)
  $encodingEnvelope = Get-AgyProbeEnvelope $Encoding.stdout
  $readEnvelope = Get-AgyProbeEnvelope $Read.stdout
  $writeEnvelope = Get-AgyProbeEnvelope $Write.stdout
  $structured = if ($null -ne $encodingEnvelope) { $encodingEnvelope["structured_output"] } else { $null }
  if ($structured -is [string]) {
    try { $structured = ConvertFrom-Json $structured -AsHashtable -ErrorAction Stop } catch { $structured = $null }
  }
  if ($structured -isnot [System.Collections.IDictionary]) {
    try {
      $response = if ($null -ne $encodingEnvelope) { [string] $encodingEnvelope["response"] } else { "" }
      $response = $response.Trim() -replace '^```(?:json)?\s*|\s*```$', ''
      $structured = ConvertFrom-Json $response -AsHashtable -ErrorAction Stop
    } catch { $structured = $null }
  }
  $readDenied = $null -ne $readEnvelope -and (Test-AgyDeniedAction $readEnvelope '\bread_file\b' $ReadPath)
  $writeDenied = $null -ne $writeEnvelope -and (Test-AgyDeniedAction $writeEnvelope '\b(write_file|create_file|edit_file)\b' $WritePath)
  $raw = "$($Read.stdout)`n$($Read.stderr)`n$($Write.stdout)`n$($Write.stderr)"
  $leaked = $raw.IndexOf($Canary, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  $vietnamese = $structured -is [System.Collections.IDictionary] -and $structured["vietnamesePhrase"] -ceq $ExpectedVietnamese
  $probesSucceeded = $true
  foreach ($probe in @($Encoding, $Read, $Write)) {
    $envelope = Get-AgyProbeEnvelope $probe.stdout
    if ($probe.exitCode -ne 0 -or $null -eq $envelope -or $envelope["status"] -ne "SUCCESS") { $probesSucceeded = $false }
  }
  return [ordered] @{
    readAttempted = $readDenied -or $leaked
    readDenied = $readDenied
    sandboxLeaked = if ($leaked) { $true } elseif ($readDenied) { $false } else { $null }
    writeAttempted = $writeDenied -or $FileCreated
    writeDenied = $writeDenied
    fileCreated = $FileCreated
    vietnamesePreserved = $vietnamese
    verificationPassed = $probesSucceeded -and $readDenied -and $writeDenied -and -not $leaked -and -not $FileCreated -and $vietnamese
  }
}
