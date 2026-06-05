"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AdminEmailOverview } from "@/lib/email/adminEmailTypes";

export function AdminEmailOverviewCard() {
  const [overview, setOverview] = useState<AdminEmailOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/admin/email-logs?limit=1", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed");
        if (!cancelled) setOverview(body.overview ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;
  if (!overview) return null;

  const nearCap = overview.today.sent >= overview.cap * 0.85;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Transactional emails (IST)
          </CardDescription>
          <Link
            href="/admin/emails"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <CardTitle className="text-lg font-bold">Email volume</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Today</p>
          <p className="text-2xl font-bold">{overview.today.sent}</p>
          <p className="text-xs text-muted-foreground">
            {overview.today.welcome} welcome · {overview.today.login} login
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Yesterday</p>
          <p className="text-2xl font-bold">{overview.yesterday.sent}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cap today</p>
          <p className="text-2xl font-bold">
            {overview.today.sent}/{overview.cap}
          </p>
          {nearCap ? (
            <Badge variant="destructive" className="mt-1">
              Near daily limit
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">Welcome mail on first sign-in</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
