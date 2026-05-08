"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/hooks/useAuth";
import type { Achievement } from "@/lib/publicProfileService";
import {
  parseAcademicRecordExtras,
  extrasToJson,
  type AcademicRecordExtrasShape,
} from "@/lib/profile/academicRecordExtras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Award,
  Building2,
  FileText,
  Coins,
  ExternalLink,
  Flame,
  Heart,
  LineChart,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Lightbulb,
  Upload,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EDUFUND_RDM_GATES } from "@/lib/dashboardSidebarMetrics";
import {
  activityGreenLevelFromStudyMs,
  addDaysLocal,
  formatPresenceMsForTooltip,
  formatStudyMsForTooltip,
  localDayKeyFromDate,
  startOfLocalDay,
} from "@/lib/dashboardDayActivity";
import { computeStudyStreakFromDayMs } from "@/lib/studyStreakClient";
import { getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/studyDayBumpEvents";
import { useSitePresenceLiveMsToday } from "@/components/providers/SitePresenceProvider";
import { eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns";

const ACADEMIC_BUCKET = "academic-marksheets";
const ACHIEVEMENT_BUCKET = "achievement-marksheets";

const ACHIEVEMENT_LEVELS = ["School", "District", "State", "National", "International"] as const;

type AchievementRow = { id: string; marksheet_path: string | null } & Achievement;

const ACHIEVEMENT_YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  const out: number[] = [];
  for (let i = y + 1; i >= y - 12; i--) out.push(i);
  return out;
})();

function achievementVerifiedSortRank(v: Achievement["verified"]): number {
  if (v === "verified") return 0;
  if (v === "pending") return 1;
  return 2;
}

function sortAchievementsForDisplay(list: AchievementRow[]): AchievementRow[] {
  return [...list].sort((a, b) => {
    const vr = achievementVerifiedSortRank(a.verified) - achievementVerifiedSortRank(b.verified);
    if (vr !== 0) return vr;
    return b.year - a.year;
  });
}

