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

type FunnelStep = {
  name: string;
  count: number;
  pct: number;
  dropoff?: number;
};

type FunnelPayload = {
  steps: FunnelStep[];
  generatedAt: string;
};

const STEP_COLORS = ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function ConversionFunnelPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FunnelPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/conversion-funnel", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as FunnelPayload & { error?: string };
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
              <CardTitle className="text-2xl">Conversion Funnel</CardTitle>
              <CardDescription>
                Signup → First Quiz → First Doubt → Daily Active → Paid
              </CardDescription>
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Funnel Visualization</CardTitle>
              <CardDescription>Bar width = % of total signups</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.steps} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={130} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "pct") return [`${value}%`, "Conversion"];
                      return [formatNumber(Number(value)), "Users"];
                    }}
                  />
                  <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={32}>
                    {data.steps.map((_, index) => (
                      <Cell key={index} fill={STEP_COLORS[index % STEP_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Breakdown</CardTitle>
              <CardDescription>Counts and drop-off at each stage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.steps.map((step, i) => (
                  <div key={step.name}>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: STEP_COLORS[i % STEP_COLORS.length] }}
                        />
                        <span className="font-medium">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatNumber(step.count)} users
                        </span>
                        <Badge variant="secondary">{step.pct}%</Badge>
                      </div>
                    </div>
                    {step.dropoff !== undefined && step.dropoff > 0 && (
                      <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-destructive">
                        <span>↓ {step.dropoff}% dropped off from previous step</span>
                      </div>
                    )}
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
