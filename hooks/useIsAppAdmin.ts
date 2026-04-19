"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/** App admin: `profiles.role === "admin"` or legacy `user_roles` row (same rules as AdminRoute / isAdminUser). */
export function useIsAppAdmin(): boolean {
  const { profile, user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (authLoading) return;
      if (!user?.id || !profile) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      if (profile.role === "admin") {
        if (!cancelled) setIsAdmin(true);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!error && !!data);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, profile?.id, profile?.role]);

  return isAdmin;
}
