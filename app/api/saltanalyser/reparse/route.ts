import { NextResponse } from "next/server";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import { reparseStoredSaltAnalyses } from "@/lib/salt-analysis-store";

export async function POST() {
  try {
    const result = await reparseStoredSaltAnalyses();

    return NextResponse.json({
      error: "",
      notice: result.notice,
      rows: result.rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...initialSaltAnalysisState,
        error:
          error instanceof Error
            ? error.message
            : "Noget gik galt under genlæsning af gemte analyser.",
      },
      { status: 500 }
    );
  }
}
