import "server-only";

import {
  countParsedSaltAnalysisFields,
  getSaltAnalysisStatus,
  type SaltAnalysisRow,
} from "@/lib/salt-analysis-shared";
import { parseSaltAnalysisPdf } from "@/lib/salt-analysis";
import { SALT_ANALYSIS_BUCKET } from "@/lib/salt-analysis-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";

type SaltAnalysisDbRow = {
  analysis_date: string | null;
  created_at: string;
  delivery_note_number: string | null;
  file_name: string;
  id: string;
  parsed_field_count: number;
  recipient: string | null;
  report_number: string | null;
  sample_date: string | null;
  sample_type: string | null;
  source_excerpt: string | null;
  source_key: string;
  status: "klar" | "tjek";
  storage_path: string | null;
  updated_at: string;
  water_content: string | null;
};

type SaltAnalysisIdentityRow = Pick<
  SaltAnalysisDbRow,
  "file_name" | "id" | "report_number" | "source_key"
>;

type StoredSaltAnalysisReparseRow = Pick<
  SaltAnalysisDbRow,
  | "delivery_note_number"
  | "file_name"
  | "id"
  | "parsed_field_count"
  | "recipient"
  | "report_number"
  | "sample_date"
  | "sample_type"
  | "status"
  | "storage_path"
  | "water_content"
>;

type UpsertableSaltAnalysisRow = Pick<
  SaltAnalysisRow,
  | "analysisDate"
  | "deliveryNoteNumber"
  | "fileName"
  | "fileStoragePath"
  | "recipient"
  | "reportNumber"
  | "sampleDate"
  | "sampleType"
  | "sourceExcerpt"
  | "waterContent"
> & { id?: string };

function getDeduplicationKey(row: Pick<SaltAnalysisDbRow, "file_name" | "report_number">) {
  const reportNumber = row.report_number?.trim().toLowerCase();

  if (reportNumber) {
    return `report:${reportNumber}`;
  }

  return `file:${row.file_name.trim().toLowerCase()}`;
}

function choosePreferredSaltAnalysisRow(
  current: SaltAnalysisDbRow,
  candidate: SaltAnalysisDbRow
) {
  if (candidate.parsed_field_count !== current.parsed_field_count) {
    return candidate.parsed_field_count > current.parsed_field_count ? candidate : current;
  }

  const currentUpdatedAt = Date.parse(current.updated_at || current.created_at || "");
  const candidateUpdatedAt = Date.parse(candidate.updated_at || candidate.created_at || "");

  if (!Number.isNaN(candidateUpdatedAt) && !Number.isNaN(currentUpdatedAt)) {
    return candidateUpdatedAt > currentUpdatedAt ? candidate : current;
  }

  return candidate.id > current.id ? candidate : current;
}

function dedupeSaltAnalysisRows(rows: SaltAnalysisDbRow[]) {
  const deduped = new Map<string, SaltAnalysisDbRow>();

  for (const row of rows) {
    const key = getDeduplicationKey(row);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, row);
      continue;
    }

    deduped.set(key, choosePreferredSaltAnalysisRow(existing, row));
  }

  return Array.from(deduped.values());
}

function mapDbRow(row: SaltAnalysisDbRow, fileUrl?: string): SaltAnalysisRow {
  return {
    id: row.id,
    analysisDate: row.analysis_date ?? "",
    batchNumber: "",
    deliveryNoteNumber: row.delivery_note_number ?? "",
    fileName: row.file_name,
    fileStoragePath: row.storage_path ?? "",
    fileUrl,
    laboratory: "",
    notes: "",
    parsedFieldCount:
      typeof row.parsed_field_count === "number"
        ? row.parsed_field_count
        : countParsedSaltAnalysisFields({
            analysisDate: row.analysis_date ?? "",
            deliveryNoteNumber: row.delivery_note_number ?? "",
            recipient: row.recipient ?? "",
            reportNumber: row.report_number ?? "",
            sampleDate: row.sample_date ?? "",
            sampleType: row.sample_type ?? "",
            waterContent: row.water_content ?? "",
          }),
    recipient: row.recipient ?? "",
    reportNumber: row.report_number ?? "",
    sampleDate: row.sample_date ?? "",
    sampleType: row.sample_type ?? "",
    sourceExcerpt: row.source_excerpt ?? "",
    status: row.status ?? "tjek",
    waterContent: row.water_content ?? "",
  };
}

