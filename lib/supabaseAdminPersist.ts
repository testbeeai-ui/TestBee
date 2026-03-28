import { createAdminClient } from "@/integrations/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Client for Supabase writes after slow LLM work. User-scoped JWTs can expire
 * mid-request (PGRST303); service role avoids that. Caller must already have
 * verified admin. Falls back to the user client if SUPABASE_SERVICE_ROLE_KEY is unset.
 */
export function supabaseForLongJobPersist(
  userScoped: SupabaseClient<Database>
): SupabaseClient<Database> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      "[supabaseForLongJobPersist] SUPABASE_SERVICE_ROLE_KEY missing; using user JWT — long requests may fail with JWT expired"
    );
    return userScoped;
  }
  return admin;
}
