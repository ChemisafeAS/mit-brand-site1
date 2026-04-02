export const SALT_ANALYSIS_BUCKET = "salt-analysis-pdfs";

export function sanitizeSaltAnalysisStorageSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w./-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

function ensurePdfExtension(value: string) {
  return value.toLowerCase().endsWith(".pdf") ? value : `${value}.pdf`;
}

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .split("/")
      .map((segment) => sanitizeSaltAnalysisStorageSegment(segment) || "file")
      .join("/") || "analyse.pdf"
  );
}

export function getStoragePathForSaltAnalysis(fileName: string, reportNumber?: string) {
  const normalizedReportNumber = reportNumber?.trim();

  if (normalizedReportNumber) {
    const safeReportNumber = ensurePdfExtension(
      sanitizeSaltAnalysisStorageSegment(normalizedReportNumber) || "analyse"
    );

    return `reports/${safeReportNumber}`;
  }

  return `files/${ensurePdfExtension(sanitizeFileName(fileName))}`;
}
