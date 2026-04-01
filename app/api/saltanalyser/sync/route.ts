import { NextResponse } from "next/server";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import { syncSaltAnalysesFromSourceDirectory } from "@/lib/salt-analysis-sync";

export async function POST() {
  try {
    const result = await syncSaltAnalysesFromSourceDirectory();

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
            : "Noget gik galt under synkronisering af analyser.",
      },
      { status: 500 }
    );
  }
}
