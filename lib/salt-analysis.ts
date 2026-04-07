import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";
import type { SaltAnalysisRow } from "./salt-analysis-shared";

const execFileAsync = promisify(execFile);
const TEMP_DIR = "/private/tmp";
const DANISH_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marts: "03",
  april: "04",
  maj: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countMojibakeMarkers(value: string) {
  return (value.match(/Ã|Â|â€|�/g) ?? []).length;
}

function decodeLatin1Utf8Mojibake(value: string) {
  if (!/[ÃÂâ€�]/.test(value)) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8").normalize("NFC");
    return countMojibakeMarkers(repaired) < countMojibakeMarkers(value) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeDanishMojibake(value: string) {
  return decodeLatin1Utf8Mojibake(value)
    .replaceAll("ÃƒÂ¦", "\u00e6")
    .replaceAll("ÃƒÂ¸", "\u00f8")
    .replaceAll("ÃƒÂ¥", "\u00e5")
    .replaceAll("Ãƒâ€ ", "\u00c6")
    .replaceAll("ÃƒËœ", "\u00d8")
    .replaceAll("Ãƒâ€¦", "\u00c5")
    .replaceAll("Ã¦", "\u00e6")
    .replaceAll("Ã¸", "\u00f8")
    .replaceAll("Ã¥", "\u00e5")
    .replaceAll("Ã†", "\u00c6")
    .replaceAll("Ã˜", "\u00d8")
    .replaceAll("Ã…", "\u00c5")
    .replaceAll("Ã‚Â¢", "\u00f8")
    .replaceAll("Â¢", "\u00f8");
}

function normalizeOcrText(value: string) {
  return normalizeDanishMojibake(normalizeWhitespace(value))
    .replace(/prgv/gi, "prov")
    .replace(/préve/gi, "prove")
    .replace(/provnings/gi, "provnings")
    .replace(/kornstorrelses/gi, "kornstorrelses")
    .replace(/folgeseddel/gi, "folgeseddel");
}

function normalizeRecipientValue(value: string) {
  return normalizeDanishMojibake(normalizeWhitespace(value))
    .replace(/\s+(?:[\w.+-]+@[\w.-]+\.\w+.*)$/i, "")
    .replace(/\bNgrskovvej\b/gi, "N\u00f8rskovvej")
    .replace(/\bN¢rskovvej\b/gi, "N\u00f8rskovvej")
    .replace(/\bSdlsted\b/gi, "S\u00f8lsted")
    .replace(/\bTonder\b/gi, "T\u00f8nder")
    .replace(/\bKirkegardsvej\b/gi, "Kirkeg\u00e5rdsvej")
    .replace(/\bAbenra\b/gi, "Aabenraa")
    .replace(/\bHillergd\b/gi, "Hiller\u00f8d")
    .replace(/\bHillerd\b/gi, "Hiller\u00f8d")
    .replace(/\bFrederiksveerksgade\b/gi, "Frederiksv\u00e6rksgade")
    .replace(/\bFrederiksvaerksgade\b/gi, "Frederiksv\u00e6rksgade")
    .replace(/\bMaterialegarden\b/gi, "Materialeg\u00e5rden")
    .replace(/\bHumlebzek\b/gi, "Humleb\u00e6k")
    .replace(/\bK liplev\b/g, "Kliplev")
    .replace(/\s+,/g, ",");
}

function normalizeRecipientDisplay(value: string) {
  const normalized = normalizeRecipientValue(value);

  const municipalityPatterns: Array<[RegExp, string]> = [
    [/\bAabenraa\b/i, "Aabenraa Kommune"],
    [/\bViborg\b/i, "Viborg Kommune"],
    [/\bTønder\b/i, "Tønder Kommune"],
    [/\bBillund\b|\bGrindsted\b/i, "Billund Kommune"],
    [/\bFavrskov\b|\bHinnerup\b/i, "Favrskov Kommune"],
    [/\bFredericia\b/i, "Fredericia Kommune"],
    [/\bHolstebro\b/i, "Holstebro Kommune"],
    [/\bKolding\b/i, "Kolding Kommune"],
  ];

  for (const [pattern, label] of municipalityPatterns) {
    if (pattern.test(normalized)) {
      return label;
    }
  }

  const vejdirektoratetCities: Array<[RegExp, string]> = [
    [/\bSkanderborg\b/i, "Vejdirektoratet Skanderborg"],
    [/\bRanders\b/i, "Vejdirektoratet Randers"],
    [/\bLyngby\b/i, "Vejdirektoratet Lyngby"],
    [/\bHillerød\b/i, "Vejdirektoratet Hillerød"],
  ];

  for (const [pattern, label] of vejdirektoratetCities) {
    if (pattern.test(normalized)) {
      return label;
    }
  }

  return normalized;
}

function splitProvidedOcrPages(value: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/\[\[PAGE_BREAK\]\]/g)
    .map((part) => normalizeOcrText(part))
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPdfText(buffer: Buffer) {
  const textChunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of buffer.toString("latin1").matchAll(streamRegex)) {
    const chunk = match[1];
    let inflated = "";

    try {
      inflated = inflateSync(Buffer.from(chunk, "latin1")).toString("latin1");
    } catch {
      continue;
    }

    if (!inflated.includes("BT")) {
      continue;
    }

    let current = "";

    for (let index = 0; index < inflated.length; index += 1) {
      if (inflated[index] !== "(") {
        continue;
      }

      index += 1;
      let depth = 1;
      let value = "";

      while (index < inflated.length && depth > 0) {
        const char = inflated[index];

        if (char === "\\") {
          const next = inflated[index + 1] ?? "";
          const escapes: Record<string, string> = {
            "\\": "\\",
            "(": "(",
            ")": ")",
            n: "\n",
            r: "\r",
            t: "\t",
            b: "\b",
            f: "\f",
          };
          value += escapes[next] ?? next;
          index += 2;
          continue;
        }

        if (char === "(") {
          depth += 1;
          value += char;
          index += 1;
          continue;
        }

        if (char === ")") {
          depth -= 1;

          if (depth === 0) {
            index += 1;
            break;
          }
        }

        value += char;
        index += 1;
      }

      current += value;
    }

    if (/[A-Za-zÆØÅæøå]{3,}/.test(current)) {
      textChunks.push(current);
    }
  }

  return normalizeWhitespace(textChunks.join(" "));
}

