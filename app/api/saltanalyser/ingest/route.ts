import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import { ingestSaltAnalysisFiles } from "@/lib/salt-analysis-ingest";

function isValidSyncToken(receivedToken: string | null) {
  const expectedToken = process.env.SALT_ANALYSIS_SYNC_TOKEN;

  if (!expectedToken || !receivedToken) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedToken);
  const receivedBuffer = Buffer.from(receivedToken);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : null;
  const headerToken = request.headers.get("x-salt-analysis-sync-token");

  if (!isValidSyncToken(bearerToken ?? headerToken)) {
    return NextResponse.json(
      {
        ...initialSaltAnalysisState,
        error: "Ugyldig eller manglende sync-token.",
      },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const pdfFiles = formData
      .getAll("analyses")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!pdfFiles.length) {
      return NextResponse.json(
        {
          ...initialSaltAnalysisState,
          error: "Upload mindst én analyse-PDF for at synkronisere.",
        },
        { status: 400 }
      );
    }

    const persistedResult = await ingestSaltAnalysisFiles(pdfFiles);

    return NextResponse.json({
      error: "",
      importedCount: pdfFiles.length,
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
            : "Noget gik galt under synkronisering af analyse-PDF'erne.",
      },
      { status: 500 }
    );
  }
}
