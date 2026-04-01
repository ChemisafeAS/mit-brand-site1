import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";

export type SaltAnalysisState = {
  error: string;
  notice: string;
  rows: SaltAnalysisRow[];
};

export const initialSaltAnalysisState: SaltAnalysisState = {
  error: "",
  notice: "",
  rows: [],
};
