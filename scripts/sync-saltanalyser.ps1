param(
  [string]$SourceDir = "C:\Users\Frederik\OneDrive - ChemisafeAS\Dokumenter\PowerAutomate\Prøvetagning",
  [string]$ApiBaseUrl = "https://example.com",
  [string]$SyncToken = "",
  [string]$StateFile = "$PSScriptRoot\sync-saltanalyser-state.json",
  [int]$BatchSize = 4
)

$ErrorActionPreference = "Stop"

try {
  Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
}
catch {
  throw "System.Net.Http kunne ikke indlaeses i denne PowerShell-session."
}

if ([string]::IsNullOrWhiteSpace($SyncToken)) {
  throw "SyncToken mangler. Sæt SALT_ANALYSIS_SYNC_TOKEN eller send -SyncToken med."
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Kildemappen blev ikke fundet: $SourceDir"
}

function Get-FileFingerprint {
  param([System.IO.FileInfo]$File)

  $utc = $File.LastWriteTimeUtc.ToString("o")
  return "$utc|$($File.Length)"
}

function Load-State {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return @{}
  }

  $raw = Get-Content -LiteralPath $Path -Raw

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @{}
  }

  $parsed = $raw | ConvertFrom-Json

  if ($null -eq $parsed) {
    return @{}
  }

  $state = @{}

  foreach ($property in $parsed.PSObject.Properties) {
    $state[$property.Name] = [string]$property.Value
  }

  return $state
}

function Save-State {
  param(
    [string]$Path,
    [hashtable]$State
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $State | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Upload-Batch {
  param(
    [System.Collections.Generic.List[System.IO.FileInfo]]$Files,
    [string]$BaseUrl,
    [string]$Token
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromMinutes(15)
  $client.DefaultRequestHeaders.Authorization =
    [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)

  try {
    $content = [System.Net.Http.MultipartFormDataContent]::new()
    $streams = [System.Collections.Generic.List[System.IDisposable]]::new()

    try {
      foreach ($file in $Files) {
        $stream = [System.IO.File]::OpenRead($file.FullName)
        $streams.Add($stream)

        $fileContent = [System.Net.Http.StreamContent]::new($stream)
        $fileContent.Headers.ContentType =
          [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/pdf")
        $content.Add($fileContent, "analyses", $file.Name)
      }

      $url = $BaseUrl.TrimEnd("/") + "/api/saltanalyser/ingest"
      $response = $client.PostAsync($url, $content).GetAwaiter().GetResult()
      $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

      if (-not $response.IsSuccessStatusCode) {
        throw "Upload fejlede ($([int]$response.StatusCode)): $body"
      }

      return $body | ConvertFrom-Json
    }
    finally {
      foreach ($stream in $streams) {
        $stream.Dispose()
      }
      $content.Dispose()
    }
  }
  finally {
    $client.Dispose()
  }
}

$state = Load-State -Path $StateFile
$files = Get-ChildItem -LiteralPath $SourceDir -Recurse -File |
  Where-Object { $_.Extension -ieq ".pdf" } |
  Sort-Object FullName

$currentPaths = @{}
$pending = [System.Collections.Generic.List[System.IO.FileInfo]]::new()

foreach ($file in $files) {
  $fullPath = $file.FullName
  $fingerprint = Get-FileFingerprint -File $file
  $currentPaths[$fullPath] = $fingerprint

  if (-not $state.ContainsKey($fullPath) -or $state[$fullPath] -ne $fingerprint) {
    $pending.Add($file)
  }
}

foreach ($knownPath in @($state.Keys)) {
  if (-not $currentPaths.ContainsKey($knownPath)) {
    $state.Remove($knownPath)
  }
}

if ($pending.Count -eq 0) {
  Write-Host "Ingen nye eller ændrede PDF'er at synkronisere."
  exit 0
}

$uploadedCount = 0

for ($index = 0; $index -lt $pending.Count; $index += $BatchSize) {
  $chunk = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
  $upperBound = [Math]::Min($index + $BatchSize - 1, $pending.Count - 1)

  for ($innerIndex = $index; $innerIndex -le $upperBound; $innerIndex++) {
    $chunk.Add($pending[$innerIndex])
  }

  $result = Upload-Batch -Files $chunk -BaseUrl $ApiBaseUrl -Token $SyncToken

  foreach ($file in $chunk) {
    $state[$file.FullName] = Get-FileFingerprint -File $file
    $uploadedCount++
  }

  if ($result.notice) {
    Write-Host $result.notice
  }
}

Save-State -Path $StateFile -State $state
Write-Host "$uploadedCount PDF-filer synkroniseret."
