import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";

const execFileAsync = promisify(execFile);

const OUTPUT_HEADERS = [
  "SKIkundenr",
  "Kundenavn",
  "Adresse",
  "Varenr",
  "Varenavn",
  "Varegruppe",
  "Fakturanr",
  "Antal",
  "Enhed",
  "Linietotal",
  "Valuta",
  "Fakturadato",
  "SKIRammekontrakt",
  "SKIIndrapporteringskode",
  "Enhedspris",
] as const;

const VEJDIREKTORATET_LOCATIONS = [
  "Lyngby",
  "Hillerød",
  "Aalborg",
  "København",
  "Skanderborg",
  "Randers",
  "Vejle",
  "Bramming",
  "Viborg",
  "Holstebro",
  "Kolding",
] as const;

export type SkiMetadataRow = {
  searchName: string;
  customerName: string;
  address1: string;
  address2: string;
  ean: string;
  skiReportingCode: string;
  itemNumber: string;
  itemName: string;
  itemGroup: string;
  contract: string;
  unitPrice: string;
  unit: string;
};

export type MetadataWorkbookParseResult = {
  debug: string;
  rows: SkiMetadataRow[];
  selectedSheetName: string;
  sheetNames: string[];
};

export type ParsedInvoiceLine = {
  description: string;
  itemGroup: string;
  itemNumber: string;
  lineTotal: number;
  quantity: number;
  quantitySource: QuantitySource;
  rawQuantity: string;
  skiId: string;
  unit: string;
  unitPrice: number;
};

type QuantitySource = "parsed" | "fallback_from_total" | "subtotal_division";

export type ParsedInvoice = {
  adjustedSubtotal: number;
  customerRaw: string;
  dateIso: string;
  dateLabel: string;
  debtorAddress: string;
  debtorAddressCandidates: string[];
  deliveryAddress: string;
  deliveryCity: string;
  fileName: string;
  invoiceNumber: string;
  lines: ParsedInvoiceLine[];
  lookupCandidates: string[];
  reference: string;
  sourceText: string;
};

export type ReportRow = {
  address: string;
  controlPrice: string;
  controlStatus: "correct" | "review" | "incomplete" | "not_relevant";
  customerName: string;
  dateFormat: string;
  ean: string;
  fakturaDato: string;
  fakturaNr: string;
  itemGroup: string;
  itemName: string;
  itemNumber: string;
  lineTotal: string;
  lookupKey: string;
  quantity: string;
  readQuantity: string;
  skiContract: string;
  skiReportingCode: string;
  sourceFileName: string;
  status: "matched" | "review";
  statusMessage: string;
  unit: string;
  unitPrice: string;
  valuta: string;
};

function aggregateInvoiceLines(lines: ParsedInvoiceLine[]) {
  const grouped = new Map<string, ParsedInvoiceLine>();

  for (const line of lines) {
    const key = [line.itemNumber, line.skiId, line.unit].join("|");
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...line });
      continue;
    }

    existing.lineTotal += line.lineTotal;
    existing.quantity += line.quantity;
    existing.quantitySource =
      existing.quantitySource === "parsed" && line.quantitySource === "parsed"
        ? "parsed"
        : "fallback_from_total";
  }

  return Array.from(grouped.values());
}

type CellValueMap = Map<string, string>;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLookupValue(value: string) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeCsv(value: string) {
  if (/[;"\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function formatDateForCsv(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return value;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function toDecimalString(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(value);
}

function parseDanishNumber(value: string) {
  const cleaned = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCaseCity(value: string) {
  return value
    .toLocaleLowerCase("da-DK")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toLocaleUpperCase("da-DK") + segment.slice(1))
    .join(" ");
}

function getResolvedCustomerName(customerRaw: string, deliveryAddress: string, deliveryCity: string) {
  const normalizedCustomer = normalizeWhitespace(customerRaw);

  if (!/^Vejdirektoratet$/i.test(normalizedCustomer)) {
    return normalizedCustomer;
  }

  const normalizedDeliveryAddress = normalizeLookupValue(deliveryAddress);
  const normalizedDeliveryCity = normalizeLookupValue(deliveryCity);

  for (const location of VEJDIREKTORATET_LOCATIONS) {
    const normalizedLocation = normalizeLookupValue(location);

    if (
      normalizedDeliveryAddress.includes(normalizedLocation) ||
      normalizedDeliveryCity.includes(normalizedLocation)
    ) {
      return `Vejdirektoratet ${location}`;
    }
  }

  if (deliveryCity) {
    return `Vejdirektoratet ${titleCaseCity(deliveryCity)}`;
  }

  return "Vejdirektoratet";
}

async function readZipEntry(zipPath: string, entryPath: string) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, entryPath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

function getSharedStrings(xml: string) {
  const strings: string[] = [];
  const matches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g);

  for (const match of matches) {
    const text = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");
    strings.push(text);
  }

  return strings;
}

function getSheetTargets(workbookXml: string, relsXml: string) {
  const relations = Array.from(
    relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)
  );

  return Array.from(
    workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)
  ).map((match) => {
    const relationMatch = relations.find((relation) => relation[1] === match[2]);

    if (!relationMatch) {
      return null;
    }

    return {
      name: match[1],
      target: relationMatch[2].startsWith("xl/")
        ? relationMatch[2]
        : `xl/${relationMatch[2].replace(/^\/+/, "")}`,
    };
  }).filter((value): value is { name: string; target: string } => Boolean(value));
}

