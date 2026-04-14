"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AnalyticsResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
    name: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    status: "active" | "suspended" | "banned" | "soft_deleted";
    bannedUntil: string | null;
    suspendedUntil: string | null;
    deletedAt: string | null;
  };
  metrics: {
    rdm: number;
    lifetimeRdm: number;
    savedBits: number;
    savedFormulas: number;
    savedRevisionCards: number;
    savedRevisionUnits: number;
    bitsAttempts: number;
    subtopicEngagement: number;
    doubtsCreated: number;
    doubtsResolved: number;
    doubtViews: number;
    aiCalls: number;
    aiTotalTokens: number;
  };
  series: {
    aiTokensByMonth: Array<{ month: string; tokens: number }>;
  };
};

type ActivityResponse = {
  activity: Array<{
    type: "governance" | "doubt" | "ai_call";
    timestamp: string;
    title: string;
    details: string;
  }>;
};

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#14b8a6"];

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityResponse["activity"]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const [aRes, actRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}/analytics`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }),
        fetch(`/api/admin/users/${userId}/activity`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }),
      ]);

      const aBody = (await aRes.json()) as AnalyticsResponse & { error?: string };
      const actBody = (await actRes.json()) as ActivityResponse & { error?: string };
      if (!aRes.ok) throw new Error(aBody.error || "Failed to load analytics");
      if (!actRes.ok) throw new Error(actBody.error || "Failed to load activity");
      setAnalytics(aBody);
      setActivity(actBody.activity ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const savedMix = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Bits", value: analytics.metrics.savedBits },
      { name: "Formulas", value: analytics.metrics.savedFormulas },
      { name: "InstaCue", value: analytics.metrics.savedRevisionCards },
      { name: "Units", value: analytics.metrics.savedRevisionUnits },
    ];
  }, [analytics]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Analytics Detail</h1>
          <p className="text-sm text-muted-foreground">Investigate account state, usage, and governance history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/users">Back to users</Link>
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading user analytics...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {analytics ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Name</CardDescription><CardTitle>{analytics.user.name || "—"}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Email</CardDescription><CardTitle className="text-base">{analytics.user.email || "—"}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Status</CardDescription><CardTitle>{analytics.user.status}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Role</CardDescription><CardTitle>{analytics.user.role || "unknown"}</CardTitle></CardHeader></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Token Activity</CardTitle>
                <CardDescription>Monthly token usage footprint</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.series.aiTokensByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="tokens" stroke="#6366f1" fill="#6366f133" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Content Mix</CardTitle>
                <CardDescription>User revision behavior composition</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={savedMix} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45}>
                      {savedMix.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Doubts Created</CardDescription><CardTitle>{analytics.metrics.doubtsCreated}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Doubts Resolved</CardDescription><CardTitle>{analytics.metrics.doubtsResolved}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>AI Calls</CardDescription><CardTitle>{analytics.metrics.aiCalls}</CardTitle></CardHeader></Card>
            <Card size="sm"><CardHeader className="pb-2"><CardDescription>Total RDM</CardDescription><CardTitle>{analytics.metrics.rdm.toLocaleString()}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Feed</CardTitle>
              <CardDescription>Governance + doubt + AI event timeline</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity found.</p>
              ) : (
                <div className="space-y-2">
                  {activity.map((item, idx) => (
                    <div key={`${item.timestamp}-${idx}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
