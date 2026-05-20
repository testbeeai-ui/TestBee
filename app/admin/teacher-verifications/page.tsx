"use client";

import { useEffect, useMemo, useState } from "react";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeacherVerificationStatus } from "@/lib/teacherPortal/types";

type TeacherVerificationItem = {
  teacherId: string;
  name: string;
  avatarUrl: string | null;
  subjects: string[];
  examTags: string[];
  location: string | null;
  qualification: string | null;
  experience: string | null;
  email: string | null;
  phone: string | null;
  verificationStatus: TeacherVerificationStatus;
  adminNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  updatedAt: string;
  docs: {
    aadharPhotoUrl: string | null;
    aadharPhotoLink: string | null;
    aadharShareLink: string | null;
    instituteCertificatePhotoUrl: string | null;
    instituteCertificatePhotoLink: string | null;
    instituteCertificateShareLink: string | null;
  };
};

const FILTERS: Array<{ value: "all" | TeacherVerificationStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function TeacherVerificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<TeacherVerificationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | TeacherVerificationStatus>("pending");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarLoadFailedByTeacherId, setAvatarLoadFailedByTeacherId] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing session token");
      const sp = new URLSearchParams();
      if (statusFilter !== "all") sp.set("status", statusFilter);
      const res = await fetch(`/api/admin/teacher-verifications?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as { teachers?: TeacherVerificationItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load verifications");
      const next = body.teachers ?? [];
      setItems(next);
      if (!selectedTeacherId || !next.some((x) => x.teacherId === selectedTeacherId)) {
        const first = next[0]?.teacherId ?? null;
        setSelectedTeacherId(first);
        const selected = next.find((x) => x.teacherId === first);
        setAdminNotesDraft(selected?.adminNotes ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selected = useMemo(
    () => items.find((item) => item.teacherId === selectedTeacherId) ?? null,
    [items, selectedTeacherId]
  );
  const selectedInitial = (selected?.name?.trim().charAt(0) || "T").toUpperCase();
  const selectedAvatarVisible = Boolean(
    selected?.avatarUrl && !avatarLoadFailedByTeacherId[selected.teacherId]
  );

  useEffect(() => {
    setAdminNotesDraft(selected?.adminNotes ?? "");
  }, [selected?.teacherId, selected?.adminNotes]);

  const applyStatus = async (status: TeacherVerificationStatus) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing session token");
      const res = await fetch("/api/admin/teacher-verifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId: selected.teacherId,
          status,
          adminNotes: adminNotesDraft,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update status");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-bold">Teacher Verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review teacher identity submissions, validate documents, and approve or reject with notes.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "outline"}
            onClick={() => setStatusFilter(f.value)}
            disabled={loading || saving}
          >
            {f.label}
          </Button>
        ))}
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="rounded-2xl border bg-card p-3">
          <div className="max-h-[60vh] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Teacher</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                      No teacher verification records found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.teacherId}
                      className={`cursor-pointer border-t ${selectedTeacherId === item.teacherId ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedTeacherId(item.teacherId)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.subjects.join(", ") || "—"}</div>
                      </td>
                      <td className="px-3 py-2 capitalize">{item.verificationStatus}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a teacher to review details.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border bg-muted">
                  {selectedAvatarVisible ? (
                    <img
                      src={selected.avatarUrl ?? ""}
                      alt={`${selected.name} profile`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() =>
                        setAvatarLoadFailedByTeacherId((prev) => ({
                          ...prev,
                          [selected.teacherId]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                      {selectedInitial}
                    </div>
                  )}
                </div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
              </div>
              <div className="grid gap-1">
                <p>Status: <span className="font-medium capitalize">{selected.verificationStatus}</span></p>
                <p>Subjects: {selected.subjects.join(", ") || "—"}</p>
                <p>Specialisation: {selected.examTags.join(", ") || "—"}</p>
                <p>Location: {selected.location || "—"}</p>
                <p>Qualification: {selected.qualification || "—"}</p>
                <p>Experience: {selected.experience || "—"}</p>
                <p>Phone: {selected.phone || "—"}</p>
                <p>Email: {selected.email || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Documents</p>
                <p>
                  Aadhaar:{" "}
                  {selected.docs.aadharPhotoLink ? (
                    <a href={selected.docs.aadharPhotoLink} target="_blank" rel="noreferrer" className="underline">
                      View upload
                    </a>
                  ) : (
                    "—"
                  )}
                  {selected.docs.aadharShareLink ? (
                    <>
                      {" · "}
                      <a href={selected.docs.aadharShareLink} target="_blank" rel="noreferrer" className="underline">
                        Share link
                      </a>
                    </>
                  ) : null}
                </p>
                <p>
                  Certificate:{" "}
                  {selected.docs.instituteCertificatePhotoLink ? (
                    <a
                      href={selected.docs.instituteCertificatePhotoLink}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View upload
                    </a>
                  ) : (
                    "—"
                  )}
                  {selected.docs.instituteCertificateShareLink ? (
                    <>
                      {" · "}
                      <a
                        href={selected.docs.instituteCertificateShareLink}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Share link
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Verification notes to teacher
                </label>
                <Input
                  value={adminNotesDraft}
                  onChange={(e) => setAdminNotesDraft(e.target.value)}
                  placeholder="Explain what to fix and re-submit"
                />
                <p className="text-xs text-muted-foreground">
                  To send this note to the teacher, use <span className="font-medium">Request resubmission</span>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => void applyStatus("approved")} disabled={saving}>
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => void applyStatus("rejected")} disabled={saving}>
                  Request resubmission
                </Button>
                <Button variant="outline" onClick={() => void applyStatus("pending")} disabled={saving}>
                  Keep pending
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
