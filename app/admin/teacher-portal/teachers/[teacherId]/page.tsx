"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeacherTab =
  | "overview"
  | "classrooms"
  | "lessons"
  | "assignments"
  | "tests"
  | "motivation"
  | "profile"
  | "audit";

const TEACHER_TABS: TeacherTab[] = [
  "overview",
  "classrooms",
  "lessons",
  "assignments",
  "tests",
  "motivation",
  "profile",
  "audit",
];

function normalizeTeacherTab(raw: string | null): TeacherTab {
  if (!raw) return "overview";
  const legacy: Record<string, TeacherTab> = {
    sessions: "lessons",
    notifications: "motivation",
    actions: "lessons",
    sections: "classrooms",
  };
  if (legacy[raw]) return legacy[raw];
  if (TEACHER_TABS.includes(raw as TeacherTab)) return raw as TeacherTab;
  return "overview";
}

type TeacherBundle = {
  summary: {
    googleCalendarConnected: boolean;
    activeClassrooms: number;
    totalStudents: number;
    assignmentsActive: number;
    avgCompletionPercent: number | null;
    rdmDistributedMonth: number;
    questionsToday: number;
    teacherSectionsWritten: number;
    teacherRdmWeek: number;
    avgTeacherUpvotes: number;
  };
  classrooms: Array<{
    id: string;
    name: string;
    subject: string | null;
    section: string | null;
    joinCode: string;
    studentCount: number;
    assignmentCount: number;
    nextSessionLabel: string;
    nextMeetLink: string | null;
    googleSeriesLinked: boolean;
  }>;
  sessions: Array<{
    id: string;
    classroomId: string;
    classroomName: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    meetLink: string | null;
    sectionId: string | null;
    sectionName: string | null;
    scopeLabel: string;
    status: string | null;
    sessionPlanAttached: boolean;
    postWorkReleaseLabel: string | null;
  }>;
  classroomDetails: Record<
    string,
    {
      classroomId: string;
      sections: Array<{
        id: string;
        name: string;
        scheduleLabel: string | null;
        isActive: boolean;
      }>;
      assignments: Array<{
        id: string;
        title: string;
        type: string;
        dueDateLabel: string;
        completionPercent: number;
        completedCount: number;
        totalCount: number;
      }>;
      motivationLog: Array<{
        id: string;
        actionKind: string;
        message: string;
        rdmDelta: number;
        createdAt: string;
      }>;
    }
  >;
  profile: {
    id: string;
    name: string | null;
    bio?: string;
    subjects: string[];
    teachingLevels: number[];
    examTags?: string[];
    visibility: string | null;
    rdm: number;
    details?: {
      location: string | null;
      qualification: string | null;
      experience: string | null;
      email: string | null;
      phone: string | null;
      youtubeOrSocial: string | null;
      docs?: {
        aadharPhotoUrl: string | null;
        instituteCertificatePhotoUrl: string | null;
        aadharShareLink?: string | null;
        instituteCertificateShareLink?: string | null;
      };
    };
  };
};

type AuditRow = {
  id: string;
  actionType: string;
  createdAt: string;
  actorUserId: string;
  details: string | null;
};

