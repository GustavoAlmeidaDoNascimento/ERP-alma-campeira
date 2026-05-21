import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

// No-op lock: evita warnings/unhandledRejection do navigatorLock do gotrue-js
// quando React Strict Mode (dev) chama getUser duas vezes seguidas e o lock
// fica órfão na primeira chamada. Sem cross-tab/concorrência real de refresh
// neste app, perder o lock é seguro.
const noOpLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn();

export function createClient() {
  if (browserClient) return browserClient;
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
  browserClient = createBrowserClient(supabaseUrl, supabasePublishableKey, {
    auth: { lock: noOpLock },
  });
  return browserClient;
}