function getCellValues(sheetXml: string, sharedStrings: string[]) {
  const rows = new Map<number, CellValueMap>();
  let fallbackRowNumber = 0;

  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttributes = rowMatch[1];
    const explicitRowNumber = rowAttributes.match(/\br="(\d+)"/);
    const rowNumber = explicitRowNumber ? Number(explicitRowNumber[1]) : fallbackRowNumber + 1;
    fallbackRowNumber = rowNumber;
    const cellMap: CellValueMap = new Map();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const refMatch = attrs.match(/\br="([A-Z]+\d+)"/);

      if (!refMatch) {
        continue;
      }

      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      const textMatches = Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((match) =>
        decodeXml(match[1])
      );

      let value = "";

      if (typeMatch?.[1] === "s" && valueMatch) {
        value = sharedStrings[Number(valueMatch[1])] ?? "";
      } else if (textMatches.length) {
        value = textMatches.join("");
      } else if (valueMatch) {
        value = decodeXml(valueMatch[1]);
      }

      cellMap.set(refMatch[1], normalizeWhitespace(value));
    }

    rows.set(rowNumber, cellMap);
  }

  return rows;
}

function getCell(cellMap: CellValueMap, column: string) {
  return cellMap.get(`${column}`) ?? "";
}

function getColumnLetters(cellRef: string) {
  const match = cellRef.match(/^([A-Z]+)/);
  return match?.[1] ?? "";
}

function looksLikeMetadataSheet(rows: Map<number, CellValueMap>) {
  for (const rowNumber of [1, 2, 3, 4, 5]) {
    const row = rows.get(rowNumber);

    if (!row) {
      continue;
    }

    const firstColumns = ["A", "B", "C", "D", "E", "F"]
      .map((column) => normalizeLookupValue(getCell(row, column)))
      .filter(Boolean);

    const hasSearchName = firstColumns.some((value) => value.includes("sogenavn"));
    const hasCustomerName = firstColumns.some((value) => value === "navn" || value.includes("kundenavn"));
    const hasAddress = firstColumns.some((value) => value.includes("adresse"));

    if ((hasSearchName && hasCustomerName) || (hasCustomerName && hasAddress)) {
      return true;
    }
  }

  return false;
}

function isMetadataHeaderRow(cellMap: CellValueMap) {
  const firstColumns = ["A", "B", "C", "D", "E", "F"]
    .map((column) => normalizeLookupValue(getCell(cellMap, column)))
    .filter(Boolean);

  const hasSearchName = firstColumns.some((value) => value.includes("sogenavn"));
  const hasCustomerName = firstColumns.some((value) => value === "navn" || value.includes("kundenavn"));
  const hasAddress = firstColumns.some((value) => value.includes("adresse"));

  return (hasSearchName && hasCustomerName) || (hasCustomerName && hasAddress);
}

function findHeaderColumns(rows: Map<number, CellValueMap>) {
  for (const [, cellMap] of rows) {
    if (!isMetadataHeaderRow(cellMap)) {
      continue;
    }

    const headerMap = new Map<string, string>();

    for (const [cellRef, value] of cellMap.entries()) {
      headerMap.set(normalizeLookupValue(value), getColumnLetters(cellRef));
    }

    return headerMap;
  }

  return new Map<string, string>();
}

function getCellByHeader(
  cellMap: CellValueMap,
  headerColumns: Map<string, string>,
  ...headerCandidates: string[]
) {
  for (const candidate of headerCandidates) {
    const column = headerColumns.get(normalizeLookupValue(candidate));

    if (column) {
      return getCell(cellMap, column);
    }
  }

  return "";
}

function summarizeSheetRow(row: CellValueMap | undefined) {
  if (!row) {
    return "(ingen række)";
  }

  return ["A", "B", "C", "D", "E", "F"]
    .map((column) => getCell(row, column))
    .filter(Boolean)
    .join(" | ");
}

function summarizeFirstNonEmptyRows(rows: Map<number, CellValueMap>, limit = 3) {
  const previews: string[] = [];

  for (const [rowNumber, row] of rows) {
    const summary = summarizeSheetRow(row);

    if (!summary || summary === "(ingen række)") {
      continue;
    }

    previews.push(`Række ${rowNumber}: ${summary}`);

    if (previews.length >= limit) {
      break;
    }
  }

  return previews.join(" || ") || "(ingen ikke-tomme rækker fundet)";
}

