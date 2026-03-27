import "server-only";

import type { ContactRecord } from "@/lib/contact-schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function getContacts() {
  if (!isSupabaseConfigured()) {
    return {
      contacts: [] as ContactRecord[],
      error: "Supabase er ikke sat op endnu.",
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, company_name, contact_person, role, phone, email, address, notes, category"
      )
      .order("company_name", { ascending: true });

    if (error || !data) {
      return {
        contacts: [] as ContactRecord[],
        error:
          "Kontaktregisteret er ikke klar endnu. Kør SQL-opsætningen først.",
      };
    }

    return { contacts: data as ContactRecord[] };
  } catch {
    return {
      contacts: [] as ContactRecord[],
      error: "Der opstod en fejl ved hentning af kontaktregisteret.",
    };
  }
}
