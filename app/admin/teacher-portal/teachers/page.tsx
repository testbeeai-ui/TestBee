"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeGetSession } from "@/lib/safeSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeacherDirectoryRow = {
  id: string;
  name: string | null;
  email: string | null;
  subjects: string[];
  teachingLevels: number[];
  googleConnected: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  classrooms: number;
  sections: number;
  assignments: number;
  upcomingSessions: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default function AdminTeacherDirectoryPage() {
  const params = useSearchParams();
  const initialFilter = params.get("filter") ?? "all";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [rows, setRows] = useState<TeacherDirectoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) throw new Error("Missing access token");
        const qs = new URLSearchParams();
        if (search.trim()) qs.set("search", search.trim());
        if (filter && filter !== "all") qs.set("filter", filter);
        const res = await fetch(`/api/admin/teachers?mode=directory&${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = (await res.json()) as { teachers?: TeacherDirectoryRow[]; error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load teachers");
        if (!cancelled) setRows(Array.isArray(body.teachers) ? body.teachers : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [search, filter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const google = rows.filter((r) => r.googleConnected).length;
    return { total, google };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Teachers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search, filter, and drill into per-teacher analytics. Admin actions are available from
              each teacher detail page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Total: {fmt(stats.total)}</Badge>
            <Badge variant="secondary">Google: {fmt(stats.google)}</Badge>
            <Button variant="outline" asChild>
              <Link href="/admin/teacher-portal">Back to overview</Link>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>Search by name/email; filter by operational signals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teacher name / email…"
              className="sm:max-w-md"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Teacher filter"
            >
              <option value="all">All</option>
              <option value="active30d">Active (30d)</option>
              <option value="upcomingSessions">Has upcoming sessions</option>
              <option value="googleConnected">Google connected</option>
            </select>
          </div>

          {loading ? <p className="text-sm text-muted-foreground">Loading teachers…</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead className="text-right">Classrooms</TableHead>
                  <TableHead className="text-right">Sections</TableHead>
                  <TableHead className="text-right">Assignments</TableHead>
                  <TableHead className="text-right">Upcoming sessions</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      No teachers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {t.email ?? t.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(t.subjects ?? []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {t.subjects.slice(0, 3).map((s) => (
                              <Badge key={s} variant="secondary">
                                {s}
                              </Badge>
                            ))}
                            {t.subjects.length > 3 ? (
                              <Badge variant="secondary">+{t.subjects.length - 3}</Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(t.classrooms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(t.sections)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(t.assignments)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(t.upcomingSessions)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.googleConnected ? <Badge variant="secondary">Google</Badge> : null}
                          {!t.googleConnected ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/admin/teacher-portal/teachers/${encodeURIComponent(t.id)}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

