"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (loading || !user || !profile) return;
      // Fast path for the new profile-role based access model.
      if (profile.role === "admin") {
        if (!cancelled) {
          setIsAdmin(true);
          setCheckingAdmin(false);
        }
        return;
      }
      // Backward-compatible path for existing admins in user_roles.
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) {
        setIsAdmin(!error && !!data);
        setCheckingAdmin(false);
      }
    }
    setCheckingAdmin(true);
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [loading, user, profile]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!profile || checkingAdmin) return;
    if (!isAdmin) {
      router.replace("/");
    }
  }, [loading, user, profile, checkingAdmin, isAdmin, router]);

  if (loading || !user || !profile || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading admin console...</span>
      </div>
    );
  }

  if (!isAdmin) return null;
  return <>{children}</>;
}
