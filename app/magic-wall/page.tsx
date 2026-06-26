"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { useUserStore } from "@/store/useUserStore";
import type { Board, ClassLevel, ExamType, Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchMagicWallBasket,
  type MagicWallBasketInsert,
  type MagicWallBasketItem,
  type MagicWallUsage,
  upsertMagicWallBasketItems,
  removeMagicWallBasketItems,
  makeTopicKey,
} from "@/lib/templates/magicWallBasketService";
import { formatMagicWallPeriodEndLocal } from "@/lib/subscription/magicWallQuota";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";
import {
  BookOpen,
  Filter,
  History,
  Loader2,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  appendQueryParams,
  buildTopicOverviewPath,
  type DifficultyLevel,
} from "@/lib/curriculum/topicRoutes";
import type { TopicNode } from "@/data/topicTaxonomy";
import { fetchAdvancedLessonCompletionKeys } from "@/lib/curriculum/lessonCompletionClient";
import { isTopicCompleteAtAdvanced } from "@/lib/curriculum/lessonCompletionRollup";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { syncMagicWallOnboardingStepsFromBasketState } from "@/lib/onboarding/magicWallOnboarding";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";

/** Topic hub level when opening topics from Magic Wall (Start Reading / basket links). */
const MAGIC_WALL_READING_LEVEL: DifficultyLevel = "advanced";

type RainTopic = {
  topicKey: string;
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  examType: ExamType | null;
  unitName: string;
  chapterTitle: string;
  topicName: string;
  tag: string;
  node: TopicNode;
};

const SUBJECT_OPTIONS: { subject: Subject; label: string }[] = [
  { subject: "physics", label: "Physics" },
  { subject: "chemistry", label: "Chemistry" },
  { subject: "math", label: "Maths" },
];

