"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlatformFeedbackOverview } from "@/lib/feedback/platformFeedbackTypes";

export function AdminFeedbackOverviewCard() {
  const [overview, setOverview] = useState<PlatformFeedbackOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/admin/platform-feedback?limit=1", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await res.json();
        if (!res.ok) return;
        if (!cancelled) setOverview(body.overview ?? null);
      } catch {
        /* optional card */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!overview || overview.total === 0) return null;

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Settings feedback survey
          </CardDescription>
          <Link
            href="/admin/feedback"
            className="text-xs font-medium text-primary hover:underline"
          >
            Open inbox
          </Link>
        </div>
        <CardTitle className="text-lg font-bold">User feedback</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Total submissions</p>
          <p className="text-2xl font-bold">{overview.total}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Needs review</p>
          <p className="text-2xl font-bold">{overview.newCount}</p>
          {overview.newCount > 0 ? (
            <Badge variant="destructive" className="mt-1">
              New
            </Badge>
          ) : null}
        </div>
        <div>
          <p className="text-muted-foreground">With issues reported</p>
          <p className="text-2xl font-bold">{overview.withIssues}</p>
          <p className="text-xs text-muted-foreground">{overview.last7Days} in last 7 days</p>
        </div>
      </CardContent>
    </Card>
  );
}
