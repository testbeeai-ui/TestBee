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
import { GraduationCap, Medal, Plus, Pencil, Trash2 } from "lucide-react";
import type { AcademicRecord, Achievement } from "@/lib/publicProfileService";

type AcademicRow = { id: string } & AcademicRecord;
type AchievementRow = { id: string } & Achievement;

const ACHIEVEMENT_LEVELS = ["School", "District", "State", "National", "International"] as const;

export default function ProfileAcademicsAchievements({ userId }: { userId: string }) {
  const [academics, setAcademics] = useState<AcademicRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicDialog, setAcademicDialog] = useState<{ open: boolean; edit?: AcademicRow }>({ open: false });
  const [achievementDialog, setAchievementDialog] = useState<{ open: boolean; edit?: AchievementRow }>({ open: false });

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, achRes] = await Promise.all([
        supabase.from("profile_academics").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("profile_achievements").select("*").eq("user_id", userId).order("year", { ascending: false }),
      ]);
      setAcademics((aRes.data ?? []).map((r) => ({ id: r.id, exam: r.exam, board: r.board, score: r.score, verified: r.verified as AcademicRecord["verified"] })));
      setAchievements((achRes.data ?? []).map((r) => ({ id: r.id, name: r.name, level: r.level as Achievement["level"], year: r.year, result: r.result ?? "" })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const handleAddAcademic = async (data: Omit<AcademicRecord, never>) => {
    const { error } = await supabase.from("profile_academics").insert({
      user_id: userId,
      exam: data.exam,
      board: data.board,
      score: data.score,
      verified: data.verified,
    });
    if (!error) {
      setAcademicDialog({ open: false });
      load();
    }
  };

  const handleUpdateAcademic = async (id: string, data: AcademicRecord) => {
    const { error } = await supabase
      .from("profile_academics")
      .update({ exam: data.exam, board: data.board, score: data.score, verified: data.verified, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setAcademicDialog({ open: false });
      load();
    }
  };

  const handleDeleteAcademic = async (id: string) => {
    await supabase.from("profile_academics").delete().eq("id", id);
    load();
  };

  const handleAddAchievement = async (data: Achievement) => {
    const { error } = await supabase.from("profile_achievements").insert({
      user_id: userId,
      name: data.name,
      level: data.level,
      year: data.year,
      result: data.result,
    });
    if (!error) {
      setAchievementDialog({ open: false });
      load();
    }
  };

  const handleUpdateAchievement = async (id: string, data: Achievement) => {
    const { error } = await supabase
      .from("profile_achievements")
      .update({ name: data.name, level: data.level, year: data.year, result: data.result, updated_at: new Date().toISOString() })
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-950/80"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-foreground dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-300" /> Academic Record
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
          <p className="text-sm text-muted-foreground dark:text-slate-400">No records yet. Add your Class 11/12 results for your public profile.</p>
        ) : (
          <div className="space-y-2">
            {academics.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 dark:border-white/10">
                <p className="font-semibold text-foreground dark:text-slate-100">{a.exam} — {a.board}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground dark:text-slate-400">{a.score}</span>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setAcademicDialog({ open: true, edit: a })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300" onClick={() => handleDeleteAcademic(a.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="link" size="sm" className="mt-2 text-violet-300 px-0 hover:text-violet-200" asChild>
          <Link href={`/user/${userId}`}>View public profile →</Link>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-950/80"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-foreground dark:text-white flex items-center gap-2">
            <Medal className="w-5 h-5 text-amber-300" /> Achievements & Competitions
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
          <p className="text-sm text-muted-foreground dark:text-slate-400">No achievements yet. Add Olympiads, competitions, and more.</p>
        ) : (
          <div className="space-y-2">
            {achievements.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 dark:border-white/10">
                <p className="font-semibold text-foreground dark:text-slate-100">{a.name}</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground dark:bg-slate-800 dark:text-slate-300">{a.level}</span>
                  <span className="text-sm text-muted-foreground dark:text-slate-400">{a.year} — {a.result}</span>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setAchievementDialog({ open: true, edit: a })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300" onClick={() => handleDeleteAchievement(a.id)}>
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
        onSave={(d) => academicDialog.edit ? handleUpdateAcademic(academicDialog.edit.id, d) : handleAddAcademic(d)}
      />
      <AchievementFormDialog
        open={achievementDialog.open}
        edit={achievementDialog.edit}
        onClose={() => setAchievementDialog({ open: false })}
        onSave={(d) => achievementDialog.edit ? handleUpdateAchievement(achievementDialog.edit.id, d) : handleAddAchievement(d)}
      />
    </>
  );
}

function AcademicFormDialog({
  open,
  edit,
  onClose,
  onSave,
}: {
  open: boolean;
  edit?: AcademicRow;
  onClose: () => void;
  onSave: (d: AcademicRecord) => void;
}) {
  const [exam, setExam] = useState("");
  const [board, setBoard] = useState("");
  const [score, setScore] = useState("");
  const [verified, setVerified] = useState<AcademicRecord["verified"]>("unverified");

  const reset = () => {
    setExam(edit?.exam ?? "");
    setBoard(edit?.board ?? "");
    setScore(edit?.score ?? "");
    setVerified(edit?.verified ?? "unverified");
  };

  const handleOpenChange = (o: boolean) => {
    if (o) reset();
    if (!o) onClose();
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
            <Input id="exam" value={exam} onChange={(e) => setExam(e.target.value)} placeholder="e.g. Class 11, Class 12" className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="board">Board</Label>
            <Input id="board" value={board} onChange={(e) => setBoard(e.target.value)} placeholder="e.g. CBSE, State Board" className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="score">Score</Label>
            <Input id="score" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 95%, 450/500" className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="verified">Verification</Label>
            <select
              id="verified"
              aria-label="Verification status"
              value={verified}
              onChange={(e) => setVerified(e.target.value as AcademicRecord["verified"])}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={() => onSave({ exam, board, score, verified })} className="rounded-xl">Save</Button>
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
}: {
  open: boolean;
  edit?: AchievementRow;
  onClose: () => void;
  onSave: (d: Achievement) => void;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Achievement["level"]>("School");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState("");

  const reset = () => {
    setName(edit?.name ?? "");
    setLevel(edit?.level ?? "School");
    setYear(String(edit?.year ?? new Date().getFullYear()));
    setResult(edit?.result ?? "");
  };

  const handleOpenChange = (o: boolean) => {
    if (o) reset();
    if (!o) onClose();
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
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics Olympiad" className="mt-1 rounded-xl" />
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
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="result">Result</Label>
            <Input id="result" value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Gold Medal, 2nd Place" className="mt-1 rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={() => onSave({ name, level, year: parseInt(year, 10) || new Date().getFullYear(), result })} className="rounded-xl">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
