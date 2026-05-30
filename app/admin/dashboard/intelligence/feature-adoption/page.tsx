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
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeatureRow = {
  name: string;
  users: number;
  pct: number;
};

type AdoptionPayload = {
  activeUsers30d: number;
  features: FeatureRow[];
  generatedAt: string;
};

const BAR_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function FeatureAdoptionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdoptionPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/feature-adoption", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as AdoptionPayload & { error?: string };
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

  const sorted = data?.features ? [...data.features].sort((a, b) => b.pct - a.pct) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Feature Adoption</CardTitle>
              <CardDescription>% of active users (30d) who used each feature</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {data ? (
                <Badge variant="secondary">
                  Active users (30d): {formatNumber(data.activeUsers30d)}
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
              <CardTitle>Adoption by Feature</CardTitle>
              <CardDescription>Horizontal bar = % of 30-day active users</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sorted} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Adoption"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={28}>
                    {sorted.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={entry.pct < 10 ? "#ef4444" : BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Breakdown</CardTitle>
              <CardDescription>User counts and percentages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sorted.map((f, i) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            f.pct < 10 ? "#ef4444" : BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                      <span className="font-medium">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(f.users)} users
                      </span>
                      <Badge variant={f.pct < 10 ? "destructive" : "secondary"}>{f.pct}%</Badge>
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
