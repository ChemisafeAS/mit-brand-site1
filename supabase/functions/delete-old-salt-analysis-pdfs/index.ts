/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";

const SALT_ANALYSIS_BUCKET = "salt-analysis-pdfs";
const DEFAULT_MONTHS_OLD = 12;
const BATCH_SIZE = 100;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY mangler." },
      500
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const payload = await request.json().catch(() => ({}));
  const monthsOld =
    typeof payload?.monthsOld === "number" && Number.isFinite(payload.monthsOld)
      ? Math.max(1, Math.floor(payload.monthsOld))
      : DEFAULT_MONTHS_OLD;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsOld);

  const { data: candidates, error: fetchError } = await admin
    .from("salt_analyses")
    .select("id, storage_path, updated_at, archived_at")
    .not("storage_path", "is", null)
    .lt("updated_at", cutoff.toISOString())
    .limit(BATCH_SIZE);

  if (fetchError) {
    return jsonResponse(
      { error: "Kunne ikke hente gamle analyser.", details: fetchError.message },
      500
    );
  }

  const rows =
    (candidates ?? []).filter(
      (
        row
      ): row is {
        id: string;
        storage_path: string;
        updated_at: string;
        archived_at: string | null;
      } => typeof row.storage_path === "string" && row.storage_path.length > 0
    ) ?? [];

  if (!rows.length) {
    return jsonResponse({
      deletedCount: 0,
      monthsOld,
      notice: `Ingen PDF-filer ældre end ${monthsOld} måneder skulle slettes.`,
    });
  }

  const storagePaths = rows.map((row) => row.storage_path);
  const { data: removedItems, error: removeError } = await admin.storage
    .from(SALT_ANALYSIS_BUCKET)
    .remove(storagePaths);

  if (removeError) {
    return jsonResponse(
      { error: "Kunne ikke slette gamle PDF-filer.", details: removeError.message },
      500
    );
  }

  const removedPaths = new Set((removedItems ?? []).map((item) => item.name));
  const deletedRows = rows.filter((row) => removedPaths.has(row.storage_path));

  if (!deletedRows.length) {
    return jsonResponse(
      {
        error: "Storage returnerede ingen slettede filer.",
        details: removedItems ?? [],
      },
      500
    );
  }

  const nowIso = new Date().toISOString();
  const ids = deletedRows.map((row) => row.id);
  const { error: updateError } = await admin
    .from("salt_analyses")
    .update({
      archived_at: nowIso,
      storage_path: null,
    })
    .in("id", ids);

  if (updateError) {
    return jsonResponse(
      {
        error: "PDF-filerne blev slettet, men databasen kunne ikke opdateres.",
        details: updateError.message,
      },
      500
    );
  }

  return jsonResponse({
    deletedCount: deletedRows.length,
    monthsOld,
    notice: `${deletedRows.length} gamle PDF-filer er slettet fra Storage.`,
  });
});
