"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function buildLoginRedirect(errorCode: "config" | "invalid", nextPath?: FormDataEntryValue | null) {
  const target = new URLSearchParams({ error: errorCode });

  if (
    typeof nextPath === "string" &&
    (nextPath === "/medarbejder" || nextPath.startsWith("/medarbejder/"))
  ) {
    target.set("next", nextPath);
  }

  return `/medarbejder-login?${target.toString()}`;
}

export async function loginEmployee(formData: FormData) {
  const nextPath = formData.get("next");

  if (!isSupabaseConfigured()) {
    redirect(buildLoginRedirect("config", nextPath));
  }

  const email = formData.get("email");
  const password = formData.get("password");
  const supabase = await createClient();

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    redirect(buildLoginRedirect("invalid", nextPath));
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildLoginRedirect("invalid", nextPath));
  }

  if (
    typeof nextPath === "string" &&
    (nextPath === "/medarbejder" || nextPath.startsWith("/medarbejder/"))
  ) {
    redirect(nextPath);
  }

  redirect("/medarbejder");
}
