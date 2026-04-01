export type SaltAnalysisRow = {
  id?: string;
  analysisDate: string;
  batchNumber: string;
  deliveryNoteNumber: string;
  fileName: string;
  fileStoragePath?: string;
  fileUrl?: string;
  laboratory: string;
  notes: string;
  parsedFieldCount: number;
  recipient: string;
  reportNumber: string;
  sampleDate: string;
  sampleType: string;
  sourceExcerpt: string;
  status: "klar" | "tjek";
  waterContent: string;
};

export function countParsedSaltAnalysisFields(row: Partial<SaltAnalysisRow>) {
  return [
    row.recipient,
    row.reportNumber,
    row.deliveryNoteNumber,
    row.sampleDate,
    row.analysisDate,
    row.waterContent,
    row.sampleType,
  ].filter(Boolean).length;
}

export function getSaltAnalysisStatus(row: Partial<SaltAnalysisRow>): "klar" | "tjek" {
  return countParsedSaltAnalysisFields(row) >= 4 ? "klar" : "tjek";
}

export function buildSaltAnalysisCsv(rows: SaltAnalysisRow[]) {
  const headers = [
    "Fil",
    "Rapportnr",
    "Til",
    "Folgeseddel",
    "Analysedato",
    "Vandindhold",
    "Proevetype",
    "Uddrag",
  ];

  const escapeValue = (value: string) => {
    if (/[;"\n]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }

    return value;
  };

  return [
    headers.join(";"),
    ...rows.map((row) =>
      [
        row.fileName,
        row.reportNumber,
        row.recipient,
        row.deliveryNoteNumber,
        row.sampleDate,
        row.waterContent,
        row.sampleType,
        row.sourceExcerpt,
      ]
        .map(escapeValue)
        .join(";")
    ),
  ].join("\n");
}
