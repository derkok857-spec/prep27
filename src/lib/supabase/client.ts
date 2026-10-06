import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are public by design. Row level security is what protects the data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase is not configured");
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "prep27-auth" },
    });
  }
  return client;
}
