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

  const knownSampleTypes = uniqueValues([
    /vandindhold/i.test(normalizedText) ? "Vandindhold" : "",
    /kornstørrelsesfordeling/i.test(normalizedText) || /kornst/i.test(normalizedText)
      ? "Kornstørrelsesfordeling"
      : "",
  ]);

  if (knownSampleTypes.length) {
    return knownSampleTypes.join(" + ");
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
    normalized.includes("vandindhold") || Boolean(waterContent) ? "Vandindhold" : "",
    normalized.includes("kornst") || normalized.includes("korn") || normalized.includes("sigt")
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
    }

    return normalizeWhitespace(collectedTexts.join(" "));
  } catch {
    return "";
  } finally {
    await Promise.all([
      fs.unlink(tempPdfPath).catch(() => undefined),
      ...tempImagePaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)),
    ]);
  }
}

export async function parseSaltAnalysisPdf(file: File): Promise<SaltAnalysisRow> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceText = extractPdfText(buffer);
  const pageCount = estimatePdfPageCount(buffer);
  const fileFallback = parseFileNameFallback(file.name);
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

  let recipient =
    findLabeledValue(sourceText, ["rekvirent", "kunde", "modtager", "analyseret for"], stopLabels) ||
    fileFallback.recipient;
  let reportNumber = findReportNumber(sourceText) || fileFallback.reportNumber;
  let deliveryNoteNumber = findFiveDigitDeliveryNote(sourceText) || fileFallback.deliveryNoteNumber;
  const batchNumber = findReference(sourceText, ["batch nr", "batch", "lot nr", "lot"]);
  let sampleDate =
    findDateNearLabels(sourceText, ["prøvestart", "start"]) ||
    findDateNearLabels(sourceText, ["prøvedato", "prøve dato", "udtaget"]) ||
    fileFallback.sampleDate;
  const analysisDate =
    findDateNearLabels(sourceText, ["prøveslut", "slut"]) ||
    findDateNearLabels(sourceText, ["analysedato", "analyse dato", "rapportdato", "dato"]);
  let waterContent =
    findPercentNearLabels(sourceText, ["vandindhold in situ"]) ||
    findPercentNearLabels(sourceText, ["vandindhold", "fugt", "moisture", "h2o"]);
  let sampleType = buildSampleType(sourceText, stopLabels);
  const laboratory = findLabeledValue(
    sourceText,
    ["laboratorium", "lab", "analyseret af"],
    stopLabels,
    80
  );
  const notes = buildNotes(sourceText);

  let ocrText = "";

  if (!sampleType || !waterContent || !recipient || !reportNumber || !deliveryNoteNumber || !sampleDate) {
    ocrText = await runOcrFallback(buffer, pageCount);

    if (!recipient) {
      recipient = fileFallback.recipient || recipient;
    }

    if (!reportNumber) {
      reportNumber = findReportNumber(ocrText) || reportNumber;
    }

    if (!deliveryNoteNumber) {
      deliveryNoteNumber = findFiveDigitDeliveryNote(ocrText) || deliveryNoteNumber;
    }

    if (!sampleDate) {
      sampleDate =
        findDateNearLabels(ocrText, ["prøvestart", "start"]) ||
        findDateNearLabels(ocrText, ["prøvedato", "prøve dato", "udtaget"]) ||
        sampleDate;
    }

    if (!waterContent) {
      const ocrWaterContent =
        findPercentNearLabels(ocrText, ["vandindhold in situ"]) ||
        findPercentNearLabels(ocrText, ["vandindhold", "fugt", "moisture", "h2o"]) ||
        normalizePercentValue(ocrText.match(/\b(\d{1,2}[.,'’]\d)\s*%/)?.[0] ?? "");

      waterContent = ocrWaterContent || waterContent;
    }

    if (!sampleType) {
      sampleType =
        buildSampleType(ocrText, stopLabels) ||
        inferSampleTypeFromOcr(ocrText, pageCount, waterContent);
    }
  }

  if (!sampleType && waterContent) {
    sampleType = "Vandindhold";
  }

  if (sampleType && waterContent && !sampleType.includes("Vandindhold")) {
    sampleType = `Vandindhold + ${sampleType}`;
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
