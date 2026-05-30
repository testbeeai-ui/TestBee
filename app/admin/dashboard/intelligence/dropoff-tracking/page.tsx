"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Stage = {
  stage: string;
  count: number;
  pct: number;
};

type AbandonmentPoint = {
  point: string;
  abandoned: number;
  pct: number;
};

type DropoffPayload = {
  totalSubtopicVisits: number;
  stages: Stage[];
  abandonmentPoints: AbandonmentPoint[];
  generatedAt: string;
};

const STAGE_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#22c55e"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function DropoffTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DropoffPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/dropoff-tracking", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as DropoffPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Drop-off Tracking</CardTitle>
              <CardDescription>Where students abandon the learning flow</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {data ? (
                <Badge variant="secondary">
                  Total visits: {formatNumber(data.totalSubtopicVisits)}
                </Badge>
              ) : null}
              <Button variant="outline" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Learning Flow Funnel</CardTitle>
              <CardDescription>
                Page Visited → Quiz Started → Quiz Completed → Lesson Marked
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="stage" width={160} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "pct") return [`${value}%`, "Conversion"];
                      return [formatNumber(Number(value)), "Count"];
                    }}
                  />
                  <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={32}>
                    {data.stages.map((_, index) => (
                      <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Abandonment Points</CardTitle>
              <CardDescription>Where students drop off most</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.abandonmentPoints.map((ap, i) => (
                  <div key={ap.point} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{ap.point}</span>
                      <Badge variant={ap.pct > 30 ? "destructive" : "secondary"}>
                        {ap.pct}% abandoned
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/60"
                          style={{ width: `${Math.min(ap.pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(ap.abandoned)} users
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
