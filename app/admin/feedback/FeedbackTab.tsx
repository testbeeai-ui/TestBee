"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, RefreshCw, Star } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  PlatformFeedbackOverview,
  PlatformFeedbackRow,
  FeedbackAdminStatus,
} from "@/lib/feedback/platformFeedbackTypes";

type Payload = {
  rows: PlatformFeedbackRow[];
  overview: PlatformFeedbackOverview;
  calculatedAt: string;
  error?: string;
};

function statusBadge(status: FeedbackAdminStatus) {
  if (status === "new") return <Badge variant="destructive">new</Badge>;
  if (status === "resolved") return <Badge className="bg-emerald-600/90 text-white">resolved</Badge>;
  return <Badge variant="secondary">reviewed</Badge>;
}

function displayUser(row: PlatformFeedbackRow) {
  return (
    row.user_display_name ||
    row.profile_name ||
    row.user_email ||
    (row.user_id ? row.user_id.slice(0, 8) : "Anonymous")
  );
}

interface FeedbackTabProps {
  initialId?: string | null;
}

export function FeedbackTab({ initialId }: FeedbackTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialId || null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const sp = new URLSearchParams();
      sp.set("status", statusFilter);
      sp.set("limit", "200");
      if (issuesOnly) sp.set("issues", "1");

      const res = await fetch(`/api/admin/platform-feedback?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as Payload;
      if (!res.ok) throw new Error(body.error || "Failed to load feedback");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, issuesOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialId) {
      setSelectedId(initialId);
    }
  }, [initialId]);

  useEffect(() => {
    if (!data?.rows.length) return;
    if (selectedId && data.rows.some((r) => r.id === selectedId)) {
      return;
    }
    setSelectedId(data.rows[0]?.id ?? null);
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.rows.find((r) => r.id === selectedId) ?? null,
    [data, selectedId]
  );

  useEffect(() => {
    setAdminNote(selected?.admin_note ?? "");
  }, [selected?.id, selected?.admin_note]);

  const patchRow = async (patch: { admin_status?: FeedbackAdminStatus; admin_note?: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");
      const res = await fetch(`/api/admin/platform-feedback/${selected.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Update failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5">
              <MessageSquare className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Feedback Inbox</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Every submission from the 'Share your experience' feedback form (found in Profile → Settings). Includes satisfaction ratings, feature usage, suggestions, and reported platform bugs/issues.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      {data?.overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl font-bold">{data.overview.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>New / unreviewed</CardDescription>
              <CardTitle className="text-2xl font-bold text-rose-500">{data.overview.newCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Reported issues</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-500">{data.overview.withIssues}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Last 7 days</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-500">{data.overview.last7Days}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value) setStatusFilter(value);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New only</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={issuesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setIssuesOnly((v) => !v)}
        >
          Issues only
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading feedback…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data?.rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No feedback submissions yet.</p>
      ) : null}

      {/* Grid: List + Detail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Submissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Rating</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((row) => {
                    const active = row.id === selectedId;
                    const issue = Boolean(row.issue_category || row.issue_text?.trim());
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer border-t border-border/60 hover:bg-muted/40 transition-colors",
                          active && "bg-primary/5"
                        )}
                        onClick={() => handleSelect(row.id)}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{displayUser(row)}</span>
                          {issue ? (
                            <Badge variant="outline" className="ml-1 text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                              issue
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 capitalize text-xs">{row.role}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.overall_rating}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{statusBadge(row.admin_status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selected ? (
          <Card className="flex flex-col h-fit">
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{displayUser(selected)}</CardTitle>
                  <CardDescription className="mt-1">
                    {selected.user_email ?? "No email"} · Survey role: {selected.role}
                    {selected.profile_role ? ` · Account: ${selected.profile_role}` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.user_id ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/users/${selected.user_id}`}>User analytics</Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void patchRow({ admin_status: "reviewed" })}
                  >
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void patchRow({ admin_status: "resolved" })}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm max-h-[500px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {statusBadge(selected.admin_status)}
                <Badge variant="outline">{selected.source}</Badge>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1C2333] border border-[#2A3347]">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {selected.overall_rating}/5
                  {selected.nps !== null ? ` · NPS ${selected.nps}` : ""}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Features Used</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.features.length > 0 ? (
                    selected.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {selected.extra_value ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Context / Extra Info</p>
                  <p className="mt-1 text-foreground leading-relaxed bg-muted/10 p-3 rounded-lg border border-border/50">{selected.extra_value}</p>
                </div>
              ) : null}

              {selected.issue_category || selected.issue_text ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                  <p className="text-xs font-semibold uppercase text-rose-400">Issue Details</p>
                  {selected.issue_category ? (
                    <p className="font-medium text-rose-200 mt-0.5">{selected.issue_category}</p>
                  ) : null}
                  {selected.issue_text ? (
                    <p className="mt-1 whitespace-pre-wrap text-rose-100/90 leading-relaxed">{selected.issue_text}</p>
                  ) : null}
                </div>
              ) : null}

              {Object.keys(selected.specific_ratings).length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Specific ratings</p>
                  <ul className="mt-1.5 space-y-1 bg-muted/20 border border-border rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selected.specific_ratings).map(([k, v]) => (
                      <li key={k} className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span> 
                        <span className="font-semibold">{v}/5</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selected.suggestion ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Suggestion / Feedback</p>
                  <p className="whitespace-pre-wrap mt-1 leading-relaxed text-foreground bg-muted/10 p-3 rounded-lg border border-border/50">{selected.suggestion}</p>
                </div>
              ) : null}

              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Admin Internal Note</p>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Internal note for support / product team…"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void patchRow({ admin_note: adminNote })}
                >
                  Save Note
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