function buildSourceKey(row: Pick<SaltAnalysisRow, "fileName" | "reportNumber">) {
  const reportNumber = row.reportNumber.trim().toLowerCase();

  if (reportNumber) {
    return `report:${reportNumber}`;
  }

  return `file:${row.fileName.trim().toLowerCase()}`;
}

async function findExistingSaltAnalysisRows(rows: SaltAnalysisRow[]) {
  const fileNames = uniqueNonEmpty(rows.map((row) => row.fileName));
  const reportNumbers = uniqueNonEmpty(rows.map((row) => row.reportNumber));

  if (!fileNames.length && !reportNumbers.length) {
    return [] as SaltAnalysisIdentityRow[];
  }

  const supabase = createAdminClient();
  const matches = new Map<string, SaltAnalysisIdentityRow>();

  if (fileNames.length) {
    const { data } = await supabase
      .from("salt_analyses")
      .select("id, file_name, report_number, source_key")
      .in("file_name", fileNames);

    for (const row of (data ?? []) as unknown as SaltAnalysisIdentityRow[]) {
      matches.set(row.id, row);
    }
  }

  if (reportNumbers.length) {
    const { data } = await supabase
      .from("salt_analyses")
      .select("id, file_name, report_number, source_key")
      .in("report_number", reportNumbers);

    for (const row of (data ?? []) as unknown as SaltAnalysisIdentityRow[]) {
      matches.set(row.id, row);
    }
  }

  return Array.from(matches.values());
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, index + batchIndex))
    );
    results.push(...batchResults);
  }

  return results;
}

function needsReparse(row: StoredSaltAnalysisReparseRow) {
  return (
    !row.report_number ||
    !row.recipient ||
    !row.delivery_note_number ||
    !row.sample_date ||
    !row.water_content ||
    row.status === "tjek" ||
    (row.parsed_field_count ?? 0) < 6
  );
}

export async function getStoredSaltAnalyses() {
  if (!isSupabaseConfigured()) {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Supabase er ikke sat op endnu.",
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("salt_analyses")
      .select(
        [
          "id",
          "analysis_date",
          "created_at",
          "delivery_note_number",
          "file_name",
          "parsed_field_count",
          "recipient",
          "report_number",
          "sample_date",
          "sample_type",
          "source_excerpt",
          "source_key",
          "status",
          "storage_path",
          "updated_at",
          "water_content",
        ].join(", ")
      )
      .order("sample_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data) {
      return {
        rows: [] as SaltAnalysisRow[],
        notice:
          "Saltanalyse-tabellen er ikke klar endnu. Kør SQL-filen `supabase/salt_analysis_setup.sql` først.",
      };
    }

    const rows = dedupeSaltAnalysisRows(data as unknown as SaltAnalysisDbRow[]);
    const paths = rows
      .map((row) => row.storage_path)
      .filter((value): value is string => Boolean(value));
    const fileUrlByPath = new Map<string, string>();

    if (paths.length) {
      const { data: signedUrls } = await supabase.storage
        .from(SALT_ANALYSIS_BUCKET)
        .createSignedUrls(paths, 60 * 60);

      for (const signedItem of signedUrls ?? []) {
        if (signedItem.path && signedItem.signedUrl) {
          fileUrlByPath.set(signedItem.path, signedItem.signedUrl);
        }
      }
    }

    return {
      rows: rows.map((row) => mapDbRow(row, row.storage_path ? fileUrlByPath.get(row.storage_path) : undefined)),
      notice: "",
    };
  } catch {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Der opstod en fejl ved hentning af gemte saltanalyser.",
    };
  }
}

