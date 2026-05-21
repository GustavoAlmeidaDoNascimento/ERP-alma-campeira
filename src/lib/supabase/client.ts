import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
  browserClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
