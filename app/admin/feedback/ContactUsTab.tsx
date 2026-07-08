"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  Star,
} from "lucide-react";
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
  ContactAdminStatus,
  ContactCategory,
  ContactMessageRow,
  ContactMessagesOverview,
} from "@/lib/contact/contactMessageTypes";
import { CONTACT_CATEGORY_LABELS } from "@/lib/contact/contactMessageTypes";

type Payload = {
  rows: ContactMessageRow[];
  overview: ContactMessagesOverview;
  calculatedAt: string;
  error?: string;
};

function statusBadge(status: ContactAdminStatus) {
  if (status === "new") return <Badge variant="destructive">new</Badge>;
  if (status === "resolved") return <Badge className="bg-emerald-600/90 text-white">resolved</Badge>;
  return <Badge variant="secondary">reviewed</Badge>;
}

function categoryBadge(category: ContactCategory) {
  if (category === "sales") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        {CONTACT_CATEGORY_LABELS.sales}
      </Badge>
    );
  }
  if (category === "issue") {
    return (
      <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30">
        {CONTACT_CATEGORY_LABELS.issue}
      </Badge>
    );
  }
  return (
    <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
      {CONTACT_CATEGORY_LABELS.comment}
    </Badge>
  );
}

function categoryAccent(category: ContactCategory) {
  if (category === "sales") return "border-l-emerald-500";
  if (category === "issue") return "border-l-rose-500";
  return "border-l-violet-500";
}

function previewText(row: ContactMessageRow): string {
  const p = row.payload ?? {};
  const msg =
    (typeof p.salesMsg === "string" && p.salesMsg) ||
    (typeof p.issueDesc === "string" && p.issueDesc) ||
    (typeof p.commMsg === "string" && p.commMsg) ||
    "";
  return msg.trim().slice(0, 120) || "No message preview";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ContactUsTabProps {
  initialId?: string | null;
}

export function ContactUsTab({ initialId }: ContactUsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
      sp.set("category", categoryFilter);
      sp.set("limit", "200");

      const res = await fetch(`/api/admin/contact-messages?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as Payload;
      if (!res.ok) throw new Error(body.error || "Failed to load contact messages");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  useEffect(() => {
    if (!data?.rows.length) return;
    if (selectedId && data.rows.some((r) => r.id === selectedId)) return;
    setSelectedId(data.rows[0]?.id ?? null);
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.rows.find((r) => r.id === selectedId) ?? null,
    [data, selectedId]
  );

  useEffect(() => {
    setAdminNote(selected?.admin_note ?? "");
  }, [selected?.id, selected?.admin_note]);

  const patchRow = async (patch: { admin_status?: ContactAdminStatus; admin_note?: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");
      const res = await fetch(`/api/admin/contact-messages/${selected.id}`, {
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

  const renderPayloadDetails = (row: ContactMessageRow) => {
    const p = row.payload ?? {};
    const entries = Object.entries(p).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    );
    if (entries.length === 0) {
      return <p className="text-muted-foreground text-sm">No extra details.</p>;
    }
    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {String(value)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-500/10 p-2.5">
              <Inbox className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Contact Us Inbox</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Messages from the public Contact Us page — sales, issues, and feedback — with
                ticket IDs and category routing.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

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
              <CardTitle className="text-2xl font-bold text-rose-500">
                {data.overview.newCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Last 7 days</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-500">
                {data.overview.last7Days}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>By category</CardDescription>
              <CardTitle className="text-sm font-medium leading-snug">
                {data.overview.byCategory
                  .map((c) => `${CONTACT_CATEGORY_LABELS[c.category].split(" ")[0]}: ${c.count}`)
                  .join(" · ")}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
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
        <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="sales">Sales / partner</SelectItem>
            <SelectItem value="issue">Issue faced</SelectItem>
            <SelectItem value="comment">Comment / suggestion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading messages…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid min-h-[560px] lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="border-b lg:border-b-0 lg:border-r bg-muted/20">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              Inbox
              <span className="ml-auto text-xs">{data?.rows.length ?? 0}</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {(data?.rows ?? []).length === 0 && !loading ? (
                <p className="p-6 text-sm text-muted-foreground">No contact messages yet.</p>
              ) : null}
              {(data?.rows ?? []).map((row) => {
                const active = row.id === selectedId;
                const unread = row.admin_status === "new";
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-border/50 px-4 py-3 text-left transition hover:bg-muted/40",
                      "border-l-4",
                      categoryAccent(row.category),
                      active && "bg-primary/5",
                      unread && "bg-background"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          unread ? "font-bold text-foreground" : "font-medium text-foreground/90"
                        )}
                      >
                        {row.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {formatWhen(row.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">{row.email}</span>
                      {statusBadge(row.admin_status)}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono text-[10px] text-primary/80">{row.ticket_id}</span>
                      {" · "}
                      {previewText(row)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selected ? (
            <div className="flex flex-col">
              <div className="border-b px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryBadge(selected.category)}
                      {statusBadge(selected.admin_status)}
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {selected.ticket_id}
                      </Badge>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">{selected.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.email}
                      {selected.phone ? ` · ${selected.phone}` : ""} · {selected.role}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Received {new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.user_id ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${selected.user_id}`}>User profile</Link>
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
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {selected.category === "issue" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    ) : selected.category === "sales" ? (
                      <Star className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-violet-400" />
                    )}
                    Message body
                  </div>
                  {renderPayloadDetails(selected)}
                </div>

                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Admin internal note
                  </p>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="Internal note for support team…"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void patchRow({ admin_note: adminNote })}
                  >
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
              Select a message to read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
