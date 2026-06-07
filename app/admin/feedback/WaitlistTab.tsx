"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, User } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  WaitlistSubmissionDbRow,
  WaitlistAdminStatus,
  WaitlistRole,
} from "@/lib/waitlist/waitlistDb";

type Payload = {
  rows: WaitlistSubmissionDbRow[];
  overview: {
    total: number;
    newCount: number;
    last7Days: number;
    byRole: { role: string; count: number }[];
  };
  calculatedAt: string;
  error?: string;
};

function statusBadge(status: WaitlistAdminStatus) {
  if (status === "new") return <Badge variant="destructive">new</Badge>;
  if (status === "resolved") return <Badge className="bg-emerald-600/90 text-white">resolved</Badge>;
  return <Badge variant="secondary">reviewed</Badge>;
}

function tierBadge(tier: string | undefined) {
  if (tier === "ambassador") {
    return <Badge className="bg-violet-600/90 text-white">ambassador</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">waitlist only</Badge>;
}

function displayName(row: WaitlistSubmissionDbRow) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

interface WaitlistTabProps {
  initialId?: string | null;
}

export function WaitlistTab({ initialId }: WaitlistTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialId || null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const sp = new URLSearchParams();
      sp.set("status", statusFilter);
      sp.set("role", roleFilter);
      if (debouncedSearch) sp.set("search", debouncedSearch);
      sp.set("limit", "200");

      const res = await fetch(`/api/admin/waitlist?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as Payload;
      if (!res.ok) throw new Error(body.error || "Failed to load waitlist");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, debouncedSearch]);

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

  const patchRow = async (patch: { admin_status?: WaitlistAdminStatus; admin_note?: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");
      const res = await fetch(`/api/admin/waitlist/${selected.id}`, {
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

  const approveSubmission = async (roleOverride?: "student" | "teacher") => {
    if (!selected) return;
    setApproving(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const targetRole = roleOverride || (selected.role === "teacher" ? "teacher" : "student");

      const res = await fetch("/api/admin/waitlist/approve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selected.id,
          role: targetRole,
          customMessage: "Your waitlist application is approved! Setup your account.",
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Approval failed");

      alert(`Successfully whitelisted ${selected.email} as a ${targetRole}! Invitation email sent.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const roleCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (data?.overview.byRole) {
      for (const item of data.overview.byRole) {
        map.set(item.role, item.count);
      }
    }
    return map;
  }, [data?.overview.byRole]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Waitlist Inbox</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View and manage early access registrations from the public landing page.
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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Total waitlist</CardDescription>
              <CardTitle className="text-2xl font-bold">{data.overview.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>New signups</CardDescription>
              <CardTitle className="text-2xl font-bold text-rose-500">{data.overview.newCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Students</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-500">{roleCountsMap.get("student") ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription>Teachers / Tutors</CardDescription>
              <CardTitle className="text-2xl font-bold text-sky-500">{roleCountsMap.get("teacher") ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Last 7 Days</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-500">{data.overview.last7Days}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(val) => { if (val) setStatusFilter(val); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New only</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={(val) => { if (val) setRoleFilter(val); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="parent">Parents</SelectItem>
            <SelectItem value="other">Others</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="search"
          placeholder="Search by name, email, phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-9 bg-card border-border"
        />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading submissions…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data?.rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No waitlist submissions found.</p>
      ) : null}

      {/* Main Grid: List + Details */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Submissions List */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Registrations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[550px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">Waitlist ID</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Tier</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((row) => {
                    const active = row.id === selectedId;
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
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                          {row.waitlist_id}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{displayName(row)}</span>
                          <span className="block text-[10px] text-muted-foreground">{row.email}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {row.role ? (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                              row.role === "student" && "bg-emerald-500/10 text-emerald-400",
                              row.role === "teacher" && "bg-sky-500/10 text-sky-400",
                              row.role === "parent" && "bg-purple-500/10 text-purple-400",
                              row.role === "other" && "bg-zinc-500/15 text-zinc-400"
                            )}>
                              {row.role}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{tierBadge(row.signup_tier)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{statusBadge(row.admin_status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Selected Submission Detail Panel */}
        {selected ? (
          <Card className="flex flex-col h-fit">
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{displayName(selected)}</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/5">{selected.waitlist_id}</Badge>
                    {tierBadge(selected.signup_tier)}
                  </div>
                  <CardDescription className="mt-1">
                    {selected.email} · Phone: {selected.phone}
                    {(selected.city || selected.state) && (
                      <>
                        <br />
                        Location: {[selected.city, selected.state].filter(Boolean).join(", ")}
                      </>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.admin_status !== "resolved" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      disabled={saving || approving}
                      onClick={() => void approveSubmission()}
                    >
                      {approving ? "Approving..." : "Approve & Whitelist"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={saving || approving}
                    onClick={() => void patchRow({ admin_status: "reviewed" })}
                  >
                    Mark Reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || approving}
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1C2333] border border-[#2A3347] capitalize">
                  {selected.role}
                </span>
              </div>

              {/* Role Specific details */}
              <div className="rounded-xl border border-border bg-muted/20 p-4.5 space-y-3">
                <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Application profile answers
                </p>

                {selected.role === "student" && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Class:</span>
                      <span className="font-semibold text-foreground">{selected.student_class || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">School / College:</span>
                      <span className="font-semibold text-foreground">{selected.school || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Target Exam:</span>
                      <span className="font-semibold text-foreground">{selected.exam || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Coaching Setup:</span>
                      <span className="font-semibold text-foreground">{selected.coaching || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Study Hours / Week:</span>
                      <span className="font-semibold text-foreground">{selected.study_hours || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Class 10 Score:</span>
                      <span className="font-semibold text-foreground">{selected.grade10_marks || "—"}</span>
                    </div>
                  </div>
                )}

                {selected.role === "teacher" && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Subject:</span>
                      <span className="font-semibold text-foreground">{selected.primary_subject || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Experience:</span>
                      <span className="font-semibold text-foreground">{selected.experience || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Students Taught / Year:</span>
                      <span className="font-semibold text-foreground">{selected.students_count || "—"}</span>
                    </div>
                    {selected.linkedin ? (
                      <div className="col-span-2">
                        <span className="text-muted-foreground block">LinkedIn Profile:</span>
                        <a
                          href={selected.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium break-all"
                        >
                          {selected.linkedin}
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}

                {selected.role === "parent" && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Child's Class:</span>
                      <span className="font-semibold text-foreground">{selected.child_class || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Child's Target Exam:</span>
                      <span className="font-semibold text-foreground">{selected.child_exam || "—"}</span>
                    </div>
                  </div>
                )}

                {selected.role === "other" && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Organisation:</span>
                      <span className="font-semibold text-foreground">{selected.organisation || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Role:</span>
                      <span className="font-semibold text-foreground">{selected.organisation_role || "—"}</span>
                    </div>
                    {selected.website ? (
                      <div className="col-span-2">
                        <span className="text-muted-foreground block">Website:</span>
                        <a
                          href={selected.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium break-all"
                        >
                          {selected.website}
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Selected Interests */}
              {selected.interests && selected.interests.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.interests.map((interest) => (
                      <Badge key={interest} variant="outline" className="text-xs py-0.5">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Why Join */}
              {selected.why_join ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Reason for joining</p>
                  <p className="whitespace-pre-wrap mt-1 leading-relaxed text-foreground bg-muted/10 p-3 rounded-lg border border-border/50">
                    {selected.why_join}
                  </p>
                </div>
              ) : null}

              {/* Referral info */}
              {(selected.referral || selected.refcode) ? (
                <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                  {selected.referral ? (
                    <div>
                      <span className="text-muted-foreground block">Referral source:</span>
                      <span className="font-medium text-foreground">{selected.referral}</span>
                    </div>
                  ) : null}
                  {selected.refcode ? (
                    <div>
                      <span className="text-muted-foreground block">Referral code used:</span>
                      <span className="font-mono text-primary font-semibold">{selected.refcode}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Admin Note Section */}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Admin Internal Note
                </p>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Notes on phone call, validation details, school name, ambassador interview..."
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
