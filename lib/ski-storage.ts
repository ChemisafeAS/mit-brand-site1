export const SKI_UPLOAD_BUCKET = "ski-invoices";

export function sanitizeStorageSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w./-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

export function getStoragePathForInvoice(batchId: string, fileName: string, relativePath?: string) {
  const rawPath = relativePath && relativePath.trim() ? relativePath : fileName;
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const sanitizedPath = normalizedPath
    .split("/")
    .map((segment) => sanitizeStorageSegment(segment) || "file")
    .join("/");

  return `${sanitizeStorageSegment(batchId)}/${sanitizedPath}`;
}