function achievementLevelPillClass(level: Achievement["level"]): string {
  switch (level) {
    case "School":
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/35";
    case "District":
      return "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25";
    case "State":
      return "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25";
    case "National":
      return "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25";
    case "International":
      return "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function AchievementListIcon({ level }: { level: Achievement["level"] }) {
  const box =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10";
  if (level === "School") {
    return (
      <div className={cn(box, "bg-lime-500/15 text-lime-400")}>
        <Lightbulb className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
      </div>
    );
  }
  if (level === "District") {
    return (
      <div className={cn(box, "bg-blue-500/15 text-blue-400")}>
        <Medal className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn(box, "bg-amber-500/15 text-amber-400")}>
      <Trophy className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
    </div>
  );
}

type AcademicSlot = "class_x" | "puc_i" | "puc_ii";

function slotDisplayShort(slot: AcademicSlot): string {
  switch (slot) {
    case "class_x":
      return "Class X";
    case "puc_i":
      return "Class XI";
    case "puc_ii":
      return "Class XII / PUC II";
  }
}

function rowMatchesSlot(exam: string, slot: AcademicSlot): boolean {
  const e = exam.toLowerCase();
  switch (slot) {
    case "class_x":
      return e.includes("class x") || e.includes("class 10") || e.includes("class x ");
    case "puc_i":
      return e.includes("puc i") || e.includes("class xi") || e.includes("class 11");
    case "puc_ii":
      return e.includes("puc ii") || e.includes("class xii") || e.includes("class 12");
    default:
      return false;
  }
}

function defaultExamTitle(slot: AcademicSlot): string {
  switch (slot) {
    case "class_x":
      return "Class X";
    case "puc_i":
      return "PUC I / Class XI";
    case "puc_ii":
      return "PUC II / Class XII";
  }
}

function examTitleWithBoard(slot: AcademicSlot, board: string | null | undefined): string {
  const base = defaultExamTitle(slot);
  const boardLabel = board?.trim() || "State Board";
  return `${base} — ${boardLabel}`;
}

function defaultSubtitle(slot: AcademicSlot): string {
  switch (slot) {
    case "class_x":
      return "Board year · aggregate percentage";
    case "puc_i":
      return "Aggregate or subject-wise marks";
    case "puc_ii":
      return "Current year score or internals %";
  }
}

function fileNameFromStoragePath(path: string | null): string | null {
  if (!path) return null;
  const cleaned = path.split("?")[0] ?? path;
  const parts = cleaned.split("/");
  const name = parts[parts.length - 1] ?? "";
  return name.trim() || null;
}

function hasTextValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAcademicRowData(row: DbAcademic | undefined): boolean {
  if (!row) return false;
  return (
    hasTextValue(row.board) ||
    hasTextValue(row.score) ||
    hasTextValue(row.academic_year) ||
    hasTextValue(row.marksheet_path)
  );
}

function verificationLabel(verified: string | undefined): "Pending" | "Verified" | "Rejected" | null {
  if (verified === "verified") return "Verified";
  if (verified === "unverified") return "Rejected";
  if (verified === "pending") return "Pending";
  return null;
}

type DbAcademic = {
  id: string;
  exam: string;
  board: string;
  score: string;
  verified: string;
  marksheet_path: string | null;
  academic_year: string | null;
  record_status: string | null;
};

const fieldFocus =
  "focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30 dark:focus-visible:border-emerald-500";

/** Academic record — aligned with EduFund mock; persists to `profile_academics` + `academic_record_extras`. */
export function StudentProfileAcademicPanel({
  profile,
  onProfileUpdated,
}: {
  profile: Profile;
  onProfileUpdated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DbAcademic[]>([]);

  const [yearX, setYearX] = useState("");
  const [scoreX, setScoreX] = useState("");
  const [boardX, setBoardX] = useState("");
  const [yearXi, setYearXi] = useState("");
  const [scoreXi, setScoreXi] = useState("");
  const [boardXi, setBoardXi] = useState("");
  const [boardXii, setBoardXii] = useState("");
  const [yearXii, setYearXii] = useState("");
  const [internalsXii, setInternalsXii] = useState("");

  const [subj, setSubj] = useState<NonNullable<AcademicRecordExtrasShape["classXSubjects"]>>({});
  const [subjXi, setSubjXi] = useState<NonNullable<AcademicRecordExtrasShape["classXSubjects"]>>({});
  const [subjXii, setSubjXii] = useState<NonNullable<AcademicRecordExtrasShape["classXSubjects"]>>({});
  const [coachingName, setCoachingName] = useState("");
  const [coachingSince, setCoachingSince] = useState("");
  const [coachingNameXi, setCoachingNameXi] = useState("");
  const [coachingSinceXi, setCoachingSinceXi] = useState("");
  const [coachingNameXii, setCoachingNameXii] = useState("");
  const [coachingSinceXii, setCoachingSinceXii] = useState("");
  const [activeDetailsSlot, setActiveDetailsSlot] = useState<AcademicSlot>("class_x");
  const [editingX, setEditingX] = useState(true);
  const [editingXi, setEditingXi] = useState(true);
  const [editingXii, setEditingXii] = useState(true);

  const [fileX, setFileX] = useState<File | null>(null);
  const [fileXi, setFileXi] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profile_academics")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as DbAcademic[]);

      const extras = parseAcademicRecordExtras(profile.academic_record_extras);
      setSubj(extras.classXSubjects ?? {});
      setSubjXi(extras.classXISubjects ?? {});
      setSubjXii(extras.classXIISubjects ?? {});
      setCoachingName(extras.coaching?.instituteName ?? "");
      setCoachingSince(extras.coaching?.attendingSince ?? "");
      setCoachingNameXi(extras.coachingXI?.instituteName ?? "");
      setCoachingSinceXi(extras.coachingXI?.attendingSince ?? "");
      setCoachingNameXii(extras.coachingXII?.instituteName ?? "");
      setCoachingSinceXii(extras.coachingXII?.attendingSince ?? "");
      setInternalsXii(extras.puc2InternalsPercent ?? "");

      const rx = (data ?? []).find((r) => rowMatchesSlot(r.exam, "class_x"));
      const rxi = (data ?? []).find((r) => rowMatchesSlot(r.exam, "puc_i"));
      const rxii = (data ?? []).find((r) => rowMatchesSlot(r.exam, "puc_ii"));

      setYearX(rx?.academic_year ?? "");
      setScoreX(rx?.score ?? "");
      setBoardX(rx?.board ?? profile.board ?? "");
      setYearXi(rxi?.academic_year ?? "");
      setScoreXi(rxi?.score ?? "");
      setBoardXi(rxi?.board ?? profile.board ?? "");
      setBoardXii(rxii?.board ?? profile.board ?? "");
      setYearXii(rxii?.academic_year ?? "");
      if (rxii?.score && !extras.puc2InternalsPercent) setInternalsXii(rxii.score);

      setEditingX(!hasAcademicRowData(rx ?? undefined));
      setEditingXi(!hasAcademicRowData(rxi ?? undefined));
      setEditingXii(!(hasAcademicRowData(rxii ?? undefined) || hasTextValue(extras.puc2InternalsPercent)));
    } catch (e: unknown) {
      toast({
        title: "Could not load academic record",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.academic_record_extras, profile.board, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const findRow = (slot: AcademicSlot) => rows.find((r) => rowMatchesSlot(r.exam, slot));

  const uploadMarksheet = async (userId: string, academicId: string, file: File | null) => {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${academicId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(ACADEMIC_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
    });
    if (error) throw error;
    await supabase.from("profile_academics").update({ marksheet_path: path }).eq("id", academicId);
  };

  const upsertSlot = async (
    slot: AcademicSlot,
    fields: { year: string; score: string; board: string },
    file: File | null
  ) => {
    const existing = findRow(slot);
    const examTitle = defaultExamTitle(slot);
    const record_status = slot === "puc_ii" ? "in_progress" : "complete";
    const scoreVal = fields.score.trim() || (slot === "puc_ii" ? "" : "—");

    if (existing) {
      const { error } = await supabase
        .from("profile_academics")
        .update({
          board: fields.board.trim() || profile.board || "—",
          score: scoreVal || "—",
          academic_year: fields.year.trim() || null,
          record_status,
          verified: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;
      await uploadMarksheet(profile.id, existing.id, file);
    } else {
      const { data: inserted, error } = await supabase
        .from("profile_academics")
        .insert({
          user_id: profile.id,
          exam: examTitle,
          board: fields.board.trim() || profile.board || "—",
          score: scoreVal || "—",
          academic_year: fields.year.trim() || null,
          record_status,
          verified: "pending",
        })
        .select("id")
        .single();
      if (error || !inserted?.id) throw error ?? new Error("Insert failed");
      await uploadMarksheet(profile.id, inserted.id, file);
    }
  };

  const shouldPersistSlot = (fields: { year: string; score: string; board: string }, file: File | null): boolean => {
    return Boolean(fields.year.trim() || fields.score.trim() || fields.board.trim() || file);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const classXFields = { year: yearX, score: scoreX, board: boardX };
      const classXIFields = { year: yearXi, score: scoreXi, board: boardXi };
      const classXIIFields = { year: yearXii, score: internalsXii, board: boardXii };

      if (shouldPersistSlot(classXFields, fileX)) {
        await upsertSlot("class_x", classXFields, fileX);
      }
      if (shouldPersistSlot(classXIFields, fileXi)) {
        await upsertSlot("puc_i", classXIFields, fileXi);
      }
      if (shouldPersistSlot(classXIIFields, null)) {
        await upsertSlot("puc_ii", classXIIFields, null);
      }

      const extras: AcademicRecordExtrasShape = {
        classXSubjects: subj,
        classXISubjects: subjXi,
        classXIISubjects: subjXii,
        coaching:
          coachingName.trim() || coachingSince.trim()
            ? { instituteName: coachingName.trim(), attendingSince: coachingSince.trim() }
            : undefined,
        coachingXI:
          coachingNameXi.trim() || coachingSinceXi.trim()
            ? { instituteName: coachingNameXi.trim(), attendingSince: coachingSinceXi.trim() }
            : undefined,
        coachingXII:
          coachingNameXii.trim() || coachingSinceXii.trim()
            ? { instituteName: coachingNameXii.trim(), attendingSince: coachingSinceXii.trim() }
            : undefined,
        puc2InternalsPercent: internalsXii.trim() || undefined,
      };
      const { error: pe } = await supabase
        .from("profiles")
        .update({ academic_record_extras: extrasToJson(extras) })
        .eq("id", profile.id);
      if (pe) throw pe;

      setFileX(null);
      setFileXi(null);
      setEditingX(false);
      setEditingXi(false);
      setEditingXii(false);
      await onProfileUpdated();
      await load();
      toast({ title: "Academic record saved" });
    } catch (e: unknown) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openMarksheet = async (path: string) => {
    const { data, error } = await supabase.storage.from(ACADEMIC_BUCKET).createSignedUrl(path, 120);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const rowX = findRow("class_x");
  const rowXi = findRow("puc_i");
  const rowXii = findRow("puc_ii");
  const xSummary = [boardX, yearX, scoreX && `${scoreX}%`]
    .filter((v) => hasTextValue(v))
    .join(" · ");
  const xiSummary = [boardXi, yearXi, scoreXi && `${scoreXi}%`]
    .filter((v) => hasTextValue(v))
    .join(" · ");
  const xiiSummary = [boardXii, yearXii, internalsXii && `${internalsXii}%`]
    .filter((v) => hasTextValue(v))
    .join(" · ");
  const activeSubjects =
    activeDetailsSlot === "class_x" ? subj : activeDetailsSlot === "puc_i" ? subjXi : subjXii;
  const setActiveSubjects =
    activeDetailsSlot === "class_x" ? setSubj : activeDetailsSlot === "puc_i" ? setSubjXi : setSubjXii;
  const activeCoachingName =
    activeDetailsSlot === "class_x" ? coachingName : activeDetailsSlot === "puc_i" ? coachingNameXi : coachingNameXii;
  const setActiveCoachingName =
    activeDetailsSlot === "class_x"
      ? setCoachingName
      : activeDetailsSlot === "puc_i"
        ? setCoachingNameXi
        : setCoachingNameXii;
  const activeCoachingSince =
    activeDetailsSlot === "class_x" ? coachingSince : activeDetailsSlot === "puc_i" ? coachingSinceXi : coachingSinceXii;
  const setActiveCoachingSince =
    activeDetailsSlot === "class_x"
      ? setCoachingSince
      : activeDetailsSlot === "puc_i"
        ? setCoachingSinceXi
        : setCoachingSinceXii;
  const activeIsEditing =
    activeDetailsSlot === "class_x" ? editingX : activeDetailsSlot === "puc_i" ? editingXi : editingXii;

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground dark:text-slate-400">
        Loading academic record…
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <FileText className="h-5 w-5 shrink-0 text-emerald-400" />
          <h2 className="text-base font-black text-foreground sm:text-lg dark:text-white">Academic record</h2>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
            Shared with EduFund &amp; NGOs
          </span>
        </div>

        <AcademicRowEditor
          iconClass="bg-blue-500/15 text-blue-400"
          title={examTitleWithBoard("class_x", boardX)}
          subtitle={defaultSubtitle("class_x")}
          year={yearX}
          setYear={setYearX}
          score={scoreX}
          setScore={setScoreX}
          board={boardX}
          setBoard={setBoardX}
          uploadLabel="Upload Class X marksheet"
          file={fileX}
          onFile={setFileX}
          marksheetPath={rowX?.marksheet_path ?? null}
          onOpenMarksheet={openMarksheet}
          onActivate={() => setActiveDetailsSlot("class_x")}
          isActive={activeDetailsSlot === "class_x"}
          isEditing={editingX}
          onEdit={() => {
            setEditingX(true);
            setActiveDetailsSlot("class_x");
          }}
          verification={verificationLabel(rowX?.verified)}
          summary={xSummary}
        />

        <AcademicRowEditor
          iconClass="bg-violet-500/15 text-violet-300"
          title={examTitleWithBoard("puc_i", boardXi)}
          subtitle={defaultSubtitle("puc_i")}
          year={yearXi}
          setYear={setYearXi}
          score={scoreXi}
          setScore={setScoreXi}
          board={boardXi}
          setBoard={setBoardXi}
          uploadLabel="Upload marksheet"
          file={fileXi}
          onFile={setFileXi}
          marksheetPath={rowXi?.marksheet_path ?? null}
          onOpenMarksheet={openMarksheet}
          onActivate={() => setActiveDetailsSlot("puc_i")}
          isActive={activeDetailsSlot === "puc_i"}
          isEditing={editingXi}
          onEdit={() => {
            setEditingXi(true);
            setActiveDetailsSlot("puc_i");
          }}
          verification={verificationLabel(rowXi?.verified)}
          summary={xiSummary}
        />

        <div
          className="flex flex-wrap items-center gap-2 border-b border-border py-3 dark:border-white/10 sm:gap-3"
          onClick={() => setActiveDetailsSlot("puc_ii")}
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9",
              "bg-emerald-500/15 text-emerald-400"
            )}
          >
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground dark:text-slate-100">
              {examTitleWithBoard("puc_ii", boardXii)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-slate-500">{defaultSubtitle("puc_ii")}</p>
            {!editingXii ? (
              <p className="mt-1 text-[11px] text-muted-foreground dark:text-slate-400">
                {xiiSummary || "No data submitted"}
              </p>
            ) : null}
          </div>
          {verificationLabel(rowXii?.verified) ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                verificationLabel(rowXii?.verified) === "Verified"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : verificationLabel(rowXii?.verified) === "Rejected"
                    ? "bg-rose-500/15 text-rose-400"
                    : "bg-amber-500/15 text-amber-400"
              )}
            >
              {verificationLabel(rowXii?.verified)}
            </span>
          ) : null}
          {!editingXii ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              onClick={(e) => {
                e.stopPropagation();
                setEditingXii(true);
                setActiveDetailsSlot("puc_ii");
              }}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Input
                value={boardXii}
                onChange={(e) => {
                  setActiveDetailsSlot("puc_ii");
                  setBoardXii(e.target.value);
                }}
                onFocus={() => setActiveDetailsSlot("puc_ii")}
                placeholder="Board"
                className={cn("h-9 w-[110px] sm:w-[130px]", fieldFocus)}
              />
              <Input
                value={yearXii}
                onChange={(e) => {
                  setActiveDetailsSlot("puc_ii");
                  setYearXii(e.target.value);
                }}
                onFocus={() => setActiveDetailsSlot("puc_ii")}
                placeholder="Year"
                className={cn("h-9 w-[72px] sm:w-20", fieldFocus)}
              />
              <Input
                value={internalsXii}
                onChange={(e) => {
                  setActiveDetailsSlot("puc_ii");
                  setInternalsXii(e.target.value);
                }}
                onFocus={() => setActiveDetailsSlot("puc_ii")}
                placeholder="Score %"
                className={cn("h-9 w-[100px] sm:w-[110px]", fieldFocus)}
              />
            </>
          )}
        </div>

        <div className="my-4 h-px bg-border dark:bg-white/10" />

        <p className="mb-2 text-[11px] font-bold text-muted-foreground dark:text-slate-400">
          Subject-wise marks — {slotDisplayShort(activeDetailsSlot)}
        </p>
        {activeIsEditing ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["physicsScience", "Physics / Science"],
                ["mathematics", "Mathematics"],
                ["chemistry", "Chemistry"],
                ["english", "English"],
                ["socialScience", "Social Science"],
                ["secondLanguage", "Second language"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold dark:text-slate-200">{label}</label>
                <Input
                  value={activeSubjects[key] ?? ""}
                  onChange={(e) => setActiveSubjects((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder="e.g. 94%"
                  className={cn("h-9", fieldFocus)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["physicsScience", "Physics / Science"],
                ["mathematics", "Mathematics"],
                ["chemistry", "Chemistry"],
                ["english", "English"],
                ["socialScience", "Social Science"],
                ["secondLanguage", "Second language"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="min-w-0 rounded-md border border-border/80 bg-muted/20 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-[11px] font-semibold dark:text-slate-300">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">
                  {activeSubjects[key]?.trim() || "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="my-4 h-px bg-border dark:bg-white/10" />

        <p className="mb-2 text-[11px] font-bold text-muted-foreground dark:text-slate-400">
          Coaching class / tuition ({slotDisplayShort(activeDetailsSlot)})
        </p>
        {activeIsEditing ? (
          <div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold dark:text-slate-200">Coaching institute name</label>
              <Input
                value={activeCoachingName}
                onChange={(e) => setActiveCoachingName(e.target.value)}
                placeholder="e.g. FIITJEE, Allen…"
                className={cn("h-9", fieldFocus)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold dark:text-slate-200">Attending since</label>
              <Input
                type="month"
                value={activeCoachingSince}
                onChange={(e) => setActiveCoachingSince(e.target.value)}
                className={cn("h-9", fieldFocus)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2">
            <div className="rounded-md border border-border/80 bg-muted/20 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-[11px] font-semibold dark:text-slate-300">Coaching institute name</p>
              <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">{activeCoachingName.trim() || "—"}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-[11px] font-semibold dark:text-slate-300">Attending since</p>
              <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">{activeCoachingSince.trim() || "—"}</p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] leading-relaxed text-emerald-200/90 dark:border-emerald-500/20 dark:bg-emerald-950/40">
          Marksheets are stored securely and only shared with the EduFund committee and partner NGOs when you apply for
          a grant.
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 dark:border-white/10">
          <Button type="button" variant="outline" onClick={() => void load()} className="text-xs font-bold sm:text-sm">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving}
            className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 sm:text-sm"
          >
            {saving ? "Saving…" : "Save academic record"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function AcademicRowEditor({
  iconClass,
  title,
  subtitle,
  year,
  setYear,
  score,
  setScore,
  board,
  setBoard,
  uploadLabel,
  file,
  onFile,
  marksheetPath,
  onOpenMarksheet,
  onActivate,
  isActive,
  isEditing,
  onEdit,
  verification,
  summary,
}: {
  iconClass: string;
  title: string;
  subtitle: string;
  year: string;
  setYear: (v: string) => void;
  score: string;
  setScore: (v: string) => void;
  board: string;
  setBoard: (v: string) => void;
  uploadLabel: string;
  file: File | null;
  onFile: (f: File | null) => void;
  marksheetPath: string | null;
  onOpenMarksheet: (path: string) => void;
  onActivate: () => void;
  isActive: boolean;
  isEditing: boolean;
  onEdit: () => void;
  verification: "Pending" | "Verified" | "Rejected" | null;
  summary: string;
}) {
  const id = useId();
  const activate = () => onActivate();
  const selectedFileName = file?.name?.trim() || null;
  const uploadedFileName = fileNameFromStoragePath(marksheetPath);
  const displayDocName = selectedFileName ?? uploadedFileName;
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 border-b border-border py-3 dark:border-white/10 sm:gap-3"
        onClick={activate}
      >
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9", iconClass)}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 basis-[200px]">
          <p className="text-xs font-bold text-foreground dark:text-slate-100">{title}</p>
          <p className="text-[11px] text-muted-foreground dark:text-slate-500">{subtitle}</p>
          {!isEditing ? (
            <p className="mt-1 text-[11px] text-muted-foreground dark:text-slate-400">{summary || "No data submitted"}</p>
          ) : (
            <Input
              value={board}
              onChange={(e) => {
                activate();
                setBoard(e.target.value);
              }}
              onFocus={activate}
              placeholder="Board"
              className={cn("mt-2 h-8 max-w-xs text-xs", fieldFocus)}
            />
          )}
        </div>
        {verification ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              verification === "Verified"
                ? "bg-emerald-500/15 text-emerald-400"
                : verification === "Rejected"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-amber-500/15 text-amber-400"
            )}
          >
            {verification}
          </span>
        ) : null}
        {!isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <>
            <Input
              value={year}
              onChange={(e) => {
                activate();
                setYear(e.target.value);
              }}
              onFocus={activate}
              placeholder="Year"
              className={cn("h-9 w-[72px] sm:w-20", fieldFocus)}
            />
            <Input
              value={score}
              onChange={(e) => {
                activate();
                setScore(e.target.value);
              }}
              onFocus={activate}
              placeholder="Score %"
              className={cn("h-9 w-20 sm:w-24", fieldFocus)}
            />
          </>
        )}
      </div>
      {!isActive || !isEditing ? null : (
        <div className="mb-3 ml-0 sm:ml-11" onClick={activate}>
          <input
            type="file"
            id={id}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              activate();
              onFile(e.target.files?.[0] ?? null);
            }}
          />
          <button
            type="button"
            onClick={() => document.getElementById(id)?.click()}
            className="flex w-full flex-col items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-center transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:border-white/15 dark:bg-white/[0.03]"
          >
            <Upload className="mb-1 h-5 w-5 text-emerald-400" />
            <span className="text-xs font-semibold text-foreground dark:text-slate-200">{uploadLabel}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground dark:text-slate-500">
              PDF or image · max 10 MB · {displayDocName ?? "scholarship verification"}
            </span>
            {displayDocName ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 transition-all duration-300">
                <Check className="h-3 w-3 motion-safe:animate-pulse" />
                {selectedFileName ? "Selected:" : "Uploaded:"} {displayDocName}
              </span>
            ) : null}
          </button>
          {marksheetPath ? (
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => onOpenMarksheet(marksheetPath)}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              View uploaded marksheet
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Achievements — verified rows first; add/edit inline (no modal). Organising body uses DB `percentage` text column. */
export function StudentProfileAchievementsPanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formResult, setFormResult] = useState("");
  const [formLevel, setFormLevel] = useState<Achievement["level"]>("State");
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formOrganizer, setFormOrganizer] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const certInputId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profile_achievements")
        .select("*")
        .eq("user_id", userId)
        .order("year", { ascending: false });
      if (error) throw error;
      setRows(
        (data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          level: r.level as Achievement["level"],
          year: r.year,
          result: r.result ?? "",
          percentage: (r as { percentage?: string }).percentage ?? "",
          verified: ((r as { verified?: string }).verified ?? "pending") as Achievement["verified"],
          marksheet_path: r.marksheet_path ?? null,
        }))
      );
    } catch (e: unknown) {
      toast({
        title: "Could not load achievements",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => sortAchievementsForDisplay(rows), [rows]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormName("");
    setFormResult("");
    setFormLevel("State");
    setFormYear(String(new Date().getFullYear()));
    setFormOrganizer("");
    setFormFile(null);
  }, []);

  const startEdit = (a: AchievementRow) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormResult(a.result ?? "");
    setFormLevel(a.level);
    setFormYear(String(a.year));
    setFormOrganizer(a.percentage ?? "");
    setFormFile(null);
  };

  const openAchievementMarksheet = async (path: string) => {
    const { data, error } = await supabase.storage.from(ACHIEVEMENT_BUCKET).createSignedUrl(path, 120);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const uploadCertificate = async (achievementId: string, file: File | null) => {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${achievementId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from(ACHIEVEMENT_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
    });
    if (!upErr) await supabase.from("profile_achievements").update({ marksheet_path: path }).eq("id", achievementId);
  };

  const submitForm = async () => {
    const name = formName.trim();
    if (!name) {
      toast({ title: "Achievement name required", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      level: formLevel,
      year: parseInt(formYear, 10) || new Date().getFullYear(),
      result: formResult.trim(),
      percentage: formOrganizer.trim(),
      verified: "pending" as const,
    };

    setSaving(true);
    try {
      if (editingId) {
        let newPath: string | undefined;
        if (formFile) {
          const safeName = formFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          newPath = `${userId}/${editingId}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from(ACHIEVEMENT_BUCKET).upload(newPath, formFile, {
            contentType: formFile.type || undefined,
          });
          if (upErr) newPath = undefined;
        }
        const { error } = await supabase
          .from("profile_achievements")
          .update({
            ...payload,
            verified: "pending",
            ...(newPath !== undefined ? { marksheet_path: newPath } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Achievement updated" });
      } else {
        const { data: inserted, error } = await supabase
          .from("profile_achievements")
          .insert({ user_id: userId, ...payload })
          .select("id")
          .single();
        if (error) throw error;
        if (inserted?.id) await uploadCertificate(inserted.id, formFile);
        toast({ title: "Achievement added" });
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profile_achievements").delete().eq("id", id);
    if (editingId === id) resetForm();
    await load();
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Medal className="h-5 w-5 shrink-0 text-emerald-400" />
            <h2 className="text-base font-black dark:text-white sm:text-lg">Achievements &amp; competitions</h2>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
            Strengthens scholarship profile
          </span>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
          Every verified achievement improves your grant eligibility score and makes you visible to partner NGOs and
          corporate CSR programmes. Higher-level achievements carry significantly more weight.
        </p>

        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground">Loading…</p>
        ) : sortedRows.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground dark:text-slate-400">
            No achievements yet. Add your first one below.
          </p>
        ) : (
          <ul className="mb-6 divide-y divide-border dark:divide-white/10">
            {sortedRows.map((a) => {
              const org = a.percentage?.trim();
              const metaParts = [`${a.level} level`, String(a.year), org].filter(Boolean);
              return (
                <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:gap-4">
                  <AchievementListIcon level={a.level} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground dark:text-slate-100">{a.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground dark:text-slate-500">
                      {metaParts.join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        achievementLevelPillClass(a.level)
                      )}
                    >
                      {a.level}
                    </span>
                    {a.verified === "verified" ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <Check className="h-3 w-3" aria-hidden />
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        Pending verify
                      </span>
                    )}
                    {a.marksheet_path ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-bold"
                        onClick={() => void openAchievementMarksheet(a.marksheet_path!)}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Certificate
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => startEdit(a)}
                      aria-label="Edit achievement"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-400"
                      onClick={() => void handleDelete(a.id)}
                      aria-label="Delete achievement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border pt-5 dark:border-white/10">
          <p className="mb-3 text-sm font-bold text-foreground dark:text-white">
            {editingId ? "Edit achievement" : "Add a new achievement"}
          </p>
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
            <div className="min-w-0">
              <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">
                Achievement / competition name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. KVPY, NSO, JEE score, Science Olympiad…"
                className={cn("mt-1 h-9", fieldFocus)}
              />
            </div>
            <div className="min-w-0">
              <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">Result / rank / medal</Label>
              <Input
                value={formResult}
                onChange={(e) => setFormResult(e.target.value)}
                placeholder="e.g. Rank 12, Gold, 98.4 percentile…"
                className={cn("mt-1 h-9", fieldFocus)}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">
                Level <span className="text-red-500">*</span>
              </Label>
              <Select value={formLevel} onValueChange={(v) => setFormLevel(v as Achievement["level"])}>
                <SelectTrigger className={cn("mt-1 h-9 w-full", fieldFocus)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">Year</Label>
              <Select value={formYear} onValueChange={(v) => v != null && setFormYear(v)}>
                <SelectTrigger className={cn("mt-1 h-9 w-full", fieldFocus)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ACHIEVEMENT_YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 sm:col-span-1">
              <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">Organising body</Label>
              <Input
                value={formOrganizer}
                onChange={(e) => setFormOrganizer(e.target.value)}
                placeholder="e.g. CBSE, IIT, NSEJS…"
                className={cn("mt-1 h-9", fieldFocus)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-[11px] font-semibold text-foreground dark:text-slate-200">
              Upload certificate (verified certificates shown with a tick)
            </Label>
            {editingId && rows.find((r) => r.id === editingId)?.marksheet_path ? (
              <Button
                type="button"
                variant="link"
                className="mt-0.5 h-auto p-0 text-xs font-bold text-emerald-400"
                onClick={() => {
                  const p = rows.find((r) => r.id === editingId)?.marksheet_path;
                  if (p) void openAchievementMarksheet(p);
                }}
              >
                View current certificate
              </Button>
            ) : null}
            <input
              type="file"
              id={certInputId}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => document.getElementById(certInputId)?.click()}
              className={cn(
                "mt-2 flex w-full flex-col items-center rounded-lg border border-dashed px-4 py-4 text-center transition-colors",
                formFile
                  ? "border-emerald-500/55 bg-emerald-500/10 hover:bg-emerald-500/15 dark:border-emerald-500/45 dark:bg-emerald-950/30"
                  : "border-border bg-muted/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:border-white/15 dark:bg-white/[0.03]"
              )}
            >
              {formFile ? (
                <Check className="mb-2 h-5 w-5 text-emerald-400 motion-safe:animate-pulse" aria-hidden />
              ) : (
                <Upload className="mb-2 h-5 w-5 text-emerald-400" aria-hidden />
              )}
              <span className="text-xs font-semibold text-foreground dark:text-slate-200">
                {formFile ? "Certificate selected" : "Drop certificate PDF or image here"}
              </span>
              <span className="mt-1 text-[10px] text-muted-foreground dark:text-slate-500">
                {formFile
                  ? `Uploaded: ${formFile.name}`
                  : "Shared with funders on request when you apply for a grant · JPEG, PNG, WebP, or PDF"}
              </span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              className="font-bold"
              disabled={saving}
              onClick={() => resetForm()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-500"
              disabled={saving || !formName.trim()}
              onClick={() => void submitForm()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Save changes"
              ) : (
                <>
                  <Plus className="mr-1 h-4 w-4" />
                  Add achievement
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Study heat: red = none or under 10m; greens = 10–30m → 30m–2h → over 2h (`activityGreenLevelFromStudyMs`). */
const ACTIVITY_DOT_COLORS = {
  none: "rgb(15 23 42 / 0.35)", // outside range / pad
  inactive: "rgb(185 28 28 / 0.58)", // no activity or under 10 min
  l0: "rgb(134 239 172 / 0.92)", // 10–30 min — light green
  l1: "rgb(22 163 74 / 0.78)", // 30 min–2 h
  l2: "rgb(6 78 59 / 0.95)", // over 2 h — darkest green
} as const;

function dotKeyFromGreenLevel(g: 0 | 1 | 2 | 3): keyof typeof ACTIVITY_DOT_COLORS {
  switch (g) {
    case 0:
      return "inactive";
    case 1:
      return "l0";
    case 2:
      return "l1";
    case 3:
      return "l2";
    default:
      return "inactive";
  }
}

type DotCell = {
  date: Date;
  level: keyof typeof ACTIVITY_DOT_COLORS;
  activeMs: number;
  presenceMs: number;
};

function buildActivityDotWeeks(
  studyMsByDay: Map<string, number>,
  presenceMsByDay: Map<string, number>,
  livePresencePendingMs: number,
  now: Date
): { weeks: DotCell[][] } {
  const todayStart = startOfLocalDay(now);
  const todayKey = localDayKeyFromDate(todayStart);
  const rangeStartDay = addDaysLocal(todayStart, -27);
  const fromKey = localDayKeyFromDate(rangeStartDay);

  const gridStart = startOfWeek(rangeStartDay, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(todayStart, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: DotCell[][] = [];

  for (let i = 0; i < allDays.length; i += 7) {
    const chunk = allDays.slice(i, i + 7).map((date) => {
      const key = localDayKeyFromDate(startOfLocalDay(date));
      const inRange = key >= fromKey && key <= todayKey;
      if (!inRange) {
        return {
          date,
          level: "none" as const,
          activeMs: 0,
          presenceMs: 0,
        };
      }
      const activeMs = studyMsByDay.get(key) ?? 0;
      const serverPresence = presenceMsByDay.get(key) ?? 0;
      const presenceMs = serverPresence + (key === todayKey ? livePresencePendingMs : 0);
      const heatMs = Math.max(presenceMs, activeMs);
      const greenLevel = activityGreenLevelFromStudyMs(heatMs);
      return {
        date,
        level: dotKeyFromGreenLevel(greenLevel),
        activeMs,
        presenceMs,
      };
    });
    weeks.push(chunk);
  }

  return { weeks };
}

const WEEKDAY_LABELS_LEFT = ["Mon", "", "Wed", "", "Fri", "", "Sun"] as const;

/** Sum of `user_study_day_totals.active_ms` — shown as hours/minutes on profile. */
function formatPlatformStudyHours(activeMs: number): string {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return "0 h";
  const hours = activeMs / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(activeMs / 60_000))} min`;
  return hours >= 10 ? `${Math.round(hours)} h` : `${hours.toFixed(1)} h`;
}

type RdmRecentClaimRow = {
  key: string;
  category: "gyan" | "play" | "mocks" | "revision";
  title: string;
  detail: string;
  amount: number;
  at: string;
};

/** Activity &amp; RDM — study streak + heatmap use the same `/api/user/study-days` pipeline as the home dashboard. */
export function StudentProfileActivityPanel({ profile }: { profile: Profile }) {
  const rdm = profile.rdm ?? 0;
  const dailyDoseStreak = profile.daily_dose_streak ?? 0;
  const livePresencePendingMs = useSitePresenceLiveMsToday();

  const [dashboardClock, setDashboardClock] = useState(() => Date.now());
  const now = useMemo(() => new Date(dashboardClock), [dashboardClock]);
  const monthDays = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

  useEffect(() => {
    const id = setInterval(() => setDashboardClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [studyMsByDay, setStudyMsByDay] = useState<Map<string, number>>(() => new Map());
  const [presenceMsByDay, setPresenceMsByDay] = useState<Map<string, number>>(() => new Map());
  const [streakSummary, setStreakSummary] = useState<{
    streak: number;
    activeDaysThisMonth: number;
  } | null>(null);
  const [studyDaysStatus, setStudyDaysStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const studyDaysCommittedRef = useRef(false);

  const loadStudyDays = useCallback(async () => {
    if (!profile.id) {
      studyDaysCommittedRef.current = false;
      setStudyDaysStatus("idle");
      return;
    }
    const todayStart = startOfLocalDay(new Date());
    const toStr = localDayKeyFromDate(todayStart);
    const fromStr = localDayKeyFromDate(addDaysLocal(todayStart, -45));
    const silent = studyDaysCommittedRef.current;
    if (!silent) setStudyDaysStatus("loading");
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch(`/api/user/study-days?from=${fromStr}&to=${toStr}&today=${toStr}`, {
        headers,
      });
      if (!res.ok) {
        if (!silent) setStudyDaysStatus("error");
        return;
      }
      const json = (await res.json()) as {
        days?: { day: string; active_ms: number; presence_ms?: number }[];
        summary?: { streak?: number; activeDaysThisMonth?: number } | null;
      };
      const map = new Map<string, number>();
      const presenceMap = new Map<string, number>();
      for (const row of json.days ?? []) {
        if (row?.day && typeof row.active_ms === "number" && row.active_ms >= 0) {
          map.set(row.day, Math.max(0, row.active_ms));
        }
        if (row?.day && typeof row.presence_ms === "number" && row.presence_ms >= 0) {
          presenceMap.set(row.day, Math.max(0, row.presence_ms));
        }
      }
      setStudyMsByDay(map);
      setPresenceMsByDay(presenceMap);
      const s = json.summary;
      if (s && typeof s.streak === "number" && typeof s.activeDaysThisMonth === "number") {
        setStreakSummary({ streak: s.streak, activeDaysThisMonth: s.activeDaysThisMonth });
      } else {
        setStreakSummary(computeStudyStreakFromDayMs(map, toStr));
      }
      setStudyDaysStatus("ready");
      studyDaysCommittedRef.current = true;
    } catch {
      if (!silent) setStudyDaysStatus("error");
    }
  }, [profile.id]);

  const [rdmRecent, setRdmRecent] = useState<{
    windowDays: number;
    gyan: number;
    play: number;
    mocks: number;
    revision: number;
    totalInWindow: number;
    recentClaims: RdmRecentClaimRow[];
  } | null>(null);
  const [rdmRecentStatus, setRdmRecentStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadRdmRecent = useCallback(async () => {
    if (!profile.id) {
      setRdmRecent(null);
      setRdmRecentStatus("idle");
      return;
    }
    setRdmRecentStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/rdm-recent-by-activity?days=28", { headers });
      if (!res.ok) {
        setRdmRecent(null);
        setRdmRecentStatus("error");
        return;
      }
      const json = (await res.json()) as {
        windowDays?: number;
        gyan?: number;
        play?: number;
        mocks?: number;
        revision?: number;
        totalInWindow?: number;
        recentClaims?: RdmRecentClaimRow[];
      };
      const claims = Array.isArray(json.recentClaims)
        ? json.recentClaims.filter(
            (c): c is RdmRecentClaimRow =>
              c != null &&
              typeof c.key === "string" &&
              typeof c.title === "string" &&
              typeof c.detail === "string" &&
              typeof c.amount === "number" &&
              typeof c.at === "string" &&
              (c.category === "gyan" || c.category === "play" || c.category === "mocks" || c.category === "revision")
          )
        : [];
      setRdmRecent({
        windowDays: json.windowDays ?? 28,
        gyan: Number(json.gyan) || 0,
        play: Number(json.play) || 0,
        mocks: Number(json.mocks) || 0,
        revision: Number(json.revision) || 0,
        totalInWindow: Number(json.totalInWindow) || 0,
        recentClaims: claims,
      });
      setRdmRecentStatus("ready");
    } catch {
      setRdmRecent(null);
      setRdmRecentStatus("error");
    }
  }, [profile.id]);

  const [mockSubjectAverages, setMockSubjectAverages] = useState<{
    physics: { avg: number | null; count: number };
    chemistry: { avg: number | null; count: number };
    math: { avg: number | null; count: number };
  } | null>(null);
  const [mockSubjectStatus, setMockSubjectStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const [attendanceStats, setAttendanceStats] = useState<{
    classroomsJoined: number;
    assignmentTasksDone: number;
    dailyDoseDualStreak: number;
    mocksAttempted: number;
    instacueDwellEventsThisWeek: number;
    studyMsTotal: number;
  } | null>(null);
  const [attendanceStatsStatus, setAttendanceStatsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const loadAttendanceStats = useCallback(async () => {
    if (!profile.id) {
      setAttendanceStats(null);
      setAttendanceStatsStatus("idle");
      return;
    }
    setAttendanceStatsStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/profile-attendance-summary", { headers });
      if (!res.ok) {
        setAttendanceStats(null);
        setAttendanceStatsStatus("error");
        return;
      }
      const json = (await res.json()) as {
        classroomsJoined?: unknown;
        assignmentTasksDone?: unknown;
        dailyDoseDualStreak?: unknown;
        mocksAttempted?: unknown;
        instacueDwellEventsThisWeek?: unknown;
        studyMsTotal?: unknown;
      };
      setAttendanceStats({
        classroomsJoined: Math.max(0, Math.trunc(Number(json.classroomsJoined) || 0)),
        assignmentTasksDone: Math.max(0, Math.trunc(Number(json.assignmentTasksDone) || 0)),
        dailyDoseDualStreak: Math.max(0, Math.trunc(Number(json.dailyDoseDualStreak) || 0)),
        mocksAttempted: Math.max(0, Math.trunc(Number(json.mocksAttempted) || 0)),
        instacueDwellEventsThisWeek: Math.max(0, Math.trunc(Number(json.instacueDwellEventsThisWeek) || 0)),
        studyMsTotal: Math.max(0, Math.trunc(Number(json.studyMsTotal) || 0)),
      });
      setAttendanceStatsStatus("ready");
    } catch {
      setAttendanceStats(null);
      setAttendanceStatsStatus("error");
    }
  }, [profile.id]);

  const loadMockSubjectAverages = useCallback(async () => {
    if (!profile.id) {
      setMockSubjectAverages(null);
      setMockSubjectStatus("idle");
      return;
    }
    setMockSubjectStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/mock-subject-averages", { headers });
      if (!res.ok) {
        setMockSubjectAverages(null);
        setMockSubjectStatus("error");
        return;
      }
      const json = (await res.json()) as {
        subjects?: {
          physics?: { avg: number | null; count: number };
          chemistry?: { avg: number | null; count: number };
          math?: { avg: number | null; count: number };
        };
      };
      const s = json.subjects;
      setMockSubjectAverages({
        physics: { avg: s?.physics?.avg ?? null, count: s?.physics?.count ?? 0 },
        chemistry: { avg: s?.chemistry?.avg ?? null, count: s?.chemistry?.count ?? 0 },
        math: { avg: s?.math?.avg ?? null, count: s?.math?.count ?? 0 },
      });
      setMockSubjectStatus("ready");
    } catch {
      setMockSubjectAverages(null);
      setMockSubjectStatus("error");
    }
  }, [profile.id]);

  useEffect(() => {
    startTransition(() => {
      studyDaysCommittedRef.current = false;
      setStudyMsByDay(new Map());
      setPresenceMsByDay(new Map());
      setStreakSummary(null);
      setStudyDaysStatus("idle");
      setRdmRecent(null);
      setRdmRecentStatus("idle");
      setMockSubjectAverages(null);
      setMockSubjectStatus("idle");
      setAttendanceStats(null);
      setAttendanceStatsStatus("idle");
    });
  }, [profile.id]);

  useEffect(() => {
    startTransition(() => {
      void loadStudyDays();
    });
  }, [loadStudyDays]);

  useEffect(() => {
    const onRefresh = () => void loadStudyDays();
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
    return () => window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
  }, [loadStudyDays]);

  useEffect(() => {
    if (!profile.id) return;
    const channel = supabase
      .channel(`user_study_day_totals_profile:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_study_day_totals",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          void loadStudyDays();
          void loadAttendanceStats();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id, loadStudyDays, loadAttendanceStats]);

  useEffect(() => {
    const onFocus = () => void loadStudyDays();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStudyDays]);

  useEffect(() => {
    startTransition(() => {
      void loadRdmRecent();
    });
  }, [loadRdmRecent]);

  useEffect(() => {
    const onFocus = () => void loadRdmRecent();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadRdmRecent]);

  useEffect(() => {
    startTransition(() => {
      void loadMockSubjectAverages();
    });
  }, [loadMockSubjectAverages]);

  useEffect(() => {
    const onFocus = () => void loadMockSubjectAverages();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadMockSubjectAverages]);

  useEffect(() => {
    startTransition(() => {
      void loadAttendanceStats();
    });
  }, [loadAttendanceStats]);

  useEffect(() => {
    const onFocus = () => void loadAttendanceStats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadAttendanceStats]);

  useEffect(() => {
    if (!profile.id) return;
    const channel = supabase
      .channel(`profile_attendance_summary:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        () => void loadAttendanceStats()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id, loadAttendanceStats]);

  const studyStreak = streakSummary?.streak ?? 0;
  const activeDaysThisMonth = streakSummary?.activeDaysThisMonth ?? 0;

  const { weeks } = useMemo(
    () => buildActivityDotWeeks(studyMsByDay, presenceMsByDay, livePresencePendingMs, now),
    [studyMsByDay, presenceMsByDay, livePresencePendingMs, now]
  );

  const streakDisplay =
    studyDaysStatus === "loading" || studyDaysStatus === "idle" ? "…" : studyDaysStatus === "error" ? "—" : String(studyStreak);
  const streakSub =
    studyDaysStatus === "ready"
      ? `Active days this month: ${activeDaysThisMonth}/${monthDays}`
      : studyDaysStatus === "error"
        ? "Could not load — refresh the page"
        : "Same source as dashboard";

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 lg:gap-3">
        <StatCard label="Total RDM earned" value={rdm.toLocaleString()} sub="all time" valueClass="text-amber-400" />
        <StatCard label="Study streak" value={streakDisplay} sub={streakSub} />
        <StatCard label="DailyDose streak" value={String(dailyDoseStreak)} sub="Play · both domains" />
        <StatCard
          label="Active this month"
          value={studyDaysStatus === "ready" ? `${activeDaysThisMonth}/${monthDays}` : studyDaysStatus === "loading" || studyDaysStatus === "idle" ? "…" : "—"}
          sub="days with study time"
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Flame className="h-5 w-5 text-orange-400" />
          <h2 className="text-base font-black dark:text-white sm:text-lg">Activity streaks &amp; heatmap</h2>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-8">
          {/* Study streak — left column (above heatmap on small screens) */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-border pb-5 dark:border-white/10 lg:w-[min(100%,11.5rem)] lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-500">
              Study streak
            </p>
            <div className="flex items-center gap-2.5">
              <Flame className="h-9 w-9 shrink-0 text-orange-400 lg:h-10 lg:w-10" aria-hidden />
              <span className="text-4xl font-black tabular-nums leading-none tracking-tight text-amber-100 dark:text-amber-50 sm:text-[2.75rem]">
                {streakDisplay}
              </span>
            </div>
            <p className="max-w-[14rem] text-[11px] leading-snug text-muted-foreground dark:text-slate-400">
              {studyDaysStatus === "ready"
                ? studyStreak === 0
                  ? "No streak yet — same as home dashboard"
                  : studyStreak === 1
                    ? "day — same as home dashboard"
                    : "days — same as home dashboard"
                : studyDaysStatus === "error"
                  ? "Could not load"
                  : "Syncing…"}
            </p>
          </div>

          {/* Heatmap — right column */}
          <div className="min-w-0 w-full max-w-full lg:w-max lg:max-w-[min(100%,calc(100%-12rem))]">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground dark:text-slate-400">
              Last 28 days · weeks start Monday
            </p>
            <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-0 gap-2">
                {/* Day-of-week labels */}
                <div
                  className="flex shrink-0 flex-col justify-between gap-[3px] py-0.5 pr-0.5 text-[10px] leading-none text-muted-foreground dark:text-slate-500"
                  aria-hidden
                >
                  {WEEKDAY_LABELS_LEFT.map((lab, row) => (
                    <span
                      key={row}
                      className="flex h-[11px] items-center font-medium tabular-nums"
                      style={{ minHeight: 11 }}
                    >
                      {lab}
                    </span>
                  ))}
                </div>
                {/* Month ribbon */}
                <div className="flex flex-col gap-1">
                  <div className="flex gap-[3px] pl-0.5">
                    {weeks.map((week, wi) => {
                      const mon = format(week[0]!.date, "MMM");
                      const prevMon =
                        wi > 0 ? format(weeks[wi - 1]![0]!.date, "MMM") : null;
                      return (
                        <div
                          key={`wk-${wi}`}
                          className="flex w-[11px] shrink-0 justify-center sm:w-3"
                        >
                          <span className="text-[10px] font-medium tabular-nums text-muted-foreground dark:text-slate-500">
                            {wi === 0 || mon !== prevMon ? mon : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Dot grid: each column = one week, rows = Mon–Sun */}
                  <div
                    className="flex gap-[3px]"
                    role="img"
                    aria-label="Study activity map — red when under 10 minutes, greens for longer focus"
                  >
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[3px]">
                        {week.map((cell, di) => {
                          const isReady = studyDaysStatus === "ready";
                          const tip = !isReady
                            ? "Loading activity…"
                            : cell.level === "none"
                              ? `${format(cell.date, "EEE d MMM yyyy")} · outside selected range`
                              : `${format(cell.date, "EEE d MMM yyyy")} · ${formatPresenceMsForTooltip(cell.presenceMs)} · ${formatStudyMsForTooltip(cell.activeMs)}`;
                          return (
                            <div
                              key={`${wi}-${di}`}
                              className="h-[11px] w-[11px] shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/10 sm:h-3 sm:w-3"
                              style={{
                                backgroundColor: !isReady
                                  ? ACTIVITY_DOT_COLORS.none
                                  : ACTIVITY_DOT_COLORS[cell.level],
                              }}
                              title={tip}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground dark:text-slate-500">
              <span>Less</span>
              <span
                className="h-[11px] w-[11px] shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/10 sm:h-3 sm:w-3"
                style={{ backgroundColor: ACTIVITY_DOT_COLORS.inactive }}
                title="No activity or under 10 minutes"
              />
              <div className="flex gap-1">
                {(["l0", "l1", "l2"] as const).map((k) => (
                  <span
                    key={k}
                    className="h-[11px] w-[11px] shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/10 sm:h-3 sm:w-3"
                    style={{ backgroundColor: ACTIVITY_DOT_COLORS[k] }}
                  />
                ))}
              </div>
              <span>More</span>
              <span className="text-[10px] text-muted-foreground/80 dark:text-slate-600">
                · {studyDaysStatus === "ready" ? "Live data · matches dashboard study map" : "Loading activity…"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-black dark:text-white sm:text-lg">Recent RDM by activity</h2>
          </div>
          <p className="text-[10px] font-medium text-muted-foreground dark:text-slate-500">
            Last {rdmRecent?.windowDays ?? 28} days · refreshes when you return to this tab
          </p>
        </div>
        {rdmRecentStatus === "loading" || rdmRecentStatus === "idle" ? (
          <ActivityRow
            icon={<span className="text-slate-400">…</span>}
            title="Loading claims…"
            detail=""
            amount={null}
            loading
            errored={false}
          />
        ) : rdmRecentStatus === "error" ? (
          <ActivityRow
            icon={<span className="text-red-400">!</span>}
            title="Could not load RDM activity"
            detail="Try again later"
            amount={null}
            loading={false}
            errored
          />
        ) : rdmRecent && rdmRecent.recentClaims.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground dark:text-slate-500">
            No claims above 1 RDM in this window — micro-rewards still count toward your total below.
          </p>
        ) : (
          rdmRecent?.recentClaims.map((c) => (
            <ActivityRow
              key={c.key}
              icon={rdmCategoryIcon(c.category)}
              title={c.title}
              detail={c.detail}
              whenIso={c.at}
              amount={c.amount}
              loading={false}
              errored={false}
            />
          ))
        )}
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[11px] dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground dark:text-slate-500">
            Tracked in this window:{" "}
            <span className="font-bold tabular-nums text-emerald-400">
              {rdmRecentStatus === "ready" && rdmRecent
                ? `${rdmRecent.totalInWindow.toLocaleString()} RDM`
                : rdmRecentStatus === "error"
                  ? "—"
                  : "…"}
            </span>
            <span className="text-muted-foreground/80 dark:text-slate-600">
              {" "}
              · excludes spends & grants outside this list
            </span>
          </span>
          <span className="text-sm font-bold text-amber-400">Wallet balance {rdm.toLocaleString()} RDM</span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <LineChart className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-black dark:text-white sm:text-lg">Performance by subject</h2>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Based on your performance across various subject quizzes.
        </p>
        <BarRow label="Physics" pct={82} color="bg-blue-500" />
        <BarRow label="Maths" pct={78} color="bg-violet-500" />
        <BarRow label="Chemistry" pct={62} color="bg-amber-500" />
      </section>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
        <p className="mb-2 text-[11px] font-semibold text-muted-foreground dark:text-slate-400">
          Mock test average score per subject
        </p>
        <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground dark:text-slate-500">
          Library mocks only. We take your latest score on each paper and average them by subject—Physics, Maths, or
          Chemistry.
        </p>
        <BarRow
          label="Physics"
          pct={mockSubjectStatus === "ready" ? mockSubjectAverages?.physics.avg ?? null : null}
          color="bg-blue-500"
          loading={mockSubjectStatus === "loading" || mockSubjectStatus === "idle"}
        />
        <BarRow
          label="Maths"
          pct={mockSubjectStatus === "ready" ? mockSubjectAverages?.math.avg ?? null : null}
          color="bg-violet-500"
          loading={mockSubjectStatus === "loading" || mockSubjectStatus === "idle"}
        />
        <BarRow
          label="Chemistry"
          pct={mockSubjectStatus === "ready" ? mockSubjectAverages?.chemistry.avg ?? null : null}
          color="bg-amber-500"
          loading={mockSubjectStatus === "loading" || mockSubjectStatus === "idle"}
        />
        <p className="mt-2 text-[10px] text-muted-foreground/85 dark:text-slate-600">
          {mockSubjectStatus === "ready" && mockSubjectAverages
            ? `Papers in average: Physics ${mockSubjectAverages.physics.count}, Maths ${mockSubjectAverages.math.count}, Chemistry ${mockSubjectAverages.chemistry.count}.`
            : mockSubjectStatus === "error"
              ? "Could not load mock averages."
              : ""}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <ClipboardList className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-black dark:text-white sm:text-lg">Attendance, assignments &amp; study hours</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3">
          <StatCard
            label="No of classes joined"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? attendanceStats.classroomsJoined.toLocaleString()
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="when enrolled"
          />
          <StatCard
            label="No of Daily dose and fun brain streak"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? attendanceStats.dailyDoseDualStreak.toLocaleString()
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="Play streaks"
          />
          <StatCard
            label="Mocks attempted"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? attendanceStats.mocksAttempted.toLocaleString()
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="Testbee"
          />
          <StatCard
            label="Instacues reviewed"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? attendanceStats.instacueDwellEventsThisWeek.toLocaleString()
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="this week"
          />
          <StatCard
            label="Study hours"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? formatPlatformStudyHours(attendanceStats.studyMsTotal)
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="on platform"
          />
          <StatCard
            label="Assignments done"
            value={
              attendanceStatsStatus === "ready" && attendanceStats
                ? attendanceStats.assignmentTasksDone.toLocaleString()
                : attendanceStatsStatus === "error"
                  ? "—"
                  : "…"
            }
            sub="tasks marked in classes"
            valueClass="text-emerald-400"
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5 dark:bg-white/[0.04] sm:p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-lg font-black text-foreground dark:text-white sm:text-xl", valueClass)}>{value}</p>
      <p className="text-[10px] text-muted-foreground dark:text-slate-500">{sub}</p>
    </div>
  );
}

function formatRdmClaimWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function rdmCategoryIcon(category: RdmRecentClaimRow["category"]): ReactNode {
  switch (category) {
    case "gyan":
      return <span className="text-amber-300">?</span>;
    case "play":
      return <span className="text-lime-400">▶</span>;
    case "mocks":
      return <span className="text-blue-300">✎</span>;
    case "revision":
      return <span className="text-violet-300">★</span>;
    default:
      return <span className="text-slate-400">•</span>;
  }
}

function ActivityRow({
  icon,
  title,
  detail,
  whenIso,
  amount,
  loading,
  errored,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  whenIso?: string;
  amount: number | null;
  loading?: boolean;
  errored?: boolean;
}) {
  const right =
    errored ? "—" : loading || amount === null ? "…" : `+${amount.toLocaleString()}`;
  const when =
    whenIso && !loading && !errored ? formatRdmClaimWhen(whenIso) : "";
  return (
    <div className="flex items-center gap-2 border-b border-border py-2 last:border-0 dark:border-white/10 sm:gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 dark:bg-white/10">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground dark:text-slate-100">{title}</p>
        {detail ? <p className="text-[10px] text-muted-foreground dark:text-slate-500">{detail}</p> : null}
        {when ? <p className="text-[10px] tabular-nums text-slate-600 dark:text-slate-600">{when} IST</p> : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums text-xs font-bold",
          errored ? "text-muted-foreground" : "text-emerald-400"
        )}
      >
        {right}
      </span>
    </div>
  );
}

function BarRow({
  label,
  pct,
  color,
  loading,
}: {
  label: string;
  pct: number | null;
  color: string;
  loading?: boolean;
}) {
  const safe = pct === null || loading ? null : Math.min(100, Math.max(0, Math.round(pct)));
  const right =
    loading ? "…" : safe === null ? "—" : `${safe}%`;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs text-muted-foreground dark:text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all", safe === null ? "opacity-0" : color)}
          style={{ width: safe === null ? "0%" : `${safe}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums dark:text-slate-200">{right}</span>
    </div>
  );
}

function formatEdufundInr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

const EDUFUND_PANEL_ACCENTS = [
  {
    focus: "border-2 border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-950/35",
    done: "border border-emerald-500/35 bg-emerald-500/[0.07] dark:bg-emerald-950/25",
    bar: "[&>div]:bg-emerald-500",
    icon: "text-emerald-400",
  },
  {
    focus: "border-2 border-violet-500/45 bg-violet-500/[0.06] dark:bg-violet-950/20",
    done: "border border-violet-500/30 bg-violet-500/[0.05] dark:bg-violet-950/20",
    bar: "[&>div]:bg-violet-500",
    icon: "text-violet-400",
  },
  {
    focus: "border-2 border-sky-500/45 bg-sky-500/[0.06] dark:bg-sky-950/25",
    done: "border border-sky-500/35 bg-sky-500/[0.05] dark:bg-sky-950/30",
    bar: "[&>div]:bg-sky-500",
    icon: "text-sky-400",
  },
  {
    focus: "border-2 border-amber-500/45 bg-amber-500/[0.06] dark:bg-amber-950/20",
    done: "border border-amber-500/40 bg-amber-500/[0.06] dark:bg-amber-950/20",
    bar: "[&>div]:bg-amber-500",
    icon: "text-amber-400",
  },
  {
    focus: "border-2 border-orange-500/45 bg-orange-500/[0.06] dark:bg-orange-950/25",
    done: "border border-orange-500/40 bg-orange-500/[0.06] dark:bg-orange-950/25",
    bar: "[&>div]:bg-orange-500",
    icon: "text-orange-400",
  },
] as const;

/** EduFund tiers &amp; partners — navigates to full EduFund flow. Thresholds match `EDUFUND_RDM_GATES`. */
export function StudentProfileEduFundPanel({ profile }: { profile: Profile }) {
  const rdm = Math.max(0, profile.rdm ?? 0);
  const gates = EDUFUND_RDM_GATES;
  const focusIndex = gates.findIndex((g) => rdm < g.need);

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Heart className="h-5 w-5 text-rose-400" />
          <h2 className="text-base font-black dark:text-white sm:text-lg">EduFund eligibility &amp; funder visibility</h2>
        </div>
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] leading-relaxed text-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-950/40">
          Your activity, academic profile, and achievements can be compiled into a portfolio for partner NGOs when you
          apply for a grant. Completing your academic record and achievements raises your eligibility score. Progress below
          uses your <span className="font-semibold text-emerald-50">wallet RDM balance</span> (same numbers as the rest of
          your profile).
        </div>
        <div className="space-y-3">
          {gates.map((gate, i) => {
            const accent = EDUFUND_PANEL_ACCENTS[i] ?? EDUFUND_PANEL_ACCENTS[0];
            const prev = i > 0 ? gates[i - 1] : null;
            const done = rdm >= gate.need;
            const waitingPrior = prev != null && rdm < prev.need;
            const isFocus = focusIndex === i;
            const pct = Math.min(100, Math.round((rdm / gate.need) * 100));
            const remaining = Math.max(0, gate.need - rdm);
            const nextGate = gates[i + 1];

            const shellClass = cn(
              "rounded-xl border p-3",
              isFocus ? accent.focus : done ? accent.done : "border border-border dark:border-white/10"
            );

            return (
              <div key={gate.name} className={shellClass}>
                <div className="flex flex-wrap items-center gap-2">
                  <Award className={cn("h-5 w-5 shrink-0", accent.icon)} />
                  <span className="font-bold text-foreground dark:text-white">
                    {i + 1} · {gate.name}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-200/90 dark:text-emerald-200/80">
                    {formatEdufundInr(gate.unlockInrAmount)} unlocked
                  </span>
                  {waitingPrior ? (
                    <span className="ml-auto text-[11px] font-medium text-muted-foreground dark:text-slate-500">
                      After {prev.name}
                    </span>
                  ) : done ? (
                    <span className="ml-auto text-[11px] font-semibold text-emerald-500 dark:text-emerald-400">
                      Threshold met
                    </span>
                  ) : (
                    <span className="ml-auto text-[11px] font-semibold text-amber-500">
                      {remaining.toLocaleString()} RDM to go
                    </span>
                  )}
                </div>

                {waitingPrior ? (
                  <p className="mt-2 text-[11px] text-muted-foreground dark:text-slate-400">
                    Reach {prev!.name} ({prev!.need.toLocaleString()} RDM in wallet) to show progress toward {gate.name} (
                    {gate.need.toLocaleString()} RDM · {formatEdufundInr(gate.unlockInrAmount)}).
                  </p>
                ) : done ? (
                  <p className="mt-2 text-[11px] text-muted-foreground dark:text-slate-400">
                    {nextGate
                      ? `Tier unlocked. Next milestone: ${nextGate.name} (${nextGate.need.toLocaleString()} RDM · ${formatEdufundInr(nextGate.unlockInrAmount)}).`
                      : "Highest EduFund tier shown here — see EduFund for live programme rules."}
                  </p>
                ) : (
                  <>
                    <Progress value={pct} className={cn("mt-2 h-1.5", accent.bar)} />
                    <p className="mt-1 text-[10px] text-muted-foreground dark:text-slate-500">
                      {rdm.toLocaleString()} of {gate.need.toLocaleString()} RDM in your wallet
                    </p>
                  </>
                )}

                {i === 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
                    Build RDM and keep a consistent study streak — Sprout opens EduFund proposal tracks aligned with your
                    tier.
                  </p>
                ) : i === 1 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
                    Higher tiers unlock larger proposal ceilings — see{" "}
                    <Link href="/edufund" className="font-bold text-emerald-400 underline-offset-2 hover:underline">
                      EduFund
                    </Link>{" "}
                    for the full table.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
                    Full consideration typically combines wallet RDM with verified marksheets, achievements, and sustained
                    activity.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Building2 className="h-5 w-5 text-blue-400" />
          <h2 className="text-base font-black dark:text-white sm:text-lg">Partner NGOs &amp; philanthropists</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">EduFund</span>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
          Partner organisations receive your verified portfolio when you apply and consent to share. Your data is not
          sold or shared without that step.
        </p>
        <div className="rounded-xl border border-dashed border-border bg-muted/25 py-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <p className="text-sm font-black tracking-tight text-foreground dark:text-white">Coming soon</p>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground dark:text-slate-400">
            We’re not listing partner NGOs or funders here yet. This section will show trusted partners when the programme
            is live.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-100 dark:bg-amber-950/35">
          <Link href="/edufund" className="inline-flex items-center font-bold text-amber-200 underline-offset-2 hover:underline">
            Open EduFund →
          </Link>{" "}
          to apply, track RDM, and see live eligibility requirements.
        </div>
      </section>
    </div>
  );
}
