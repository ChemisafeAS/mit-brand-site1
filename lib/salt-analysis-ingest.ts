import { parseSaltAnalysisPdf } from "@/lib/salt-analysis";
import { upsertSaltAnalyses } from "@/lib/salt-analysis-store";
import { getStoragePathForSaltAnalysis } from "@/lib/salt-analysis-storage";
import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";
import {
  deleteSaltAnalysisFileFromStorage,
  downloadSaltAnalysisFileFromStorage,
  uploadSaltAnalysisFileToStorage,
} from "@/lib/salt-analysis-storage-server";

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

export async function ingestSaltAnalysisStorageFiles(
  files: { fileName: string; storagePath: string }[]
) {
  const rows = await Promise.all(
    files.map(async ({ fileName, storagePath }) => {
      const file = await downloadSaltAnalysisFileFromStorage(storagePath, fileName);
      const parsedRow = await parseSaltAnalysisPdf(file);
      const canonicalStoragePath = getStoragePathForSaltAnalysis(
        file.name,
        parsedRow.reportNumber
      );
      let finalStoragePath = storagePath;

      if (canonicalStoragePath !== storagePath) {
        finalStoragePath = await uploadSaltAnalysisFileToStorage(
          file,
          parsedRow.reportNumber
        );
        await deleteSaltAnalysisFileFromStorage(storagePath);
      }

      return {
        ...parsedRow,
        fileStoragePath: finalStoragePath,
      } satisfies SaltAnalysisRow;
    })
  );

  return upsertSaltAnalyses(rows);
}
