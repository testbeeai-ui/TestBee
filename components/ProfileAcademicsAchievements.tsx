"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Medal,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { AcademicRecord, Achievement } from "@/lib/profile/publicProfileService";
import { cn } from "@/lib/utils";

type AcademicRow = { id: string; marksheet_path: string | null } & AcademicRecord;
type AchievementRow = { id: string; marksheet_path: string | null } & Achievement;

const ACHIEVEMENT_MARKSHEET_BUCKET = "achievement-marksheets";
const ACADEMIC_MARKSHEET_BUCKET = "academic-marksheets";

type VerifiedStatus = AcademicRecord["verified"];

const verificationChipClass: Record<VerifiedStatus, string> = {
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  unverified: "bg-muted text-muted-foreground",
} satisfies Record<VerifiedStatus, string>;

const ACHIEVEMENT_LEVELS = ["School", "District", "State", "National", "International"] as const;

export default function ProfileAcademicsAchievements({ userId }: { userId: string }) {
  const [academics, setAcademics] = useState<AcademicRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicDialog, setAcademicDialog] = useState<{ open: boolean; edit?: AcademicRow }>({
    open: false,
  });
  const [achievementDialog, setAchievementDialog] = useState<{
    open: boolean;
    edit?: AchievementRow;
  }>({ open: false });

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, achRes] = await Promise.all([
        supabase
          .from("profile_academics")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("profile_achievements")
          .select("*")
          .eq("user_id", userId)
          .order("year", { ascending: false }),
      ]);
      setAcademics(
        (aRes.data ?? []).map((r) => ({
          id: r.id,
          exam: r.exam,
          board: r.board,
          score: r.score,
          verified: r.verified as AcademicRecord["verified"],
          marksheet_path: (r as { marksheet_path?: string | null }).marksheet_path ?? null,
        }))
      );
      setAchievements(
        (achRes.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          level: r.level as Achievement["level"],
          year: r.year,
          result: r.result ?? "",
          percentage: (r as { percentage?: string }).percentage ?? "",
          verified: ((r as { verified?: string }).verified ?? "pending") as Achievement["verified"],
          marksheet_path: (r as { marksheet_path?: string | null }).marksheet_path ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const handleAddAcademic = async (
    data: Pick<AcademicRecord, "exam" | "board" | "score">,
    marksheetFile: File | null
  ) => {
    const { data: inserted, error } = await supabase
      .from("profile_academics")
      .insert({
        user_id: userId,
        exam: data.exam,
        board: data.board,
        score: data.score,
        verified: "pending",
      })
      .select("id")
      .single();

    if (error || !inserted?.id) return;

    if (marksheetFile) {
      const safeName = marksheetFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${inserted.id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(ACADEMIC_MARKSHEET_BUCKET)
        .upload(path, marksheetFile, {
          contentType: marksheetFile.type || undefined,
        });
      if (!uploadErr) {
        await supabase.from("profile_academics").update({ marksheet_path: path }).eq("id", inserted.id);
      }
    }

    setAcademicDialog({ open: false });
    load();
  };

  const handleUpdateAcademic = async (
    id: string,
    data: Pick<AcademicRecord, "exam" | "board" | "score">,
    marksheetFile: File | null
  ) => {
    let newPath: string | undefined;
    if (marksheetFile) {
      const safeName = marksheetFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      newPath = `${userId}/${id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(ACADEMIC_MARKSHEET_BUCKET)
        .upload(newPath, marksheetFile, {
          contentType: marksheetFile.type || undefined,
        });
      if (uploadErr) newPath = undefined;
    }

    const { error } = await supabase
      .from("profile_academics")
      .update({
        exam: data.exam,
        board: data.board,
        score: data.score,
        ...(newPath !== undefined ? { marksheet_path: newPath } : {}),
        verified: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!error) {
      setAcademicDialog({ open: false });
      load();
    }
  };

  const openAcademicMarksheet = async (path: string) => {
    const { data, error } = await supabase.storage
      .from(ACADEMIC_MARKSHEET_BUCKET)
      .createSignedUrl(path, 120);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDeleteAcademic = async (id: string) => {
    await supabase.from("profile_academics").delete().eq("id", id);
    load();
  };

  const handleAddAchievement = async (data: Achievement, marksheetFile: File | null) => {
    const { data: inserted, error } = await supabase
      .from("profile_achievements")
      .insert({
        user_id: userId,
        name: data.name,
        level: data.level,
        year: data.year,
        result: data.result,
        percentage: data.percentage,
        verified: "pending",
      })
      .select("id")
      .single();

    if (error || !inserted?.id) return;

    if (marksheetFile) {
      const safeName = marksheetFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${inserted.id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(ACHIEVEMENT_MARKSHEET_BUCKET)
        .upload(path, marksheetFile, {
          contentType: marksheetFile.type || undefined,
        });
      if (!uploadErr) {
        await supabase.from("profile_achievements").update({ marksheet_path: path }).eq("id", inserted.id);
      }
    }

    setAchievementDialog({ open: false });
    load();
  };

  const handleUpdateAchievement = async (id: string, data: Achievement, marksheetFile: File | null) => {
    let newPath: string | undefined;
    if (marksheetFile) {
      const safeName = marksheetFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      newPath = `${userId}/${id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(ACHIEVEMENT_MARKSHEET_BUCKET)
        .upload(newPath, marksheetFile, {
          contentType: marksheetFile.type || undefined,
        });
      if (uploadErr) newPath = undefined;
    }

    const { error } = await supabase
      .from("profile_achievements")
      .update({
        name: data.name,
        level: data.level,
        year: data.year,
        result: data.result,
        percentage: data.percentage,
        ...(newPath !== undefined ? { marksheet_path: newPath } : {}),
        verified: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!error) {
      setAchievementDialog({ open: false });
      load();
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    await supabase.from("profile_achievements").delete().eq("id", id);
    load();
  };

  const openAchievementMarksheet = async (path: string) => {
    const { data, error } = await supabase.storage
      .from(ACHIEVEMENT_MARKSHEET_BUCKET)
      .createSignedUrl(path, 120);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-950/80 2xl:p-5"
      >
        <div className="flex items-center justify-between mb-3 2xl:mb-4">
          <h3 className="text-lg font-black text-foreground dark:text-white flex items-center gap-1.5 2xl:text-xl 2xl:gap-2">
            <GraduationCap className="w-4 h-4 shrink-0 text-indigo-300 2xl:w-5 2xl:h-5" /> Academic
            Record
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setAcademicDialog({ open: true })}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground dark:text-slate-400">Loading...</p>
        ) : academics.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-slate-400">
            No records yet. Add your Class 11/12 results for your public profile.
          </p>
        ) : (
          <div className="space-y-2">
            {academics.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 py-3 border-b border-border last:border-0 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground dark:text-slate-100">
                    {a.exam} — {a.board}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                        verificationChipClass[a.verified]
                      )}
                    >
                      {a.verified}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-slate-400">{a.score}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {a.marksheet_path ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl text-xs font-bold gap-1"
                      onClick={() => openAcademicMarksheet(a.marksheet_path!)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Marksheet
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => setAcademicDialog({ open: true, edit: a })}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                    onClick={() => handleDeleteAcademic(a.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="link"
          size="sm"
          className="mt-2 text-violet-300 px-0 hover:text-violet-200"
          asChild
        >
          <Link href={`/user/${userId}`}>View public profile →</Link>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-950/80 2xl:p-5"
      >
        <div className="flex items-center justify-between mb-3 2xl:mb-4">
          <h3 className="text-lg font-black text-foreground dark:text-white flex items-center gap-1.5 2xl:text-xl 2xl:gap-2">
            <Medal className="w-4 h-4 shrink-0 text-amber-300 2xl:w-5 2xl:h-5" /> Achievements &
            Competitions
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setAchievementDialog({ open: true })}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground dark:text-slate-400">Loading...</p>
        ) : achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-slate-400">
            No achievements yet. Add Olympiads, competitions, and more.
          </p>
        ) : (
          <div className="space-y-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 py-3 border-b border-border last:border-0 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground dark:text-slate-100">{a.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground dark:bg-slate-800 dark:text-slate-300">
                      {a.level}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                        verificationChipClass[a.verified]
                      )}
                    >
                      {a.verified}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-slate-400">
                    {a.year}
                    {a.result?.trim() ? ` · ${a.result}` : ""}
                    {a.percentage?.trim() ? ` · ${a.percentage}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {a.marksheet_path ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl text-xs font-bold gap-1"
                      onClick={() => openAchievementMarksheet(a.marksheet_path!)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Marksheet
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => setAchievementDialog({ open: true, edit: a })}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                    onClick={() => handleDeleteAchievement(a.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <AcademicFormDialog
        open={academicDialog.open}
        edit={academicDialog.edit}
        onClose={() => setAcademicDialog({ open: false })}
        onSave={(d, marksheetFile) =>
          academicDialog.edit
            ? handleUpdateAcademic(academicDialog.edit.id, d, marksheetFile)
            : handleAddAcademic(d, marksheetFile)
        }
        onOpenMarksheet={openAcademicMarksheet}
      />
      <AchievementFormDialog
        open={achievementDialog.open}
        edit={achievementDialog.edit}
        onClose={() => setAchievementDialog({ open: false })}
        onSave={(d, marksheetFile) =>
          achievementDialog.edit
            ? handleUpdateAchievement(achievementDialog.edit.id, d, marksheetFile)
            : handleAddAchievement(d, marksheetFile)
        }
        onOpenMarksheet={openAchievementMarksheet}
      />
    </>
  );
}

function AcademicFormDialog({
  open,
  edit,
  onClose,
  onSave,
  onOpenMarksheet,
}: {
  open: boolean;
  edit?: AcademicRow;
  onClose: () => void;
  onSave: (d: Pick<AcademicRecord, "exam" | "board" | "score">, marksheetFile: File | null) => void | Promise<void>;
  onOpenMarksheet: (path: string) => void | Promise<void>;
}) {
  const [exam, setExam] = useState("");
  const [board, setBoard] = useState("");
  const [score, setScore] = useState("");
  const [marksheetFile, setMarksheetFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setExam(edit?.exam ?? "");
    setBoard(edit?.board ?? "");
    setScore(edit?.score ?? "");
    setMarksheetFile(null);
    setSaving(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (o) reset();
    if (!o) onClose();
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({ exam, board, score }, marksheetFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Academic Record" : "Add Academic Record"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label htmlFor="exam">Exam</Label>
            <Input
              id="exam"
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              placeholder="e.g. Class 11, Class 12"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="board">Board</Label>
            <Input
              id="board"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              placeholder="e.g. CBSE, State Board"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="score">Score</Label>
            <Input
              id="score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 95%, 450/500"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label className="flex items-center justify-between gap-2">
              <span>Marksheet</span>
              {edit?.marksheet_path ? (
                <button
                  type="button"
                  className="text-xs font-bold text-primary hover:underline"
                  onClick={() => onOpenMarksheet(edit.marksheet_path!)}
                >
                  View current
                </button>
              ) : null}
            </Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                id="academic-marksheet-file"
                onChange={(e) => setMarksheetFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-bold gap-2 w-full sm:w-auto"
                onClick={() => document.getElementById("academic-marksheet-file")?.click()}
              >
                <Upload className="w-4 h-4" />
                {marksheetFile ? "Change file" : "Upload"}
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                {marksheetFile ? marksheetFile.name : "JPEG, PNG, WebP, or PDF · max 10 MB"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Submissions are reviewed by admins before appearing on your public profile.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} className="rounded-xl" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AchievementFormDialog({
  open,
  edit,
  onClose,
  onSave,
  onOpenMarksheet,
}: {
  open: boolean;
  edit?: AchievementRow;
  onClose: () => void;
  onSave: (d: Achievement, marksheetFile: File | null) => void | Promise<void>;
  onOpenMarksheet: (path: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Achievement["level"]>("School");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState("");
  const [percentage, setPercentage] = useState("");
  const [marksheetFile, setMarksheetFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(edit?.name ?? "");
    setLevel(edit?.level ?? "School");
    setYear(String(edit?.year ?? new Date().getFullYear()));
    setResult(edit?.result ?? "");
    setPercentage(edit?.percentage ?? "");
    setMarksheetFile(null);
    setSaving(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (o) reset();
    if (!o) onClose();
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(
        {
          name,
          level,
          year: parseInt(year, 10) || new Date().getFullYear(),
          result,
          percentage,
          verified: edit?.verified ?? "pending",
        },
        marksheetFile
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Achievement" : "Add Achievement"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Physics Olympiad"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="level">Level</Label>
            <select
              id="level"
              aria-label="Achievement level"
              value={level}
              onChange={(e) => setLevel(e.target.value as Achievement["level"])}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {ACHIEVEMENT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="achievement-result">Rank/Medal</Label>
            <Input
              id="achievement-result"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="e.g. Gold Medal, 2nd Place"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="achievement-percentage">Percentage</Label>
            <Input
              id="achievement-percentage"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="e.g. 95%, 450/500"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label className="flex items-center justify-between gap-2">
              <span>Marksheet</span>
              {edit?.marksheet_path ? (
                <button
                  type="button"
                  className="text-xs font-bold text-primary hover:underline"
                  onClick={() => onOpenMarksheet(edit.marksheet_path!)}
                >
                  View current
                </button>
              ) : null}
            </Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                id="achievement-marksheet"
                onChange={(e) => setMarksheetFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-bold gap-2 w-full sm:w-auto"
                onClick={() => document.getElementById("achievement-marksheet")?.click()}
              >
                <Upload className="w-4 h-4" />
                {marksheetFile ? "Change file" : "Upload"}
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                {marksheetFile ? marksheetFile.name : "JPEG, PNG, WebP, or PDF · max 10 MB"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} className="rounded-xl" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
