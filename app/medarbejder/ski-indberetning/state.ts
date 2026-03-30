import type { ParsedInvoice, ReportRow } from "@/lib/ski-report";

export type SkiReportState = {
  csvContent: string;
  error: string;
  invoices: ParsedInvoice[];
  metadataCacheJson: string;
  metadataDebug: string;
  metadataCount: number;
  metadataSourceLabel: string;
  metadataSourceType: "cache" | "upload" | "";
  rows: ReportRow[];
};

export const initialSkiReportState: SkiReportState = {
  csvContent: "",
  error: "",
  invoices: [],
  metadataCacheJson: "",
  metadataDebug: "",
  metadataCount: 0,
  metadataSourceLabel: "",
  metadataSourceType: "",
  rows: [],
};
