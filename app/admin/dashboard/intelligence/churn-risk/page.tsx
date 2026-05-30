"use client";

import { useEffect, useState } from "react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RiskUser = {
  user_id: string;
  name: string;
  risk_score: number;
  risk_level: "high" | "medium" | "low";
  risk_factors: string[];
  days_inactive: number;
  daily_dose_streak: number;
  study_ms_7d: number;
  study_ms_prev_7d: number;
  quiz_count_30d: number;
};

type ChurnPayload = {
  summary: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  atRiskUsers: RiskUser[];
  generatedAt: string;
  cachedAt?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatMs(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

function riskBadge(level: string) {
  switch (level) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Medium</Badge>
      );
    default:
      return <Badge variant="secondary">Low</Badge>;
  }
}

export default function ChurnRiskPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ChurnPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/churn-risk", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as ChurnPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/analytics/churn-risk", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as ChurnPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to refresh");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const lastRefreshed = data?.cachedAt || data?.generatedAt;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Churn Risk</CardTitle>
              <CardDescription>
                Students at risk of dropping off — based on inactivity, streak breaks, declining
                study time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lastRefreshed ? (
                <span className="text-xs text-muted-foreground">
                  Last refreshed: {new Date(lastRefreshed).toLocaleString()}
                </span>
              ) : null}
              <Button variant="outline" onClick={refresh} disabled={refreshing}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>High Risk</CardDescription>
                <CardTitle className="text-2xl font-bold text-destructive">
                  {formatNumber(data.summary.high)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Medium Risk</CardDescription>
                <CardTitle className="text-2xl font-bold text-yellow-600">
                  {formatNumber(data.summary.medium)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Low Risk</CardDescription>
                <CardTitle className="text-2xl font-bold text-emerald-600">
                  {formatNumber(data.summary.low)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Students</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {formatNumber(data.summary.total)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>At-Risk Students</CardTitle>
              <CardDescription>Click a student name to view their full profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 text-left font-medium text-muted-foreground">Student</th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">Risk</th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">Score</th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">
                        Inactive
                      </th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">
                        Study 7d
                      </th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">
                        Prev 7d
                      </th>
                      <th className="pb-3 text-center font-medium text-muted-foreground">
                        Quizzes 30d
                      </th>
                      <th className="pb-3 text-left font-medium text-muted-foreground">
                        Risk Factors
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atRiskUsers.map((user) => (
                      <tr key={user.user_id} className="border-b last:border-0">
                        <td className="py-3">
                          <a
                            href={`/admin/users/${user.user_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {user.name || "Unknown"}
                          </a>
                        </td>
                        <td className="py-3 text-center">{riskBadge(user.risk_level)}</td>
                        <td className="py-3 text-center font-mono">{user.risk_score}</td>
                        <td className="py-3 text-center">{user.days_inactive}d</td>
                        <td className="py-3 text-center">{formatMs(user.study_ms_7d)}</td>
                        <td className="py-3 text-center">{formatMs(user.study_ms_prev_7d)}</td>
                        <td className="py-3 text-center">{user.quiz_count_30d}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.risk_factors.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.atRiskUsers.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No at-risk students found</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
