import { NextResponse } from "next/server";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import { ingestSaltAnalysisFiles } from "@/lib/salt-analysis-ingest";
import { updateStoredSaltAnalysis } from "@/lib/salt-analysis-store";
import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const pdfFiles = formData
      .getAll("analyses")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!pdfFiles.length) {
      return NextResponse.json(
        {
          ...initialSaltAnalysisState,
          error: "Upload mindst én analyse-PDF for at bygge oversigten.",
        },
        { status: 400 }
      );
    }

    const persistedResult = await ingestSaltAnalysisFiles(pdfFiles);

    return NextResponse.json({
      error: "",
      notice: persistedResult.notice,
      rows: persistedResult.rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...initialSaltAnalysisState,
        error:
          error instanceof Error
            ? error.message
            : "Noget gik galt under læsningen af analyse-PDF'erne.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as SaltAnalysisRow;
    const result = await updateStoredSaltAnalysis(body);

    return NextResponse.json({
      notice: result.notice,
      row: result.row,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Saltanalysen kunne ikke opdateres.",
      },
      { status: 500 }
    );
  }
}
