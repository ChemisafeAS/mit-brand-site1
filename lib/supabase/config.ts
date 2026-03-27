export function getSupabaseConfig() {
  return {
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };
}

export function isSupabaseConfigured() {
  const { publishableKey, url } = getSupabaseConfig();

  return Boolean(url && publishableKey);
}