type TestHistoryRow = {
  id: string;
  board: string;
  class_level: number;
  subject: string;
  scope: string;
  chapter_title: string | null;
  topic_title: string | null;
  unit_title: string | null;
  question_count: number;
  duration_minutes: number | null;
  generated_at: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function sessionCancelled(status: string | null) {
  const v = (status ?? "").trim().toLowerCase();
  return v === "cancelled" || v === "canceled";
}

function buildProfileDetailsPayload(bundle: TeacherBundle) {
  const d = bundle.profile.details;
  return {
    location: d?.location ?? undefined,
    qualification: d?.qualification ?? undefined,
    experience: d?.experience ?? undefined,
    email: d?.email ?? undefined,
    phone: d?.phone ?? undefined,
    youtubeOrSocial: d?.youtubeOrSocial ?? undefined,
    docs: {
      aadharPhotoUrl: d?.docs?.aadharPhotoUrl ?? undefined,
      aadharShareLink: d?.docs?.aadharShareLink ?? undefined,
      instituteCertificatePhotoUrl: d?.docs?.instituteCertificatePhotoUrl ?? undefined,
      instituteCertificateShareLink: d?.docs?.instituteCertificateShareLink ?? undefined,
    },
  };
}

export default function AdminTeacherDetailPage() {
  const routeParams = useParams<{ teacherId: string }>();
  const teacherId = routeParams.teacherId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = normalizeTeacherTab(searchParams.get("tab"));

  const setTab = useCallback(
    (v: TeacherTab) => {
      router.replace(`/admin/teacher-portal/teachers/${teacherId}?tab=${v}`, { scroll: false });
    },
    [router, teacherId]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState<TeacherBundle | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [testHistory, setTestHistory] = useState<TestHistoryRow[]>([]);
  const [testHistoryLoading, setTestHistoryLoading] = useState(false);
  const [testHistoryError, setTestHistoryError] = useState("");

  const [classroomsStatus, setClassroomsStatus] = useState("");
  const [lessonsStatus, setLessonsStatus] = useState("");
  const [assignmentsStatus, setAssignmentsStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

  const [createTitle, setCreateTitle] = useState("");
  const [createClassroomId, setCreateClassroomId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");
  const [createMeetLink, setCreateMeetLink] = useState("");
  const [sessionCreateNotes, setSessionCreateNotes] = useState("");

  const [pendingCancelSessionId, setPendingCancelSessionId] = useState<string | null>(null);
  const [sessionCancelNotes, setSessionCancelNotes] = useState("");

  const [ccName, setCcName] = useState("");
  const [ccSubject, setCcSubject] = useState("");
  const [ccPucLevel, setCcPucLevel] = useState<"PUC 1" | "PUC 2" | "Both">("Both");
  const [ccExamTarget, setCcExamTarget] = useState("General");
  const [ccScheduleDate, setCcScheduleDate] = useState("");
  const [ccScheduleTime, setCcScheduleTime] = useState("");
  const [ccScheduleEndDate, setCcScheduleEndDate] = useState("");
  const [ccDurationMinutes, setCcDurationMinutes] = useState(60);
  const [ccAllowAdhoc, setCcAllowAdhoc] = useState(true);
  const [ccRepeatDaysRaw, setCcRepeatDaysRaw] = useState("");
  const [ccNotes, setCcNotes] = useState("");

  const [renameClassroomId, setRenameClassroomId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameNotes, setRenameNotes] = useState("");

  const [deleteClassroomId, setDeleteClassroomId] = useState<string | null>(null);
  const [deleteNotes, setDeleteNotes] = useState("");

  const [assignClassroomId, setAssignClassroomId] = useState("");
  const [assignType, setAssignType] = useState("assignment");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignRewardRdm, setAssignRewardRdm] = useState(10);
  const [assignToLabel, setAssignToLabel] = useState("All students");
  const [assignNotes, setAssignNotes] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [profileSubjectsRaw, setProfileSubjectsRaw] = useState("");
  const [profileExamTagsRaw, setProfileExamTagsRaw] = useState("");
  const [profileLevelsRaw, setProfileLevelsRaw] = useState("");
  const [profileSaveNotes, setProfileSaveNotes] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch(`/api/admin/teachers/${teacherId}/bundle`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as { bundle?: TeacherBundle; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load teacher bundle");
      setBundle(body.bundle ?? null);

      const auditRes = await fetch(`/api/admin/teachers/${teacherId}/audit?limit=50`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const auditBody = (await auditRes.json()) as { rows?: AuditRow[]; error?: string };
      if (auditRes.ok) setAudit(Array.isArray(auditBody.rows) ? auditBody.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    if (!bundle?.classrooms?.length) return;
    if (!assignClassroomId || !bundle.classrooms.some((c) => c.id === assignClassroomId)) {
      setAssignClassroomId(bundle.classrooms[0]?.id ?? "");
    }
  }, [bundle, assignClassroomId]); // bundle: reset picker when classrooms list changes

  useEffect(() => {
    if (!bundle) return;
    setProfileName(bundle.profile.name ?? "");
    setProfileBio(bundle.profile.bio ?? "");
    setProfileVisibility(bundle.profile.visibility ?? "public");
    setProfileSubjectsRaw((bundle.profile.subjects ?? []).join(", "));
    setProfileExamTagsRaw((bundle.profile.examTags ?? []).join(", "));
    setProfileLevelsRaw((bundle.profile.teachingLevels ?? []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed form when this teacher's profile row changes (after load/save)
  }, [bundle?.profile.id]);

  const loadTestHistory = useCallback(async () => {
    setTestHistoryLoading(true);
    setTestHistoryError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");
      const res = await fetch(`/api/admin/teachers/${teacherId}/test-history?limit=100`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as { history?: TestHistoryRow[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load test history");
      setTestHistory(Array.isArray(body.history) ? body.history : []);
    } catch (e) {
      setTestHistoryError(e instanceof Error ? e.message : "Unknown error");
      setTestHistory([]);
    } finally {
      setTestHistoryLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    if (activeTab !== "tests") return;
    void loadTestHistory();
  }, [activeTab, loadTestHistory]);

  const top = useMemo(() => {
    if (!bundle) return null;
    const totalAssignments = Object.values(bundle.classroomDetails ?? {}).reduce(
      (sum, d) => sum + (d.assignments?.length ?? 0),
      0
    );
    const totalSections = Object.values(bundle.classroomDetails ?? {}).reduce(
      (sum, d) => sum + (d.sections?.length ?? 0),
      0
    );
    return { totalAssignments, totalSections };
  }, [bundle]);

  const postAdmin = async (path: string, payload: Record<string, unknown>) => {
    const { session } = await safeGetSession();
    if (!session?.access_token) throw new Error("Missing access token");
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!res.ok) throw new Error(body.error || "Action failed");
    return body;
  };

  const parseCommaList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const parseRepeatDays = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const parseLevels = (s: string) =>
    s
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
              {bundle?.profile?.name ?? "Teacher"}{" "}
              <span className="text-sm font-normal text-muted-foreground">({teacherId})</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Per-teacher analytics + admin operations.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Google: {bundle?.summary.googleCalendarConnected ? "Connected" : "Not connected"}
              </Badge>
              <Badge variant="secondary">RDM: {fmt(bundle?.profile.rdm ?? 0)}</Badge>
              {(bundle?.profile.subjects ?? []).slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/teacher-portal/teachers">Back</Link>
            </Button>
            <Button asChild>
              <Link
                href={`/teacher-portal?adminTeacherId=${encodeURIComponent(teacherId)}&section=myClassroom`}
              >
                Open as teacher
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading teacher…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {bundle && top ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Classrooms</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {fmt(bundle.summary.activeClassrooms)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Sections</CardDescription>
                <CardTitle className="text-2xl font-bold">{fmt(top.totalSections)}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Assignments</CardDescription>
                <CardTitle className="text-2xl font-bold">{fmt(top.totalAssignments)}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardDescription>Upcoming sessions</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {fmt(
                    (bundle.sessions ?? []).filter((s) => Date.parse(s.scheduledAt) > Date.now())
                      .length
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setTab(v as TeacherTab)} className="w-full">
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/80 p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="classrooms" className="text-xs sm:text-sm">
                Classrooms
              </TabsTrigger>
              <TabsTrigger value="lessons" className="text-xs sm:text-sm">
                Lessons
              </TabsTrigger>
              <TabsTrigger value="assignments" className="text-xs sm:text-sm">
                Assignments
              </TabsTrigger>
              <TabsTrigger value="tests" className="text-xs sm:text-sm">
                Tests
              </TabsTrigger>
              <TabsTrigger value="motivation" className="text-xs sm:text-sm">
                Motivation
              </TabsTrigger>
              <TabsTrigger value="profile" className="text-xs sm:text-sm">
                Profile
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs sm:text-sm">
                Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Admin summary (fast read)</CardTitle>
                  <CardDescription>High-signal teacher operating summary.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm lg:grid-cols-3">
                  <div className="rounded-xl border bg-background p-3">
                    Students across classrooms:{" "}
                    <span className="font-semibold">{fmt(bundle.summary.totalStudents)}</span>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    Assignments active:{" "}
                    <span className="font-semibold">{fmt(bundle.summary.assignmentsActive)}</span>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    Gyan++ answers written:{" "}
                    <span className="font-semibold">
                      {fmt(bundle.summary.teacherSectionsWritten)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="classrooms" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create classroom</CardTitle>
                  <CardDescription>
                    Creates a classroom for this teacher. Reason is required for the audit log.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={ccName}
                      onChange={(e) => setCcName(e.target.value)}
                      placeholder="Class name"
                    />
                    <Input
                      value={ccSubject}
                      onChange={(e) => setCcSubject(e.target.value)}
                      placeholder="Subject"
                    />
                    <div>
                      <label className="text-xs text-muted-foreground">PUC level</label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={ccPucLevel}
                        onChange={(e) => setCcPucLevel(e.target.value as typeof ccPucLevel)}
                      >
                        <option value="PUC 1">PUC 1</option>
                        <option value="PUC 2">PUC 2</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                    <Input
                      value={ccExamTarget}
                      onChange={(e) => setCcExamTarget(e.target.value)}
                      placeholder="Exam target (e.g. JEE, NEET, General)"
                    />
                    <Input
                      type="date"
                      value={ccScheduleDate}
                      onChange={(e) => setCcScheduleDate(e.target.value)}
                      placeholder="Schedule date"
                    />
                    <Input
                      type="time"
                      value={ccScheduleTime}
                      onChange={(e) => setCcScheduleTime(e.target.value)}
                      placeholder="Start time"
                    />
                    <Input
                      type="date"
                      value={ccScheduleEndDate}
                      onChange={(e) => setCcScheduleEndDate(e.target.value)}
                      placeholder="Recurrence end date (optional)"
                    />
                    <Input
                      type="number"
                      min={15}
                      value={ccDurationMinutes}
                      onChange={(e) => setCcDurationMinutes(Number(e.target.value) || 60)}
                      placeholder="Duration (minutes)"
                    />
                    <Input
                      value={ccRepeatDaysRaw}
                      onChange={(e) => setCcRepeatDaysRaw(e.target.value)}
                      placeholder="Repeat days (comma, e.g. Mon,Wed) — optional"
                      className="md:col-span-2"
                    />
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <input
                        type="checkbox"
                        checked={ccAllowAdhoc}
                        onChange={(e) => setCcAllowAdhoc(e.target.checked)}
                      />
                      Allow ad-hoc trial
                    </label>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Reason (audit)</label>
                      <Input
                        value={ccNotes}
                        onChange={(e) => setCcNotes(e.target.value)}
                        placeholder="Ticket / reason for creating this classroom…"
                      />
                    </div>
                  </div>
                  {classroomsStatus ? (
                    <p className="text-sm text-muted-foreground">{classroomsStatus}</p>
                  ) : null}
                  <Button
                    onClick={async () => {
                      setClassroomsStatus("");
                      try {
                        if (!ccNotes.trim()) throw new Error("Reason (audit) is required.");
                        await postAdmin(`/api/admin/teachers/${teacherId}/classrooms/create`, {
                          name: ccName.trim(),
                          subject: ccSubject.trim(),
                          pucLevel: ccPucLevel,
                          examTarget: ccExamTarget.trim() || "General",
                          scheduleDate: ccScheduleDate.trim() || null,
                          scheduleTime: ccScheduleTime.trim() || null,
                          durationMinutes: ccDurationMinutes,
                          repeatDays: parseRepeatDays(ccRepeatDaysRaw),
                          scheduleEndDate: ccScheduleEndDate.trim() || null,
                          allowAdhocTrial: ccAllowAdhoc,
                          notes: ccNotes.trim(),
                        });
                        setClassroomsStatus("Classroom created.");
                        setCcName("");
                        setCcSubject("");
                        setCcNotes("");
                        await load();
                      } catch (e) {
                        setClassroomsStatus(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Create classroom
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Classrooms</CardTitle>
                  <CardDescription>Join codes, rosters, and next session hints.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Join</TableHead>
                          <TableHead className="text-right">Students</TableHead>
                          <TableHead className="text-right">Assignments</TableHead>
                          <TableHead>Next session</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bundle.classrooms.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-muted-foreground">
                              No classrooms.
                            </TableCell>
                          </TableRow>
                        ) : (
                          bundle.classrooms.flatMap((c) => {
                            const rows = [
                              <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                                  {c.id}
                                </TableCell>
                                <TableCell className="text-xs tabular-nums">{c.joinCode}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(c.studentCount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(c.assignmentCount)}
                                </TableCell>
                                <TableCell className="text-sm">{c.nextSessionLabel}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      onClick={() => {
                                        setRenameClassroomId(c.id);
                                        setRenameName(c.name);
                                        setRenameNotes("");
                                      }}
                                    >
                                      Rename
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      type="button"
                                      onClick={() => {
                                        setDeleteClassroomId(c.id);
                                        setDeleteNotes("");
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>,
                            ];
                            if (renameClassroomId === c.id) {
                              rows.push(
                                <TableRow key={`${c.id}-rename`}>
                                  <TableCell colSpan={7} className="bg-muted/30">
                                    <div className="grid gap-2 py-2 md:grid-cols-2">
                                      <Input
                                        value={renameName}
                                        onChange={(e) => setRenameName(e.target.value)}
                                        placeholder="New name"
                                      />
                                      <Input
                                        value={renameNotes}
                                        onChange={(e) => setRenameNotes(e.target.value)}
                                        placeholder="Reason (audit)"
                                      />
                                      <div className="flex flex-wrap gap-2 md:col-span-2">
                                        <Button
                                          size="sm"
                                          type="button"
                                          onClick={async () => {
                                            setClassroomsStatus("");
                                            try {
                                              if (!renameNotes.trim())
                                                throw new Error("Reason required.");
                                              await postAdmin(
                                                `/api/admin/teachers/${teacherId}/classrooms/update`,
                                                {
                                                  classroomId: c.id,
                                                  name: renameName.trim(),
                                                  notes: renameNotes.trim(),
                                                }
                                              );
                                              setRenameClassroomId(null);
                                              setClassroomsStatus("Classroom updated.");
                                              await load();
                                            } catch (e) {
                                              setClassroomsStatus(
                                                e instanceof Error ? e.message : "Failed"
                                              );
                                            }
                                          }}
                                        >
                                          Save rename
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          type="button"
                                          onClick={() => setRenameClassroomId(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            return rows;
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {deleteClassroomId ? (
                <Card className="border-destructive/40">
                  <CardHeader>
                    <CardTitle>Confirm delete classroom</CardTitle>
                    <CardDescription>
                      This will delete classroom{" "}
                      <span className="font-mono text-xs">{deleteClassroomId}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Input
                      value={deleteNotes}
                      onChange={(e) => setDeleteNotes(e.target.value)}
                      placeholder="Reason (audit) — required"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        type="button"
                        onClick={async () => {
                          setClassroomsStatus("");
                          try {
                            if (!deleteNotes.trim()) throw new Error("Reason required.");
                            await postAdmin(`/api/admin/teachers/${teacherId}/classrooms/delete`, {
                              classroomId: deleteClassroomId,
                              notes: deleteNotes.trim(),
                            });
                            setDeleteClassroomId(null);
                            setClassroomsStatus("Classroom deleted.");
                            await load();
                          } catch (e) {
                            setClassroomsStatus(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Delete permanently
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setDeleteClassroomId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Sections</CardTitle>
                  <CardDescription>
                    Schedules and activity status across classrooms.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Classroom</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.values(bundle.classroomDetails).flatMap((d) => d.sections ?? [])
                          .length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              No sections.
                            </TableCell>
                          </TableRow>
                        ) : (
                          Object.values(bundle.classroomDetails).flatMap((d) =>
                            (d.sections ?? []).map((s) => (
                              <TableRow key={`${d.classroomId}:${s.id}`}>
                                <TableCell className="text-xs tabular-nums">
                                  {d.classroomId}
                                </TableCell>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-sm">{s.scheduleLabel ?? "—"}</TableCell>
                                <TableCell>
                                  {s.isActive ? (
                                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-600 hover:bg-slate-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lessons" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule a lesson (live session)</CardTitle>
                  <CardDescription>
                    Creates a session for one of this teacher&apos;s classrooms. Reason is required
                    for audit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={createClassroomId}
                      onChange={(e) => setCreateClassroomId(e.target.value)}
                      placeholder="Classroom ID"
                    />
                    <Input
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="Session title"
                    />
                    <Input
                      value={createDate}
                      onChange={(e) => setCreateDate(e.target.value)}
                      placeholder="Date (YYYY-MM-DD)"
                    />
                    <Input
                      value={createTime}
                      onChange={(e) => setCreateTime(e.target.value)}
                      placeholder="Start time (HH:MM)"
                    />
                    <Input
                      value={createMeetLink}
                      onChange={(e) => setCreateMeetLink(e.target.value)}
                      placeholder="Meet link"
                      className="md:col-span-2"
                    />
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Reason (audit)</label>
                      <Input
                        value={sessionCreateNotes}
                        onChange={(e) => setSessionCreateNotes(e.target.value)}
                        placeholder="Ticket / reason for scheduling…"
                      />
                    </div>
                  </div>
                  {lessonsStatus ? (
                    <p className="text-sm text-muted-foreground">{lessonsStatus}</p>
                  ) : null}
                  <Button
                    type="button"
                    onClick={async () => {
                      setLessonsStatus("");
                      try {
                        if (!sessionCreateNotes.trim())
                          throw new Error("Reason (audit) is required.");
                        await postAdmin(`/api/admin/teachers/${teacherId}/sessions/create`, {
                          classroomId: createClassroomId.trim(),
                          title: createTitle.trim(),
                          date: createDate.trim(),
                          startTime: createTime.trim(),
                          durationMinutes: 60,
                          meetLink: createMeetLink.trim(),
                          allowAdhocTrial: true,
                          preWork: "",
                          postWork: "",
                          notes: sessionCreateNotes.trim(),
                        });
                        setLessonsStatus("Session created.");
                        setSessionCreateNotes("");
                        setCreateTitle("");
                        setCreateDate("");
                        setCreateTime("");
                        setCreateMeetLink("");
                        await load();
                      } catch (e) {
                        setLessonsStatus(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Create session
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live sessions</CardTitle>
                  <CardDescription>
                    Upcoming and past sessions. Cancel requires an audit reason.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Classroom</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Meet</TableHead>
                          <TableHead className="text-right">Duration</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bundle.sessions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-muted-foreground">
                              No sessions.
                            </TableCell>
                          </TableRow>
                        ) : (
                          bundle.sessions.slice(0, 50).flatMap((s) => {
                            const rows = [
                              <TableRow key={s.id}>
                                <TableCell className="text-xs tabular-nums whitespace-nowrap">
                                  {new Date(s.scheduledAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-sm">{s.classroomName}</TableCell>
                                <TableCell className="font-medium">{s.title}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{s.status ?? "—"}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {s.meetLink ? (
                                    <a
                                      href={s.meetLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      link
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(s.durationMinutes)}m
                                </TableCell>
                                <TableCell className="text-right">
                                  {!sessionCancelled(s.status) ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      onClick={() => {
                                        setPendingCancelSessionId(s.id);
                                        setSessionCancelNotes("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                              </TableRow>,
                            ];
                            if (pendingCancelSessionId === s.id) {
                              rows.push(
                                <TableRow key={`${s.id}-cancel`}>
                                  <TableCell colSpan={7} className="bg-muted/30">
                                    <div className="grid gap-2 py-2 md:grid-cols-2">
                                      <Input
                                        value={sessionCancelNotes}
                                        onChange={(e) => setSessionCancelNotes(e.target.value)}
                                        placeholder="Reason (audit) for cancelling this session"
                                        className="md:col-span-2"
                                      />
                                      <div className="flex flex-wrap gap-2 md:col-span-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          type="button"
                                          onClick={async () => {
                                            setLessonsStatus("");
                                            try {
                                              if (!sessionCancelNotes.trim())
                                                throw new Error("Reason required.");
                                              await postAdmin(
                                                `/api/admin/teachers/${teacherId}/sessions/update-or-cancel`,
                                                {
                                                  sessionId: s.id,
                                                  action: "cancel",
                                                  notes: sessionCancelNotes.trim(),
                                                }
                                              );
                                              setPendingCancelSessionId(null);
                                              setLessonsStatus("Session cancelled.");
                                              await load();
                                            } catch (e) {
                                              setLessonsStatus(
                                                e instanceof Error ? e.message : "Failed"
                                              );
                                            }
                                          }}
                                        >
                                          Confirm cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          type="button"
                                          onClick={() => setPendingCancelSessionId(null)}
                                        >
                                          Abort
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            return rows;
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create assignment</CardTitle>
                  <CardDescription>
                    Posts a new assignment to a classroom. Reason is required for audit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Classroom</label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={assignClassroomId}
                        onChange={(e) => setAssignClassroomId(e.target.value)}
                      >
                        {bundle.classrooms.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.id.slice(0, 8)}…)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Type</label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={assignType}
                        onChange={(e) => setAssignType(e.target.value)}
                      >
                        <option value="assignment">assignment</option>
                        <option value="quiz">quiz</option>
                        <option value="mock">mock</option>
                        <option value="Concept Focus">Concept Focus</option>
                      </select>
                    </div>
                    <Input
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      placeholder="Title"
                      className="md:col-span-2"
                    />
                    <Input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      placeholder="Due date"
                    />
                    <Input
                      type="number"
                      value={assignRewardRdm}
                      onChange={(e) => setAssignRewardRdm(Number(e.target.value) || 0)}
                      placeholder="Reward RDM"
                    />
                    <Input
                      value={assignToLabel}
                      onChange={(e) => setAssignToLabel(e.target.value)}
                      placeholder="Assign to label (e.g. All students)"
                      className="md:col-span-2"
                    />
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Instructions</label>
                      <Textarea
                        value={assignInstructions}
                        onChange={(e) => setAssignInstructions(e.target.value)}
                        placeholder="Optional instructions…"
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Reason (audit)</label>
                      <Input
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        placeholder="Ticket / reason for creating this assignment…"
                      />
                    </div>
                  </div>
                  {assignmentsStatus ? (
                    <p className="text-sm text-muted-foreground">{assignmentsStatus}</p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={!bundle.classrooms.length}
                    onClick={async () => {
                      setAssignmentsStatus("");
                      try {
                        if (!assignClassroomId) throw new Error("Pick a classroom.");
                        if (!assignNotes.trim()) throw new Error("Reason (audit) is required.");
                        if (!assignTitle.trim()) throw new Error("Title is required.");
                        await postAdmin(`/api/admin/teachers/${teacherId}/assignments/create`, {
                          classroomId: assignClassroomId,
                          assignmentType: assignType,
                          title: assignTitle.trim(),
                          dueDate: assignDueDate.trim() || null,
                          assignToLabel: assignToLabel.trim() || "All students",
                          rewardRdm: assignRewardRdm,
                          instructions: assignInstructions.trim(),
                          notes: assignNotes.trim(),
                        });
                        setAssignmentsStatus("Assignment created.");
                        setAssignTitle("");
                        setAssignInstructions("");
                        setAssignNotes("");
                        await load();
                      } catch (e) {
                        setAssignmentsStatus(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Create assignment
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assignments by classroom</CardTitle>
                  <CardDescription>Per-class assignment activity and completion.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.values(bundle.classroomDetails).map((d) => (
                    <div key={d.classroomId} className="rounded-2xl border bg-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-semibold">Classroom: {d.classroomId}</div>
                        <Badge variant="secondary">Assignments: {fmt(d.assignments.length)}</Badge>
                      </div>
                      <div className="rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Due</TableHead>
                              <TableHead className="text-right">Completion</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {d.assignments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-muted-foreground">
                                  No assignments.
                                </TableCell>
                              </TableRow>
                            ) : (
                              d.assignments.slice(0, 25).map((a) => (
                                <TableRow key={a.id}>
                                  <TableCell className="font-medium">{a.title}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{a.type}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{a.dueDateLabel}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {fmt(a.completionPercent)}% ({fmt(a.completedCount)}/
                                    {fmt(a.totalCount)})
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tests" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Generated tests (history)</CardTitle>
                  <CardDescription>
                    Read-only log of tests this teacher generated (question bank depletion history).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testHistoryLoading ? (
                    <p className="text-sm text-muted-foreground">Loading test history…</p>
                  ) : null}
                  {testHistoryError ? (
                    <p className="text-sm text-destructive">{testHistoryError}</p>
                  ) : null}
                  {!testHistoryLoading && !testHistoryError ? (
                    <div className="rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Generated</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead>Chapter / topic / unit</TableHead>
                            <TableHead className="text-right">Questions</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-muted-foreground">
                                No generated tests yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            testHistory.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {row.generated_at
                                    ? new Date(row.generated_at).toLocaleString()
                                    : "—"}
                                </TableCell>
                                <TableCell className="capitalize">{row.subject}</TableCell>
                                <TableCell className="tabular-nums">
                                  {fmt(row.class_level)}
                                </TableCell>
                                <TableCell>{row.scope}</TableCell>
                                <TableCell className="max-w-[280px] text-sm">
                                  {row.chapter_title ? (
                                    <span className="block truncate" title={row.chapter_title}>
                                      {row.chapter_title}
                                    </span>
                                  ) : null}
                                  {row.topic_title ? (
                                    <span
                                      className="block truncate text-muted-foreground"
                                      title={row.topic_title ?? ""}
                                    >
                                      {row.topic_title}
                                    </span>
                                  ) : null}
                                  {row.unit_title ? (
                                    <span
                                      className="block truncate text-muted-foreground"
                                      title={row.unit_title ?? ""}
                                    >
                                      Unit: {row.unit_title}
                                    </span>
                                  ) : null}
                                  {!row.chapter_title && !row.topic_title && !row.unit_title
                                    ? "—"
                                    : null}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {fmt(row.question_count)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.duration_minutes != null
                                    ? `${fmt(row.duration_minutes)}m`
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="motivation" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Motivation & notifications</CardTitle>
                  <CardDescription>
                    Recent boosts, nudges, and rewards logged per classroom. For targeted sends
                    (requires student IDs), use{" "}
                    <Link
                      href={`/teacher-portal?adminTeacherId=${encodeURIComponent(teacherId)}&section=myClassroom`}
                      className="underline"
                    >
                      Open as teacher
                    </Link>
                    .
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.values(bundle.classroomDetails).map((d) => (
                    <div key={d.classroomId} className="rounded-2xl border bg-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-semibold">Classroom: {d.classroomId}</div>
                        <Badge variant="secondary">Actions: {fmt(d.motivationLog.length)}</Badge>
                      </div>
                      <div className="rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>When</TableHead>
                              <TableHead>Kind</TableHead>
                              <TableHead>Message</TableHead>
                              <TableHead className="text-right">RDM</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {d.motivationLog.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-muted-foreground">
                                  No motivation actions.
                                </TableCell>
                              </TableRow>
                            ) : (
                              d.motivationLog.slice(0, 25).map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                                    {new Date(m.createdAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{m.actionKind}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{m.message}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {fmt(m.rdmDelta)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Edit teacher profile</CardTitle>
                  <CardDescription>
                    Updates profile fields and preserves extended teacher details from the current
                    bundle. Reason is required for audit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Name"
                    />
                    <Input
                      value={profileVisibility}
                      onChange={(e) => setProfileVisibility(e.target.value)}
                      placeholder="Visibility (e.g. public)"
                    />
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Bio (student-facing)</label>
                      <Textarea
                        value={profileBio}
                        onChange={(e) => setProfileBio(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Subjects (comma-separated)</label>
                      <Input
                        value={profileSubjectsRaw}
                        onChange={(e) => setProfileSubjectsRaw(e.target.value)}
                        placeholder="Physics, Math"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Exam tags (comma-separated)</label>
                      <Input
                        value={profileExamTagsRaw}
                        onChange={(e) => setProfileExamTagsRaw(e.target.value)}
                        placeholder="JEE, NEET"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">
                        Teaching levels (comma-separated numbers)
                      </label>
                      <Input
                        value={profileLevelsRaw}
                        onChange={(e) => setProfileLevelsRaw(e.target.value)}
                        placeholder="11, 12"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Reason (audit)</label>
                      <Input
                        value={profileSaveNotes}
                        onChange={(e) => setProfileSaveNotes(e.target.value)}
                        placeholder="Ticket / reason for profile change…"
                      />
                    </div>
                  </div>
                  {profileStatus ? (
                    <p className="text-sm text-muted-foreground">{profileStatus}</p>
                  ) : null}
                  <Button
                    type="button"
                    onClick={async () => {
                      setProfileStatus("");
                      try {
                        if (!profileSaveNotes.trim())
                          throw new Error("Reason (audit) is required.");
                        await postAdmin(`/api/admin/teachers/${teacherId}/profile/update`, {
                          name: profileName.trim(),
                          bio: profileBio,
                          visibility: profileVisibility.trim() || "public",
                          subjects: parseCommaList(profileSubjectsRaw),
                          examTags: parseCommaList(profileExamTagsRaw),
                          teachingLevels: parseLevels(profileLevelsRaw),
                          details: buildProfileDetailsPayload(bundle),
                          notes: profileSaveNotes.trim(),
                        });
                        setProfileStatus("Profile saved.");
                        setProfileSaveNotes("");
                        await load();
                      } catch (e) {
                        setProfileStatus(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Save profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Verification & details (read-only)</CardTitle>
                  <CardDescription>
                    Location, qualification, and document flags from the bundle.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm lg:grid-cols-2">
                  <div className="rounded-xl border bg-background p-3">
                    <div className="text-muted-foreground text-xs">Location</div>
                    <div className="font-semibold">{bundle.profile.details?.location ?? "—"}</div>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <div className="text-muted-foreground text-xs">Qualification</div>
                    <div className="font-semibold">
                      {bundle.profile.details?.qualification ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <div className="text-muted-foreground text-xs">Experience</div>
                    <div className="font-semibold">{bundle.profile.details?.experience ?? "—"}</div>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <div className="text-muted-foreground text-xs">Docs</div>
                    <div className="font-semibold">
                      Aadhar: {bundle.profile.details?.docs?.aadharPhotoUrl ? "Uploaded" : "—"} ·
                      Certificate:{" "}
                      {bundle.profile.details?.docs?.instituteCertificatePhotoUrl
                        ? "Uploaded"
                        : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audit log</CardTitle>
                  <CardDescription>Admin operations taken for this teacher.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              No audit records yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          audit.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs tabular-nums whitespace-nowrap">
                                {new Date(r.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{r.actionType}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{r.actorUserId}</TableCell>
                              <TableCell className="text-sm">{r.details ?? "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
