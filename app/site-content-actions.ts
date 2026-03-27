"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PageSlug } from "@/lib/site-content";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveSiteContent(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/medarbejder-login?error=config");
  }

  const page = getText(formData, "page") as PageSlug;
  const contentKey = getText(formData, "contentKey");
  const returnPath = getText(formData, "returnPath");
  const value = getText(formData, "value");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/medarbejder-login");
  }

  if (!page || !contentKey || !returnPath) {
    redirect("/medarbejder?status=error&message=Indholdet%20kunne%20ikke%20gemmes.");
  }

  const { error } = await supabase.from("site_content").upsert(
    {
      content_key: contentKey,
      page,
      value,
    },
    {
      onConflict: "page,content_key",
    }
  );

  if (error) {
    redirect(
      `${returnPath}${returnPath.includes("?") ? "&" : "?"}status=error&message=Kunne%20ikke%20gemme%20indholdet`
    );
  }

  revalidatePath("/");
  revalidatePath("/om");
  revalidatePath("/kontakt");
  revalidatePath("/medarbejder");

  redirect(
    `${returnPath}${returnPath.includes("?") ? "&" : "?"}status=success&message=Indholdet%20er%20gemt`
  );
}
