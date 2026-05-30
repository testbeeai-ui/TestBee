"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Users, CalendarDays, BookCopy, ArrowRight } from "lucide-react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TeacherPortalAdminSummary = {
  totalTeachers: number;
  activeTeachers30d: number;
  googleConnectedTeachers: number;
  classroomsTotal: number;
  sectionsTotal: number;
  assignmentsTotal: number;
  upcomingSessionsTotal: number;
  motivationActionsTotal: number;
  generatedAt: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default function AdminTeacherPortalOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [summary, setSummary] = useState<TeacherPortalAdminSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) throw new Error("Missing access token");
        const res = await fetch("/api/admin/teachers?mode=summary", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = (await res.json()) as { summary?: TeacherPortalAdminSummary; error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load teacher portal summary");
        if (!cancelled) setSummary(body.summary ?? null);
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
  }, []);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Total teachers",
        value: fmt(summary.totalTeachers),
        href: "/admin/teacher-portal/teachers",
        icon: Users,
      },
      {
        label: "Active teachers (30d)",
        value: fmt(summary.activeTeachers30d),
        href: "/admin/teacher-portal/teachers?filter=active30d",
        icon: GraduationCap,
      },
      {
        label: "Classrooms",
        value: fmt(summary.classroomsTotal),
        href: "/admin/teacher-portal/teachers",
        icon: BookCopy,
      },
      {
        label: "Upcoming sessions",
        value: fmt(summary.upcomingSessionsTotal),
        href: "/admin/teacher-portal/teachers?filter=upcomingSessions",
        icon: CalendarDays,
      },
    ] as const;
  }, [summary]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Teacher Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Admin command center for teachers: analytics, classrooms, assignments, scheduling, and
              student communications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            {summary?.generatedAt ? (
              <Badge variant="secondary">
                Updated: {new Date(summary.generatedAt).toLocaleString()}
              </Badge>
            ) : null}
            <Button asChild>
              <Link href="/admin/teacher-portal/teachers">
                View teachers <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading teacher portal…</p> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link key={c.label} href={c.href} className="block">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center justify-between">
                        <span>{c.label}</span>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </CardDescription>
                      <CardTitle className="text-2xl font-bold">{c.value}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Operational coverage</CardTitle>
                <CardDescription>Key teacher-platform systems</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                  <span>Google connected</span>
                  <span className="font-semibold">{fmt(summary.googleConnectedTeachers)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                  <span>Sections</span>
                  <span className="font-semibold">{fmt(summary.sectionsTotal)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                  <span>Assignments</span>
                  <span className="font-semibold">{fmt(summary.assignmentsTotal)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                  <span>Motivation actions</span>
                  <span className="font-semibold">{fmt(summary.motivationActionsTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin shortcuts</CardTitle>
                <CardDescription>Fast entry points</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/admin/teacher-portal/teachers">Teacher directory</Link>
                </Button>
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/admin/users?role=teacher">User management (teachers)</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
