export const SALT_ANALYSIS_BUCKET = "salt-analysis-pdfs";

export function sanitizeSaltAnalysisStorageSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w./-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

export function getStoragePathForSaltAnalysis(fileName: string) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeFileName =
    fileName
      .split("/")
      .map((segment) => sanitizeSaltAnalysisStorageSegment(segment) || "file")
      .join("/") || "analyse.pdf";

  return `${timestamp}/${crypto.randomUUID()}-${safeFileName}`;
}
