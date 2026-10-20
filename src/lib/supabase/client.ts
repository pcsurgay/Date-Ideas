import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// Browser-side client. Call it inside effects and event handlers, not at
// module scope, so builds without env vars still succeed.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
