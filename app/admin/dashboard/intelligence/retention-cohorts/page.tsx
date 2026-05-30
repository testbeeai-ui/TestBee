"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CohortRow = {
  cohort_month: string;
  cohort_size: number;
  day1: number;
  day7: number;
  day30: number;
  day1_pct: number;
  day7_pct: number;
  day30_pct: number;
};

type RetentionPayload = {
  cohorts: CohortRow[];
  note: string;
  generatedAt: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function heatColor(pct: number): string {
  if (pct >= 50) return "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  if (pct >= 30) return "bg-emerald-400/20 text-emerald-600 dark:text-emerald-400";
  if (pct >= 15) return "bg-emerald-300/15 text-emerald-500";
  if (pct > 0) return "bg-emerald-200/10 text-muted-foreground";
  return "text-muted-foreground/50";
}

export default function RetentionCohortsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<RetentionPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/retention-cohorts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as RetentionPayload & { error?: string };
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
              <CardTitle className="text-2xl">Retention Cohorts</CardTitle>
              <CardDescription>Day-1 / Day-7 / Day-30 return rates by signup month</CardDescription>
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
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground">Cohort</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Signups</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Day 1</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Day 7</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Day 30</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((row) => (
                    <tr key={row.cohort_month} className="border-b last:border-0">
                      <td className="py-3 font-medium">{row.cohort_month}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {formatNumber(row.cohort_size)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block min-w-[4.5rem] rounded-md px-2 py-1 text-xs font-semibold ${heatColor(row.day1_pct)}`}
                        >
                          {row.day1_pct}%
                          <span className="block text-[10px] font-normal opacity-70">
                            ({formatNumber(row.day1)})
                          </span>
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block min-w-[4.5rem] rounded-md px-2 py-1 text-xs font-semibold ${heatColor(row.day7_pct)}`}
                        >
                          {row.day7_pct}%
                          <span className="block text-[10px] font-normal opacity-70">
                            ({formatNumber(row.day7)})
                          </span>
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block min-w-[4.5rem] rounded-md px-2 py-1 text-xs font-semibold ${heatColor(row.day30_pct)}`}
                        >
                          {row.day30_pct}%
                          <span className="block text-[10px] font-normal opacity-70">
                            ({formatNumber(row.day30)})
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{data.note}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