const SUBJECT_TONE: Record<Subject, string> = {
  physics: "border-cyan-400/60 text-cyan-300",
  chemistry: "border-rose-400/60 text-rose-300",
  math: "border-amber-400/60 text-amber-300",
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function countNetNewTopicKeys(selected: Set<string>, saved: Set<string>): number {
  let n = 0;
  for (const k of selected) {
    if (!saved.has(k)) n += 1;
  }
  return n;
}

/* ── Rain animation (EduBlast-style trickle + de-clustered flow) ─ */
const RAIN_CANVAS_H = 640;
/**
 * Only this many topic chips are mounted at once. The full catalog still cycles
 * through over time; 200+ simultaneous animations will always overlap.
 */
/**
 * Fewer concurrent streams = less pile-up; chip width is capped so columns can span the canvas.
 */
/** Fewer columns = less vertical pile-up in the same Y band (easier to tap). */
/** Paginated “completed topics” history modal (150+ syllabus rows). */
const COMPLETED_TOPICS_HISTORY_PAGE_SIZE = 20;
const RESET_HISTORY_COUNTDOWN_SEC = 10;
const RAIN_SLOT_COUNT = 12;
/** Max canvas height cap; actual height is viewport-aware (see rain canvas style). */
const RAIN_TRICKLE_SLACK_PX = 30;
/** Quick left→right “wave” at the top edge; all streams still start at y=0 (top-down flow). */
const RAIN_ENTRY_STAGGER_S = 0.04;
/** Second chip per column starts half a cycle later → while one is mid-wall, the next is at the top (no dead band). */
const RAIN_TWIN_PHASE_FR = 0.5;
/** Visual + layout width (keep in sync with chip max-w in className below) */
const RAIN_CARD_MAX_W = 172;

const SUBJECT_DOT_COLOR: Record<Subject, string> = {
  physics: "#38bdf8",
  chemistry: "#fb7185",
  math: "#fbbf24",
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic shuffle so the rain pool doesn’t reshuffle on every parent re-render (that was resetting the queue). */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Edge-to-edge placement: slot 0 hugs the left, last slot hugs the right (with pad),
 * so the rain uses the full canvas width instead of clustering in the middle.
 */
function layoutCardWidthForRain(w: number): number {
  return Math.min(RAIN_CARD_MAX_W, Math.max(136, w * 0.21));
}

/** Even columns, true left→right edge use (no jitter — jitter was clustering/overlap for demos). */
function computeLeftForSlot(slotIndex: number, slotCount: number, w: number): number {
  const pad = 4;
  const cardW = layoutCardWidthForRain(w);
  const maxLeft = Math.max(pad, w - cardW - pad);
  const usable = Math.max(maxLeft - pad, 1);
  const n = Math.max(1, slotCount);
  const t = n <= 1 ? 0.5 : slotIndex / (n - 1);
  const leftPx = pad + t * usable;
  return Math.max(pad, Math.min(leftPx, maxLeft));
}

function rainEntryStaggerDelay(slotIndex: number, slotCount: number): number {
  if (slotCount <= 1) return 0;
  const micro = (hashStr(`st|${slotIndex}`) % 50) / 1000;
  return Number((slotIndex * RAIN_ENTRY_STAGGER_S + micro).toFixed(4));
}

/** ~5–7s per fall across the wall */
function rainFallDurationSec(slotId: number, topicKey: string): number {
  const th = hashStr(topicKey);
  return Number((5 + (((slotId * 53 + th) % 1000) / 1000) * 2).toFixed(2));
}

type RainSlot = {
  slotId: number;
  /** Twin 0/1 share the column; staggered by half a fall so the column always has a top entry. */
  topics: [RainTopic, RainTopic];
  leftPx: number;
  duration: number;
  baseAnimDelay: number;
  depthZ: number;
};

export default function MagicWallPage() {
  const { taxonomy, loading, error } = useTopicTaxonomy();
  const { user, profile } = useAuth();
  const isAdmin = useIsAppAdmin();
  const [planMaxPicks, setPlanMaxPicks] = useState(DEFAULT_RDM_CONFIG.magic_wall_max_topics);
  const currentPlan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
  const [showSaveConfirmOpen, setShowSaveConfirmOpen] = useState(false);
  const storeUser = useUserStore((s) => s.user);
  const { toast } = useToast();
  const router = useRouter();

  const board = (storeUser?.board ?? "CBSE") as Board;
  const initialClass =
    profile?.class_level === 11 || profile?.class_level === 12
      ? (profile.class_level as ClassLevel)
      : 11;
  const [selectedClass, setSelectedClass] = useState<ClassLevel>(initialClass);
  const [activeSubjects, setActiveSubjects] = useState<Set<Subject>>(
    new Set(["physics", "chemistry", "math"])
  );
  const [selectedTopicKeys, setSelectedTopicKeys] = useState<Set<string>>(new Set());
  const selectedTopicKeysRef = useRef(selectedTopicKeys);
  selectedTopicKeysRef.current = selectedTopicKeys;
  const [basketItems, setBasketItems] = useState<MagicWallBasketItem[]>([]);
  const [basketUsage, setBasketUsage] = useState<MagicWallUsage | null>(null);
  const [loadingBasket, setLoadingBasket] = useState(false);

  const maxPicks =
    basketUsage && !isUnlimited(basketUsage.maxActive)
      ? basketUsage.maxActive
      : isAdmin
        ? 5
        : planMaxPicks;
  const newPicksAllowed = basketUsage?.newPicksAllowed ?? null;
  const [savingBasket, setSavingBasket] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  /** Class shown inside “Completed topics” (independent of wall Class 11/12 filter). */
  const [historyModalClass, setHistoryModalClass] = useState<ClassLevel>(initialClass);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTimer, setResetTimer] = useState(RESET_HISTORY_COUNTDOWN_SEC);
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const wfRef = useRef<HTMLDivElement>(null);
  const [wfSize, setWfSize] = useState({ width: 800, height: RAIN_CANVAS_H });
  const poolRef = useRef<RainTopic[]>([]);
  const queueRef = useRef(0);
  const slotLoopHandlerRef = useRef<(slotId: number, twinIndex: number) => void>(() => {});
  const [rainSlots, setRainSlots] = useState<RainSlot[]>([]);
  /** Paused chip = animation stops so taps aren’t a moving target (hover or touch-hold). */
  const [pausedRainChipKey, setPausedRainChipKey] = useState<string | null>(null);

  const boardNormForLessonCompletions = useMemo(
    () =>
      String(storeUser?.board ?? profile?.board ?? board)
        .trim()
        .toLowerCase(),
    [storeUser?.board, profile?.board, board]
  );

  const [advancedLessonKeysByClass, setAdvancedLessonKeysByClass] = useState<{
    11: Set<string>;
    12: Set<string>;
  }>(() => ({ 11: new Set(), 12: new Set() }));

  const activeSubjectsKey = useMemo(() => [...activeSubjects].sort().join(","), [activeSubjects]);

  /* Fetch plan-driven Magic Wall limit from admin config */
  useEffect(() => {
    let cancelled = false;
    void fetchSubscriptionConfig().then((cfg) => {
      if (!cancelled) {
        const v = getPlanLimits(cfg, currentPlan).magicWallMaxActiveTopics;
        if (typeof v === "number" && v >= 1) setPlanMaxPicks(v);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentPlan]);

  useEffect(() => {
    // Gate on session user (matches lesson-completion API), not profile row — avoids a gap
    // where profile is still null but the student is signed in.
    if (!user?.id) {
      setAdvancedLessonKeysByClass({ 11: new Set(), 12: new Set() });
      return;
    }
    let cancelled = false;
    void (async () => {
      const subjects = activeSubjectsKey ? (activeSubjectsKey.split(",") as Subject[]) : [];
      const fetchMergedForClass = async (classLevel: 11 | 12) => {
        const results = await Promise.all(
          subjects.map((subject) =>
            fetchAdvancedLessonCompletionKeys({
              subject,
              classLevel,
              board: boardNormForLessonCompletions,
            })
          )
        );
        const merged = new Set<string>();
        for (const set of results) {
          for (const k of set) merged.add(k);
        }
        return merged;
      };
      const [keys11, keys12] = await Promise.all([
        fetchMergedForClass(11),
        fetchMergedForClass(12),
      ]);
      if (cancelled) return;
      setAdvancedLessonKeysByClass({ 11: keys11, 12: keys12 });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeSubjectsKey, boardNormForLessonCompletions]);

  useEffect(() => {
    if (!resetDialogOpen) return;
    setResetTimer(RESET_HISTORY_COUNTDOWN_SEC);
    setResetAcknowledged(false);
    const id = window.setInterval(() => {
      setResetTimer((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resetDialogOpen]);

  const closeResetDialog = useCallback(() => {
    setResetDialogOpen(false);
    setResetAcknowledged(false);
    setResetTimer(RESET_HISTORY_COUNTDOWN_SEC);
  }, []);

  const confirmResetHistory = useCallback(async () => {
    if (resetTimer > 0 || !resetAcknowledged || isResetting) return;
    setIsResetting(true);
    try {
      const res = await fetchWithClientAuth("/api/user/reset-history", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || res.statusText || "Reset failed");
      }
      toast({
        title: "History reset",
        description:
          "Class 11 and 12 lesson marks, engagement, and subtopic quiz attempts were cleared. The page will reload so Topic Rain updates.",
      });
      closeResetDialog();
      window.location.reload();
    } catch (e) {
      toast({
        title: "Could not reset history",
        description: e instanceof Error ? e.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  }, [resetTimer, resetAcknowledged, isResetting, toast, closeResetDialog]);

  useLayoutEffect(() => {
    const el = wfRef.current;
    if (!el) return;
    const apply = () => {
      setWfSize({
        width: el.offsetWidth || 800,
        height: el.offsetHeight || RAIN_CANVAS_H,
      });
    };
    apply();
    const id = requestAnimationFrame(apply);
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [loading]);

  const catalog = useMemo(() => {
    return taxonomy.map((node) => {
      const unitName = node.unitTitle ?? node.unitLabel ?? "Unit";
      const chapterTitle = node.chapterTitle ?? node.topic;
      const topicName = node.topic;
      const topicKey = makeTopicKey({
        board,
        subject: node.subject,
        classLevel: node.classLevel,
        unitName,
        chapterTitle,
        topicName,
      });
      const examType: ExamType | null = null;
      return {
        topicKey,
        board,
        subject: node.subject,
        classLevel: node.classLevel,
        examType,
        unitName,
        chapterTitle,
        topicName,
        tag: `${node.subject.toUpperCase()} · C${node.classLevel}`,
        examRelevance: node.examRelevance,
        node,
      };
    });
  }, [taxonomy, board]);

  const advancedLessonKeysForRain = advancedLessonKeysByClass[selectedClass];

  // Topic Rain and Completed-topics History use the same rule: advanced-complete topics are
  // excluded from the rain automatically (no separate “manual remove” step).
  const filteredRainTopics = useMemo(() => {
    const seen = new Set<string>();
    // Collect per-subject buckets so each subject is always represented
    const buckets = new Map<Subject, RainTopic[]>();
    for (const item of catalog) {
      if (Number(item.classLevel) !== Number(selectedClass)) continue;
      if (!activeSubjects.has(item.subject)) continue;
      if (
        isTopicCompleteAtAdvanced(
          item.node,
          advancedLessonKeysForRain,
          boardNormForLessonCompletions
        )
      ) {
        continue;
      }
      if (seen.has(item.topicKey)) continue;
      seen.add(item.topicKey);
      if (!buckets.has(item.subject)) buckets.set(item.subject, []);
      buckets.get(item.subject)!.push({
        topicKey: item.topicKey,
        board: item.board,
        subject: item.subject,
        classLevel: item.classLevel,
        examType: item.examType,
        unitName: item.unitName,
        chapterTitle: item.chapterTitle,
        topicName: item.topicName,
        tag: item.tag,
        node: item.node,
      });
    }
    // Round-robin interleave: physics[0], chem[0], math[0], physics[1], ...
    // This guarantees every active subject appears in the rain canvas
    const arrays = Array.from(buckets.values());
    const out: RainTopic[] = [];
    let row = 0;
    while (true) {
      let added = false;
      for (const arr of arrays) {
        if (row < arr.length) {
          out.push(arr[row]);
          added = true;
        }
      }
      if (!added) break;
      row++;
    }
    return out;
  }, [
    catalog,
    selectedClass,
    activeSubjects,
    advancedLessonKeysForRain,
    boardNormForLessonCompletions,
  ]);

  const filteredRainLatestRef = useRef(filteredRainTopics);
  filteredRainLatestRef.current = filteredRainTopics;

  const topicKeyOrderSig = useMemo(
    () =>
      filteredRainTopics
        .map((t) => t.topicKey)
        .sort()
        .join("\0"),
    [filteredRainTopics]
  );

  const rainFilterKey = useMemo(
    () => [String(selectedClass), [...activeSubjects].sort().join(","), topicKeyOrderSig].join("§"),
    [selectedClass, activeSubjects, topicKeyOrderSig]
  );

  const rainPool = useMemo(() => {
    const list = filteredRainLatestRef.current;
    if (list.length === 0) return [];
    const seed = hashStr(rainFilterKey);
    return seededShuffle(list, seed);
  }, [rainFilterKey]);

  poolRef.current = rainPool;

  const topicMapByKey = useMemo(() => {
    const map = new Map<string, RainTopic>();
    for (const t of filteredRainTopics) map.set(t.topicKey, t);
    for (const t of catalog) {
      if (!map.has(t.topicKey)) {
        map.set(t.topicKey, {
          topicKey: t.topicKey,
          board: t.board,
          subject: t.subject,
          classLevel: t.classLevel,
          examType: t.examType,
          unitName: t.unitName,
          chapterTitle: t.chapterTitle,
          topicName: t.topicName,
          tag: t.tag,
          node: t.node,
        });
      }
    }
    return map;
  }, [filteredRainTopics, catalog]);

  const completedTopicsHistory = useMemo(() => {
    const lessonKeys = advancedLessonKeysByClass[historyModalClass];
    const seen = new Set<string>();
    const rows: Array<{
      topicKey: string;
      subject: Subject;
      classLevel: ClassLevel;
      chapterTitle: string;
      topicName: string;
      tag: string;
    }> = [];
    for (const item of catalog) {
      if (Number(item.classLevel) !== Number(historyModalClass)) continue;
      if (!activeSubjects.has(item.subject)) continue;
      if (!isTopicCompleteAtAdvanced(item.node, lessonKeys, boardNormForLessonCompletions)) {
        continue;
      }
      if (seen.has(item.topicKey)) continue;
      seen.add(item.topicKey);
      rows.push({
        topicKey: item.topicKey,
        subject: item.subject,
        classLevel: item.classLevel,
        chapterTitle: item.chapterTitle,
        topicName: item.topicName,
        tag: item.tag,
      });
    }
    rows.sort(
      (a, b) =>
        a.subject.localeCompare(b.subject) ||
        a.chapterTitle.localeCompare(b.chapterTitle) ||
        a.topicName.localeCompare(b.topicName)
    );
    return rows;
  }, [
    catalog,
    historyModalClass,
    activeSubjects,
    advancedLessonKeysByClass,
    boardNormForLessonCompletions,
  ]);

  useEffect(() => {
    if (loading) {
      setRainSlots([]);
      queueRef.current = 0;
      return;
    }
    const pool = rainPool;
    if (pool.length === 0) {
      setRainSlots([]);
      queueRef.current = 0;
      return;
    }
    const w = Math.max(wfSize.width, 320);
    const slotCap = w < 420 ? 6 : w < 500 ? 8 : w < 620 ? 10 : RAIN_SLOT_COUNT;
    const n = Math.min(slotCap, pool.length);
    let qi = 0;
    const slots: RainSlot[] = Array.from({ length: n }, (_, i) => {
      const topicA = pool[qi % pool.length];
      qi += 1;
      const topicB = pool[qi % pool.length];
      qi += 1;
      const th = hashStr(topicA.topicKey);
      const duration = rainFallDurationSec(i, topicA.topicKey);
      return {
        slotId: i,
        topics: [topicA, topicB],
        leftPx: computeLeftForSlot(i, n, w),
        duration,
        baseAnimDelay: rainEntryStaggerDelay(i, n),
        depthZ: 6 + (th % 12),
      };
    });
    setRainSlots(slots);
    queueRef.current = qi;
  }, [loading, rainFilterKey, rainPool, wfSize.width]);

  useEffect(() => {
    if (loading) return;
    setRainSlots((prev) => {
      if (prev.length === 0) return prev;
      const w = Math.max(wfSize.width, 320);
      const n = prev.length;
      return prev.map((s) => ({
        ...s,
        leftPx: computeLeftForSlot(s.slotId, n, w),
      }));
    });
  }, [wfSize.width, loading]);

  slotLoopHandlerRef.current = (slotId: number, twinIndex: number) => {
    setRainSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s;
        const pool = poolRef.current;
        if (pool.length === 0) return s;
        const topic = pool[queueRef.current % pool.length];
        queueRef.current += 1;
        const next: [RainTopic, RainTopic] = [s.topics[0], s.topics[1]];
        next[twinIndex] = topic;
        return { ...s, topics: next };
      })
    );
  };

  useEffect(() => {
    if (rainSlots.length === 0) return;
    const root = wfRef.current;
    if (!root) return;
    const onIter = (e: Event) => {
      const ae = e as AnimationEvent;
      const name = (ae.animationName || "").toLowerCase();
      if (name && !name.includes("magic-trickle")) return;
      const el = ae.target as HTMLElement;
      const sid = el?.getAttribute?.("data-rain-slot");
      const twin = el?.getAttribute?.("data-rain-twin");
      if (sid == null || twin == null) return;
      slotLoopHandlerRef.current(Number(sid), Number(twin));
    };
    root.addEventListener("animationiteration", onIter);
    return () => root.removeEventListener("animationiteration", onIter);
  }, [rainSlots.length]);

  const basketKeySet = useMemo(() => new Set(basketItems.map((i) => i.topicKey)), [basketItems]);
  const hasUnsavedChanges = useMemo(
    () => !setsEqual(selectedTopicKeys, basketKeySet),
    [selectedTopicKeys, basketKeySet]
  );

  const startReadingHref = useMemo(() => {
    if (basketItems.length === 0) return null;
    const first = basketItems[0]!;
    return appendQueryParams(
      buildTopicOverviewPath(
        board,
        first.subject,
        first.classLevel,
        first.topicName,
        MAGIC_WALL_READING_LEVEL,
        undefined,
        first.chapterTitle
      ),
      { source: "magic-wall" }
    );
  }, [basketItems, board]);

  const handleStartReading = useCallback(() => {
    if (!startReadingHref) return;
    if (hasUnsavedChanges) {
      toast({
        title: "Save your reading basket first",
        description: 'Tap "Save changes" to sync your topic picks before you start reading.',
      });
      return;
    }
    router.push(startReadingHref);
  }, [hasUnsavedChanges, startReadingHref, router, toast]);

  const selectedDetails = useMemo(() => {
    const out: Array<{
      topicKey: string;
      subject: Subject;
      classLevel: ClassLevel;
      chapterTitle: string;
      topicName: string;
      saved: boolean;
    }> = [];
    for (const key of selectedTopicKeys) {
      const found = topicMapByKey.get(key);
      if (found) {
        out.push({
          topicKey: key,
          subject: found.subject,
          classLevel: found.classLevel,
          chapterTitle: found.chapterTitle,
          topicName: found.topicName,
          saved: basketKeySet.has(key),
        });
        continue;
      }
      const dbRow = basketItems.find((row) => row.topicKey === key);
      if (!dbRow) continue;
      out.push({
        topicKey: key,
        subject: dbRow.subject,
        classLevel: dbRow.classLevel,
        chapterTitle: dbRow.chapterTitle,
        topicName: dbRow.topicName,
        saved: true,
      });
    }
    return out.sort(
      (a, b) => a.subject.localeCompare(b.subject) || a.topicName.localeCompare(b.topicName)
    );
  }, [selectedTopicKeys, topicMapByKey, basketItems, basketKeySet]);

  const autoPruneCompletedInFlightRef = useRef(false);
  useEffect(() => {
    if (!user?.id) return;
    if (basketItems.length === 0) return;
    if (autoPruneCompletedInFlightRef.current) return;

    const completedTopicKeys = basketItems
      .map((item) => {
        const topic = topicMapByKey.get(item.topicKey);
        if (!topic) return null;
        const classLevel = Number(item.classLevel) === 12 ? 12 : 11;
        const keys = advancedLessonKeysByClass[classLevel];
        const done = isTopicCompleteAtAdvanced(topic.node, keys, boardNormForLessonCompletions);
        return done ? item.topicKey : null;
      })
      .filter((k): k is string => Boolean(k));

    if (completedTopicKeys.length === 0) return;

    autoPruneCompletedInFlightRef.current = true;
    void (async () => {
      try {
        await removeMagicWallBasketItems(completedTopicKeys);
        const { items: rows, usage } = await fetchMagicWallBasket();
        setBasketItems(rows);
        setBasketUsage(usage);
        setSelectedTopicKeys(new Set(rows.map((r) => r.topicKey)));
        selectedTopicKeysRef.current = new Set(rows.map((r) => r.topicKey));
      } catch {
        // best effort; user can still refresh manually
      } finally {
        autoPruneCompletedInFlightRef.current = false;
      }
    })();
  }, [
    user?.id,
    basketItems,
    topicMapByKey,
    advancedLessonKeysByClass,
    boardNormForLessonCompletions,
  ]);

  const refreshBasket = useCallback(async () => {
    if (!user?.id) return;
    setLoadingBasket(true);
    try {
      const { items: rows, usage } = await fetchMagicWallBasket();
      setBasketItems(rows);
      setBasketUsage(usage);
      setSelectedTopicKeys(new Set(rows.map((r) => r.topicKey)));
      syncMagicWallOnboardingStepsFromBasketState(rows.length, rows.length);
      if (rows.length > maxPicks) {
        toast({
          title: `More than ${maxPicks} topics in basket`,
          description: `Keep up to ${maxPicks}. Remove extras, then save.`,
        });
      }
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to load reading basket",
        variant: "destructive",
      });
    } finally {
      setLoadingBasket(false);
    }
  }, [user?.id, toast, maxPicks]);

  useEffect(() => {
    void refreshBasket();
  }, [refreshBasket]);

  useEffect(() => {
    if (!user?.id) return;
    syncMagicWallOnboardingStepsFromBasketState(basketItems.length, selectedTopicKeys.size);
  }, [user?.id, basketItems.length, selectedTopicKeys.size]);

  const toggleSubject = (subject: Subject) => {
    setActiveSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) {
        if (next.size === 1) return prev;
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  const toggleTopic = (topicKey: string) => {
    const prev = selectedTopicKeysRef.current;
    if (prev.has(topicKey)) {
      const isSaved = basketKeySet.has(topicKey);
      if (!isAdmin && isSaved && (currentPlan === "free" || currentPlan === "free_trial")) {
        toast({
          title: "Saved topics cannot be undone",
          description:
            "On Free and Free Trial, saved Magic Wall topics stay locked. Complete the topic to free a slot for a new pick.",
        });
        return;
      }
      setSelectedTopicKeys((s) => {
        const next = new Set(s);
        next.delete(topicKey);
        selectedTopicKeysRef.current = next;
        return next;
      });
      return;
    }
    if (prev.size >= maxPicks) {
      toast({
        title: `Maximum ${maxPicks} topics`,
        description: `You already have ${maxPicks} active slots filled. Complete a saved topic to free a slot.`,
      });
      return;
    }
    const isNewPick = !basketKeySet.has(topicKey);
    if (isNewPick && newPicksAllowed !== null) {
      const netNew = countNetNewTopicKeys(prev, basketKeySet);
      if (netNew >= newPicksAllowed) {
        const monthlyHint =
          basketUsage && !isUnlimited(basketUsage.monthlyLimit)
            ? ` (${basketUsage.monthlyUsed}/${basketUsage.monthlyLimit} new picks used this period).`
            : "";
        toast({
          title: "No new picks left this period",
          description:
            newPicksAllowed === 0
              ? `Complete a topic or wait until ${formatMagicWallPeriodEndLocal(basketUsage?.periodEnd ?? "")} for more picks.${monthlyHint}`
              : `You can add ${newPicksAllowed} more new topic${newPicksAllowed === 1 ? "" : "s"} this period. Carried-over topics count toward your ${maxPicks} active limit.${monthlyHint}`,
        });
        return;
      }
    }
    setSelectedTopicKeys((s) => {
      const next = new Set(s);
      next.add(topicKey);
      selectedTopicKeysRef.current = next;
      return next;
    });
  };

  const persistSelection = async () => {
    if (!hasUnsavedChanges) return;
    if (selectedTopicKeys.size > maxPicks) {
      toast({
        title: "Too many topics",
        description: `Save up to ${maxPicks} topics. Remove some first.`,
        variant: "destructive",
      });
      return;
    }
    const toAdd = [...selectedTopicKeys].filter((key) => !basketKeySet.has(key));
    if (newPicksAllowed !== null && toAdd.length > newPicksAllowed) {
      toast({
        title: "Topic pick limit",
        description:
          newPicksAllowed === 0
            ? "You cannot add more topics until you complete one or your billing period resets."
            : `You can only add ${newPicksAllowed} more new topic${newPicksAllowed === 1 ? "" : "s"} this period.`,
        variant: "destructive",
      });
      return;
    }
    setSavingBasket(true);
    try {
      const toRemove = [...basketKeySet].filter((key) => !selectedTopicKeys.has(key));

      const addPayload: MagicWallBasketInsert[] = toAdd
        .map((key) => topicMapByKey.get(key))
        .filter((v): v is RainTopic => Boolean(v))
        .map((topic) => ({
          topicKey: topic.topicKey,
          board: topic.board,
          subject: topic.subject,
          classLevel: topic.classLevel,
          examType: topic.examType,
          unitName: topic.unitName,
          chapterTitle: topic.chapterTitle,
          topicName: topic.topicName,
        }));

      await Promise.all([
        upsertMagicWallBasketItems(addPayload),
        removeMagicWallBasketItems(toRemove),
      ]);
      const { items: rows, usage } = await fetchMagicWallBasket();
      setBasketItems(rows);
      setBasketUsage(usage);
      setSelectedTopicKeys(new Set(rows.map((r) => r.topicKey)));
      syncMagicWallOnboardingStepsFromBasketState(rows.length, rows.length);
      toast({
        title: "Reading basket updated",
        description: `Saved ${rows.length} topic${rows.length === 1 ? "" : "s"} for Magic Wall.`,
      });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not update reading basket",
        variant: "destructive",
      });
    } finally {
      setSavingBasket(false);
    }
  };

  const handleSaveChangesClick = () => {
    if (!hasUnsavedChanges) return;
    if (selectedTopicKeys.size > maxPicks) {
      toast({
        title: "Too many topics",
        description: `Save up to ${maxPicks} topics. Remove some first.`,
        variant: "destructive",
      });
      return;
    }
    if (isAdmin) {
      void persistSelection();
    } else {
      setShowSaveConfirmOpen(true);
    }
  };

  const handleConfirmSave = () => {
    setShowSaveConfirmOpen(false);
    void persistSelection();
  };

  const classPill = "rounded-xl border border-border bg-card/80 px-3 py-2 text-sm font-bold";

  const historyTotal = completedTopicsHistory.length;
  const historyMaxPage =
    historyTotal === 0 ? 0 : Math.ceil(historyTotal / COMPLETED_TOPICS_HISTORY_PAGE_SIZE) - 1;
  const historyEffectivePage = Math.min(Math.max(0, historyPage), historyMaxPage);
  const historyPageLabelCount = historyTotal === 0 ? 1 : historyMaxPage + 1;
  const historyRangeStart =
    historyTotal === 0 ? 0 : historyEffectivePage * COMPLETED_TOPICS_HISTORY_PAGE_SIZE + 1;
  const historyRangeEnd =
    historyTotal === 0
      ? 0
      : Math.min(historyTotal, (historyEffectivePage + 1) * COMPLETED_TOPICS_HISTORY_PAGE_SIZE);
  const historyPageSlice = completedTopicsHistory.slice(
    historyEffectivePage * COMPLETED_TOPICS_HISTORY_PAGE_SIZE,
    (historyEffectivePage + 1) * COMPLETED_TOPICS_HISTORY_PAGE_SIZE
  );

  return (
    <ProtectedRoute allowRoles={["student"]}>
      <AppLayout>
        <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col space-y-2 pb-2 sm:space-y-3 lg:space-y-1.5">
          {/*
            Grid: Topic Rain fills all space left of the basket (no justify-between “void”).
            Column 1 = minmax(0,1fr); column 2 = fixed readable basket width.
          */}
          <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_min(100%,400px)] xl:gap-6">
            <section className="min-w-0 w-full rounded-2xl border-2 border-violet-500/35 bg-gradient-to-b from-[#121426] to-[#090b16] p-2 shadow-[0_0_32px_rgba(139,92,246,0.14)] ring-1 ring-violet-400/15 sm:rounded-3xl md:p-3">
              <div className="px-1 pb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-extrabold text-white flex flex-wrap items-center gap-2">
                    <WandSparkles className="h-4.5 w-4.5 shrink-0 text-violet-300" />
                    <span>Topic Rain — tap to select (max {maxPicks}), add to basket</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 break-words">
                    {loading
                      ? "Loading…"
                      : error && taxonomy.length === 0
                        ? "Curriculum could not be loaded."
                        : filteredRainTopics.length === 0
                          ? "No topics match your filters."
                          : `${filteredRainTopics.length} topics loaded · ${rainSlots.length} columns (${rainSlots.length * 2} drops) · class ${selectedClass} · max ${maxPicks} picks — hover or touch-hold to pause`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                  <span className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100">
                    CBSE
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                  </button>
                </div>
              </div>
              {filtersOpen && (
                <div className="mb-2 rounded-2xl border border-white/10 bg-black/35 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Filter topics
                    </p>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Subjects
                    </span>
                    {SUBJECT_OPTIONS.map((s) => {
                      const active = activeSubjects.has(s.subject);
                      return (
                        <button
                          key={s.subject}
                          type="button"
                          onClick={() => toggleSubject(s.subject)}
                          className={`rounded-full px-3 py-1.5 text-xs font-extrabold border transition-all ${
                            active
                              ? `bg-white/10 ${SUBJECT_TONE[s.subject]} shadow-[0_0_0_1px_rgba(255,255,255,0.08)]`
                              : "border-white/20 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                    <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Classes
                    </span>
                    <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl p-1">
                      {[11, 12].map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setSelectedClass(lv as ClassLevel)}
                          className={`${classPill} ${
                            selectedClass === lv
                              ? "border-violet-400 bg-violet-500/20 text-violet-200"
                              : "text-slate-300"
                          }`}
                        >
                          Class {lv}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryPage(0);
                        setHistoryModalClass(selectedClass);
                        setHistoryOpen(true);
                      }}
                      className={`${classPill} flex items-center gap-1.5 border-white/15 bg-black/30 text-slate-200 hover:bg-white/10 hover:text-white`}
                    >
                      <History className="h-3.5 w-3.5 shrink-0 opacity-90" />
                      History
                    </button>
                  </div>
                </div>
              )}

              <Dialog
                open={historyOpen}
                onOpenChange={(open) => {
                  setHistoryOpen(open);
                  if (open) {
                    setHistoryPage(0);
                    setHistoryModalClass(selectedClass);
                  }
                }}
              >
                <DialogContent
                  className={cn(
                    // z-[101] required: overlay uses z-[100]; default content z-50 would sit UNDER overlay.
                    "z-[101] max-h-[85vh] max-w-2xl gap-0 overflow-hidden border-2 border-violet-400/45 bg-slate-900 p-0 text-slate-100 shadow-2xl shadow-black/50 ring-1 ring-violet-300/25 sm:rounded-xl",
                    "[&>button.absolute]:text-slate-200 [&>button.absolute]:opacity-100 [&>button.absolute]:hover:bg-white/15 [&>button.absolute]:hover:text-white"
                  )}
                  overlayClassName="z-[100] bg-slate-950/55 backdrop-blur-[3px]"
                >
                  <DialogHeader className="border-b border-violet-500/20 bg-slate-900/80 px-5 py-4 pr-12 text-left sm:pr-14">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <DialogTitle className="text-lg font-extrabold text-white">
                        Completed topics
                      </DialogTitle>
                      <div
                        className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1"
                        role="group"
                        aria-label="Class for completed topics list"
                      >
                        {([11, 12] as const).map((lv) => (
                          <button
                            key={lv}
                            type="button"
                            onClick={() => {
                              setHistoryModalClass(lv);
                              setHistoryPage(0);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-extrabold border transition-all ${
                              historyModalClass === lv
                                ? "border-violet-400 bg-violet-500/20 text-violet-200"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Class {lv}
                          </button>
                        ))}
                      </div>
                    </div>
                    <DialogDescription className="mt-2 space-y-1.5 text-slate-400">
                      <span className="block">
                        {`Topics you finished for Class ${historyModalClass}${
                          activeSubjects.size < 3
                            ? ` · ${[...activeSubjects]
                                .sort()
                                .map(
                                  (s) => SUBJECT_OPTIONS.find((o) => o.subject === s)?.label ?? s
                                )
                                .join(", ")}`
                            : ""
                        }.`}
                      </span>
                      <span className="block text-slate-500">
                        Anything that appears here is automatically hidden from Topic Rain (auto
                        filter) once your lesson completions are loaded—same rule as the wall.
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[min(52vh,420px)] overflow-y-auto bg-slate-900/95 px-5 py-3">
                    {!user?.id ? (
                      <p className="text-sm text-slate-400">
                        Sign in to see topics you&apos;ve completed.
                      </p>
                    ) : historyTotal === 0 ? (
                      <p className="text-sm text-slate-400">
                        No completed topics for these filters yet. Finish every subtopic
                        in a topic to add it here.
                      </p>
                    ) : (
                      <ol className="list-decimal space-y-2.5 pl-5" start={historyRangeStart}>
                        {historyPageSlice.map((row) => (
                          <li
                            key={row.topicKey}
                            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 marker:font-bold"
                          >
                            <div className="text-sm font-bold text-white leading-snug">
                              {row.topicName}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {row.tag} · {row.chapterTitle}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <DialogFooter className="flex-col gap-3 border-t border-violet-500/20 bg-slate-800/90 px-5 py-4 sm:flex-col">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-semibold tabular-nums">
                        {historyTotal === 0
                          ? "0 topics"
                          : `${historyRangeStart}–${historyRangeEnd} of ${historyTotal}`}
                      </span>
                      <span className="font-extrabold tabular-nums text-slate-300">
                        Page {historyEffectivePage + 1} of {historyPageLabelCount}
                      </span>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
                        disabled={historyTotal === 0 || historyEffectivePage <= 0}
                        onClick={() =>
                          setHistoryPage((p) => {
                            const c = Math.min(p, historyMaxPage);
                            return Math.max(0, c - 1);
                          })
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
                        disabled={historyTotal === 0 || historyEffectivePage >= historyMaxPage}
                        onClick={() =>
                          setHistoryPage((p) => {
                            const c = Math.min(p, historyMaxPage);
                            return Math.min(historyMaxPage, c + 1);
                          })
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={resetDialogOpen}
                onOpenChange={(open) => {
                  if (!open) closeResetDialog();
                }}
              >
                <DialogContent
                  hideClose
                  onPointerDownOutside={(e) => e.preventDefault()}
                  onEscapeKeyDown={(e) => e.preventDefault()}
                  className="z-[101] max-w-lg gap-0 overflow-hidden border-2 border-red-500/40 bg-slate-900 p-0 text-slate-100 shadow-2xl sm:rounded-xl"
                  overlayClassName="z-[100] bg-slate-950/60 backdrop-blur-[2px]"
                >
                  <DialogHeader className="border-b border-red-500/25 px-5 py-4 text-left">
                    <DialogTitle className="text-lg font-extrabold text-white">
                      Reset history
                    </DialogTitle>
                    <DialogDescription className="space-y-3 pt-1 text-left text-sm leading-relaxed text-slate-300">
                      <span className="block">
                        <strong className="text-white">Are you sure you want to reset?</strong> This
                        permanently clears your learning history for{" "}
                        <strong className="text-white">Class 11</strong> and{" "}
                        <strong className="text-white">Class 12</strong>.
                      </span>
                      <span className="block">
                        That includes every{" "}
                        <strong className="text-white">topic, chapter, and subtopic</strong> you
                        marked as read or complete (including lesson checks and saved
                        progress in those classes). Other grades are not affected.
                      </span>
                      <span className="block">
                        After a reset, those topics can show up again in Topic Rain and your
                        completed list will be empty until you study them again.
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 px-5 py-4">
                    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                      <Checkbox
                        id="reset-history-ack"
                        checked={resetAcknowledged}
                        onCheckedChange={(v) => setResetAcknowledged(v === true)}
                        className="mt-0.5 border-slate-400 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600"
                      />
                      <Label
                        htmlFor="reset-history-ack"
                        className="cursor-pointer text-sm font-medium leading-snug text-slate-200"
                      >
                        I have read all the information properly.
                      </Label>
                    </div>
                  </div>
                  <DialogFooter className="flex-col gap-2 border-t border-white/10 bg-slate-950/50 px-5 py-4 sm:flex-col">
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        disabled={isResetting || resetTimer > 0 || !resetAcknowledged}
                        onClick={() => void confirmResetHistory()}
                      >
                        {isResetting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting…
                          </>
                        ) : resetTimer > 0 ? (
                          <>Reset in {resetTimer}s</>
                        ) : (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset history
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white sm:w-auto"
                        onClick={closeResetDialog}
                      >
                        Close window
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showSaveConfirmOpen} onOpenChange={setShowSaveConfirmOpen}>
                <DialogContent
                  hideClose={true}
                  className="flex w-[min(calc(100vw-2rem),400px)] flex-col gap-4 border border-violet-500/25 bg-[#0a0f18]/95 p-5 text-center shadow-2xl shadow-violet-950/40 sm:rounded-2xl"
                >
                  <DialogHeader className="sr-only">
                    <DialogTitle>Confirm Save Changes</DialogTitle>
                    <DialogDescription>
                      Confirm if you really want to save changes to your reading basket.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/35">
                    <History className="h-5 w-5 text-amber-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Confirm Save Changes? ⚠️</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                      Once saved, you{" "}
                      <strong className="text-red-400 font-bold">cannot Undo</strong>. So make sure
                      you select topics properly by going through filters.
                    </p>
                  </div>
                  <div className="flex gap-2.5 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl h-10 border-white/10 hover:bg-white/[0.06] text-xs font-bold text-slate-300"
                      onClick={() => setShowSaveConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded-xl h-10 bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-lg shadow-violet-950/20"
                      onClick={handleConfirmSave}
                    >
                      Yes, Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* ── Topic Rain canvas (EduBlast waterfall / trickle) ─── */}
              <div
                ref={wfRef}
                className="relative w-full min-w-0 overflow-hidden rounded-[14px] border-2 border-violet-400/25 bg-white/[0.02] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.08)]"
                style={
                  {
                    height: `clamp(240px, calc(100svh - 16rem), ${RAIN_CANVAS_H}px)`,
                    ["--mw-trickle-end" as string]: `${wfSize.height + RAIN_TRICKLE_SLACK_PX}px`,
                  } as CSSProperties
                }
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-10 bg-gradient-to-b from-[#0a0a12] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[50px] bg-gradient-to-t from-[#0a0a12] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-24 overflow-hidden">
                  <div className="absolute -top-10 left-[18%] h-28 w-[42%] max-w-md rounded-full bg-violet-500/12 blur-3xl" />
                  <div className="absolute -top-8 left-[52%] h-24 w-[38%] max-w-sm rounded-full bg-indigo-500/10 blur-3xl" />
                </div>

                {loading && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-4 text-center text-slate-300">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">Loading…</span>
                    <span className="max-w-sm text-xs text-slate-500">
                      Topic Rain starts after your syllabus is loaded — hover or touch a topic to
                      pause it, then tap to select.
                    </span>
                  </div>
                )}
                {!loading && filteredRainTopics.length === 0 && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-300">
                    {error && taxonomy.length === 0 ? (
                      <>
                        <span className="font-semibold text-slate-200">Curriculum unavailable</span>
                        <span className="max-w-md text-xs text-slate-500">{error}</span>
                      </>
                    ) : (
                      <span>
                        No topics for selected filters. Try another class, exam, or subject.
                      </span>
                    )}
                  </div>
                )}

                {!loading &&
                  rainSlots.flatMap((slot) => {
                    const { topics, leftPx, duration, baseAnimDelay, depthZ, slotId } = slot;
                    return [0, 1].map((twinIx) => {
                      const topic = topics[twinIx]!;
                      const chipKey = `${slotId}:${twinIx}`;
                      const isPaused = pausedRainChipKey === chipKey;
                      const selected = selectedTopicKeys.has(topic.topicKey);
                      const dot = SUBJECT_DOT_COLOR[topic.subject];
                      const animDelay = Number(
                        (baseAnimDelay + twinIx * RAIN_TWIN_PHASE_FR * duration).toFixed(4)
                      );
                      const tone =
                        topic.subject === "physics"
                          ? selected
                            ? "border-sky-400 bg-sky-500/[0.16]"
                            : "border-sky-500/30 bg-sky-500/[0.06] hover:border-white/16 hover:bg-white/[0.08]"
                          : topic.subject === "chemistry"
                            ? selected
                              ? "border-rose-400 bg-rose-500/[0.16]"
                              : "border-rose-500/28 bg-rose-500/[0.06] hover:border-white/16 hover:bg-white/[0.08]"
                            : topic.subject === "math"
                              ? selected
                                ? "border-amber-400 bg-amber-500/[0.16]"
                                : "border-amber-500/28 bg-amber-500/[0.06] hover:border-white/16 hover:bg-white/[0.08]"
                              : selected
                                ? "border-emerald-400 bg-emerald-500/[0.16]"
                                : "border-emerald-500/28 bg-emerald-500/[0.06] hover:border-white/16 hover:bg-white/[0.08]";
                      const chkTone =
                        topic.subject === "physics"
                          ? "border-sky-400 bg-sky-400"
                          : topic.subject === "chemistry"
                            ? "border-rose-400 bg-rose-400"
                            : topic.subject === "math"
                              ? "border-amber-400 bg-amber-400"
                              : "border-emerald-400 bg-emerald-400";
                      return (
                        <button
                          key={`rain-slot-${slotId}-t${twinIx}`}
                          type="button"
                          data-rain-slot={String(slotId)}
                          data-rain-twin={String(twinIx)}
                          onClick={() => toggleTopic(topic.topicKey)}
                          onPointerEnter={() => setPausedRainChipKey(chipKey)}
                          onPointerLeave={() =>
                            setPausedRainChipKey((prev) => (prev === chipKey ? null : prev))
                          }
                          onTouchStart={() => setPausedRainChipKey(chipKey)}
                          onTouchEnd={() => {
                            window.setTimeout(() => {
                              setPausedRainChipKey((prev) => (prev === chipKey ? null : prev));
                            }, 280);
                          }}
                          onTouchCancel={() =>
                            setPausedRainChipKey((prev) => (prev === chipKey ? null : prev))
                          }
                          className={cn(
                            "absolute top-0 flex min-h-[38px] min-w-0 max-w-[min(172px,calc(100%-12px))] touch-manipulation cursor-pointer select-none items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-left text-[11px] leading-snug shadow-sm transition-[border-color,background-color,box-shadow] duration-150",
                            tone,
                            selected && "border-[1.5px] ring-1 ring-white/15",
                            isPaused &&
                              "ring-2 ring-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                          )}
                          style={{
                            left: leftPx,
                            zIndex: selected ? 80 : isPaused ? 72 : depthZ + twinIx,
                            willChange: "transform, opacity",
                            animationName: "magic-trickle",
                            animationDuration: `${duration}s`,
                            animationTimingFunction: "linear",
                            animationIterationCount: "infinite",
                            animationDelay: `${animDelay}s`,
                            animationFillMode: "backwards",
                            animationPlayState: isPaused ? "paused" : "running",
                          }}
                        >
                          <span
                            className="h-[7px] w-[7px] shrink-0 rounded-full"
                            style={{ background: dot }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-[rgba(232,232,240,0.9)]">
                            {topic.topicName}
                          </span>
                          <span className="shrink-0 text-[9px] text-[rgba(232,232,240,0.32)]">
                            C{topic.classLevel}
                          </span>
                          <span
                            className={cn(
                              "ml-[3px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-white/18",
                              selected && chkTone
                            )}
                            aria-hidden
                          >
                            {selected ? (
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                <polyline
                                  points="2,6 5,9 10,3"
                                  stroke="#fff"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            ) : null}
                          </span>
                        </button>
                      );
                    });
                  })}
              </div>

              {/* Actions stay under Topic Rain only (not full grid width beside basket). */}
              <div className="sticky bottom-0 z-30 mt-2 shrink-0">
                <div className="flex flex-col gap-1.5 rounded-xl border border-violet-400/50 bg-violet-500/25 px-2.5 py-1.5 shadow-md shadow-violet-950/25 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-2">
                  <div className="min-w-0 text-[11px] font-bold leading-tight text-violet-100 sm:pr-2 sm:text-xs">
                    <span className="break-words">
                      Reading Basket: {selectedTopicKeys.size}/{maxPicks} active slots filled
                      {hasUnsavedChanges ? ` (${basketItems.length} currently saved)` : ""}
                      {newPicksAllowed !== null && basketUsage && !isUnlimited(basketUsage.monthlyLimit) ? (
                        <>
                          {" "}
                          · {newPicksAllowed} new pick{newPicksAllowed === 1 ? "" : "s"} left
                        </>
                      ) : null}
                    </span>
                    {basketUsage && !isUnlimited(basketUsage.monthlyLimit) ? (
                      <span className="mt-0.5 block text-[10px] font-medium text-violet-200/80">
                        New picks this period: {basketUsage.monthlyUsed}/{basketUsage.monthlyLimit}
                        {basketUsage.periodEnd
                          ? ` · Resets ${formatMagicWallPeriodEndLocal(basketUsage.periodEnd)}`
                          : null}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
                    {basketItems.length > 0 && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 shrink-0 rounded-lg bg-emerald-500 px-3 text-[11px] font-extrabold text-white hover:bg-emerald-600 sm:whitespace-nowrap"
                        onClick={handleStartReading}
                      >
                        <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0" /> Start Reading
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-lg border-red-400/55 bg-red-950/35 px-2.5 text-[11px] font-extrabold text-red-100 hover:bg-red-950/55 sm:whitespace-nowrap"
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5 shrink-0" /> Reset history
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChangesClick}
                      disabled={savingBasket || !hasUnsavedChanges}
                      className="h-8 shrink-0 rounded-lg bg-violet-500 px-2.5 text-[11px] font-extrabold text-white hover:bg-violet-600 disabled:opacity-60 sm:whitespace-nowrap"
                    >
                      {savingBasket ? (
                        <>
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                          Save changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <aside className="min-w-0 w-full rounded-2xl border-2 border-violet-400/30 bg-gradient-to-b from-[#121425] to-[#0a0c16] p-3 space-y-2.5 shadow-[0_0_28px_rgba(139,92,246,0.1)] ring-1 ring-violet-500/10 sm:rounded-3xl lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-3 lg:shrink-0">
                <p className="text-[11px] uppercase tracking-wider font-bold text-amber-200">
                  Live Study Hour
                </p>
                <p className="mt-1 text-sm font-extrabold text-white">25 min study · 5 min break</p>
                <p className="text-xs text-amber-100/80">Syncs with streak rhythm</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-extrabold text-white">Reading Basket</p>
                  <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-100">
                    {selectedDetails.length}/{maxPicks} topics
                  </span>
                </div>
                {loadingBasket ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : selectedDetails.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No topics selected yet. Tap cards in Topic Rain (max {maxPicks} active).
                  </p>
                ) : (
                  <div className="space-y-1.5 pr-1">
                    {basketUsage ? (
                      <p className="mb-1.5 text-[10px] leading-snug text-slate-400">
                        Up to {maxPicks} topics in your basket at once.
                        {newPicksAllowed !== null && !isUnlimited(basketUsage.monthlyLimit)
                          ? ` ${newPicksAllowed} new pick${newPicksAllowed === 1 ? "" : "s"} left this period (${basketUsage.monthlyUsed}/${basketUsage.monthlyLimit} used). Incomplete topics carry over and use a slot.`
                          : null}
                      </p>
                    ) : null}
                    {selectedDetails.map((item) => (
                      <div
                        key={item.topicKey}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {item.saved ? (
                                <Link
                                  href={appendQueryParams(
                                    buildTopicOverviewPath(
                                      board,
                                      item.subject,
                                      item.classLevel,
                                      item.topicName,
                                      MAGIC_WALL_READING_LEVEL,
                                      undefined,
                                      item.chapterTitle
                                    ),
                                    { source: "magic-wall" }
                                  )}
                                  className="min-w-0 flex-1 truncate text-xs font-bold text-white hover:underline"
                                >
                                  {item.topicName}
                                </Link>
                              ) : (
                                <p className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                                  {item.topicName}
                                </p>
                              )}
                              <span
                                className={cn(
                                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold leading-none tracking-wide",
                                  item.saved
                                    ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-200"
                                    : "border-amber-400/45 bg-amber-500/20 text-amber-200"
                                )}
                                title={
                                  item.saved
                                    ? "Saved to basket"
                                    : "Not saved yet — use Save changes"
                                }
                              >
                                {item.saved ? "Saved" : "Pending"}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                              {item.subject.toUpperCase()} · C{item.classLevel} ·{" "}
                              {item.chapterTitle}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleTopic(item.topicKey)}
                            className="shrink-0 rounded-md border border-white/20 p-1 text-slate-300 hover:border-white/40 hover:text-white"
                            title="Remove from basket selection"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {error ? (
            <div className="px-1 sm:px-0">
              <p className="mt-2 text-xs text-destructive">{error}</p>
            </div>
          ) : null}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