export async function reparseStoredSaltAnalyses() {
  if (!isSupabaseConfigured()) {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Supabase er ikke sat op endnu.",
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("salt_analyses")
      .select(
        [
          "id",
          "delivery_note_number",
          "file_name",
          "parsed_field_count",
          "recipient",
          "report_number",
          "sample_date",
          "sample_type",
          "status",
          "storage_path",
          "water_content",
        ].join(", ")
      )
      .not("storage_path", "is", null);

    if (error || !data) {
      return {
        rows: [] as SaltAnalysisRow[],
        notice: "De gemte saltanalyser kunne ikke hentes til genlæsning.",
      };
    }

    const reparsableItems = ((data as unknown as StoredSaltAnalysisReparseRow[]) ?? []).filter(
      (item): item is StoredSaltAnalysisReparseRow & { storage_path: string } =>
        Boolean(item.storage_path) && needsReparse(item)
    );

    const reparsedFileNames: string[] = [];
    const reparsedRows = await mapInBatches(reparsableItems, 4, async (item) => {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(SALT_ANALYSIS_BUCKET)
        .download(item.storage_path);

      if (downloadError || !fileData) {
        return null;
      }

      const file = new File([fileData], item.file_name, {
        type: fileData.type || "application/pdf",
      });
      const parsedRow = await parseSaltAnalysisPdf(file);
      reparsedFileNames.push(item.file_name);

      return {
        ...parsedRow,
        id: item.id,
        fileStoragePath: item.storage_path,
      } satisfies SaltAnalysisRow;
    });
    const completedRows = reparsedRows.filter(
      (row): row is NonNullable<(typeof reparsedRows)[number]> => Boolean(row)
    );

    if (!completedRows.length) {
      return {
        rows: (await getStoredSaltAnalyses()).rows,
        notice: reparsableItems.length
          ? "Kunne ikke genlæse de udvalgte PDF'er."
          : "Der var ingen problematiske analyser at genlæse.",
      };
    }
    for (const row of completedRows) {
      const parsedFieldCount = countParsedSaltAnalysisFields(row);
      const { error: updateError } = await supabase
        .from("salt_analyses")
        .update({
          analysis_date: row.analysisDate || null,
          delivery_note_number: row.deliveryNoteNumber || null,
          file_name: row.fileName,
          parsed_field_count: parsedFieldCount,
          recipient: row.recipient || null,
          report_number: row.reportNumber || null,
          sample_date: row.sampleDate || null,
          sample_type: row.sampleType || null,
          source_excerpt: row.sourceExcerpt || null,
          status: getSaltAnalysisStatus(row),
          storage_path: row.fileStoragePath || null,
          water_content: row.waterContent || null,
        })
        .eq("id", row.id);

      if (updateError) {
        return {
          rows: (await getStoredSaltAnalyses()).rows,
          notice:
            `Genlæsningen fandt data, men kunne ikke skrive alle opdateringer tilbage. ` +
            `Senest fejl på ${row.fileName}: ${updateError.message}`,
        };
      }
    }

    const refreshed = await getStoredSaltAnalyses();

    return {
      rows: refreshed.rows,
      notice:
        `Genlæste ${completedRows.length} analyser, som manglede felter eller stod til tjek.` +
        (reparsedFileNames.length
          ? ` Filer: ${reparsedFileNames.slice(0, 6).join(", ")}${reparsedFileNames.length > 6 ? " ..." : ""}`
          : ""),
    };
  } catch {
    return {
      rows: [] as SaltAnalysisRow[],
      notice: "Der opstod en fejl under genlæsning af gemte analyser.",
    };
  }
}

