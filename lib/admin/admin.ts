import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function isAdminUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  // Admin authority must come from `user_roles`. `profiles` is user-editable
  // for onboarding/profile flows, so trusting `profiles.role = admin` allows
  // self-promotion if RLS ever permits broad own-row updates.
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!error && data) return true;

  if (process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK !== "true") return false;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return false;
  return profile?.role === "admin";
}
