import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type PageSlug = "home" | "om" | "kontakt";

type DefaultsByPage = Record<PageSlug, Record<string, string>>;

const defaults: DefaultsByPage = {
  home: {
    cta_primary: "Se produkter",
    cta_secondary: "Få et tilbud",
    cta_tertiary: "Læs mere",
    hero_body:
      "Chemisafe A/S leverer vejsalt, fodersalt, saltpoletter og et bredt sortiment af øvrige saltprodukter til professionelle kunder. Kontakt os for tilbud, levering og den rigtige løsning til jeres behov.",
    hero_title: "Saltprodukter til erhverv",
  },
  kontakt: {
    body_intro: "Kontakt os gerne for tilbud eller spørgsmål om vores produkter.",
    body_mail: "Skriv til ordre@chemisafe.dk",
    body_phone: "Ring til os på 86 44 79 00",
    hero_title: "Kontakt",
  },
  om: {
    caption_body:
      "Vi arbejder med fokus på håndtering, ordreflow og levering af saltprodukter til både professionelle kunder og private.",
    caption_title: "Levering og logistik",
    hero_title: "Chemisafe A/S",
    intro_body_1:
      "Chemisafe har været i branchen i mere end 25 år og leverer saltprodukter til både erhverv og private.",
    intro_body_2:
      "Vi lægger vægt på stabile leverancer, hurtig ordrebehandling og en praktisk tilgang til kundernes behov.",
    intro_body_3:
      "På området for vejsalt er vi blandt de førende leverandører til det offentlige.",
    intro_title: "Stabil levering og mange års erfaring",
    reasons_heading: "Derfor vælger kunder Chemisafe A/S",
    reason_1_body:
      "Vi lægger vægt på leveringssikkerhed og en løsning, der fungerer i praksis.",
    reason_1_title: "Stabil levering",
    reason_2_body:
      "Forespørgsler og bestillinger håndteres hurtigt og direkte.",
    reason_2_title: "Hurtig ordrebehandling",
    reason_3_body:
      "Vi leverer både til erhverv, det offentlige og private kunder.",
    reason_3_title: "Produkter til flere behov",
  },
};

type ContentRow = {
  content_key: string;
  page: PageSlug;
  value: string;
};

export function getDefaultContent(page: PageSlug) {
  return defaults[page];
}

export async function getPageContent(page: PageSlug) {
  const baseContent = getDefaultContent(page);

  if (!isSupabaseConfigured()) {
    return {
      content: baseContent,
      source: "fallback" as const,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("page, content_key, value")
      .eq("page", page);

    if (error || !data) {
      return {
        content: baseContent,
        error:
          "Indholds-tabellen er ikke klar endnu. Standardskrivningen vises derfor stadig.",
        source: "fallback" as const,
      };
    }

    const merged = { ...baseContent };

    for (const row of data as ContentRow[]) {
      merged[row.content_key] = row.value;
    }

    return {
      content: merged,
      source: "supabase" as const,
    };
  } catch {
    return {
      content: baseContent,
      error:
        "Der opstod en fejl ved hentning af sideindhold. Standardskrivningen vises derfor stadig.",
      source: "fallback" as const,
    };
  }
}