export async function upsertSaltAnalyses(rows: SaltAnalysisRow[]) {
  if (!isSupabaseConfigured()) {
    return {
      rows,
      notice: "Supabase er ikke sat op endnu, så analyserne er kun vist midlertidigt.",
    };
  }

  try {
    const supabase = createAdminClient();
    const existingRows = await findExistingSaltAnalysisRows(rows);
    const existingByFileName = new Map(
      existingRows.map((row) => [row.file_name.trim().toLowerCase(), row] as const)
    );
    const existingByReportNumber = new Map(
      existingRows
        .filter((row) => row.report_number)
        .map((row) => [row.report_number!.trim().toLowerCase(), row] as const)
    );
    const payload = rows.map((row) => {
      const parsedFieldCount = countParsedSaltAnalysisFields(row);
      const normalizedFileName = row.fileName.trim().toLowerCase();
      const normalizedReportNumber = row.reportNumber.trim().toLowerCase();
      const existingRow =
        (normalizedReportNumber
          ? existingByReportNumber.get(normalizedReportNumber)
          : undefined) ?? existingByFileName.get(normalizedFileName);

      return {
        id: existingRow?.id,
        analysis_date: row.analysisDate || null,
        delivery_note_number: row.deliveryNoteNumber || null,
        file_name: row.fileName,
        parsed_field_count: parsedFieldCount,
        recipient: row.recipient || null,
        report_number: row.reportNumber || null,
        sample_date: row.sampleDate || null,
        sample_type: row.sampleType || null,
        source_excerpt: row.sourceExcerpt || null,
        source_key: existingRow?.source_key ?? buildSourceKey(row),
        status: getSaltAnalysisStatus(row),
        storage_path: row.fileStoragePath || null,
        water_content: row.waterContent || null,
      };
    });
    const rowsToUpdate = payload.filter((row) => row.id);
    const rowsToInsert = payload.filter((row) => !row.id).map((row) => ({
      analysis_date: row.analysis_date,
      delivery_note_number: row.delivery_note_number,
      file_name: row.file_name,
      parsed_field_count: row.parsed_field_count,
      recipient: row.recipient,
      report_number: row.report_number,
      sample_date: row.sample_date,
      sample_type: row.sample_type,
      source_excerpt: row.source_excerpt,
      source_key: row.source_key,
      status: row.status,
      storage_path: row.storage_path,
      water_content: row.water_content,
    }));

    for (const row of rowsToUpdate) {
      const { error } = await supabase
        .from("salt_analyses")
        .update({
          analysis_date: row.analysis_date,
          delivery_note_number: row.delivery_note_number,
          file_name: row.file_name,
          parsed_field_count: row.parsed_field_count,
          recipient: row.recipient,
          report_number: row.report_number,
          sample_date: row.sample_date,
          sample_type: row.sample_type,
          source_excerpt: row.source_excerpt,
          source_key: row.source_key,
          status: row.status,
          storage_path: row.storage_path,
          water_content: row.water_content,
        })
        .eq("id", row.id);

      if (error) {
        return {
          rows,
          notice:
            "Analyserne blev læst, men nogle eksisterende rækker kunne ikke opdateres i Supabase endnu.",
        };
      }
    }

    if (rowsToInsert.length) {
      const { error } = await supabase
        .from("salt_analyses")
        .upsert(rowsToInsert, { onConflict: "source_key" });

      if (error) {
        return {
          rows,
          notice:
            "Analyserne blev læst, men kunne ikke gemmes permanent endnu. Kør SQL-filen `supabase/salt_analysis_setup.sql` og prøv igen.",
        };
      }
    }

    return getStoredSaltAnalyses();
  } catch {
    return {
      rows,
      notice: "Analyserne blev læst, men der opstod en fejl under gemning i Supabase.",
    };
  }
}

export async function updateStoredSaltAnalysis(row: UpsertableSaltAnalysisRow) {
  if (!isSupabaseConfigured()) {
    return {
      row: {
        ...row,
        batchNumber: "",
        laboratory: "",
        notes: "",
        parsedFieldCount: countParsedSaltAnalysisFields(row),
        status: getSaltAnalysisStatus(row),
      } satisfies SaltAnalysisRow,
      notice: "Supabase er ikke sat op endnu, så ændringen er kun gemt lokalt i visningen.",
    };
  }

  if (!row.id) {
    throw new Error("Række-id mangler for opdateringen.");
  }

  try {
    const supabase = createAdminClient();
    const parsedFieldCount = countParsedSaltAnalysisFields(row);
    const updatePayload = {
      analysis_date: row.analysisDate || null,
      delivery_note_number: row.deliveryNoteNumber || null,
      file_name: row.fileName,
      parsed_field_count: parsedFieldCount,
      recipient: row.recipient || null,
      report_number: row.reportNumber || null,
      sample_date: row.sampleDate || null,
      sample_type: row.sampleType || null,
      source_excerpt: row.sourceExcerpt || null,
      source_key: buildSourceKey(row),
      status: getSaltAnalysisStatus(row),
      storage_path: row.fileStoragePath || null,
      water_content: row.waterContent || null,
    };

    const { data, error } = await supabase
      .from("salt_analyses")
      .update(updatePayload)
      .eq("id", row.id)
      .select(
        [
          "id",
          "analysis_date",
          "created_at",
          "delivery_note_number",
          "file_name",
          "parsed_field_count",
          "recipient",
          "report_number",
          "sample_date",
          "sample_type",
          "source_excerpt",
          "source_key",
          "status",
          "storage_path",
          "updated_at",
          "water_content",
        ].join(", ")
      )
      .single();

    if (error || !data) {
      throw new Error("Saltanalysen kunne ikke opdateres i Supabase.");
    }

    return {
      row: mapDbRow(data as unknown as SaltAnalysisDbRow),
      notice: "",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Saltanalysen kunne ikke opdateres."
    );
  }
}
