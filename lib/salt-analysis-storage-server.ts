import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getStoragePathForSaltAnalysis,
  SALT_ANALYSIS_BUCKET,
} from "@/lib/salt-analysis-storage";

export async function uploadSaltAnalysisFileToStorage(file: File, reportNumber?: string) {
  const supabase = await createClient();
  const storagePath = getStoragePathForSaltAnalysis(file.name, reportNumber);
  const { error } = await supabase.storage.from(SALT_ANALYSIS_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "application/pdf",
  });

  if (error) {
    throw new Error(
      `Upload til Supabase Storage fejlede for ${file.name}. Tjek at bucketen '${SALT_ANALYSIS_BUCKET}' findes, og at loggede medarbejdere må uploade til den.`
    );
  }

  return storagePath;
}
