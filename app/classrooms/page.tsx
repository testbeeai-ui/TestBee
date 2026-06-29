"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Plus,
  Users,
  Copy,
  BookOpen,
  School,
  Loader2,
  RotateCw,
  Check,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  UserRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StarRatingBadge } from "@/components/StarRating";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  PREP_CLASSES_ONBOARDING_QUERY,
  shouldShowPrepClassesPickClassGuide,
} from "@/lib/onboarding/prepClassesOnboardingFlow";
import { OnboardingClickHerePointer } from "@/components/onboarding/OnboardingClickHerePointer";
import { OnboardingFlowHint } from "@/components/onboarding/OnboardingFlowHint";
import { cn } from "@/lib/utils";
import {
  maybeMarkPrepClassesOnboardingFromClassroomsVisit,
  ONBOARDING_PROGRESS_EVENT,
} from "@/lib/subscription/freeTrialClient";
import { formatTeachingLevelsForDisplay } from "@/lib/profile/profileTeacherOptions";

interface Classroom {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  description: string | null;
  join_code: string;
  teacher_id: string;
  created_at: string;
  type: string;
}

interface ExploreClassroom {
  id: string;
  name: string;
  subject: string | null;
  section: string | null;
  description: string | null;
  type: string;
  teacher_id: string;
  teacher_name?: string | null;
  teacher_visibility?: string | null;
  teacher_avatar_url?: string | null;
  teacher_bio?: string | null;
  teacher_subjects?: string[] | null;
  teacher_exam_tags?: string[] | null;
  teacher_teaching_levels?: number[] | null;
  teacher_location?: string | null;
  teacher_qualification?: string | null;
  teacher_experience?: string | null;
  teacher_verification_status?: string | null;
  avg_rating?: number;
  review_count?: number;
}

