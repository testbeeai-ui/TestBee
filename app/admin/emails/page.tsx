"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminEmailOverview } from "@/lib/email/adminEmailTypes";

type EmailLogRow = {
  id: string;
  created_at: string;
  ist_date: string;
  kind: string;
  recipient: string;
  user_id: string | null;
  subject: string;
  status: string;
  message_id: string | null;
  error_message: string | null;
};

type Payload = {
  overview: AdminEmailOverview;
  recent: EmailLogRow[];
  smtpConfigured: boolean;
  calculatedAt: string;
  error?: string;
};

function statusBadge(status: string) {
  if (status === "sent") return <Badge className="bg-emerald-600/90">sent</Badge>;
  if (status === "blocked_cap") return <Badge variant="destructive">cap blocked</Badge>;
  return <Badge variant="secondary">failed</Badge>;
}

export default function AdminEmailsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Payload | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch("/api/admin/email-logs?limit=100", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as Payload;
      if (!res.ok) throw new Error(body.error || "Failed to load email logs");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const capPct = useMemo(() => {
    if (!data?.overview) return 0;
    const { today, cap } = data.overview;
    if (cap <= 0) return 0;
    return Math.min(100, Math.round((today.sent / cap) * 100));
  }, [data]);

  const nearCap = Boolean(data && data.overview.today.sent >= data.overview.cap * 0.85);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Transactional Emails</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Welcome letters and login confirmations — counted by IST day. Use this to monitor
                volume and avoid SMTP overload.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.smtpConfigured ? (
              <Badge variant="secondary">SMTP configured</Badge>
            ) : (
              <Badge variant="destructive">SMTP not configured</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading email stats…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data?.overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Today (IST)</CardDescription>
                <CardTitle className="text-2xl font-bold">{data.overview.today.sent}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.overview.today.welcome} welcome · {data.overview.today.login} login
                {data.overview.today.failed > 0
                  ? ` · ${data.overview.today.failed} failed`
                  : ""}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Yesterday (IST)</CardDescription>
                <CardTitle className="text-2xl font-bold">{data.overview.yesterday.sent}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.overview.yesterday.welcome} welcome · {data.overview.yesterday.login} login
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Daily cap (IST)</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {data.overview.today.sent} / {data.overview.cap}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {nearCap ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    Near cap ({capPct}%) — new sends may be blocked
                  </span>
                ) : (
                  <span>{capPct}% of today&apos;s cap used</span>
                )}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Last 14 days</CardDescription>
                <CardTitle className="text-2xl font-bold">{data.overview.totals.sent}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.overview.totals.failed} failed · {data.overview.totals.blockedCap} cap blocks
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome mail flow</CardTitle>
              <CardDescription>{data.overview.welcomeFlow.note}</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last 7 IST days</CardTitle>
              <CardDescription>Sent count per calendar day (Asia/Kolkata)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Sent</th>
                      <th className="py-2 pr-4">Welcome</th>
                      <th className="py-2 pr-4">Login</th>
                      <th className="py-2 pr-4">Failed</th>
                      <th className="py-2">Cap blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overview.last7Days.map((day) => (
                      <tr key={day.istDate} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-medium">
                          {day.label}
                          <span className="ml-2 text-xs text-muted-foreground">{day.istDate}</span>
                        </td>
                        <td className="py-2 pr-4">{day.sent}</td>
                        <td className="py-2 pr-4">{day.welcome}</td>
                        <td className="py-2 pr-4">{day.login}</td>
                        <td className="py-2 pr-4">{day.failed}</td>
                        <td className="py-2">{day.blockedCap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent sends</CardTitle>
              <CardDescription>Newest first (up to 100)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Kind</th>
                      <th className="py-2 pr-3">To</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No emails logged yet. Apply migration{" "}
                          <code className="text-xs">20260804120000_transactional_email_logs</code>{" "}
                          on Supabase, then send a test or wait for a new signup.
                        </td>
                      </tr>
                    ) : (
                      data.recent.map((row) => (
                        <tr key={row.id} className="border-b border-border/60">
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            {new Date(row.created_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline">{row.kind}</Badge>
                          </td>
                          <td className="py-2 pr-3 max-w-[200px] truncate">{row.recipient}</td>
                          <td className="py-2 pr-3">{statusBadge(row.status)}</td>
                          <td className="py-2 pr-3 max-w-[280px] truncate" title={row.subject}>
                            {row.subject}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Adjust daily limit with{" "}
            <code className="rounded bg-muted px-1">EMAIL_DAILY_SEND_CAP</code> in env (default 500).
            Back to{" "}
            <Link href="/admin/dashboard" className="text-primary hover:underline">
              Overview
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
