"use server";

import { buildCsv, buildReportRows, parseInvoicePdf } from "@/lib/ski-report";
import { initialSkiReportState, type SkiReportState } from "./state";

export async function runSkiReport(
  _previousState: SkiReportState,
  formData: FormData
): Promise<SkiReportState> {
  const invoiceEntries = formData.getAll("invoices");
  const invoiceFiles = invoiceEntries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );

  if (!invoiceFiles.length) {
    return {
      ...initialSkiReportState,
      error: "Upload mindst én PDF-faktura for at køre testen.",
    };
  }

  try {
    const invoices = await Promise.all(invoiceFiles.map((file) => parseInvoicePdf(file)));
    const rows = buildReportRows([], invoices).map((row) => ({
      ...row,
      statusMessage: "Klar til eksport. Metadata kan tilføjes udenfor hjemmesiden.",
    }));

    return {
      csvContent: buildCsv(rows),
      error: "",
      invoices,
      metadataCacheJson: "",
      metadataDebug: "Metadata er midlertidigt slået fra i denne version.",
      metadataCount: 0,
      metadataSourceLabel: "",
      metadataSourceType: "",
      rows,
    };
  } catch (error) {
    return {
      ...initialSkiReportState,
      error:
        error instanceof Error
          ? error.message
          : "Noget gik galt under behandlingen af fakturaerne.",
    };
  }
}
