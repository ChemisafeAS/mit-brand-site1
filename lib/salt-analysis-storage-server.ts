import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  getStoragePathForSaltAnalysis,
  SALT_ANALYSIS_BUCKET,
} from "@/lib/salt-analysis-storage";

export async function uploadSaltAnalysisFileToStorage(file: File, reportNumber?: string) {
  const supabase = createAdminClient();
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

function encodeStoragePath(storagePath: string) {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

export async function createSaltAnalysisSignedUploadTarget(fileName: string) {
  const supabase = createAdminClient();
  const storagePath = getStoragePathForSaltAnalysis(fileName);
  const { data, error } = await supabase.storage
    .from(SALT_ANALYSIS_BUCKET)
    .createSignedUploadUrl(storagePath, {
      upsert: true,
    });

  if (error || !data) {
    throw new Error(
      `Kunne ikke oprette signed upload-url for ${fileName}. ${error?.message ?? ""}`.trim()
    );
  }

  const fallbackSignedUrl =
    `${getSupabaseConfig().url}/storage/v1/object/upload/sign/` +
    `${SALT_ANALYSIS_BUCKET}/${encodeStoragePath(storagePath)}?token=${data.token}`;

  return {
    fileName,
    signedUrl: "signedUrl" in data && data.signedUrl ? data.signedUrl : fallbackSignedUrl,
    storagePath,
  };
}

export async function downloadSaltAnalysisFileFromStorage(
  storagePath: string,
  fileName: string
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(SALT_ANALYSIS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Kunne ikke hente ${fileName} fra Supabase Storage. ${error?.message ?? ""}`.trim()
    );
  }

  return new File([data], fileName, {
    type: data.type || "application/pdf",
  });
}

export async function deleteSaltAnalysisFileFromStorage(storagePath: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(SALT_ANALYSIS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(
      `Kunne ikke rydde den midlertidige fil i Supabase Storage. ${error.message}`
    );
  }
}
