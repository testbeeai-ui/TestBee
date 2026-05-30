"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, FileCheck, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeGetSession } from "@/lib/auth/safeSession";

/** API routes use `getSupabaseAndUser`, which needs the Bearer token in many dev/proxy setups. */
async function getAdminAuthHeaders(jsonBody: boolean): Promise<Record<string, string>> {
  const { session } = await safeGetSession();
  if (!session?.access_token) {
    throw new Error(
      "Not signed in. Open the app in a tab where you are logged in, then try again."
    );
  }
  const h: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (jsonBody) h["Content-Type"] = "application/json";
  return h;
}

type AchievementAdminRow = {
  id: string;
  user_id: string;
  name: string;
  level: string;
  year: number;
  result: string;
  percentage: string | null;
  verified: string;
  marksheet_path: string | null;
  created_at: string;
  student_name: string | null;
};

type AcademicAdminRow = {
  id: string;
  user_id: string;
  exam: string;
  board: string;
  score: string;
  verified: string;
  marksheet_path: string | null;
  created_at: string;
  student_name: string | null;
};

type Section = "achievements" | "academics";
type AcademicClassXDetails = {
  user_id: string;
  student_name: string | null;
  classX: {
    board: string | null;
    year: string | null;
    score: string | null;
    verified: string | null;
  } | null;
  classXSubjects: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  } | null;
  classXI: {
    board: string | null;
    year: string | null;
    score: string | null;
    verified: string | null;
  } | null;
  classXISubjects: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  } | null;
  classXII: {
    board: string | null;
    year: string | null;
    score: string | null;
    verified: string | null;
  } | null;
  classXIISubjects: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  } | null;
  coaching: {
    instituteName?: string;
    attendingSince?: string;
  } | null;
  coachingXI: {
    instituteName?: string;
    attendingSince?: string;
  } | null;
  coachingXII: {
    instituteName?: string;
    attendingSince?: string;
  } | null;
  puc2InternalsPercent?: string;
};