/** Normalized text from class fields for client-side filter/search (lowercase). */
function exploreHaystack(c: ExploreClassroom): string {
  return [
    c.name,
    c.subject,
    c.section,
    c.description,
    c.teacher_name,
    ...(c.teacher_subjects ?? []),
    ...(c.teacher_exam_tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function shortProfileText(text?: string | null, max = 110): string | null {
  const cleaned = text?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function TeacherHoverProfile({ classroom }: { classroom: ExploreClassroom }) {
  const teacherName = classroom.teacher_name?.trim() || "Teacher";
  const subjects = classroom.teacher_subjects?.filter(Boolean) ?? [];
  const exams = classroom.teacher_exam_tags?.filter(Boolean) ?? [];
  const levels = formatTeachingLevelsForDisplay(classroom.teacher_teaching_levels ?? null);
  const profileLine =
    shortProfileText(classroom.teacher_bio) ??
    shortProfileText(classroom.teacher_qualification) ??
    shortProfileText(classroom.teacher_experience) ??
    "Basic teacher profile details are not filled yet.";
  const verified = classroom.teacher_verification_status === "approved";
  const infoBlocks = [
    subjects.length ? { label: "Subjects", value: subjects.join(", ") } : null,
    exams.length ? { label: "Exam focus", value: exams.join(", ") } : null,
    levels !== "—" ? { label: "Teaches", value: levels } : null,
    classroom.teacher_location ? { label: "Location", value: classroom.teacher_location } : null,
    classroom.teacher_qualification
      ? { label: "Qualification", value: classroom.teacher_qualification }
      : null,
    classroom.teacher_experience ? { label: "Experience", value: classroom.teacher_experience } : null,
    classroom.review_count && classroom.review_count > 0
      ? {
          label: "Class rating",
          value: `${(classroom.avg_rating ?? 0).toFixed(1)}★ · ${classroom.review_count} review${
            classroom.review_count === 1 ? "" : "s"
          }`,
        }
      : { label: "Class rating", value: "No reviews yet" },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <div className="group/teacher absolute right-4 top-4 z-10">
      <button
        type="button"
        aria-label={`Preview teacher profile for ${teacherName}`}
        className="inline-flex h-9 w-9 cursor-help items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-sm transition hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover/teacher:opacity-0 group-focus-within/teacher:opacity-0"
      >
        <UserRound className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 hidden w-80 -translate-y-1/2 rounded-2xl border border-border bg-popover p-4 text-left text-popover-foreground shadow-2xl group-hover/teacher:block group-focus-within/teacher:block">
        <div className="border-b border-border/60 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold text-foreground">{teacherName}</div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Teacher profile
            </p>
          </div>
          {verified ? (
            <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              Verified
            </span>
          ) : null}
        </div>
        {levels !== "—" ? (
          <div className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {levels}
          </div>
        ) : null}
        </div>

        <p className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          {profileLine}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {infoBlocks.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/60 bg-background/70 p-2.5"
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 text-xs font-semibold leading-snug text-foreground/90">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Quick filters for Explore — matches against name, subject, section, and description.
 * (NEET is intentionally omitted from this list per product direction.)
 */
const EXPLORE_CLASS_FILTERS: { id: string; label: string; match: (hay: string) => boolean }[] = [
  {
    id: "puc-1",
    label: "PUC-1",
    match: (hay) =>
      /\bpuc[\s_-]?1\b/.test(hay) ||
      hay.includes("1st puc") ||
      hay.includes("first puc") ||
      hay.includes("i puc"),
  },
  {
    id: "puc-2",
    label: "PUC-2",
    match: (hay) =>
      /\bpuc[\s_-]?2\b/.test(hay) ||
      hay.includes("2nd puc") ||
      hay.includes("second puc") ||
      hay.includes("ii puc"),
  },
  {
    id: "physics",
    label: "Physics",
    match: (hay) => hay.includes("physics") || /\bphy\b/.test(hay),
  },
  {
    id: "chemistry",
    label: "Chemistry",
    match: (hay) => hay.includes("chemistry") || /\bchem\b/.test(hay),
  },
  {
    id: "mathematics",
    label: "Mathematics",
    match: (hay) => hay.includes("mathematics") || hay.includes("maths") || /\bmath\b/.test(hay),
  },
  {
    id: "pcm",
    label: "PCM",
    match: (hay) =>
      hay.includes("pcm") ||
      (hay.includes("physics") &&
        (hay.includes("chemistry") || hay.includes("chem")) &&
        (hay.includes("math") || hay.includes("mathematics") || hay.includes("maths"))),
  },
  {
    id: "cbse",
    label: "CBSE",
    match: (hay) => hay.includes("cbse"),
  },
  {
    id: "jee",
    label: "JEE",
    match: (hay) => hay.includes("jee"),
  },
  {
    id: "kcet",
    label: "KCET",
    match: (hay) => hay.includes("kcet"),
  },
];

/** Visual groups only — same AND logic as selecting any combination of tags. */
const EXPLORE_FILTER_GROUPS: { title: string; filterIds: string[] }[] = [
  { title: "Grade / year", filterIds: ["puc-1", "puc-2"] },
  { title: "Subjects", filterIds: ["physics", "chemistry", "mathematics"] },
  { title: "Combo", filterIds: ["pcm"] },
  { title: "Board & exams", filterIds: ["cbse", "jee", "kcet"] },
];

const QUICK_FILTERS_EXPANDED_STORAGE_KEY = "testbee:classrooms-explore-quick-filters-expanded";

function ExploreClassesSection({
  exploreClassrooms,
  exploreLoading,
  myRequestMap,
  myMemberClassroomIds,
  requestingId,
  onRequestJoin,
  onOpenClass,
  onRefreshStatus,
  sectionTitle = "Explore classes",
  sectionSubtitle = "Browse classes from teachers and express interest. You will be added once the teacher approves.",
  emptyStateTitle = "No classes to explore yet",
  emptyStateSubtitle = "Teachers with public profiles will show their classes here. Check back later or join with a code from your teacher.",
}: {
  exploreClassrooms: ExploreClassroom[];
  exploreLoading: boolean;
  myRequestMap: Record<string, string>;
  myMemberClassroomIds: Set<string>;
  requestingId: string | null;
  withdrawingId?: string | null;
  onRequestJoin: (id: string) => void;
  onWithdrawRequest?: (classroomId: string) => void;
  onOpenClass: (id: string) => void;
  onRefreshStatus?: () => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
}) {
  const [exploreSearch, setExploreSearch] = useState("");
  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([]);
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_FILTERS_EXPANDED_STORAGE_KEY);
      if (raw === "false") setQuickFiltersOpen(false);
      if (raw === "true") setQuickFiltersOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleQuickFiltersOpen = useCallback(() => {
    setQuickFiltersOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(QUICK_FILTERS_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const filteredExploreClassrooms = useMemo(() => {
    const q = exploreSearch.trim().toLowerCase();
    return exploreClassrooms.filter((c) => {
      const hay = exploreHaystack(c);
      if (q && !hay.includes(q)) return false;
      for (const id of selectedFilterIds) {
        const def = EXPLORE_CLASS_FILTERS.find((f) => f.id === id);
        if (def && !def.match(hay)) return false;
      }
      return true;
    });
  }, [exploreClassrooms, exploreSearch, selectedFilterIds]);

  const hasActiveFilters = exploreSearch.trim().length > 0 || selectedFilterIds.length > 0;

  const clearExploreFilters = () => {
    setExploreSearch("");
    setSelectedFilterIds([]);
  };

  const toggleExploreFilter = (id: string) => {
    setSelectedFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <School className="w-5 h-5 text-primary" />
            {sectionTitle}
          </h2>
          {onRefreshStatus && (
            <button
              type="button"
              onClick={onRefreshStatus}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" /> Refresh status
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{sectionSubtitle}</p>
      </div>
      {exploreLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : exploreClassrooms.length === 0 ? (
        <div className="text-center py-12 edu-card p-8">
          <School className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-display text-lg text-foreground mb-1">{emptyStateTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyStateSubtitle}</p>
        </div>
      ) : (
        <>
          <div className="edu-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1 min-w-0 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search name, subject, board, exam…"
                  value={exploreSearch}
                  onChange={(e) => setExploreSearch(e.target.value)}
                  className="pl-9 rounded-xl h-10 bg-background"
                  aria-label="Search classes"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-xl font-bold text-muted-foreground"
                  onClick={clearExploreFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
              <button
                type="button"
                id="explore-quick-filters-trigger"
                aria-expanded={quickFiltersOpen}
                aria-controls="explore-quick-filters-panel"
                onClick={toggleQuickFiltersOpen}
                className={cn(
                  "flex w-full items-center justify-between gap-3 text-left",
                  "px-3 py-3 sm:px-4 sm:py-3.5 transition-colors",
                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
                  <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Quick filters
                  </span>
                  {selectedFilterIds.length > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
                      {selectedFilterIds.length} selected
                    </span>
                  ) : null}
                  {!quickFiltersOpen && (
                    <span className="hidden sm:inline text-[11px] text-muted-foreground font-medium truncate">
                      Tap to expand and narrow results
                    </span>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                  {quickFiltersOpen ? (
                    <>
                      Hide
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </>
                  ) : (
                    <>
                      Show
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </span>
              </button>

              {quickFiltersOpen ? (
                <div
                  id="explore-quick-filters-panel"
                  role="region"
                  aria-labelledby="explore-quick-filters-trigger"
                  className="border-t border-border/60 px-3 pb-3 pt-0 sm:px-4 sm:pb-4 space-y-4"
                >
                  <p className="text-[11px] text-muted-foreground leading-snug max-w-xl pt-3">
                    Tap any tag to add or remove it.{" "}
                    <span className="font-semibold text-foreground/90">
                      All selected tags apply together
                    </span>{" "}
                    (class text must match each one — like narrowing down step by step).
                  </p>

                  <div className="space-y-3.5">
                    {EXPLORE_FILTER_GROUPS.map((group) => (
                      <div key={group.title}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90 mb-2">
                          {group.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.filterIds.map((fid) => {
                            const f = EXPLORE_CLASS_FILTERS.find((x) => x.id === fid);
                            if (!f) return null;
                            const on = selectedFilterIds.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                type="button"
                                aria-pressed={on}
                                title={on ? "Remove filter" : "Add filter"}
                                onClick={() => toggleExploreFilter(f.id)}
                                className={cn(
                                  "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all min-h-[42px] sm:min-h-[40px]",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-1 ring-primary/30"
                                    : "border-border/80 bg-background/80 text-muted-foreground hover:border-primary/40 hover:bg-muted/60 hover:text-foreground active:scale-[0.98]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                                    on ? "border-white/40 bg-white/20" : "border-border bg-muted/50"
                                  )}
                                  aria-hidden
                                >
                                  {on ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                                </span>
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {filteredExploreClassrooms.length === 0 ? (
            <div className="text-center py-12 edu-card p-8 rounded-2xl border border-dashed border-border">
              <School className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="font-display text-lg text-foreground mb-1">No matching classes</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Try different keywords or quick filters. Teachers label classes in the title,
                subject, section, or description — matching is based on those fields.
              </p>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-xl font-bold"
                  onClick={clearExploreFilters}
                >
                  Clear search and filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredExploreClassrooms.map((c) => {
                const isMember = myMemberClassroomIds.has(c.id);
                const requestStatus = myRequestMap[c.id];
                return (
                  <motion.div
                    key={c.id}
                    layout
                    className="edu-card relative p-5 pr-14 rounded-2xl border border-border hover:border-primary/30 hover:shadow-md transition-all flex flex-col min-h-[200px]"
                  >
                    {c.teacher_name ? <TeacherHoverProfile classroom={c} /> : null}
                    <div className="flex-1 min-h-0 flex flex-col">
                      <h3 className="font-extrabold text-foreground text-base line-clamp-2">
                        {c.name}
                      </h3>
                      {c.subject && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {c.subject}
                        </p>
                      )}
                      {c.teacher_name && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          by {c.teacher_name}
                        </p>
                      )}
                      <div className="mt-1.5">
                        <StarRatingBadge rating={c.avg_rating ?? 0} count={c.review_count ?? 0} />
                      </div>
                      {c.section && (
                        <span className="edu-chip bg-muted text-muted-foreground text-xs mt-2 inline-block w-fit">
                          {c.section}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 mt-4 pt-3 border-t border-border/50">
                      {isMember ? (
                        <Button
                          onClick={() => onOpenClass(c.id)}
                          size="sm"
                          className="w-full rounded-xl font-bold gap-2"
                        >
                          Open class
                        </Button>
                      ) : requestStatus === "pending" ? (
                        <Button
                          type="button"
                          disabled
                          size="sm"
                          variant="secondary"
                          className="w-full rounded-xl font-bold gap-2 border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        >
                          <Check className="w-4 h-4 shrink-0" />
                          Sent
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            onClick={() => onRequestJoin(c.id)}
                            disabled={requestingId === c.id}
                            size="sm"
                            className="w-full rounded-xl font-bold gap-2 edu-btn-primary"
                          >
                            {requestingId === c.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                Sending…
                              </>
                            ) : (
                              "Express interest"
                            )}
                          </Button>
                          {requestStatus === "rejected" ? (
                            <p className="text-xs text-center text-muted-foreground mt-2">
                              Your previous request was not approved. You can send interest again.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Classrooms = () => {
  const { user, profile, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [exploreClassrooms, setExploreClassrooms] = useState<ExploreClassroom[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [myRequestMap, setMyRequestMap] = useState<Record<string, string>>({});
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const isTeacher = profile?.role === "teacher";
  const prepClassesOnboardingParam = searchParams.get(PREP_CLASSES_ONBOARDING_QUERY);
  const [showPickClassGuide, setShowPickClassGuide] = useState(false);

  useEffect(() => {
    const syncGuide = () => setShowPickClassGuide(shouldShowPrepClassesPickClassGuide());
    syncGuide();
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, syncGuide);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, syncGuide);
  }, []);

  useEffect(() => {
    if (prepClassesOnboardingParam !== "1") return;
    maybeMarkPrepClassesOnboardingFromClassroomsVisit();
    router.replace(pathname);
  }, [prepClassesOnboardingParam, pathname, router]);

  const fetchClassrooms = useCallback(async () => {
    await Promise.resolve();
    if (!user) return;
    setLoading(true);
    if (isTeacher) {
      const { data } = await supabase
        .from("classrooms")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      setClassrooms((data as Classroom[]) || []);
    } else {
      const { data: memberships } = await supabase
        .from("classroom_members")
        .select("classroom_id")
        .eq("user_id", user.id);
      if (memberships && memberships.length > 0) {
        const ids = memberships.map((m) => m.classroom_id);
        const { data } = await supabase
          .from("classrooms")
          .select("*")
          .in("id", ids)
          .order("created_at", { ascending: false });
        setClassrooms((data as Classroom[]) || []);
      } else {
        setClassrooms([]);
      }
    }
    setLoading(false);
  }, [user, isTeacher]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchClassrooms();
    });
  }, [fetchClassrooms]);

  const refetchExploreClassrooms = useCallback(
    async (opts?: { silent?: boolean; toastOnFailure?: boolean }) => {
      const silent = opts?.silent ?? false;
      const toastOnFailure = opts?.toastOnFailure ?? false;
      if (!user?.id) return;
      if (!silent) setExploreLoading(true);

      let accessToken = session?.access_token;
      if (!accessToken) {
        accessToken = (await safeGetSession()).session?.access_token;
      }
      const res = await fetch("/api/classrooms/explore", {
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV === "development") {
          console.error("[classrooms/explore]", res.status, body);
        }
        if (toastOnFailure) {
          toast({
            title: "Could not load classes to explore",
            description: typeof body?.error === "string" ? body.error : "Try again in a moment.",
            variant: "destructive",
          });
        }
        setExploreClassrooms([]);
        if (!silent) setExploreLoading(false);
        return;
      }

      const payload = (await res.json()) as { classrooms?: ExploreClassroom[] };
      const withTeacher = payload.classrooms ?? [];
      setExploreClassrooms(withTeacher);

      const { data: requests } = await supabase
        .from("classroom_join_requests")
        .select("classroom_id, status")
        .eq("user_id", user.id);
      const map: Record<string, string> = {};
      (requests || []).forEach((r: { classroom_id: string; status: string }) => {
        map[r.classroom_id] = r.status;
      });
      setMyRequestMap(map);

      if (!silent) setExploreLoading(false);
    },
    [session?.access_token, toast, user]
  );

  useEffect(() => {
    if (!user?.id) return;
    queueMicrotask(() => {
      void refetchExploreClassrooms({ toastOnFailure: true });
    });
  }, [refetchExploreClassrooms, user?.id]);

  const refetchMyRequestMap = useCallback(async () => {
    if (!user?.id) return;
    const { data: requests } = await supabase
      .from("classroom_join_requests")
      .select("classroom_id, status")
      .eq("user_id", user.id);
    const map: Record<string, string> = {};
    (requests || []).forEach((r: { classroom_id: string; status: string }) => {
      map[r.classroom_id] = r.status;
    });
    setMyRequestMap(map);
  }, [user]);

  useEffect(() => {
    if (pathname === "/classrooms" && user?.id) {
      queueMicrotask(() => {
        void refetchExploreClassrooms({ silent: true });
      });
    }
  }, [pathname, refetchExploreClassrooms, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const onVisible = () => {
      void refetchExploreClassrooms({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id, refetchExploreClassrooms]);

  const handleRequestJoin = async (classroomId: string) => {
    if (!user?.id) return;
    setRequestingId(classroomId);
    const { error } = await supabase
      .from("classroom_join_requests")
      .insert({ classroom_id: classroomId, user_id: user.id, status: "pending" });
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("classroom_join_requests")
          .select("status")
          .eq("classroom_id", classroomId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing?.status === "rejected") {
          const { error: updateErr } = await supabase
            .from("classroom_join_requests")
            .update({ status: "pending", responded_at: null, responded_by: null })
            .eq("classroom_id", classroomId)
            .eq("user_id", user.id)
            .eq("status", "rejected");
          if (!updateErr) {
            await refetchMyRequestMap();
            toast({
              title: "Re-apply sent!",
              description: "Your request has been sent again. The teacher will review it.",
            });
          } else {
            toast({ title: "Error", description: updateErr.message, variant: "destructive" });
          }
        } else {
          await refetchMyRequestMap();
          toast({
            title: "Your request has been sent",
            description: "Status: Pending. The teacher will review it.",
          });
        }
      } else {
        toast({ title: "Request failed", description: error.message, variant: "destructive" });
      }
      setRequestingId(null);
      return;
    }
    await refetchMyRequestMap();
    toast({ title: "Request sent!", description: "The teacher will review your request to join." });
    setRequestingId(null);
  };

  const handleWithdrawRequest = async (classroomId: string) => {
    if (!user?.id) return;
    setWithdrawingId(classroomId);
    const { error } = await supabase
      .from("classroom_join_requests")
      .delete()
      .eq("classroom_id", classroomId)
      .eq("user_id", user.id);
    if (error) {
      toast({
        title: "Could not cancel request",
        description: error.message,
        variant: "destructive",
      });
    } else {
      await refetchMyRequestMap();
      toast({ title: "Request cancelled", description: "You can request to join again anytime." });
    }
    setWithdrawingId(null);
  };

  const createClassroom = async () => {
    if (!newName.trim() || !user) return;
    const { data: verifyRow } = await (
      supabase as unknown as {
        from: (name: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string
            ) => {
              maybeSingle: () => Promise<{ data: { verification_status?: string | null } | null }>;
            };
          };
        };
      }
    )
      .from("teacher_profile_details")
      .select("verification_status")
      .eq("teacher_id", user.id)
      .maybeSingle();
    const vStatus = (verifyRow?.verification_status as string | undefined) ?? "unverified";
    if (vStatus !== "approved") {
      toast({
        title: "Teacher verification required",
        description:
          "Complete verification under Teacher Portal → Profile. An admin must approve your account before you can create classes.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("classrooms").insert({
      teacher_id: user.id,
      name: newName.trim(),
      subject: newSubject.trim() || null,
      section: newSection.trim() || null,
      description: newDescription.trim() || null,
      type: "esm_only",
      google_classroom_id: null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: newClass } = await supabase
      .from("classrooms")
      .select("id")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newClass) {
      await supabase
        .from("classroom_members")
        .insert({ classroom_id: newClass.id, user_id: user.id, role: "teacher" });
    }

    resetDialog();
    fetchClassrooms();
    toast({ title: "Classroom created! 🎉" });
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setNewName("");
    setNewSubject("");
    setNewSection("");
    setNewDescription("");
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    const { data: classroom } = await supabase
      .from("classrooms")
      .select("id")
      .eq("join_code", joinCode.trim())
      .maybeSingle();
    if (!classroom) {
      toast({
        title: "Invalid code",
        description: "No classroom found with that code.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("classroom_join_requests").insert({
      classroom_id: classroom.id,
      user_id: user.id,
      status: "pending",
    });
    if (error) {
      if (error.code === "23505") toast({ title: "Request already sent!" });
      else toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setJoinDialogOpen(false);
    setJoinCode("");
    fetchClassrooms();
    toast({ title: "Request sent", description: "The teacher will approve you soon." });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="edu-page-title">{isTeacher ? "My Classrooms" : "Classrooms"}</h1>
              <p className="edu-page-desc">
                {isTeacher ? "Manage your classes and students" : "Your enrolled classes"}
              </p>
              {isTeacher && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your classes appear in Explore for students{" "}
                  {profile?.visibility === "invite_only"
                    ? "only when your profile is Public — set it in "
                    : "— to hide them, set "}
                  <button
                    type="button"
                    onClick={() => router.push("/profile")}
                    className="text-primary font-bold underline hover:no-underline"
                  >
                    Profile
                  </button>
                  {profile?.visibility === "invite_only" ? "." : " to Invite-only."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!isTeacher && (
                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl font-bold">
                      Join Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-display">Join a Classroom</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <Input
                        placeholder="Enter 6-character join code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        className="rounded-xl h-12 text-center text-lg tracking-widest font-bold"
                        maxLength={16}
                      />
                      <Button
                        onClick={handleJoin}
                        className="w-full rounded-xl edu-btn-primary h-12 font-extrabold"
                      >
                        Join 🚀
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isTeacher && (
                <Dialog
                  open={dialogOpen}
                  onOpenChange={(v) => {
                    if (!v) resetDialog();
                    else setDialogOpen(true);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="rounded-xl edu-btn-primary font-bold gap-2">
                      <Plus className="w-4 h-4" /> New Classroom
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-display">Create Classroom</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <Input
                        placeholder="Class name (e.g. JEE Physics – Mechanics)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="rounded-xl h-12"
                      />
                      <Input
                        placeholder="Subject (optional)"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        className="rounded-xl"
                      />
                      <Input
                        placeholder="Section (optional)"
                        value={newSection}
                        onChange={(e) => setNewSection(e.target.value)}
                        className="rounded-xl"
                      />
                      <Textarea
                        placeholder="Description (optional)"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="rounded-xl"
                      />
                      <Button
                        onClick={createClassroom}
                        disabled={!newName.trim()}
                        className="w-full rounded-xl edu-btn-primary h-12 font-extrabold"
                      >
                        Create 🎯
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="edu-card p-6 h-40 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : classrooms.length > 0 ? (
            <div className="space-y-6">
              {showPickClassGuide ? (
                <p className="text-sm text-muted-foreground">
                  Site tour: tap an enrolled class below —{" "}
                  <OnboardingFlowHint className="normal-case tracking-normal">
                    open a class card
                  </OnboardingFlowHint>
                </p>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classrooms.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => router.push(`/classroom/${c.id}`)}
                    className={cn(
                      "edu-card relative p-4 cursor-pointer hover:border-primary/30 transition-all group sm:p-6",
                      showPickClassGuide &&
                        i === 0 &&
                        "border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.25)] ring-1 ring-violet-500/40"
                    )}
                  >
                    {showPickClassGuide && i === 0 ? (
                      <div className="absolute -top-10 right-2 z-10 pointer-events-none">
                        <OnboardingClickHerePointer label="Tap class" variant="violet" />
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between mb-2.5 sm:mb-3">
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground text-lg shadow-md sm:w-12 sm:h-12 sm:rounded-2xl sm:text-xl">
                        {c.type === "google_linked" ? "🔗" : "📚"}
                      </div>
                      {isTeacher && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(c.join_code);
                            toast({ title: "Code copied!" });
                          }}
                          className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 hover:bg-muted/80 sm:text-xs sm:px-2.5 sm:py-1"
                        >
                          <Copy className="w-3 h-3" /> {c.join_code}
                        </button>
                      )}
                    </div>
                    <h3 className="font-extrabold text-foreground text-base group-hover:text-primary transition-colors sm:text-lg">
                      {c.name}
                    </h3>
                    {c.subject && (
                      <p className="text-xs text-muted-foreground mt-0.5 sm:text-sm">{c.subject}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 sm:gap-2 sm:mt-2">
                      {c.section && (
                        <span className="edu-chip bg-muted text-muted-foreground text-[11px] sm:text-xs">
                          {c.section}
                        </span>
                      )}
                      <span className="edu-chip bg-muted text-muted-foreground text-[10px]">
                        {c.type === "google_linked" ? "Google" : "ESM"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground sm:mt-3 sm:text-xs">
                      <Users className="w-3.5 h-3.5" /> View class
                    </div>
                  </motion.div>
                ))}
              </div>
              <ExploreClassesSection
                sectionTitle="Explore more classes"
                sectionSubtitle="Discover other teacher batches you are not enrolled in yet."
                emptyStateTitle="No other public classes right now"
                emptyStateSubtitle="When teachers publish a class, it will show up here. You can also join with a code from your teacher."
                exploreClassrooms={exploreClassrooms.filter(
                  (ec) => !classrooms.some((my) => my.id === ec.id)
                )}
                exploreLoading={exploreLoading}
                myRequestMap={myRequestMap}
                myMemberClassroomIds={new Set(classrooms.map((c) => c.id))}
                requestingId={requestingId}
                withdrawingId={withdrawingId}
                onRequestJoin={handleRequestJoin}
                onWithdrawRequest={handleWithdrawRequest}
                onOpenClass={(id) => router.push(`/classroom/${id}`)}
                onRefreshStatus={async () => {
                  await refetchExploreClassrooms({ silent: false, toastOnFailure: true });
                  await refetchMyRequestMap();
                  toast({ title: "Status updated" });
                }}
              />
            </div>
          ) : !isTeacher ? (
            <ExploreClassesSection
              exploreClassrooms={exploreClassrooms}
              exploreLoading={exploreLoading}
              myRequestMap={myRequestMap}
              myMemberClassroomIds={new Set()}
              requestingId={requestingId}
              withdrawingId={withdrawingId}
              onRequestJoin={handleRequestJoin}
              onWithdrawRequest={handleWithdrawRequest}
              onOpenClass={(id) => router.push(`/classroom/${id}`)}
              sectionSubtitle="Browse classes below and express interest, or use a code from your teacher with the button above."
              onRefreshStatus={async () => {
                await refetchExploreClassrooms({ silent: false, toastOnFailure: true });
                await refetchMyRequestMap();
                toast({ title: "Status updated" });
              }}
            />
          ) : (
            <div className="space-y-10">
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-1">
                  No classrooms you teach yet
                </h3>
                <p className="text-muted-foreground text-sm">
                  Create a class with New Classroom, or browse public classes below.
                </p>
              </div>
              <ExploreClassesSection
                exploreClassrooms={exploreClassrooms}
                exploreLoading={exploreLoading}
                myRequestMap={myRequestMap}
                myMemberClassroomIds={new Set()}
                requestingId={requestingId}
                withdrawingId={withdrawingId}
                onRequestJoin={handleRequestJoin}
                onWithdrawRequest={handleWithdrawRequest}
                onOpenClass={(id) => router.push(`/classroom/${id}`)}
                onRefreshStatus={async () => {
                  await refetchExploreClassrooms({ silent: false, toastOnFailure: true });
                  await refetchMyRequestMap();
                  toast({ title: "Status updated" });
                }}
                emptyStateTitle="No public classes to show"
                emptyStateSubtitle="Tip: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the dev server so this list can read classrooms when RLS blocks the anon client."
              />
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default function ClassroomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Classrooms />
    </Suspense>
  );
}
