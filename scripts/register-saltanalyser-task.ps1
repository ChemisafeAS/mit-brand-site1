param(
  [string]$TaskName = "Chemisafe Saltanalyse Sync",
  [string]$SourceDir = "C:\Users\Frederik\OneDrive - Chemisafe A S\Prøvetagninger",
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$SyncToken,
  [int]$IntervalMinutes = 15,
  [int]$BatchSize = 4
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Kildemappen blev ikke fundet: $SourceDir"
}

if ($IntervalMinutes -lt 5) {
  throw "IntervalMinutes skal være mindst 5 minutter."
}

$syncScriptPath = Join-Path $PSScriptRoot "sync-saltanalyser.ps1"

if (-not (Test-Path -LiteralPath $syncScriptPath)) {
  throw "Sync-scriptet blev ikke fundet: $syncScriptPath"
}

$stateFilePath = Join-Path $PSScriptRoot "sync-saltanalyser-state.json"
$quotedSyncScriptPath = '"' + $syncScriptPath + '"'
$quotedSourceDir = '"' + $SourceDir + '"'
$quotedApiBaseUrl = '"' + $ApiBaseUrl.TrimEnd("/") + '"'
$quotedSyncToken = '"' + $SyncToken + '"'
$quotedStateFilePath = '"' + $stateFilePath + '"'

$arguments =
  "-NoProfile -ExecutionPolicy Bypass -File $quotedSyncScriptPath " +
  "-SourceDir $quotedSourceDir " +
  "-ApiBaseUrl $quotedApiBaseUrl " +
  "-SyncToken $quotedSyncToken " +
  "-StateFile $quotedStateFilePath " +
  "-BatchSize $BatchSize"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Windows-opgaven '$TaskName' er oprettet."
Write-Host "Kilde: $SourceDir"
Write-Host "Destination: $($ApiBaseUrl.TrimEnd('/'))/api/saltanalyser/ingest"
Write-Host "Interval: hver $IntervalMinutes. minut"
