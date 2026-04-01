import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { parseSaltAnalysisPdf } from "@/lib/salt-analysis";
import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";
import { upsertSaltAnalyses } from "@/lib/salt-analysis-store";
import { uploadSaltAnalysisFileToStorage } from "@/lib/salt-analysis-storage-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SALT_ANALYSIS_SOURCE_DIR =
  "/Users/Frederik/Library/CloudStorage/OneDrive-ChemisafeAS/Chemisafe A_S - Medarbejdere - Generel/SKI/Prøvetagninger";

function getSaltAnalysisSourceDirectory() {
  return process.env.SALT_ANALYSIS_SOURCE_DIR || DEFAULT_SALT_ANALYSIS_SOURCE_DIR;
}

async function collectPdfFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const filePaths: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...(await collectPdfFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      filePaths.push(entryPath);
    }
  }

  return filePaths;
}

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

export async function syncSaltAnalysesFromSourceDirectory() {
  if (!isSupabaseConfigured()) {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Supabase er ikke sat op endnu.",
    };
  }

  const sourceDirectory = getSaltAnalysisSourceDirectory();

  try {
    await fs.access(sourceDirectory);
  } catch {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: `Kildemappen blev ikke fundet: ${sourceDirectory}`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salt_analyses")
    .select("file_name");

  if (error) {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Saltanalyse-tabellen kunne ikke læses før synkronisering.",
    };
  }

  const existingFileNames = new Set(
    ((data ?? []) as Array<{ file_name: string | null }>)
      .map((row) => row.file_name?.trim().toLowerCase() ?? "")
      .filter(Boolean)
  );

  const allPdfPaths = await collectPdfFiles(sourceDirectory);
  const newPdfPaths = allPdfPaths.filter(
    (filePath) => !existingFileNames.has(path.basename(filePath).trim().toLowerCase())
  );

  if (!newPdfPaths.length) {
    const { getStoredSaltAnalyses } = await import("@/lib/salt-analysis-store");
    const current = await getStoredSaltAnalyses();
    return {
      rows: current.rows,
      notice: "0 nye filer importeret.",
    };
  }

  const importedRows = await mapInBatches(newPdfPaths, 3, async (filePath) => {
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const file = new File([fileBuffer], fileName, {
      type: "application/pdf",
    });
    const [parsedRow, storagePath] = await Promise.all([
      parseSaltAnalysisPdf(file),
      uploadSaltAnalysisFileToStorage(file),
    ]);

    return {
      ...parsedRow,
      fileStoragePath: storagePath,
    } satisfies SaltAnalysisRow;
  });

  const result = await upsertSaltAnalyses(importedRows);

  return {
    rows: result.rows,
    notice: result.notice || `${importedRows.length} nye filer importeret.`,
  };
}
