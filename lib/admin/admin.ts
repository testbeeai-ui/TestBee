import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function isAdminUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  // Backward-compatible check: allow admin via `user_roles` table OR `profiles.role`.
  // Both lookups run in parallel — India→Tokyo RTT is ~165ms each, so sequential
  // checks paid a full extra hop for every non-admin (the common case).
  const [rolesRes, profileRes] = await Promise.all([
    supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  if (!rolesRes.error && rolesRes.data) return true;
  if (profileRes.error) return false;
  return profileRes.data?.role === "admin";
}
