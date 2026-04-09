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
import { useUserStore } from "@/store/useUserStore";
import type { Board, ClassLevel, ExamType, Subject } from "@/types";
import { Button } from "@/components/ui/button";
import {
  fetchMagicWallBasket,
  removeMagicWallBasketItems,
  type MagicWallBasketInsert,
  type MagicWallBasketItem,
  upsertMagicWallBasketItems,
} from "@/lib/magicWallBasketService";
import { Filter, Loader2, Sparkles, WandSparkles, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
};

const EXAM_FILTER_OPTIONS: { key: string; label: string; value: ExamType | null }[] = [
  { key: "cbse", label: "CBSE", value: null },
  { key: "jee-mains", label: "JEE Mains", value: "JEE_Mains" },
  { key: "jee-advanced", label: "JEE Advance", value: "JEE_Advance" },
  { key: "kcet", label: "KCET", value: "KCET" },
  { key: "other", label: "Other", value: "other" },
];

const SUBJECT_OPTIONS: { subject: Subject; label: string }[] = [
  { subject: "physics", label: "Physics" },
  { subject: "chemistry", label: "Chemistry" },
  { subject: "math", label: "Maths" },
  { subject: "biology", label: "Biology" },
];

const SUBJECT_TONE: Record<Subject, string> = {
  physics: "border-cyan-400/60 text-cyan-300",
  chemistry: "border-rose-400/60 text-rose-300",
  math: "border-amber-400/60 text-amber-300",
  biology: "border-emerald-400/60 text-emerald-300",
};

function examMatchesFilter(profileExam: ExamType | null, dataExams: ExamType[]): boolean {
  if (!profileExam) return true;
  if (profileExam === "other") return true;
  if (dataExams.length === 0) return true;
  if (profileExam === "JEE_Mains" || profileExam === "JEE_Advance") return dataExams.includes("JEE");
  return dataExams.includes(profileExam);
}