export async function parseMetadataWorkbook(file: File): Promise<MetadataWorkbookParseResult> {
  const tempPath = path.join("/tmp", `${randomUUID()}-${file.name}`);
  await fs.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

  try {
    const workbookXml = await readZipEntry(tempPath, "xl/workbook.xml");
    const relsXml = await readZipEntry(tempPath, "xl/_rels/workbook.xml.rels");
    const sharedStringsXml = await readZipEntry(tempPath, "xl/sharedStrings.xml").catch(
      () => ""
    );
    const sharedStrings = sharedStringsXml ? getSharedStrings(sharedStringsXml) : [];
    const sheetTargets = getSheetTargets(workbookXml, relsXml);
    const sheetNames = sheetTargets.map((sheet) => sheet.name);
    const preferredMetadataSheet = sheetTargets.find(
      (sheet) => normalizeLookupValue(sheet.name) === "metadata"
    );

    let rows = new Map<number, CellValueMap>();
    let selectedSheetName = "";
    const debugParts = [`Faner fundet: ${sheetNames.join(", ") || "(ingen faner)"}`];

    if (preferredMetadataSheet) {
      const metadataXml = await readZipEntry(tempPath, preferredMetadataSheet.target);
      rows = getCellValues(metadataXml, sharedStrings);
      selectedSheetName = preferredMetadataSheet.name;
      debugParts.push(
        `Foretrukken metadata-fane: ${preferredMetadataSheet.name}; header-preview: ${summarizeSheetRow(
          rows.get(1)
        )}; første rækker: ${summarizeFirstNonEmptyRows(rows)}`
      );
    }

    if (!looksLikeMetadataSheet(rows)) {
      for (const sheet of sheetTargets) {
        const sheetXml = await readZipEntry(tempPath, sheet.target);
        const candidateRows = getCellValues(sheetXml, sharedStrings);
        debugParts.push(
          `Tjekkede fane ${sheet.name}; header-preview: ${summarizeSheetRow(
            candidateRows.get(1)
          )}; første rækker: ${summarizeFirstNonEmptyRows(candidateRows)}`
        );

        if (looksLikeMetadataSheet(candidateRows)) {
          rows = candidateRows;
          selectedSheetName = sheet.name;
          break;
        }
      }
    }

    const parsedRows: SkiMetadataRow[] = [];
    const headerColumns = findHeaderColumns(rows);

    for (const [, cellMap] of rows) {
      if (isMetadataHeaderRow(cellMap)) {
        continue;
      }

      const searchName = getCellByHeader(cellMap, headerColumns, "Søgenavn");
      const customerName = getCellByHeader(cellMap, headerColumns, "Navn", "Kundenavn");
      const address1 = getCellByHeader(cellMap, headerColumns, "Adresse 1", "Adresse");
      const address2 = getCellByHeader(cellMap, headerColumns, "Adresse 2");
      const ean = getCellByHeader(cellMap, headerColumns, "EAN Nummer", "SKIkundenr");
      const skiReportingCode = getCellByHeader(
        cellMap,
        headerColumns,
        "Skiindrapporteringskode",
        "SKIIndrapporteringskode"
      );
      const itemNumber = getCellByHeader(cellMap, headerColumns, "Varenummer", "Varenr");
      const itemName = getCellByHeader(cellMap, headerColumns, "Varenavn");
      const itemGroup = getCellByHeader(cellMap, headerColumns, "Varegruppe");
      const contract = getCellByHeader(cellMap, headerColumns, "Delaftale", "SKIRammekontrakt");
      const unitPrice = getCellByHeader(cellMap, headerColumns, "Enhedspris");
      const unit = getCellByHeader(cellMap, headerColumns, "Enhed");

      if (!searchName && !customerName && !itemNumber) {
        continue;
      }

      parsedRows.push({
        address1,
        address2,
        contract,
        customerName,
        ean,
        itemGroup,
        itemName,
        itemNumber,
        searchName,
        skiReportingCode,
        unit,
        unitPrice,
      });
    }

    debugParts.push(
      `Valgt metadata-fane: ${selectedSheetName || "(ingen valgt)"}; metadata-rækker fundet: ${parsedRows.length}`
    );

    return {
      debug: debugParts.join(" || "),
      rows: parsedRows,
      selectedSheetName,
      sheetNames,
    };
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

function extractPdfText(buffer: Buffer) {
  const textChunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of buffer.toString("latin1").matchAll(streamRegex)) {
    const chunk = match[1];
    let inflated: string;

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

function parseQuantity(rawQuantity: string) {
  const compact = rawQuantity.replace(/\s+/g, "");

  if (/^\d+x\d+[,.]?\d*$/i.test(compact)) {
    const [, amount] = compact.split("x");
    return parseDanishNumber(amount);
  }

  return parseDanishNumber(compact);
}

function normalizeInvoiceUnit(rawUnit: string, description: string, rawQuantity: string) {
  const normalizedUnit = rawUnit.toLocaleLowerCase("da-DK").trim();
  const normalizedDescription = normalizeLookupValue(description);
  const compactQuantity = rawQuantity.replace(/\s+/g, "");

  if (normalizedUnit === "ton") {
    return "ton";
  }

  if (
    normalizedUnit === "sække" ||
    normalizedUnit === "stk" ||
    normalizedUnit === "paller" ||
    normalizedUnit === "palle(r)"
  ) {
    if (
      normalizedDescription.includes("palle") ||
      /^(\d+)x\d+(?:[.,]\d+)?$/i.test(compactQuantity) ||
      normalizedUnit === "sække" ||
      normalizedUnit === "paller" ||
      normalizedUnit === "palle(r)"
    ) {
      return "Palle(r)";
    }
  }

  return rawUnit;
}

function normalizeInvoiceQuantity(
  rawQuantity: string,
  normalizedUnit: string,
  lineTotal: number,
  unitPrice: number
): { quantity: number; source: QuantitySource } {
  const compact = rawQuantity.replace(/\s+/g, "");
  const palletMatch = compact.match(/^(\d+)x\d+(?:[.,]\d+)?$/i);

  if (normalizedUnit === "Palle(r)" && palletMatch) {
    return {
      quantity: parseDanishNumber(palletMatch[1]),
      source: "parsed",
    };
  }

  const parsedQuantity = parseQuantity(rawQuantity);

  if (parsedQuantity > 0) {
    return {
      quantity: parsedQuantity,
      source: "parsed",
    };
  }

  if (normalizedUnit === "ton" && lineTotal > 0 && unitPrice > 0) {
    return {
      quantity: Number((lineTotal / unitPrice).toFixed(3)),
      source: "fallback_from_total",
    };
  }

  return {
    quantity: 0,
    source: "parsed",
  };
}

function getControlState(
  line: ParsedInvoiceLine,
  effectiveLineTotal: number,
  effectiveQuantity: number,
  effectiveQuantitySource: ParsedInvoiceLine["quantitySource"]
): Pick<ReportRow, "controlPrice" | "controlStatus"> {
  if (line.unit !== "ton") {
    return {
      controlPrice: "",
      controlStatus: "not_relevant",
    };
  }

  if (effectiveQuantitySource === "subtotal_division") {
    if (line.quantitySource !== "parsed" || line.quantity <= 0) {
      return {
        controlPrice:
          effectiveQuantity > 0 ? toDecimalString(effectiveLineTotal / effectiveQuantity) : "",
        controlStatus: "incomplete",
      };
    }

    const controlPrice = effectiveQuantity > 0 ? effectiveLineTotal / effectiveQuantity : 0;
    const quantityDifference = Math.abs(effectiveQuantity - line.quantity);

    return {
      controlPrice: controlPrice > 0 ? toDecimalString(controlPrice) : "",
      controlStatus: quantityDifference <= 0.2 ? "correct" : "review",
    };
  }

  if (effectiveQuantitySource !== "parsed") {
    return {
      controlPrice:
        effectiveQuantity > 0 ? toDecimalString(effectiveLineTotal / effectiveQuantity) : "",
      controlStatus: "incomplete",
    };
  }

  if (effectiveQuantity <= 0 || effectiveLineTotal <= 0 || line.unitPrice <= 0) {
    return {
      controlPrice: "",
      controlStatus: "incomplete",
    };
  }

  const controlPrice = effectiveLineTotal / effectiveQuantity;
  const difference = Math.abs(controlPrice - line.unitPrice);

  return {
    controlPrice: toDecimalString(controlPrice),
    controlStatus: difference <= 0.1 ? "correct" : "review",
  };
}

function getEffectiveInvoiceQuantity(
  line: ParsedInvoiceLine,
  effectiveLineTotal: number,
  useAdjustedSubtotal: boolean
): { quantity: number; source: QuantitySource } {
  if (line.unit === "ton" && useAdjustedSubtotal && effectiveLineTotal > 0 && line.unitPrice > 0) {
    return {
      quantity: Number((effectiveLineTotal / line.unitPrice).toFixed(3)),
      source: "subtotal_division",
    };
  }

  return {
    quantity: line.quantity,
    source: line.quantitySource,
  };
}

const EXCLUDED_ITEM_NUMBERS = new Set(["4919111", "4919112", "4949091"]);
const ALLOWED_PRODUCT_RULES: Array<{
  itemNumbers: string[];
  aliases: string[];
  units: string[];
}> = [
  {
    itemNumbers: ["4919851", "4919852"],
    aliases: ["stensalt"],
    units: ["ton"],
  },
  {
    itemNumbers: ["4919881", "4919882"],
    aliases: ["havsalt", "loesvaegt", "løsvægt"],
    units: ["ton"],
  },
  {
    itemNumbers: ["4900151"],
    aliases: ["pingo", "vejsalt", "15 kg", "15kg", "70 saekke", "70 sække"],
    units: ["Palle(r)"],
  },
] as const;

const ALLOWED_ITEM_NUMBERS = new Set(
  ALLOWED_PRODUCT_RULES.flatMap((rule) => rule.itemNumbers)
);

function shouldExcludeInvoiceLine(description: string, itemNumber = "") {
  const normalizedDescription = normalizeWhitespace(description)
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (EXCLUDED_ITEM_NUMBERS.has(normalizeWhitespace(itemNumber))) {
    return true;
  }

  return (
    normalizedDescription.includes("proeve") ||
    normalizedDescription.includes("prove") ||
    normalizedDescription.includes("hastleverance") ||
    normalizedDescription.includes("hasteleverance") ||
    normalizedDescription.includes("opskubber") ||
    normalizedDescription.includes("weekendtillaeg") ||
    normalizedDescription.includes("weekendtillag") ||
    normalizedDescription.includes("palle")
  );
}

function isAllowedInvoiceLine(description: string, itemNumber: string, unit: string) {
  const normalizedItemNumber = normalizeWhitespace(itemNumber);

  if (ALLOWED_ITEM_NUMBERS.has(normalizedItemNumber)) {
    return true;
  }

  const normalizedDescription = normalizeLookupValue(description);

  return ALLOWED_PRODUCT_RULES.some((rule) => {
    if (!rule.units.includes(unit)) {
      return false;
    }

    return rule.aliases.some((alias) => normalizedDescription.includes(normalizeLookupValue(alias)));
  });
}

function parseGenericInvoiceLines(text: string) {
  const sanitizedText = text.replace(/\s+/g, " ");
  const lineMatches = Array.from(
    sanitizedText.matchAll(
      /(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*([\d.]+,\d{2})/gi
    )
  );

  return lineMatches
    .map((match) => {
      const rawQuantity = normalizeWhitespace(match[1]);
      const rawUnit = normalizeWhitespace(match[2]);
      const description = normalizeWhitespace(match[3]);
      const unitPrice = parseDanishNumber(match[4]);
      const lineTotal = parseDanishNumber(match[5]);
      const unit = normalizeInvoiceUnit(rawUnit, description, rawQuantity);
      const quantityResult = normalizeInvoiceQuantity(rawQuantity, unit, lineTotal, unitPrice);

      return {
        description,
        itemGroup: "",
        itemNumber: "",
        lineTotal,
        quantity: quantityResult.quantity,
        quantitySource: quantityResult.source,
        rawQuantity,
        skiId: "",
        unit,
        unitPrice,
      } satisfies ParsedInvoiceLine;
    })
    .filter(
      (line) =>
        line.lineTotal > 0 &&
        (line.quantity > 0 || shouldExcludeInvoiceLine(line.description, line.itemNumber))
    );
}

function parseGenericInvoiceBlock(block: string) {
  const normalizedBlock = normalizeWhitespace(block);
  const match = normalizedBlock.match(
    /^(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*([\d.]+,\d{2})/i
  );

  if (!match) {
    return null;
  }

  const rawQuantity = normalizeWhitespace(match[1]);
  const rawUnit = normalizeWhitespace(match[2]);
  const description = normalizeWhitespace(match[3]);
  const unitPrice = parseDanishNumber(match[4]);
  const lineTotal = parseDanishNumber(match[5]);
  const unit = normalizeInvoiceUnit(rawUnit, description, rawQuantity);
  const quantityResult = normalizeInvoiceQuantity(rawQuantity, unit, lineTotal, unitPrice);

  if (
    quantityResult.quantity <= 0 ||
    lineTotal <= 0 ||
    shouldExcludeInvoiceLine(description) ||
    !isAllowedInvoiceLine(description, "", unit) ||
    normalizeLookupValue(description).includes("palle")
  ) {
    return null;
  }

  return {
    description,
    itemGroup: "",
    itemNumber: "",
    lineTotal,
    quantity: quantityResult.quantity,
    quantitySource: quantityResult.source,
    rawQuantity,
    skiId: "",
    unit,
    unitPrice,
  } satisfies ParsedInvoiceLine;
}

function parseInvoiceLines(text: string) {
  const blockDelimiter = "<<<LINE_END>>>";
  const sanitizedText = text
    .replace(
      /Overførtkr[\d.,]+[\s\S]*?Leveringsadresse[\s\S]*?KvantumEnhedBeskrivelseEnhedsprisI ALTOverførtkr[\d.,]+/gi,
      " "
    )
    .replace(
      /UNSPSC:\s*\d{8}(\d{1,3},\d{3}\s*(?:ton|sække|stk|palle\(r\)|paller|kg))/gi,
      `${blockDelimiter}$1`
    )
    .replace(/UNSPSC:\s*\d+/gi, blockDelimiter)
    .replace(/Overførtkr[\d.,]+/gi, `${blockDelimiter} `)
    .replace(/\s+/g, " ");

  const rawBlocks = sanitizedText
    .split(blockDelimiter)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean);

  const structuredLines = rawBlocks
    .map((block) => {
      const match =
        block.match(
        /(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*([\d.]+,\d{2}).*?Varenummer:\s*(\d+)\s*SKI ID:\s*([A-Z0-9-]+)/i
        ) ??
        block.match(
          /(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*Vejeseddelnr\.\s*:\s*[A-Z0-9-]+.*?Varenummer:\s*(\d+)\s*SKI ID:\s*([A-Z0-9-]+)/i
        );

      if (!match) {
        return null;
      }

      const rawQuantity = normalizeWhitespace(match[1]);
      const rawUnit = normalizeWhitespace(match[2]);
      const description = normalizeWhitespace(match[3])
        .replace(/Vejeseddelnr\.\s*:\s*[A-Z0-9-]+/gi, "")
        .trim();
      const unitPrice = parseDanishNumber(match[4]);
      const hasExplicitLineTotal = match.length >= 8;
      const lineTotal = hasExplicitLineTotal ? parseDanishNumber(match[5]) : 0;
      const itemNumber = hasExplicitLineTotal ? match[6] : match[5];
      const skiId = hasExplicitLineTotal ? match[7] : match[6];
      const unit = normalizeInvoiceUnit(rawUnit, description, rawQuantity);
      const quantityResult = normalizeInvoiceQuantity(rawQuantity, unit, lineTotal, unitPrice);

      return {
        description,
        itemGroup: skiId,
        itemNumber,
        lineTotal,
        quantity: quantityResult.quantity,
        quantitySource: quantityResult.source,
        rawQuantity,
        skiId,
        unit,
        unitPrice,
      } satisfies ParsedInvoiceLine;
    })
    .filter(
      (line): line is ParsedInvoiceLine =>
        Boolean(
          line &&
            line.itemNumber &&
            line.quantity > 0 &&
            isAllowedInvoiceLine(line.description, line.itemNumber, line.unit) &&
            !shouldExcludeInvoiceLine(line.description, line.itemNumber)
        )
    );

  const genericLines = parseGenericInvoiceLines(text);

  if (structuredLines.length) {
    const distinctStructuredItems = Array.from(
      new Set(
        structuredLines
          .map((line) =>
            line.itemNumber && line.skiId ? `${line.itemNumber}|${line.skiId}` : ""
          )
          .filter(Boolean)
      )
    );

    const fallbackItem =
      distinctStructuredItems.length === 1 ? distinctStructuredItems[0].split("|") : null;

    const supplementedLines = rawBlocks
      .filter((block) => {
        const structuredMatch =
          block.match(
            /(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*([\d.]+,\d{2}).*?Varenummer:\s*(\d+)\s*SKI ID:\s*([A-Z0-9-]+)/i
          ) ??
          block.match(
            /(\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?)\s*(ton|sække|stk|palle\(r\)|paller|kg)\s*(.*?)\s*kr\s*([\d.,]+)\s*kr\s*Vejeseddelnr\.\s*:\s*[A-Z0-9-]+.*?Varenummer:\s*(\d+)\s*SKI ID:\s*([A-Z0-9-]+)/i
          );

        return !structuredMatch;
      })
      .map((block) => parseGenericInvoiceBlock(block))
      .filter((genericLine): genericLine is ParsedInvoiceLine => Boolean(genericLine))
      .filter((genericLine) => {
        const normalizedGenericDescription = normalizeLookupValue(genericLine.description);

        return !structuredLines.some(
          (structuredLine) =>
            structuredLine.unit === genericLine.unit &&
            Math.abs(structuredLine.quantity - genericLine.quantity) < 0.001 &&
            Math.abs(structuredLine.lineTotal - genericLine.lineTotal) < 0.01 &&
            normalizeLookupValue(structuredLine.description) === normalizedGenericDescription
        );
      })
      .map((genericLine) => {
        if (!fallbackItem) {
          return null;
        }

        const [itemNumber, skiId] = fallbackItem;

        return {
          ...genericLine,
          itemGroup: skiId,
          itemNumber,
          skiId,
        } satisfies ParsedInvoiceLine;
      })
      .filter((line): line is ParsedInvoiceLine => Boolean(line));

    return [...structuredLines, ...supplementedLines];
  }

  return genericLines.filter(
    (line) =>
      isAllowedInvoiceLine(line.description, line.itemNumber, line.unit) &&
      !shouldExcludeInvoiceLine(line.description, line.itemNumber) &&
      !normalizeLookupValue(line.description).includes("palle")
  );
}

function parseInvoiceAdjustedSubtotal(text: string) {
  const normalizedText = normalizeWhitespace(text);
  const subtotalMatch =
    normalizedText.match(/Subtotal\s*kr\.?\s*([\d.]+,\d{2})/i) ??
    normalizedText.match(/Subtotalkr\.?\s*([\d.]+,\d{2})/i);

  const subtotal = subtotalMatch ? parseDanishNumber(subtotalMatch[1]) : 0;

  if (!subtotal) {
    return 0;
  }

  const parsedChargeLines = parseGenericInvoiceLines(text)
    .filter((line) => shouldExcludeInvoiceLine(line.description, line.itemNumber))
    .reduce((sum, line) => sum + line.lineTotal, 0);

  const excludedChargeMatches = Array.from(
    normalizedText.matchAll(
      /(?:-?\d+(?:[.,]\d+)?(?:x-?\d+(?:[.,]\d+)?)?\s*(?:ton|sække|stk|palle\(r\)|paller|kg|timer)\s*)?((?:\S*(?:prøve|prove)\S*|\S*leverance\S*|\S*till[æa]g\S*|\S*opskubber\S*|palle(?:\(r\))?|paller?))\s*kr\s*(-?[\d.,]+)\s*kr\s*(-?[\d.]+,\d{2})/gi
    )
  );

  const excludedTotal = excludedChargeMatches.reduce((sum, match) => {
    const description = normalizeWhitespace(match[1]);

    if (!shouldExcludeInvoiceLine(description)) {
      return sum;
    }

    return sum + Math.abs(parseDanishNumber(match[3]));
  }, 0);

  const uniqueExcludedTotal = Math.max(excludedTotal, parsedChargeLines);

  return Math.max(0, Number((subtotal - uniqueExcludedTotal).toFixed(2)));
}

function parseDeliveryAddress(text: string) {
  const match = text.match(/Leveringsadresse\s*(.*?)\s*KvantumEnhedBeskrivelseEnhedsprisI ALT/i);
  const raw = normalizeWhitespace(match?.[1] ?? "");
  const cityMatch = raw.match(/(\d{4})\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s-]+)/);
  const deliveryCity = cityMatch ? titleCaseCity(normalizeWhitespace(cityMatch[2])) : "";

  return {
    deliveryAddress: raw,
    deliveryCity,
  };
}

function looksLikeStreetAddress(value: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return false;
  }

  if (
    /\b(faktura|nummer|dato|konto|side|moms|ean|deres ref|vores ref|telefon|email|web|vedr)\b/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (!/\d/.test(normalized) || !/[A-Za-zÆØÅæøå]/.test(normalized)) {
    return false;
  }

  if (/^\d{4}\s+[A-Za-zÆØÅæøå]/.test(normalized)) {
    return false;
  }

  return /\d/.test(normalized);
}

function looksLikePostalLine(value: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return false;
  }

  if (/\b(faktura|nummer|dato|konto|side|moms|ean|vedr)\b/i.test(normalized)) {
    return false;
  }

  return /\b\d{4}\s+[A-Za-zÆØÅæøå]/.test(normalized);
}

function splitPotentialAddressLines(value: string) {
  return value
    .split(/\r?\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function parseDebtorAddress(text: string) {
  const blockBeforeNumber = text.match(/FAKTURA([\s\S]*?)Nummer:\.*/i)?.[1] ?? "";
  const blockBeforeDate = text.match(/Nummer:\.*\s*\d+([\s\S]*?)Dato:\.*/i)?.[1] ?? "";
  const blockBeforeAccount =
    text.match(/Dato:\.*\s*\d{2}\/\d{2}-\d{2}([\s\S]*?)Konto:\.*/i)?.[1] ?? "";

  const rawBlocks = [blockBeforeNumber, blockBeforeDate, blockBeforeAccount]
    .flatMap((block) => splitPotentialAddressLines(block))
    .filter(Boolean);
  const debtorAddressCandidates = Array.from(
    new Set(
      rawBlocks
        .filter((block) => looksLikeStreetAddress(block) && !looksLikePostalLine(block))
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean)
    )
  );

  return {
    debtorAddress: debtorAddressCandidates[0] ?? "",
    debtorAddressCandidates,
  };
}

function parseCustomerRaw(text: string) {
  const customerMatch = text.match(/^(.*?)FAKTURA/i);
  const rawCustomer = normalizeWhitespace(customerMatch?.[1] ?? "");

  return normalizeWhitespace(
    rawCustomer
      .replace(
        /^(?:EAN(?:\s*SE)?\s*NOTAT|SE\s*NOTAT|EAN\s*NOTAT|EAN)[:.\s-]*/i,
        ""
      )
      .replace(/^(?:att\.?|c\/o|co|kontaktperson)[:.\s-]*/i, "")
      .replace(/^EAN\s*:?\s*\d{8,20}\s*/i, "")
      .replace(/^\d{8,20}\s*/i, "")
  );
}

function parseDate(text: string) {
  const dateMatch = text.match(/Dato:\.*\s*(\d{2})\/(\d{2})-(\d{2})/i);

  if (!dateMatch) {
    return {
      dateIso: "",
      dateLabel: "",
    };
  }

  const [, day, month, year] = dateMatch;
  const dateIso = `20${year}-${month}-${day}`;

  return {
    dateIso,
    dateLabel: `${day}.${month}.20${year}`,
  };
}

function buildLookupCandidates(
  customerRaw: string,
  debtorAddress: string,
  deliveryAddress: string,
  deliveryCity: string
) {
  const candidates = new Set<string>();
  const normalizedCustomer = getResolvedCustomerName(customerRaw, deliveryAddress, deliveryCity);
  const normalizedDebtorAddress = normalizeWhitespace(debtorAddress);
  const isVejdirektoratet = /^Vejdirektoratet(?:\s|$)/i.test(normalizedCustomer);

  if (normalizedCustomer) {
    candidates.add(normalizedCustomer);
  }

  if (!isVejdirektoratet && normalizedCustomer && normalizedDebtorAddress) {
    candidates.add(`${normalizedCustomer} ${normalizedDebtorAddress}`);
  }

  if (isVejdirektoratet && deliveryCity) {
    candidates.add(`Vejdirektoratet ${deliveryCity}`);
  }

  if (isVejdirektoratet && deliveryAddress) {
    candidates.add(`${normalizedCustomer} ${deliveryAddress}`);
  }

  return Array.from(candidates);
}

function addressMatchesMetadata(debtorAddressCandidates: string[], row: SkiMetadataRow) {
  const rowAddress1 = normalizeLookupValue(row.address1);
  const rowAddress2 = normalizeLookupValue(row.address2);
  const normalizedCandidates = debtorAddressCandidates
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);

  if (!normalizedCandidates.length) {
    return false;
  }

  return normalizedCandidates.some(
    (candidate) =>
      (rowAddress1 && (candidate.includes(rowAddress1) || rowAddress1.includes(candidate))) ||
      (rowAddress2 && (candidate.includes(rowAddress2) || rowAddress2.includes(candidate)))
  );
}

export async function parseInvoicePdf(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceText = extractPdfText(buffer);
  const customerRaw = parseCustomerRaw(sourceText);
  const { dateIso, dateLabel } = parseDate(sourceText);
  const { debtorAddress, debtorAddressCandidates } = parseDebtorAddress(sourceText);
  const { deliveryAddress, deliveryCity } = parseDeliveryAddress(sourceText);
  const invoiceNumberMatch = sourceText.match(/Nummer:\.*\s*(\d+)/i);
  const referenceMatch = sourceText.match(/Deres ref:\.*\s*([A-Za-z0-9-]+)/i);
  const lines = parseInvoiceLines(sourceText);
  const adjustedSubtotal = parseInvoiceAdjustedSubtotal(sourceText);

  return {
    adjustedSubtotal,
    customerRaw,
    dateIso,
    dateLabel,
    debtorAddress,
    debtorAddressCandidates,
    deliveryAddress,
    deliveryCity,
    fileName: file.name,
    invoiceNumber: invoiceNumberMatch?.[1] ?? "",
    lines,
    lookupCandidates: buildLookupCandidates(
      customerRaw,
      debtorAddress,
      deliveryAddress,
      deliveryCity
    ),
    reference: referenceMatch?.[1] ?? "",
    sourceText,
  } satisfies ParsedInvoice;
}

function findMetadataMatch(invoice: ParsedInvoice, metadataRows: SkiMetadataRow[], line: ParsedInvoiceLine) {
  const resolvedCustomerName = getResolvedCustomerName(
    invoice.customerRaw,
    invoice.deliveryAddress,
    invoice.deliveryCity
  );
  const normalizedCustomerName = normalizeLookupValue(
    resolvedCustomerName
  );

  const directMatch = metadataRows.find((row) => {
    if (normalizeLookupValue(row.customerName) !== normalizedCustomerName) {
      return false;
    }

    if (row.itemNumber && line.itemNumber && row.itemNumber !== line.itemNumber) {
      return false;
    }

    return addressMatchesMetadata(invoice.debtorAddressCandidates, row);
  });

  if (directMatch) {
    return {
      lookupKey: `${resolvedCustomerName} + debitoradresse`,
      row: directMatch,
    };
  }

  if (/^Vejdirektoratet$/i.test(invoice.customerRaw)) {
    const metadataBySearch = new Map<string, SkiMetadataRow[]>();

    for (const row of metadataRows) {
      const key = normalizeLookupValue(row.searchName);
      const existing = metadataBySearch.get(key) ?? [];
      existing.push(row);
      metadataBySearch.set(key, existing);
    }

    for (const candidate of invoice.lookupCandidates) {
      const candidates = metadataBySearch.get(normalizeLookupValue(candidate));

      if (!candidates?.length) {
        continue;
      }

      const itemMatch = candidates.find((row) => row.itemNumber === line.itemNumber);
      return {
        lookupKey: candidate,
        row: itemMatch ?? candidates[0],
      };
    }
  }

  return null;
}

export function buildReportRows(metadataRows: SkiMetadataRow[], invoices: ParsedInvoice[]) {
  return invoices.flatMap((invoice) => {
    const resolvedCustomerName = getResolvedCustomerName(
      invoice.customerRaw,
      invoice.deliveryAddress,
      invoice.deliveryCity
    );
    const invoiceLines = aggregateInvoiceLines(invoice.lines);
    const useAdjustedSubtotal = invoice.adjustedSubtotal > 0 && invoiceLines.length === 1;

    if (!invoiceLines.length) {
      return [
        {
          address: invoice.debtorAddress,
          controlPrice: "",
          controlStatus: "not_relevant",
          customerName: resolvedCustomerName,
          dateFormat: invoice.dateIso,
          ean: "",
          fakturaDato: invoice.dateLabel,
          fakturaNr: invoice.invoiceNumber,
          itemGroup: "",
          itemName: "",
          itemNumber: "",
          lineTotal: "",
          lookupKey: invoice.lookupCandidates[0] ?? resolvedCustomerName,
          quantity: "",
          readQuantity: "",
          skiContract: "",
          skiReportingCode: "",
          sourceFileName: invoice.fileName,
          status: "review",
          statusMessage: "Ingen varelinjer med Varenummer/SKI ID blev fundet i PDF'en.",
          unit: "",
          unitPrice: "",
          valuta: "DKK",
        } satisfies ReportRow,
      ];
    }

    return invoiceLines.map((line) => {
      const metadataMatch = findMetadataMatch(invoice, metadataRows, line);

      if (!metadataMatch) {
        const effectiveLineTotal = useAdjustedSubtotal ? invoice.adjustedSubtotal : line.lineTotal;
        const effectiveQuantity = getEffectiveInvoiceQuantity(
          line,
          effectiveLineTotal,
          useAdjustedSubtotal
        );
        const controlState = getControlState(
          line,
          effectiveLineTotal,
          effectiveQuantity.quantity,
          effectiveQuantity.source
        );

        return {
          address: invoice.debtorAddress,
          controlPrice: controlState.controlPrice,
          controlStatus: controlState.controlStatus,
          customerName: resolvedCustomerName,
          dateFormat: invoice.dateIso,
          ean: "",
          fakturaDato: invoice.dateLabel,
          fakturaNr: invoice.invoiceNumber,
          itemGroup: line.itemGroup,
          itemName: line.description,
          itemNumber: line.itemNumber,
          lineTotal: toDecimalString(effectiveLineTotal),
          lookupKey: invoice.lookupCandidates[0] ?? resolvedCustomerName,
          quantity: toDecimalString(effectiveQuantity.quantity, 2),
          readQuantity: line.unit === "ton" && line.quantity > 0 ? toDecimalString(line.quantity, 2) : "",
          skiContract: "",
          skiReportingCode: "",
          sourceFileName: invoice.fileName,
          status: "review",
          statusMessage: "Ingen metadata-match fundet. Tjek søgenavn, kundealias eller adresse-regel.",
          unit: line.unit,
          unitPrice: toDecimalString(line.unitPrice),
          valuta: "DKK",
        } satisfies ReportRow;
      }

      const matched = metadataMatch.row;
      const effectiveLineTotal = useAdjustedSubtotal ? invoice.adjustedSubtotal : line.lineTotal;
      const effectiveQuantity = getEffectiveInvoiceQuantity(
        line,
        effectiveLineTotal,
        useAdjustedSubtotal
      );
      const controlState = getControlState(
        line,
        effectiveLineTotal,
        effectiveQuantity.quantity,
        effectiveQuantity.source
      );

      return {
        address: matched.address1 || invoice.debtorAddress,
        controlPrice: controlState.controlPrice,
        controlStatus: controlState.controlStatus,
        customerName: matched.customerName || resolvedCustomerName,
        dateFormat: invoice.dateIso,
        ean: matched.ean,
        fakturaDato: invoice.dateLabel,
        fakturaNr: invoice.invoiceNumber,
        itemGroup: matched.itemGroup || line.itemGroup,
        itemName: matched.itemName || line.description,
        itemNumber: matched.itemNumber || line.itemNumber,
        lineTotal: toDecimalString(effectiveLineTotal),
        lookupKey: metadataMatch.lookupKey,
        quantity: toDecimalString(effectiveQuantity.quantity, 2),
        readQuantity: line.unit === "ton" && line.quantity > 0 ? toDecimalString(line.quantity, 2) : "",
        skiContract: matched.contract,
        skiReportingCode: matched.skiReportingCode,
        sourceFileName: invoice.fileName,
        status: matched.ean ? "matched" : "review",
        statusMessage: matched.ean
          ? "Matchet mod metadata."
          : "Metadata-rækken mangler EAN eller andre nøglefelter.",
        unit: matched.unit || line.unit,
        unitPrice: matched.unitPrice || toDecimalString(line.unitPrice),
        valuta: "DKK",
      } satisfies ReportRow;
    });
  });
}

export function buildCsv(rows: ReportRow[]) {
  const delimiter = ";";
  const lines = [
    OUTPUT_HEADERS.join(delimiter),
    ...rows.map((row) =>
      [
        row.ean,
        row.customerName,
        row.address,
        row.itemNumber,
        row.itemName,
        row.itemGroup,
        row.fakturaNr,
        row.quantity,
        row.unit,
        row.lineTotal,
        row.valuta,
        formatDateForCsv(row.fakturaDato),
        row.skiContract,
        row.skiReportingCode,
        row.unitPrice,
      ]
        .map((value) => escapeCsv(value))
        .join(delimiter)
    ),
  ];

  return lines.join("\n");
}