function findLabeledValue(text: string, labels: string[], stopLabels: string[], maxLength = 120) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const stopPattern = stopLabels.map(escapeRegex).join("|");
  const pattern = new RegExp(
    `(?:${labelPattern})\\s*[:.]?\\s*(.{1,${maxLength}}?)(?=\\s+(?:${stopPattern})\\s*[:.]?|$)`,
    "i"
  );

  return normalizeWhitespace(text.match(pattern)?.[1] ?? "");
}

function findDateNearLabels(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const numericMatch = text.match(
    new RegExp(
      `(?:${labelPattern})\\s*[:.]?\\s*(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`,
      "i"
    )
  );

  if (numericMatch?.[1]) {
    return normalizeDateValue(numericMatch[1]);
  }

  const textualMatch = text.match(
    new RegExp(
      `(?:${labelPattern})\\s*[:.]?\\s*(\\d{1,2})\\.??\\s+([A-Za-zÆØÅæøå]+)\\s+(\\d{4})`,
      "i"
    )
  );

  if (!textualMatch) {
    return "";
  }

  const [, day, monthName, year] = textualMatch;
  const normalizedMonth = DANISH_MONTHS[monthName.toLocaleLowerCase("da-DK")];

  if (!normalizedMonth) {
    return "";
  }

  return `${day.padStart(2, "0")}.${normalizedMonth}.${year}`;
}

function findPercentNearLabels(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const match = text.match(
    new RegExp(
      `(?:${labelPattern})\\s*[:.]?\\s*(-?\\d{1,2}(?:[.,'’]\\d{1,2})?\\s*%)`,
      "i"
    )
  );

  return normalizePercentValue(match?.[1] ?? "");
}

function findPercentNearLabelsLoose(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const match = text.match(
    new RegExp(
      `(?:${labelPattern})[\\s\\S]{0,80}?(-?\\d{1,2}(?:[.,'’]\\d{1,2})?\\s*%)`,
      "i"
    )
  );

  return normalizePercentValue(match?.[1] ?? "");
}

function inferPercentWithoutSeparator(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 2) {
    return "";
  }

  return `${digits[0]},${digits[1]}%`;
}

function normalizeWaterPercentValue(value: string) {
  const normalized = normalizePercentValue(value);
  const wholeNumberMatch = normalized.match(/^(-?\d{2})\s*%$/);

  if (!wholeNumberMatch) {
    return normalized;
  }

  return inferPercentWithoutSeparator(wholeNumberMatch[1]) || normalized;
}