function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeTopicKey(input: {
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  unitName: string;
  chapterTitle: string;
  topicName: string;
}): string {
  return [
    normalizeKeyPart(input.board),
    normalizeKeyPart(input.subject),
    String(input.classLevel),
    normalizeKeyPart(input.unitName),
    normalizeKeyPart(input.chapterTitle),
    normalizeKeyPart(input.topicName),
  ].join("||");
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
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
const RAIN_SLOT_COUNT = 16;
/** Fall distance matches fixed canvas height (wrong measured height → chips zip or crawl). */
const RAIN_TRICKLE_END_PX = RAIN_CANVAS_H + 30;
/** Quick left→right “wave” at the top edge; all streams still start at y=0 (top-down flow). */
const RAIN_ENTRY_STAGGER_S = 0.03;
/** Second chip per column starts half a cycle later → while one is mid-wall, the next is at the top (no dead band). */
const RAIN_TWIN_PHASE_FR = 0.5;
/** Visual + layout width (keep in sync with chip max-w in className below) */
const RAIN_CARD_MAX_W = 178;

const SUBJECT_DOT_COLOR: Record<Subject, string> = {
  physics:   "#38bdf8",
  chemistry: "#fb7185",
  math:      "#fbbf24",
  biology:   "#34d399",
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

/** Shorter falls → visible downward flow fills the wall within a couple seconds (still smooth, not frantic). */
function rainFallDurationSec(slotId: number, topicKey: string): number {
  const th = hashStr(topicKey);
  return Number((8 + ((slotId * 53 + th) % 1000) / 1000 * 7).toFixed(2));
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
  const storeUser = useUserStore((s) => s.user);
  const { toast } = useToast();

  const board = (storeUser?.board ?? "CBSE") as Board;
  const initialClass = profile?.class_level === 11 || profile?.class_level === 12 ? (profile.class_level as ClassLevel) : 11;
  const [selectedClass, setSelectedClass] = useState<ClassLevel>(initialClass);
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(storeUser?.examType ?? null);
  const [activeSubjects, setActiveSubjects] = useState<Set<Subject>>(new Set(["physics", "chemistry", "math"]));
  const [selectedTopicKeys, setSelectedTopicKeys] = useState<Set<string>>(new Set());
  const [basketItems, setBasketItems] = useState<MagicWallBasketItem[]>([]);
  const [loadingBasket, setLoadingBasket] = useState(false);
  const [savingBasket, setSavingBasket] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wfRef = useRef<HTMLDivElement>(null);
  const [wfSize, setWfSize] = useState({ width: 800, height: RAIN_CANVAS_H });
  const poolRef = useRef<RainTopic[]>([]);
  const queueRef = useRef(0);
  const slotLoopHandlerRef = useRef<(slotId: number, twinIndex: number) => void>(() => {});
  const [rainSlots, setRainSlots] = useState<RainSlot[]>([]);

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

  useEffect(() => {
    if (storeUser?.subjectCombo === "PCMB") {
      setActiveSubjects(new Set(["physics", "chemistry", "math", "biology"]));
    }
  }, [storeUser?.subjectCombo]);

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
      const examType = selectedExam ?? null;
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
      };
    });
  }, [taxonomy, board, selectedExam]);

  const filteredRainTopics = useMemo(() => {
    const seen = new Set<string>();
    // Collect per-subject buckets so each subject is always represented
    const buckets = new Map<Subject, RainTopic[]>();
    for (const item of catalog) {
      if (item.classLevel !== selectedClass) continue;
      if (!activeSubjects.has(item.subject)) continue;
      if (!examMatchesFilter(selectedExam, item.examRelevance)) continue;
      if (seen.has(item.topicKey)) continue;
      seen.add(item.topicKey);
      if (!buckets.has(item.subject)) buckets.set(item.subject, []);
      buckets.get(item.subject)!.push({
        topicKey:     item.topicKey,
        board:        item.board,
        subject:      item.subject,
        classLevel:   item.classLevel,
        examType:     item.examType,
        unitName:     item.unitName,
        chapterTitle: item.chapterTitle,
        topicName:    item.topicName,
        tag:          item.tag,
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
  }, [catalog, selectedClass, activeSubjects, selectedExam]);

  const filteredRainLatestRef = useRef(filteredRainTopics);
  filteredRainLatestRef.current = filteredRainTopics;

  const topicKeyOrderSig = useMemo(
    () => filteredRainTopics.map((t) => t.topicKey).sort().join("\0"),
    [filteredRainTopics]
  );

  const rainFilterKey = useMemo(
    () =>
      [
        String(selectedClass),
        selectedExam ?? "",
        [...activeSubjects].sort().join(","),
        topicKeyOrderSig,
      ].join("§"),
    [selectedClass, selectedExam, activeSubjects, topicKeyOrderSig]
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
        });
      }
    }
    return map;
  }, [filteredRainTopics, catalog]);

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
    const n = Math.min(RAIN_SLOT_COUNT, pool.length);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wfSize.width updates leftPx only (effect below)
  }, [loading, rainFilterKey, rainPool]);

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
  const hasUnsavedChanges = useMemo(() => !setsEqual(selectedTopicKeys, basketKeySet), [selectedTopicKeys, basketKeySet]);

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
    return out.sort((a, b) => a.subject.localeCompare(b.subject) || a.topicName.localeCompare(b.topicName));
  }, [selectedTopicKeys, topicMapByKey, basketItems, basketKeySet]);

  const refreshBasket = useCallback(async () => {
    if (!user?.id) return;
    setLoadingBasket(true);
    try {
      const rows = await fetchMagicWallBasket();
      setBasketItems(rows);
      setSelectedTopicKeys(new Set(rows.map((r) => r.topicKey)));
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to load reading basket",
        variant: "destructive",
      });
    } finally {
      setLoadingBasket(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    void refreshBasket();
  }, [refreshBasket]);

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
    setSelectedTopicKeys((prev) => {
      const next = new Set(prev);
      if (next.has(topicKey)) next.delete(topicKey);
      else next.add(topicKey);
      return next;
    });
  };

  const persistSelection = async () => {
    if (!hasUnsavedChanges) return;
    setSavingBasket(true);
    try {
      const toAdd = [...selectedTopicKeys].filter((key) => !basketKeySet.has(key));
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

      await Promise.all([upsertMagicWallBasketItems(addPayload), removeMagicWallBasketItems(toRemove)]);
      const rows = await fetchMagicWallBasket();
      setBasketItems(rows);
      setSelectedTopicKeys(new Set(rows.map((r) => r.topicKey)));
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

  const classPill = "rounded-xl border border-border bg-card/80 px-3 py-2 text-sm font-bold";

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto w-full max-w-[1520px] space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">
            <section className="min-w-0 rounded-3xl border border-white/10 bg-gradient-to-b from-[#121426] to-[#090b16] p-2 md:p-3">
              <div className="px-1 pb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                    <WandSparkles className="h-4.5 w-4.5 text-violet-300" />
                    Topic Rain — tap to select, add to basket
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {loading
                      ? "Loading curriculum from Supabase…"
                      : error && taxonomy.length === 0
                        ? "Curriculum could not be loaded from Supabase."
                        : filteredRainTopics.length === 0
                          ? "No topics match your filters."
                          : `${filteredRainTopics.length} topics loaded · ${rainSlots.length} columns (${rainSlots.length * 2} live drops) · class ${selectedClass}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter topics</p>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subjects</span>
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
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl p-1">
                      {[11, 12].map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setSelectedClass(lv as ClassLevel)}
                          className={`${classPill} ${
                            selectedClass === lv ? "border-violet-400 bg-violet-500/20 text-violet-200" : "text-slate-300"
                          }`}
                        >
                          Class {lv}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl p-1 overflow-x-auto">
                      {EXAM_FILTER_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSelectedExam(opt.value)}
                          className={`${classPill} ${
                            selectedExam === opt.value ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "text-slate-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Topic Rain canvas (EduBlast waterfall / trickle) ─── */}
              <div
                ref={wfRef}
                className="relative w-full min-w-0 overflow-hidden rounded-[14px] border border-white/[0.06] bg-white/[0.015]"
                style={
                  {
                    height: RAIN_CANVAS_H,
                    ["--mw-trickle-end" as string]: `${RAIN_TRICKLE_END_PX}px`,
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
                    <span className="text-sm font-medium">Loading curriculum from Supabase…</span>
                    <span className="max-w-sm text-xs text-slate-500">
                      Topic Rain starts after your syllabus is loaded — each column keeps two topics falling so the top never goes quiet.
                    </span>
                  </div>
                )}
                {!loading && filteredRainTopics.length === 0 && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-300">
                    {error && taxonomy.length === 0 ? (
                      <>
                        <span className="font-semibold text-slate-200">Supabase curriculum unavailable</span>
                        <span className="max-w-md text-xs text-slate-500">{error}</span>
                      </>
                    ) : (
                      <span>No topics for selected filters. Try another class, exam, or subject.</span>
                    )}
                  </div>
                )}

                {!loading &&
                  rainSlots.flatMap((slot) => {
                    const { topics, leftPx, duration, baseAnimDelay, depthZ, slotId } = slot;
                    return [0, 1].map((twinIx) => {
                      const topic = topics[twinIx]!;
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
                          className={cn(
                            "absolute top-0 flex min-w-0 max-w-[min(178px,calc(100%-12px))] cursor-pointer select-none items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition-[border-color,background-color] duration-150",
                            tone,
                            selected && "border-[1.5px] ring-1 ring-white/15"
                          )}
                          style={{
                            left: leftPx,
                            zIndex: selected ? 60 : depthZ + twinIx,
                            willChange: "transform, opacity",
                            animationName: "magic-trickle",
                            animationDuration: `${duration}s`,
                            animationTimingFunction: "linear",
                            animationIterationCount: "infinite",
                            animationDelay: `${animDelay}s`,
                            animationFillMode: "backwards",
                          }}
                        >
                          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate font-medium text-[rgba(232,232,240,0.9)]">
                            {topic.topicName}
                          </span>
                          <span className="shrink-0 text-[9px] text-[rgba(232,232,240,0.32)]">C{topic.classLevel}</span>
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
              <div className="mt-3 rounded-xl border border-violet-400/40 bg-violet-500/20 px-3 py-2 text-xs font-bold text-violet-100">
                Add <span className="text-white">{selectedTopicKeys.size}</span> selected topics to reading basket
              </div>
            </section>

            <aside className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#121425] to-[#0a0c16] p-3 space-y-2.5">
              <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-3">
                <p className="text-[11px] uppercase tracking-wider font-bold text-amber-200">Live Study Hour</p>
                <p className="mt-1 text-sm font-extrabold text-white">25 min study · 5 min break</p>
                <p className="text-xs text-amber-100/80">Syncs with streak rhythm</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-extrabold text-white">Reading Basket</p>
                  <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-100">
                    {selectedDetails.length} topics
                  </span>
                </div>
                {loadingBasket ? (
                  <p className="text-xs text-slate-400">Loading basket...</p>
                ) : selectedDetails.length === 0 ? (
                  <p className="text-xs text-slate-400">No topics selected yet. Tap cards in Topic Rain.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[455px] overflow-y-auto pr-1">
                    {selectedDetails.map((item) => (
                      <div key={item.topicKey} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.topicName}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {item.subject.toUpperCase()} · C{item.classLevel} · {item.chapterTitle}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleTopic(item.topicKey)}
                            className="p-1 rounded-md border border-white/20 text-slate-300 hover:text-white hover:border-white/40"
                            title="Remove from basket selection"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <p className={`mt-1 text-[10px] font-semibold ${item.saved ? "text-emerald-300" : "text-amber-300"}`}>
                          {item.saved ? "Saved" : "Pending save"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <div className="sticky bottom-4 z-30">
            <div className="rounded-2xl border border-violet-400/35 bg-violet-500/20 backdrop-blur-xl p-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-violet-100">
                Reading Basket: {selectedTopicKeys.size} selected · {basketItems.length} saved
              </div>
              <Button
                onClick={persistSelection}
                disabled={savingBasket || !hasUnsavedChanges}
                className="rounded-xl font-extrabold bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-60"
              >
                {savingBasket ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Add {selectedTopicKeys.size} selected topics to reading basket
                  </>
                )}
              </Button>
            </div>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
