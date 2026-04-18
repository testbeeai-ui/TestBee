"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AnalyticsPayload = {
  kpis: {
    totalUsers: number;
    studentUsers: number;
    teacherUsers: number;
    adminUsers: number;
    active30d: number;
    totalRdm: number;
    lifetimeRdm: number;
    totalDoubts: number;
    resolvedDoubts: number;
    totalDoubtViews: number;
    totalSavedItems: number;
    bitsAttempts: number;
    subtopicEngagement: number;
    aiCalls: number;
  };
  series: {
    userGrowth: Array<{ month: string; count: number }>;
    doubtsMonthly: Array<{ month: string; count: number }>;
    classDistribution: Array<{ name: string; value: number }>;
    streamDistribution: Array<{ name: string; value: number }>;
    rdmByRole: Array<{ role: string; value: number }>;
    savedContentBreakdown: Array<{ name: string; value: number }>;
  };
  generatedAt: string;
};

const PIE_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const load = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      const body = (await res.json()) as AnalyticsPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load analytics");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // Keep dashboard live by polling the server.
    const id = window.setInterval(() => {
      load({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Total Users", value: formatNumber(data.kpis.totalUsers) },
      { label: "Active (30d)", value: formatNumber(data.kpis.active30d) },
      { label: "Total Doubts", value: formatNumber(data.kpis.totalDoubts) },
      { label: "Resolved Doubts", value: formatNumber(data.kpis.resolvedDoubts) },
      { label: "Total RDM", value: formatNumber(data.kpis.totalRdm) },
      { label: "Lifetime RDM", value: formatNumber(data.kpis.lifetimeRdm) },
      { label: "Saved Content", value: formatNumber(data.kpis.totalSavedItems) },
      { label: "AI Calls", value: formatNumber(data.kpis.aiCalls) },
    ];
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time command center for growth, engagement, economy, and content intelligence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Live</Badge>
            {data?.generatedAt ? (
              <Badge variant="secondary">Updated: {new Date(data.generatedAt).toLocaleString()}</Badge>
            ) : null}
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading analytics...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((item) => (
              <Card key={item.label} size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="text-2xl font-bold">{item.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Monthly new users</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series.userGrowth}>
                    <defs>
                      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#growthFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Velocity</CardTitle>
                <CardDescription>Monthly doubts created</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series.doubtsMonthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>RDM by Role</CardTitle>
                <CardDescription>Economy concentration split</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series.rdmByRole}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="role" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Class Distribution</CardTitle>
                <CardDescription>Student segmentation by class</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.series.classDistribution} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45}>
                      {data.series.classDistribution.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Content Mix</CardTitle>
                <CardDescription>Revision behavior breakdown</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.series.savedContentBreakdown} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45}>
                      {data.series.savedContentBreakdown.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