export default function AdminStudentAchievementsPage() {
  const [section, setSection] = useState<Section>("achievements");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [achievementRows, setAchievementRows] = useState<AchievementAdminRow[]>([]);
  const [academicRows, setAcademicRows] = useState<AcademicAdminRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<AcademicClassXDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const auth = await getAdminAuthHeaders(false);
      if (section === "achievements") {
        const res = await fetch(`/api/admin/student-achievements?status=${filter}`, {
          credentials: "include",
          cache: "no-store",
          headers: auth,
        });
        const body = (await res.json()) as { rows?: AchievementAdminRow[]; error?: string };
        if (!res.ok) throw new Error(body?.error || `Failed to load (${res.status})`);
        setAchievementRows(Array.isArray(body.rows) ? body.rows : []);
      } else {
        const res = await fetch(`/api/admin/student-academics?status=${filter}`, {
          credentials: "include",
          cache: "no-store",
          headers: auth,
        });
        const body = (await res.json()) as { rows?: AcademicAdminRow[]; error?: string };
        if (!res.ok) throw new Error(body?.error || `Failed to load (${res.status})`);
        setAcademicRows(Array.isArray(body.rows) ? body.rows : []);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load");
      setAchievementRows([]);
      setAcademicRows([]);
    } finally {
      setLoading(false);
    }
  }, [section, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchAchievement = async (id: string, verified: "verified" | "unverified") => {
    setActingId(id);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/student-achievements/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: await getAdminAuthHeaders(true),
        body: JSON.stringify({ verified }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body?.error || `Update failed (${res.status})`);
      await load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActingId(null);
    }
  };

  const patchAcademic = async (id: string, verified: "verified" | "unverified") => {
    setActingId(id);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/student-academics/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: await getAdminAuthHeaders(true),
        body: JSON.stringify({ verified }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body?.error || `Update failed (${res.status})`);
      await load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActingId(null);
    }
  };

  const openAchievementMarksheet = async (path: string | null) => {
    if (!path) return;
    try {
      const res = await fetch("/api/admin/student-achievements/marksheet-url", {
        method: "POST",
        credentials: "include",
        headers: await getAdminAuthHeaders(true),
        body: JSON.stringify({ path }),
      });
      const body = (await res.json()) as { signedUrl?: string; error?: string };
      if (!res.ok) throw new Error(body?.error || "Could not open document");
      if (body.signedUrl) {
        window.open(body.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not open document");
    }
  };

  const openAcademicMarksheet = async (path: string | null) => {
    if (!path) return;
    try {
      const res = await fetch("/api/admin/student-academics/marksheet-url", {
        method: "POST",
        credentials: "include",
        headers: await getAdminAuthHeaders(true),
        body: JSON.stringify({ path }),
      });
      const body = (await res.json()) as { signedUrl?: string; error?: string };
      if (!res.ok) throw new Error(body?.error || "Could not open document");
      if (body.signedUrl) {
        window.open(body.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not open document");
    }
  };

  const rows = section === "achievements" ? achievementRows : academicRows;
  const subjectFields = [
    ["physicsScience", "Physics / Science"],
    ["mathematics", "Mathematics"],
    ["chemistry", "Chemistry"],
    ["english", "English"],
    ["socialScience", "Social Science"],
    ["secondLanguage", "Second language"],
  ] as const;

  const openStudentDetails = useCallback(async (userId: string) => {
    setSelectedStudentId(userId);
    setStudentDetails(null);
    setDetailsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/student-academics/user/${userId}`, {
        credentials: "include",
        cache: "no-store",
        headers: await getAdminAuthHeaders(false),
      });
      const body = (await res.json()) as AcademicClassXDetails & { error?: string };
      if (!res.ok) throw new Error(body?.error || `Failed to load (${res.status})`);
      setStudentDetails(body);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load student details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review achievements and academic records, open marksheets, approve or reject.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["achievements", "academics"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              section === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {s === "achievements" ? "Achievements" : "Academic records"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Show
        </span>
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-bold transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f === "pending" ? "Pending review" : "All"}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl ml-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16 px-4">
            No items in this view.
          </p>
        ) : section === "achievements" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Achievement</th>
                  <th className="px-4 py-3 font-semibold">Level</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Rank/Medal</th>
                  <th className="px-4 py-3 font-semibold">Percentage</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {achievementRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{r.student_name ?? "—"}</div>
                      <Link
                        href={`/admin/users/${r.user_id}`}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        User record
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top font-medium">{r.name}</td>
                    <td className="px-4 py-3 align-top">{r.level}</td>
                    <td className="px-4 py-3 align-top">{r.year}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground max-w-[140px]">
                      {r.result || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {r.percentage?.trim() ? r.percentage : "—"}
                    </td>
                    <td className="px-4 py-3 align-top capitalize">{r.verified}</td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.marksheet_path ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl gap-1"
                            onClick={() => void openAchievementMarksheet(r.marksheet_path)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Marksheet
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground py-2">No file</span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white"
                          disabled={actingId === r.id || r.verified === "verified"}
                          onClick={() => void patchAchievement(r.id, "verified")}
                        >
                          {actingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileCheck className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={actingId === r.id}
                          onClick={() => void patchAchievement(r.id, "unverified")}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Exam</th>
                  <th className="px-4 py-3 font-semibold">Board</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {academicRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{r.student_name ?? "—"}</div>
                      <Link
                        href={`/admin/users/${r.user_id}`}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        User record
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top font-medium">{r.exam}</td>
                    <td className="px-4 py-3 align-top">{r.board}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{r.score}</td>
                    <td className="px-4 py-3 align-top capitalize">{r.verified}</td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.marksheet_path ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl gap-1"
                            onClick={() => void openAcademicMarksheet(r.marksheet_path)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Marksheet
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground py-2">No file</span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white"
                          disabled={actingId === r.id || r.verified === "verified"}
                          onClick={() => void patchAcademic(r.id, "verified")}
                        >
                          {actingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileCheck className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={actingId === r.id}
                          onClick={() => void patchAcademic(r.id, "unverified")}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {section === "academics" && selectedStudentId ? (
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Selected student details</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedStudentId(null)}
            >
              Close
            </Button>
          </div>
          {detailsLoading ? (
            <p className="text-sm text-muted-foreground">Loading details…</p>
          ) : !studentDetails ? (
            <p className="text-sm text-muted-foreground">No details available.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border p-3">
                <p className="font-semibold">{studentDetails.student_name ?? "Student"}</p>
                <p className="text-xs text-muted-foreground">
                  Academic snapshots (Class X / XI / XII)
                </p>
              </div>

              {(
                [
                  {
                    label: "Class X",
                    row: studentDetails.classX,
                    subjects: studentDetails.classXSubjects,
                    coaching: studentDetails.coaching,
                  },
                  {
                    label: "Class XI",
                    row: studentDetails.classXI,
                    subjects: studentDetails.classXISubjects,
                    coaching: studentDetails.coachingXI,
                  },
                  {
                    label: "Class XII",
                    row: studentDetails.classXII,
                    subjects: studentDetails.classXIISubjects,
                    coaching: studentDetails.coachingXII,
                  },
                ] as const
              ).map((sec) => (
                <div key={sec.label} className="rounded-xl border p-3">
                  <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    {sec.label} details
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sec.row
                      ? `${sec.row.board ?? "—"} · ${sec.row.year ?? "—"} · ${sec.row.score ?? "—"}`
                      : "No row"}
                  </p>
                  {sec.label === "Class XII" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      PUC II internals: {studentDetails.puc2InternalsPercent?.trim() || "—"}
                    </p>
                  ) : null}

                  <p className="mt-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Subject-wise marks — {sec.label}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {subjectFields.map(([key, label]) => (
                      <div key={`${sec.label}-${key}`} className="rounded-md border p-2">
                        <p className="text-[11px] font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {sec.subjects?.[key]?.trim() || "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Coaching class / tuition ({sec.label})
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md border p-2">
                      <p className="text-[11px] font-semibold">Coaching institute name</p>
                      <p className="text-xs text-muted-foreground">
                        {sec.coaching?.instituteName?.trim() || "—"}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-[11px] font-semibold">Attending since</p>
                      <p className="text-xs text-muted-foreground">
                        {sec.coaching?.attendingSince?.trim() || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
