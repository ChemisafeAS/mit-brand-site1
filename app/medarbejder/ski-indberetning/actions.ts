"use server";

import { buildCsv, buildReportRows, parseInvoicePdf } from "@/lib/ski-report";
import { createClient } from "@/lib/supabase/server";
import { SKI_UPLOAD_BUCKET } from "@/lib/ski-storage";
import { initialSkiReportState, type SkiReportState } from "./state";

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, index + batchIndex))
    );
    results.push(...batchResults);
  }

  return results;
}

async function getInvoiceFilesFromStorage(storagePaths: string[]) {
  const supabase = await createClient();
  return mapInBatches(storagePaths, 8, async (storagePath) => {
    const { data, error } = await supabase.storage.from(SKI_UPLOAD_BUCKET).download(storagePath);

    if (error || !data) {
      throw new Error(
        `Kunne ikke hente ${storagePath} fra Supabase Storage. Tjek at bucketen '${SKI_UPLOAD_BUCKET}' findes, og at den tillader upload/download for loggede medarbejdere.`
      );
    }

    const fileName = storagePath.split("/").pop() || "faktura.pdf";

    return new File([data], fileName, {
      type: data.type || "application/pdf",
    });
  });
}

async function removeUploadedBatch(storagePaths: string[]) {
  if (!storagePaths.length) {
    return;
  }

  const supabase = await createClient();
  await supabase.storage.from(SKI_UPLOAD_BUCKET).remove(storagePaths);
}

export async function processSkiReport(formData: FormData): Promise<SkiReportState> {
  const invoiceEntries = formData.getAll("invoices");
  let invoiceFiles = invoiceEntries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );
  const uploadedPathsRaw = formData.get("uploadedPaths");
  const uploadedPaths =
    typeof uploadedPathsRaw === "string" && uploadedPathsRaw
      ? (JSON.parse(uploadedPathsRaw) as string[])
      : [];

  if (!invoiceFiles.length && uploadedPaths.length) {
    invoiceFiles = await getInvoiceFilesFromStorage(uploadedPaths);
  }

  try {
    if (!invoiceFiles.length) {
      return {
        ...initialSkiReportState,
        error: "Upload mindst én PDF-faktura for at køre testen.",
      };
    }

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
  } finally {
    await removeUploadedBatch(uploadedPaths);
  }
}

export async function runSkiReport(
  _previousState: SkiReportState,
  formData: FormData
): Promise<SkiReportState> {
  return processSkiReport(formData);
}
