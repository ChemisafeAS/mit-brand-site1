import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export function formatEmployeeName(
  userMetadata?: Record<string, unknown> | null,
) {
  if (typeof userMetadata?.display_name === "string" && userMetadata.display_name.trim()) {
    return userMetadata.display_name.trim();
  }

  return null;
}

export async function getEmployeeUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
