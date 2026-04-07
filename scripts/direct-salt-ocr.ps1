param(
  [string[]]$Files
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not $Files -or $Files.Count -eq 0) {
  throw "Send mindst én PDF via -Files."
}

function Resolve-ToolPath {
  param(
    [string]$CommandName,
    [string[]]$FallbackPaths
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { return $command.Source }

  foreach ($path in $FallbackPaths) {
    if (Test-Path -LiteralPath $path) { return $path }
  }

  return $null
}

function Normalize-Text {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $normalized = ($Text -replace "\s+", " ").Trim()

  if ($normalized -match "Ã|Â|â€") {
    try {
      $latin1 = [System.Text.Encoding]::GetEncoding("ISO-8859-1")
      $bytes = $latin1.GetBytes($normalized)
      $decoded = [System.Text.Encoding]::UTF8.GetString($bytes)

      if (($decoded | Select-String -Pattern "Ã|Â|â€" -Quiet) -eq $false) {
        $normalized = $decoded
      }
    } catch {
    }
  }

  return ($normalized) `
    -replace "ÃƒÂ¦", "æ" `
    -replace "ÃƒÂ¸", "ø" `
    -replace "ÃƒÂ¥", "å" `
    -replace "Ãƒâ€ ", "Æ" `
    -replace "ÃƒËœ", "Ø" `
    -replace "Ãƒâ€¦", "Å" `
    -replace "Ã¦", "æ" `
    -replace "Ã¸", "ø" `
    -replace "Ã¥", "å" `
    -replace "Ã†", "Æ" `
    -replace "Ã˜", "Ø" `
    -replace "Ã…", "Å" `
    -replace "Ã‚Â¢", "ø" `
    -replace "Â¢", "ø"
}

function Normalize-Recipient {
  param([string]$Text)

  return (Normalize-Text $Text) `
    -replace "\s+(?:[\w.+-]+@[\w.-]+\.\w+.*)$", "" `
    -replace "\bNgrskovvej\b", "Nørskovvej" `
    -replace "\bNÂ¢rskovvej\b", "Nørskovvej" `
    -replace "\bSdlsted\b", "Sølsted" `
    -replace "\bTonder\b", "Tønder" `
    -replace "\bKirkegardsvej\b", "Kirkegårdsvej" `
    -replace "\bAbenra\b", "Aabenraa" `
    -replace "\bHillergd\b", "Hillerød" `
    -replace "\bHillerd\b", "Hillerød" `
    -replace "\bFrederiksveerksgade\b", "Frederiksværksgade" `
    -replace "\bFrederiksvaerksgade\b", "Frederiksværksgade" `
    -replace "\bMaterialegarden\b", "Materialegården" `
    -replace "\bHumlebzek\b", "Humlebæk" `
    -replace "\bK liplev\b", "Kliplev" `
    -replace "\s+,", ","
}

function Normalize-RecipientDisplay {
  param([string]$Text)

  $normalized = Normalize-Recipient $Text

  if ($normalized -match "Aabenraa") { return "Aabenraa Kommune" }
  if ($normalized -match "Viborg") { return "Viborg Kommune" }
  if ($normalized -match "Tønder|TÃ¸nder|TÃƒÂ¸nder") { return "Tønder Kommune" }
  if ($normalized -match "Billund|Grindsted") { return "Billund Kommune" }
  if ($normalized -match "Favrskov|Hinnerup") { return "Favrskov Kommune" }
  if ($normalized -match "Fredericia") { return "Fredericia Kommune" }
  if ($normalized -match "Holstebro") { return "Holstebro Kommune" }
  if ($normalized -match "Skanderborg") { return "Vejdirektoratet Skanderborg" }
  if ($normalized -match "Randers") { return "Vejdirektoratet Randers" }
  if ($normalized -match "Lyngby") { return "Vejdirektoratet Lyngby" }
  if ($normalized -match "Hillerød|HillerÃ¸d|HillerÃƒÂ¸d") { return "Vejdirektoratet Hillerød" }

  return $normalized
}

function Get-OcrPageText {
  param(
    [string]$ImagePath,
    [string]$Psm,
    [string]$TesseractPath
  )

  try {
    return Normalize-Text (& $TesseractPath $ImagePath stdout -l eng --psm $Psm 2>$null | Out-String)
  } catch {
    return ""
  }
}

function Get-FocusedWaterZoneText {
  param(
    [string]$ImagePath,
    [string]$TesseractPath
  )

  $cropPath = [System.IO.Path]::ChangeExtension($ImagePath, ".water.png")

  $bitmap = [System.Drawing.Bitmap]::FromFile($ImagePath)
  try {
    # Lower middle table area where "Vandindhold in situ / Wnat / value" lives.
    $x = [int]($bitmap.Width * 0.18)
    $y = [int]($bitmap.Height * 0.73)
    $width = [int]($bitmap.Width * 0.62)
    $height = [int]($bitmap.Height * 0.17)

    if ($x + $width -gt $bitmap.Width) { $width = $bitmap.Width - $x }
    if ($y + $height -gt $bitmap.Height) { $height = $bitmap.Height - $y }

    $rect = [System.Drawing.Rectangle]::new($x, $y, $width, $height)
    $cropped = $bitmap.Clone($rect, $bitmap.PixelFormat)
    try {
      $cropped.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $cropped.Dispose()
    }

    $runs = New-Object System.Collections.Generic.List[string]
    foreach ($psm in @("6", "11")) {
      $ocrText = Get-OcrPageText -ImagePath $cropPath -Psm $psm -TesseractPath $TesseractPath
      if (-not [string]::IsNullOrWhiteSpace($ocrText)) {
        $runs.Add($ocrText)
      }
    }

    return Normalize-Text ($runs -join " ")
  } finally {
    $bitmap.Dispose()
    Remove-Item -LiteralPath $cropPath -ErrorAction SilentlyContinue
  }
}

function Get-OcrData {
  param(
    [string]$PdfPath,
    [string]$PdfToPpmPath,
    [string]$TesseractPath
  )

  $tempDirectory = Join-Path $env:TEMP ("salt-direct-ocr-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempDirectory | Out-Null
  $prefix = Join-Path $tempDirectory "page"

  try {
    & $PdfToPpmPath -png -r 220 -f 1 -l 3 $PdfPath $prefix | Out-Null
    $pages = Get-ChildItem -LiteralPath $tempDirectory -Filter "page-*.png" | Sort-Object Name
    $pageTexts = New-Object System.Collections.Generic.List[string]

    foreach ($page in $pages) {
      $pageText = Normalize-Text (
        (Get-OcrPageText -ImagePath $page.FullName -Psm "6" -TesseractPath $TesseractPath) + " " +
        (Get-OcrPageText -ImagePath $page.FullName -Psm "11" -TesseractPath $TesseractPath)
      )

      if ($page.Name -match "page-(\d+)\.png" -and [int]$matches[1] -ge 2) {
        $waterZoneText = Get-FocusedWaterZoneText -ImagePath $page.FullName -TesseractPath $TesseractPath
        if (-not [string]::IsNullOrWhiteSpace($waterZoneText)) {
          $pageText = Normalize-Text "$pageText [[WATER_ZONE]] $waterZoneText"
        }
      }

      $pageTexts.Add($pageText)
    }

    return [pscustomobject]@{
      pages = $pageTexts.ToArray()
      all = Normalize-Text ($pageTexts.ToArray() -join " ")
    }
  } finally {
    Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Get-NameParts {
  param([string]$FileName)

  $match = [regex]::Match(
    $FileName,
    "^R\d+[A-Z]? - (\d{2}\.\d{2}\.\d{4}) (.+?) -(?: (\d{5}))?\.pdf$"
  )

  if (-not $match.Success) {
    return [pscustomobject]@{
      recipient = ""
      sampleDate = ""
      deliveryNote = ""
    }
  }

  return [pscustomobject]@{
    recipient = $match.Groups[2].Value.Trim()
    sampleDate = $match.Groups[1].Value
    deliveryNote = $match.Groups[3].Value
  }
}

function Extract-Recipient {
  param(
    [string]$FileName,
    [string]$PageOneText
  )

  $match = [regex]::Match(
    $PageOneText,
    "Chemisafe A/S\s*-\s*(.+?)(?=\s+Rapport indhold)",
    "IgnoreCase"
  )

  if ($match.Success) {
    return Normalize-RecipientDisplay $match.Groups[1].Value
  }

  return Normalize-RecipientDisplay ((Get-NameParts -FileName $FileName).recipient)
}

function Extract-SampleDate {
  param(
    [string]$FileName,
    [string]$PageOneText
  )

  $match = [regex]::Match(
    $PageOneText,
    "Start\s+(\d{1,2})[.,]?\s*marts\s+(\d{4})",
    "IgnoreCase"
  )

  if ($match.Success) {
    return ("{0:00}.03.{1}" -f [int]$match.Groups[1].Value, $match.Groups[2].Value)
  }

  return (Get-NameParts -FileName $FileName).sampleDate
}

function Extract-SampleType {
  param([string]$PageOneText)

  if ($PageOneText -match "1235" -or $PageOneText -match "Kornst") {
    return "Kornstørrelsesfordeling"
  }

  if ($PageOneText -match "1097-5" -or $PageOneText -match "Vandindhold \(2013\)") {
    return "Vandindhold"
  }

  return ""
}

function Extract-DeliveryNote {
  param(
    [string]$FileName,
    [string]$AllText
  )

  $match = [regex]::Match($AllText, "Mrk\.?\s*[:.]?\s*(\d{5})", "IgnoreCase")
  if ($match.Success) {
    return $match.Groups[1].Value
  }

  return (Get-NameParts -FileName $FileName).deliveryNote
}

function Extract-WaterContent {
  param([string]$AllText)

  $text = Normalize-Text $AllText

  $match = [regex]::Match(
    $text,
    "Vandindhold\s+in\s+situ(?:\s+Wnat)?[\s\S]{0,120}?(\d{1,2}(?:[.,]\d{1,2})?\s*%)",
    "IgnoreCase"
  )

  if (-not $match.Success) {
    $match = [regex]::Match(
      $text,
      "Wnat[\s\S]{0,80}?(\d{1,2}(?:[.,]\d{1,2})?\s*%)",
      "IgnoreCase"
    )
  }

  if ($match.Success) {
    $value = ($match.Groups[1].Value -replace "\s+", "")
    $wholeNumberMatch = [regex]::Match($value, "^(\d{2})%$")

    if ($wholeNumberMatch.Success) {
      $digits = $wholeNumberMatch.Groups[1].Value
      return "$($digits[0]),$($digits[1])%"
    }

    return $value
  }

  return ""
}

$PdfToPpmPath = Resolve-ToolPath -CommandName "pdftoppm" -FallbackPaths @(
  "C:\Users\Frederik\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin\pdftoppm.exe"
)
$TesseractPath = Resolve-ToolPath -CommandName "tesseract" -FallbackPaths @(
  "C:\Program Files\Tesseract-OCR\tesseract.exe"
)

if (-not $PdfToPpmPath) {
  throw "pdftoppm blev ikke fundet."
}

if (-not $TesseractPath) {
  throw "tesseract blev ikke fundet."
}

$rows = foreach ($filePath in $Files) {
  $file = Get-Item -LiteralPath $filePath
  $ocr = Get-OcrData -PdfPath $file.FullName -PdfToPpmPath $PdfToPpmPath -TesseractPath $TesseractPath
  $pageOneText = if ($ocr.pages.Count -ge 1) { $ocr.pages[0] } else { "" }
  $sampleType = Extract-SampleType -PageOneText $pageOneText

  [pscustomobject]@{
    file = $file.Name
    recipient = Extract-Recipient -FileName $file.Name -PageOneText $pageOneText
    sample_date = Extract-SampleDate -FileName $file.Name -PageOneText $pageOneText
    sample_type = $sampleType
    delivery_note = Extract-DeliveryNote -FileName $file.Name -AllText $ocr.all
    water_content = if ($sampleType -eq "Vandindhold") { Extract-WaterContent -AllText $ocr.all } else { "" }
  }
}

$rows | ConvertTo-Json -Depth 4

