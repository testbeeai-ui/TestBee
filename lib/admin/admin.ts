import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function isAdminUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  // Backward-compatible check: allow admin via `user_roles` table OR `profiles.role`.
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!error && data) return true;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return false;
  return profile?.role === "admin";
}