function extractPercentFromWaterZoneText(value: string) {
  const normalizedValue = normalizeWhitespace(value);

  if (!normalizedValue) {
    return "";
  }

  const valueNearWnat =
    normalizedValue.match(/wnat[\s\S]{0,30}?(-?\d{1,2}\s*[.,'’]\s*\d{1,2})\s*%?/i)?.[1] ||
    normalizedValue.match(/wnat[\s\S]{0,30}?(-?\d)\s+(\d)\s*%?/i)?.slice(1, 3).join(",") ||
    normalizedValue.match(/wnat[\s\S]{0,30}?(-?\d{2})\s*%?/i)?.[1] ||
    "";

  if (valueNearWnat) {
    return normalizeWaterPercentValue(`${valueNearWnat} %`);
  }

  const decimalMatch = normalizedValue.match(/(-?\d{1,2})\s*[.,'’]\s*(\d{1,2})\s*%/);

  if (decimalMatch) {
    return normalizeWaterPercentValue(`${decimalMatch[1]},${decimalMatch[2]} %`);
  }

  const splitDigitMatch = normalizedValue.match(/(-?\d)\s+(\d)\s*%/);

  if (splitDigitMatch) {
    return normalizeWaterPercentValue(`${splitDigitMatch[1]},${splitDigitMatch[2]} %`);
  }

  const doubleDigitWholeMatch = normalizedValue.match(/(-?\d{2})\s*%/);

  if (doubleDigitWholeMatch) {
    return normalizeWaterPercentValue(`${doubleDigitWholeMatch[1]} %`);
  }

  const singleDigitWholeMatch = normalizedValue.match(/(-?\d)\s*%/);

  if (singleDigitWholeMatch) {
    return normalizeWaterPercentValue(`${singleDigitWholeMatch[1]},0 %`);
  }

  const decimalWithoutPercentMatch = normalizedValue.match(/(-?\d{1,2})\s*[.,'’]\s*(\d{1,2})(?=\D*$)/);

  if (decimalWithoutPercentMatch) {
    return normalizeWaterPercentValue(`${decimalWithoutPercentMatch[1]},${decimalWithoutPercentMatch[2]} %`);
  }

  const splitDigitWithoutPercentMatch = normalizedValue.match(/(-?\d)\s+(\d)(?=\D*$)/);

  if (splitDigitWithoutPercentMatch) {
    return normalizeWaterPercentValue(`${splitDigitWithoutPercentMatch[1]},${splitDigitWithoutPercentMatch[2]} %`);
  }

  const doubleDigitWholeWithoutPercentMatch = normalizedValue.match(/(-?\d{2})(?=\D*$)/);

  if (doubleDigitWholeWithoutPercentMatch) {
    return normalizeWaterPercentValue(`${doubleDigitWholeWithoutPercentMatch[1]} %`);
  }

  return "";
}

function findWaterContentInWaterZones(text: string) {
  const zones = Array.from(
    text.matchAll(/\[\[WATER_ZONE\]\]([\s\S]{0,180}?)(?=\[\[PAGE_BREAK\]\]|\[\[WATER_ZONE\]\]|$)/g)
  )
    .map((match) => extractPercentFromWaterZoneText(match[1] ?? ""))
    .filter(Boolean);

  return zones[0] ?? "";
}

function findWaterContentValue(text: string) {
  if (!text) {
    return "";
  }

  const waterZoneValue = findWaterContentInWaterZones(text);

  if (waterZoneValue) {
    return waterZoneValue;
  }

  const directMatch =
    text.match(/vandindhold\s+in\s+situ(?:\s+wnat)?[\s\S]{0,120}?(-?\d{1,2}(?:[.,'’]\d{1,2})?\s*%)/i)?.[1] ||
    text.match(/wnat[\s\S]{0,80}?(-?\d{1,2}(?:[.,'’]\d{1,2})?\s*%)/i)?.[1] ||
    text.match(/(-?\d{1,2}(?:[.,'’]\d{1,2})?\s*%)\s*\|?\s*vandindhold\b/i)?.[1] ||
    text.match(/(-?\d{1,2}(?:[.,'’]\d{1,2})?\s*%)\s*\|?\s*wnat\b/i)?.[1] ||
    findPercentNearLabels(text, ["vandindhold in situ"]) ||
    findPercentNearLabelsLoose(text, ["vandindhold in situ"]) ||
    findPercentNearLabels(text, ["wnat"]) ||
    findPercentNearLabelsLoose(text, ["wnat"]);

  if (directMatch) {
    return normalizeWaterPercentValue(directMatch);
  }

  const inferredFromInSitu = text.match(
    /vandindhold\s+in\s+situ[\s\S]{0,40}?(\d{2})\s*%(?=[\sA-Za-z]|$)/i
  )?.[1];

  if (inferredFromInSitu) {
    return inferPercentWithoutSeparator(inferredFromInSitu);
  }

  const inferredFromWnat = text.match(/wnat[\s\S]{0,20}?(\d{2})\s*%(?=[\sA-Za-z]|$)/i)?.[1];

  if (inferredFromWnat) {
    return inferPercentWithoutSeparator(inferredFromWnat);
  }

  return "";
}

function normalizePercentValue(value: string) {
  return normalizeWhitespace(value)
    .replace(/[’']/g, ",")
    .replace(/\s+/g, " ");
}

function findReference(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const match = text.match(
    new RegExp(
      `(?:${labelPattern})\\s*[:.]?\\s*([A-Z0-9][A-Z0-9./-]{2,40})`,
      "i"
    )
  );

  return normalizeWhitespace(match?.[1] ?? "");
}

function normalizeReportNumber(value: string) {
  const compact = normalizeWhitespace(value).replace(/\s+/g, "").toUpperCase();
  const match = compact.match(/^R-?(\d{2})-?(\d{3,})-?([A-Z])$/);

  if (!match) {
    return compact;
  }

  return `R-${match[1]}-${match[2]}${match[3]}`;
}

function normalizeDateValue(value: string) {
  const cleaned = normalizeWhitespace(value);
  const dottedMatch = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);

  if (dottedMatch) {
    const [, day, month, rawYear] = dottedMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }

  return cleaned;
}

function normalizeRecipientFromLocation(value: string) {
  const cleaned = normalizeWhitespace(value);

  if (!cleaned) {
    return "";
  }

  const vejdirektoratetMatch = cleaned.match(/^VD\s+(.+)$/i);

  if (vejdirektoratetMatch) {
    return `Vejdirektoratet ${normalizeWhitespace(vejdirektoratetMatch[1])}`;
  }

  if (/kommune|vejdirektoratet|a\/s|aps|region/i.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned} Kommune`;
}

function parseFileNameFallback(fileName: string) {
  const nameWithoutExtension = fileName.replace(/\.pdf$/i, "");
  const fullMatch = nameWithoutExtension.match(
    /^([A-Z]\d{5,}[A-Z]?)\s*-\s*(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s*-\s*(.*)$/i
  );
  const simpleMatch = nameWithoutExtension.match(
    /^([A-Z]\d{5,}[A-Z]?)\s*-\s*(\d{2}\.\d{2}\.\d{4})\s+(.+?)$/i
  );
  const match = fullMatch ?? simpleMatch;

  if (!match) {
    return {
      deliveryNoteNumber: "",
      recipient: "",
      reportNumber: "",
      sampleDate: "",
    };
  }

  const [, rawReportNumber, sampleDate, rawRecipient, trailingSegment = ""] = match;
  const trailingValue = normalizeWhitespace(trailingSegment);
  const deliveryNoteNumber = /^\d{5}$/.test(trailingValue) ? trailingValue : "";

  return {
    deliveryNoteNumber,
    recipient: normalizeRecipientFromLocation(rawRecipient),
    reportNumber: normalizeReportNumber(rawReportNumber),
    sampleDate,
  };
}

function findFiveDigitDeliveryNote(text: string) {
  const match = text.match(/\bMrk\.?\s*[:.]?\s*(\d{5})\b/i);
  return match?.[1] ?? "";
}

function findReportNumber(text: string) {
  const labeledReference = findReference(text, [
    "prøvetagningsrapport nr",
    "prøvetagningsrapport",
    "prøvningsrapportnr",
    "prøvningsrapport nr",
    "rap nr",
    "rap. nr",
    "rapport nr",
    "rapportnummer",
  ]);

  if (labeledReference) {
    return normalizeReportNumber(labeledReference);
  }

  const directMatch = text.match(/\bR-?\d{2}-?\d{3,}[A-Z]\b/i);
  return normalizeReportNumber(directMatch?.[0] ?? "");
}

function extractDescriptionSampleType(text: string) {
  const normalizedText = normalizeWhitespace(text);
  const hasWaterContentMethod =
    /ds\/en\s*1097-5/i.test(normalizedText) || /vandindhold\s*\(2013\)/i.test(normalizedText);
  const hasGradingMethod =
    /ds\/en\s*1235/i.test(normalizedText) || /kornstørrelsesfordeling/i.test(normalizedText);

  // Side 1/metodereferencen er mere pålidelig end generiske felter fra skemaer på side 2/3.
  if (hasWaterContentMethod && hasGradingMethod) {
    return "Kornstørrelsesfordeling + Vandindhold";
  }

  if (hasGradingMethod) {
    return "Kornstørrelsesfordeling";
  }

  if (hasWaterContentMethod) {
    return "Vandindhold";
  }

  const directDescriptionMatch = normalizedText.match(
    /DS\/EN\s*\d{3,4}(?:-\d+)?\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s-]{3,80}?)(?:\s*\(\d{4}(?:\+A\d+:\d{4})?\))?(?=\s+Rapport|\s*$)/i
  );

  const rawDescription = normalizeWhitespace(directDescriptionMatch?.[1] ?? "");
  const cleanedDescription = rawDescription.replace(/\s*\(\d{4}\)\s*$/, "");

  if (/vandindhol/i.test(cleanedDescription) || /vandindhol/i.test(normalizedText)) {
    return "Vandindhold";
  }

  if (/kornst/i.test(cleanedDescription) || /kornst/i.test(normalizedText)) {
    return "Kornstørrelsesfordeling";
  }

  return cleanedDescription;
}

function buildSampleType(text: string, stopLabels: string[]) {
  const descriptionSampleType = extractDescriptionSampleType(text);

  if (descriptionSampleType) {
    return descriptionSampleType;
  }

  const methodName = findLabeledValue(
    text,
    ["metode navn", "metodenavn", "materialer"],
    stopLabels,
    80
  );
  const description = findLabeledValue(
    text,
    ["beskrivelse", "rapport indhold"],
    stopLabels,
    140
  );
  const cleanedMethodName = normalizeWhitespace(methodName).replace(/^[^A-Za-zÆØÅæøå0-9]+/, "");
  const cleanedDescription = normalizeWhitespace(description).replace(/^[^A-Za-zÆØÅæøå0-9]+/, "");
  const combinedText = normalizeWhitespace([cleanedDescription, cleanedMethodName].join(" "));
  const combinedKnownTypes = uniqueValues([
    /vandindhold/i.test(combinedText) ? "Vandindhold" : "",
    /kornstørrelsesfordeling/i.test(combinedText) || /kornst/i.test(combinedText)
      ? "Kornstørrelsesfordeling"
      : "",
  ]);

  if (combinedKnownTypes.length) {
    return combinedKnownTypes.join(" + ");
  }

  return cleanedDescription || cleanedMethodName;
}

function buildNotes(text: string) {
  const metrics = [
    { label: "NaCl", labels: ["nacl", "natriumklorid", "sodium chloride"] },
    { label: "Ca", labels: ["calcium", "ca"] },
    { label: "Mg", labels: ["magnesium", "mg"] },
    { label: "SO4", labels: ["sulfat", "sulphate", "so4"] },
    { label: "Uopløseligt", labels: ["uopløselig", "uopløseligt", "insoluble"] },
  ];

  const parts = metrics
    .map((metric) => {
      const value = findPercentNearLabels(text, metric.labels);
      return value ? `${metric.label}: ${value}` : "";
    })
    .filter(Boolean);

  return parts.join(" | ");
}

function buildExcerpt(text: string) {
  return text.slice(0, 280).trim();
}

function estimatePdfPageCount(buffer: Buffer) {
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

function normalizeLookupValue(value: string) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^a-z0-9% ]+/g, " ");
}

function inferSampleTypeFromOcr(ocrText: string, pageCount: number, waterContent: string) {
  const normalized = normalizeLookupValue(ocrText);
  const inferredTypes = uniqueValues([
    normalized.includes("1097 5") ? "Vandindhold" : "",
    normalized.includes("1235") || normalized.includes("kornst") || normalized.includes("korn") || normalized.includes("sigt")
      ? "Kornstørrelsesfordeling"
      : "",
  ]);

  if (inferredTypes.length) {
    return inferredTypes.join(" + ");
  }

  if (normalized.includes("cbr") || pageCount >= 3) {
    return "Kornstørrelsesfordeling";
  }

  return "";
}

async function runOcrFallback(buffer: Buffer, pageCount: number) {
  const tempPdfPath = path.join(TEMP_DIR, `${randomUUID()}.pdf`);
  const tempImagePaths: string[] = [];
  const tempWaterCropPaths: string[] = [];

  try {
    await fs.writeFile(tempPdfPath, buffer);
    const pagesToCheck = Array.from(
      { length: Math.min(Math.max(pageCount, 1), 4) },
      (_, index) => index + 1
    );
    const collectedTexts: string[] = [];

    for (const pageNumber of pagesToCheck) {
      const tempImagePath = path.join(TEMP_DIR, `${randomUUID()}-page-${pageNumber}.png`);
      tempImagePaths.push(tempImagePath);

      await execFileAsync("swift", [
        "-module-cache-path",
        "/tmp/swift-module-cache",
        path.join(process.cwd(), "scripts/render_pdf_page.swift"),
        tempPdfPath,
        String(pageNumber),
        tempImagePath,
      ]);

      const ocrRuns = await Promise.all(
        ["6", "11"].map(async (psm) => {
          const { stdout } = await execFileAsync("/opt/homebrew/bin/tesseract", [
            tempImagePath,
            "stdout",
            "-l",
            "dan+eng",
            "--psm",
            psm,
          ]);
          return stdout;
        })
      );

      for (const stdout of ocrRuns) {
        if (stdout) {
          collectedTexts.push(stdout);
        }
      }

      if (pageNumber >= 2) {
        const tempWaterCropPath = path.join(TEMP_DIR, `${randomUUID()}-page-${pageNumber}-water.png`);
        tempWaterCropPaths.push(tempWaterCropPath);

        try {
          await execFileAsync("swift", [
            "-module-cache-path",
            "/tmp/swift-module-cache",
            path.join(process.cwd(), "scripts/crop_image_region.swift"),
            tempImagePath,
            "0.18",
            "0.73",
            "0.62",
            "0.17",
            tempWaterCropPath,
          ]);

          const waterZoneRuns = await Promise.all(
            ["6", "11"].map(async (psm) => {
              const { stdout } = await execFileAsync("/opt/homebrew/bin/tesseract", [
                tempWaterCropPath,
                "stdout",
                "-l",
                "dan+eng",
                "--psm",
                psm,
              ]);
              return stdout;
            })
          );

          const waterZoneText = normalizeWhitespace(waterZoneRuns.join(" "));

          if (waterZoneText) {
            collectedTexts.push(`[[WATER_ZONE]] ${waterZoneText}`);
          }
        } catch {
          // Ignore focused crop OCR failures and keep the broader page OCR.
        }
      }
    }

    return normalizeWhitespace(collectedTexts.join(" "));
  } catch {
    return "";
  } finally {
    await Promise.all([
      fs.unlink(tempPdfPath).catch(() => undefined),
      ...tempImagePaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
      ...tempWaterCropPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
    ]);
  }
}

export async function parseSaltAnalysisPdf(
  file: File,
  providedOcrText = ""
): Promise<SaltAnalysisRow> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceText = extractPdfText(buffer);
  const pageCount = estimatePdfPageCount(buffer);
  const fileFallback = parseFileNameFallback(file.name);
  const providedOcrPages = splitProvidedOcrPages(providedOcrText);
  const providedOcrPageOne = providedOcrPages[0] ?? "";
  const providedOcrLaterPages = providedOcrPages.slice(1).join(" ");
  const stopLabels = [
    "rekvirent",
    "kunde",
    "modtager",
    "til",
    "prøvestart",
    "prøveslut",
    "prøvedato",
    "prøve dato",
    "analysedato",
    "rapportdato",
    "følgeseddel",
    "følgeseddel nr",
    "mrk",
    "batch",
    "lot",
    "produkt",
    "vare",
    "materiale",
    "laboratorium",
    "lab",
    "vandindhold",
    "vandindhold in situ",
    "fugt",
    "moisture",
    "metode navn",
    "metodenavn",
    "beskrivelse",
  ];

  let recipient = normalizeRecipientDisplay(
    findLabeledValue(sourceText, ["rekvirent", "kunde", "modtager", "analyseret for"], stopLabels) ||
      findLabeledValue(providedOcrPageOne, ["rekvirent", "kunde", "modtager", "analyseret for"], stopLabels) ||
      fileFallback.recipient
  );
  let reportNumber = findReportNumber(sourceText) || fileFallback.reportNumber;
  let deliveryNoteNumber = fileFallback.deliveryNoteNumber;
  const batchNumber = findReference(sourceText, ["batch nr", "batch", "lot nr", "lot"]);
  let sampleDate =
    findDateNearLabels(sourceText, ["prøvestart", "start"]) ||
    findDateNearLabels(sourceText, ["prøvedato", "prøve dato", "udtaget"]) ||
    findDateNearLabels(providedOcrPageOne, ["prøvestart", "start"]) ||
    findDateNearLabels(providedOcrPageOne, ["prøvedato", "prøve dato", "udtaget"]) ||
    fileFallback.sampleDate;
  const analysisDate =
    findDateNearLabels(sourceText, ["prøveslut", "slut"]) ||
    findDateNearLabels(sourceText, ["analysedato", "analyse dato", "rapportdato", "dato"]);
  let waterContent = findWaterContentValue(providedOcrLaterPages);
  let sampleType =
    buildSampleType(sourceText, stopLabels) ||
    buildSampleType(providedOcrPageOne, stopLabels);
  const laboratory = findLabeledValue(
    sourceText,
    ["laboratorium", "lab", "analyseret af"],
    stopLabels,
    80
  );
  const notes = buildNotes(sourceText);

  let ocrText = normalizeOcrText(providedOcrText);

  if (!sampleType || !waterContent || !recipient || !reportNumber || !deliveryNoteNumber || !sampleDate) {
    if (!ocrText) {
      ocrText = normalizeOcrText(await runOcrFallback(buffer, pageCount));
    }

    const fallbackOcrPages = splitProvidedOcrPages(ocrText);
    const fallbackOcrPageOne = fallbackOcrPages[0] ?? ocrText;
    const fallbackOcrLaterPages = fallbackOcrPages.length > 1 ? fallbackOcrPages.slice(1).join(" ") : ocrText;

    if (!recipient) {
      recipient = normalizeRecipientDisplay(
        findLabeledValue(fallbackOcrPageOne, ["rekvirent", "kunde", "modtager", "analyseret for"], stopLabels) ||
          fileFallback.recipient ||
          recipient
      );
    }

    if (!reportNumber) {
      reportNumber = findReportNumber(ocrText) || reportNumber;
    }

    if (!sampleDate) {
      sampleDate =
        findDateNearLabels(fallbackOcrPageOne, ["prøvestart", "start"]) ||
        findDateNearLabels(fallbackOcrPageOne, ["prøvedato", "prøve dato", "udtaget"]) ||
        sampleDate;
    }

    if (!waterContent) {
      waterContent = findWaterContentValue(fallbackOcrLaterPages) || waterContent;
    }

    if (!sampleType) {
      sampleType =
        buildSampleType(fallbackOcrPageOne, stopLabels) ||
        inferSampleTypeFromOcr(fallbackOcrPageOne, pageCount, waterContent);
    }
  }

  if (!sampleType && waterContent && /1097-5|vandindhold\s*\(2013\)/i.test(ocrText || sourceText)) {
    sampleType = "Vandindhold";
  }

  if (sampleType && waterContent && !sampleType.includes("Vandindhold")) {
    sampleType = `${sampleType} + Vandindhold`;
  }

  if (sampleType && /^[,.-]/.test(sampleType)) {
    sampleType = waterContent ? "Vandindhold" : sampleType.replace(/^[,.\-\s]+/, "");
  }

  const sourceExcerpt = buildExcerpt(sourceText || ocrText || file.name);

  const parsedFieldCount = [
    recipient,
    reportNumber,
    deliveryNoteNumber,
    sampleDate,
    analysisDate,
    waterContent,
    sampleType,
    laboratory,
    notes,
  ].filter(Boolean).length;

  return {
    analysisDate,
    batchNumber,
    deliveryNoteNumber,
    fileName: file.name,
    laboratory,
    notes,
    parsedFieldCount,
    recipient,
    reportNumber,
    sampleDate,
    sampleType,
    sourceExcerpt,
    status: parsedFieldCount >= 4 ? "klar" : "tjek",
    waterContent,
  };
}
