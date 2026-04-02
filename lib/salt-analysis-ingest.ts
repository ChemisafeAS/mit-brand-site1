import { parseSaltAnalysisPdf } from "@/lib/salt-analysis";
import { upsertSaltAnalyses } from "@/lib/salt-analysis-store";
import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";
import { uploadSaltAnalysisFileToStorage } from "@/lib/salt-analysis-storage-server";

export async function ingestSaltAnalysisFiles(pdfFiles: File[]) {
  const rows = await Promise.all(
    pdfFiles.map(async (file) => {
      const parsedRow = await parseSaltAnalysisPdf(file);
      const storagePath = await uploadSaltAnalysisFileToStorage(
        file,
        parsedRow.reportNumber
      );

      return {
        ...parsedRow,
        fileStoragePath: storagePath,
      } satisfies SaltAnalysisRow;
    })
  );

  return upsertSaltAnalyses(rows);
}
