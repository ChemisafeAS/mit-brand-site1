import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY mangler. Den automatiske saltanalyse-sync kræver en service role key i miljøvariablerne."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
