import { NextResponse } from "next/server";
import { parseSaltAnalysisPdf } from "@/lib/salt-analysis";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import { updateStoredSaltAnalysis, upsertSaltAnalyses } from "@/lib/salt-analysis-store";
import type { SaltAnalysisRow } from "@/lib/salt-analysis-shared";
import { uploadSaltAnalysisFileToStorage } from "@/lib/salt-analysis-storage-server";

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

    const rows = await Promise.all(
      pdfFiles.map(async (file) => {
        const [parsedRow, storagePath] = await Promise.all([
          parseSaltAnalysisPdf(file),
          uploadSaltAnalysisFileToStorage(file),
        ]);

        return {
          ...parsedRow,
          fileStoragePath: storagePath,
        };
      })
    );
    const persistedResult = await upsertSaltAnalyses(rows);

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
