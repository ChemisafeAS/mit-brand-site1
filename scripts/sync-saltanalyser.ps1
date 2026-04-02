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

function Invoke-JsonApi {
  param(
    [string]$Method,
    [string]$BaseUrl,
    [string]$Token,
    [object]$Body
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromMinutes(15)
  $client.DefaultRequestHeaders.Authorization =
    [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)

  try {
    $url = $BaseUrl.TrimEnd("/") + "/api/saltanalyser/ingest"
    $json = $Body | ConvertTo-Json -Depth 10
    $content = [System.Net.Http.StringContent]::new(
      $json,
      [System.Text.Encoding]::UTF8,
      "application/json"
    )
    $request = [System.Net.Http.HttpRequestMessage]::new(
      [System.Net.Http.HttpMethod]::$Method,
      $url
    )
    $request.Content = $content

    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (-not $response.IsSuccessStatusCode) {
      throw "API-kald fejlede ($([int]$response.StatusCode)): $body"
    }

    return $body | ConvertFrom-Json
  }
  finally {
    $client.Dispose()
  }
}

function Upload-FileToSignedUrl {
  param(
    [System.IO.FileInfo]$File,
    [string]$SignedUrl
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromMinutes(15)

  try {
    $stream = [System.IO.File]::OpenRead($File.FullName)

    try {
      $content = [System.Net.Http.StreamContent]::new($stream)
      $content.Headers.ContentType =
        [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/pdf")

      $response = $client.PutAsync($SignedUrl, $content).GetAwaiter().GetResult()
      $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

      if (-not $response.IsSuccessStatusCode) {
        throw "Direkte upload til Supabase fejlede ($([int]$response.StatusCode)): $body"
      }
    }
    finally {
      $stream.Dispose()
    }
  }
  finally {
    $client.Dispose()
  }
}

function Sync-Batch {
  param(
    [System.Collections.Generic.List[System.IO.FileInfo]]$Files,
    [string]$BaseUrl,
    [string]$Token
  )

  $prepareResponse = Invoke-JsonApi -Method "Post" -BaseUrl $BaseUrl -Token $Token -Body @{
    mode = "prepare-upload"
    files = @($Files | ForEach-Object {
      @{
        fileName = $_.Name
      }
    })
  }

  foreach ($uploadTarget in $prepareResponse.files) {
    $file = $Files | Where-Object { $_.Name -eq $uploadTarget.fileName } | Select-Object -First 1

    if ($null -eq $file) {
      throw "Kunne ikke finde lokal fil til upload-planen: $($uploadTarget.fileName)"
    }

    Upload-FileToSignedUrl -File $file -SignedUrl $uploadTarget.signedUrl
  }

  return Invoke-JsonApi -Method "Post" -BaseUrl $BaseUrl -Token $Token -Body @{
    mode = "ingest-uploaded"
    files = @($prepareResponse.files | ForEach-Object {
      @{
        fileName = $_.fileName
        storagePath = $_.storagePath
      }
    })
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

  $result = Sync-Batch -Files $chunk -BaseUrl $ApiBaseUrl -Token $SyncToken

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
