import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { initialSaltAnalysisState } from "@/app/medarbejder/saltanalyser/state";
import {
  ingestSaltAnalysisFiles,
  ingestSaltAnalysisStorageFiles,
} from "@/lib/salt-analysis-ingest";
import { createSaltAnalysisSignedUploadTarget } from "@/lib/salt-analysis-storage-server";

type PrepareUploadRequest = {
  files: {
    fileName: string;
  }[];
  mode: "prepare-upload";
};

type IngestUploadedRequest = {
  files: {
    fileName: string;
    ocrText?: string;
    storagePath: string;
  }[];
  mode: "ingest-uploaded";
};

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
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as
        | PrepareUploadRequest
        | IngestUploadedRequest;

      if (body.mode === "prepare-upload") {
        if (!body.files.length) {
          return NextResponse.json(
            {
              ...initialSaltAnalysisState,
              error: "Upload mindst én analyse-PDF for at synkronisere.",
            },
            { status: 400 }
          );
        }

        const files = await Promise.all(
          body.files.map((file) =>
            createSaltAnalysisSignedUploadTarget(file.fileName)
          )
        );

        return NextResponse.json({
          error: "",
          files,
          notice: "",
        });
      }

      if (body.mode === "ingest-uploaded") {
        if (!body.files.length) {
          return NextResponse.json(
            {
              ...initialSaltAnalysisState,
              error: "Upload mindst én analyse-PDF for at synkronisere.",
            },
            { status: 400 }
          );
        }

        const persistedResult = await ingestSaltAnalysisStorageFiles(body.files);

        return NextResponse.json({
          error: "",
          importedCount: body.files.length,
          notice: persistedResult.notice,
          rows: persistedResult.rows,
        });
      }
    }

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
