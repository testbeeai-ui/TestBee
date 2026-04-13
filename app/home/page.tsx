"use client";

import { type ComponentType, useMemo } from "react";
import { buildActivityHeatmapModel } from "@/lib/activityHeatmap";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { questions } from "@/data/questions";
import AppLayout from "@/components/AppLayout";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import TeacherDashboard from "@/components/TeacherDashboard";
import {
  BookOpen,
  BookText,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  Coins,
  Flame,
  GraduationCap,
  Sigma,
  TrendingUp,
  Target,
} from "lucide-react";
import { Subject } from "@/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type SubjectStat = {
  subject: Subject;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
};

const SUBJECT_META: Record<
  Subject,
  {
    label: string;
    short: string;
    tones: {
      border: string;
      badge: string;
      chip: string;
      percent: string;
    };
    tags: string[];
  }
> = {
  physics: {
    label: "Physics",
    short: "P",
    tones: {
      border: "border-blue-500/45 dark:border-blue-400/45",
      badge: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
      chip: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
      percent: "text-blue-600 dark:text-blue-300",
    },
    tags: ["Electrostatics", "Mechanics", "Optics"],
  },
  chemistry: {
    label: "Chemistry",
    short: "C",
    tones: {
      border: "border-rose-500/45 dark:border-rose-400/45",
      badge: "bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
      chip: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
      percent: "text-rose-600 dark:text-rose-300",
    },
    tags: ["Organic", "Inorganic", "Physical"],
  },
  math: {
    label: "Mathematics",
    short: "M",
    tones: {
      border: "border-violet-500/45 dark:border-violet-400/45",
      badge: "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
      chip: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
      percent: "text-violet-600 dark:text-violet-300",
    },
    tags: ["Calculus", "Algebra", "Geometry"],
  },
  biology: {
    label: "Biology",
    short: "B",
    tones: {
      border: "border-emerald-500/45 dark:border-emerald-400/45",
      badge: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
      chip: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
      percent: "text-emerald-600 dark:text-emerald-300",
    },
    tags: ["Botany", "Zoology", "Genetics"],
  },
};

const EXAM_CARDS: Array<{
  key: string;
  title: string;
  subtitle: string;
  tone: string;
  iconBg: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    key: "cbse",
    title: "CBSE Board",
    subtitle: "0 tests · Class 12",
    tone: "border-blue-500/35 dark:border-blue-400/35",
    iconBg: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
    icon: GraduationCap,
  },
  {
    key: "jee-main",
    title: "JEE Main",
    subtitle: "0 tests · NTA pattern",
    tone: "border-amber-500/35 dark:border-amber-400/35",
    iconBg: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
    icon: BrainCircuit,
  },
  {
    key: "jee-advanced",
    title: "JEE Advanced",
    subtitle: "0 tests · IIT pattern",
    tone: "border-violet-500/35 dark:border-violet-400/35",
    iconBg: "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
    icon: Sigma,
  },
  {
    key: "kcet",
    title: "KCET",
    subtitle: "0 tests · Karnataka",
    tone: "border-emerald-500/35 dark:border-emerald-400/35",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
    icon: BookText,
  },
];

const QUICK_ACTIONS = [
  {
    label: "Question Gun",
    desc: "Fire 5 random questions",
    path: "/play",
    tone: "from-orange-500 to-red-500",
    icon: Flame,
  },
  {
    label: "Mock Test",
    desc: "Take a timed subject exam",
    path: "/mock",
    tone: "from-indigo-500 to-blue-500",
    icon: BookOpen,
  },
  {
    label: "Explore Topics",
    desc: "Browse by subject & topic",
    path: "/explore",
    tone: "from-cyan-500 to-blue-500",
    icon: Target,
  },
  {
    label: "Gyan++",
    desc: "Get help from peers",
    path: "/doubts",
    tone: "from-amber-500 to-orange-500",
    icon: TrendingUp,
  },
  {
    label: "My Classes",
    desc: "Join or explore classrooms",
    path: "/classrooms",
    tone: "from-emerald-500 to-teal-500",
    icon: GraduationCap,
  },
];

function RingDial({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-14 w-14 rounded-full border border-border/70 bg-background/80 p-1 dark:bg-slate-900/60">
        <div className="flex h-full w-full items-center justify-center rounded-full border border-border/60 text-muted-foreground">
          <CircleDashed className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function SubjectBreakdownCard({ stat }: { stat: SubjectStat }) {
  const meta = SUBJECT_META[stat.subject];
  return (
    <div className={`rounded-2xl border bg-card/80 p-4 dark:bg-slate-950/65 ${meta.tones.border}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${meta.tones.badge}`}>
              {meta.short}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{meta.label}</p>
              <p className="text-xs text-muted-foreground">0 quizzes · {stat.total} questions</p>
            </div>
          </div>
        </div>
        <p className={`text-3xl font-extrabold tracking-tight ${meta.tones.percent}`}>{stat.accuracy}%</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/60 bg-background/70 px-2 py-1.5 text-center dark:bg-slate-900/50">
          <p className="text-lg font-bold text-emerald-500">{stat.correct}</p>
          <p className="text-[11px] text-muted-foreground">Correct</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 px-2 py-1.5 text-center dark:bg-slate-900/50">
          <p className="text-lg font-bold text-rose-500">{stat.wrong}</p>
          <p className="text-[11px] text-muted-foreground">Wrong</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 px-2 py-1.5 text-center dark:bg-slate-900/50">
          <p className="text-lg font-bold text-muted-foreground">{stat.skipped}</p>
          <p className="text-[11px] text-muted-foreground">Skipped</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {meta.tags.map((tag) => (
          <span key={tag} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.tones.chip}`}>
            {tag}
          </span>
        ))}
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">+ more</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { profile, session } = useAuth();
  const user = useUserStore((s) => s.user);
  const allResults = useUserStore((s) => s.allResults);
  const router = useRouter();
  const streakTimer = useStreakTimer();

  const subjects: Subject[] = useMemo(() => {
    if (!user) return ["physics", "chemistry", "math"];
    return user.subjectCombo === "PCMB"
      ? ["physics", "chemistry", "math", "biology"]
      : ["physics", "chemistry", "math"];
  }, [user]);

  const subjectStats = useMemo(() => {
    return subjects.map<SubjectStat>((subject) => {
      const subjectQIds = questions.filter((q) => q.subject === subject).map((q) => q.id);
      const subjectResults = allResults.filter((r) => subjectQIds.includes(r.questionId));
      const total = subjectResults.length;
      const correct = subjectResults.filter((r) => r.isCorrect).length;
      const wrong = total - correct;
      const skipped = 0;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { subject, total, correct, wrong, skipped, accuracy };
    });
  }, [subjects, allResults]);

  const totalAnswered = allResults.length;
  const totalCorrect = allResults.filter((r) => r.isCorrect).length;
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalWrong = totalAnswered - totalCorrect;
  const totalSkipped = subjectStats.reduce((sum, s) => sum + s.skipped, 0);

  const accountStartForHeatmap = useMemo(() => {
    const raw = profile?.created_at ?? session?.user?.created_at;
    if (!raw || typeof raw !== "string") return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [profile?.created_at, session?.user?.created_at]);

  const activityHeatmap = useMemo(
    () => buildActivityHeatmapModel(allResults, accountStartForHeatmap, new Date()),
    [allResults, accountStartForHeatmap]
  );

  if (profile?.role === "teacher") {
    return (
      <ProtectedRoute>
        <TeacherDashboard />
      </ProtectedRoute>
    );
  }

  /** GitHub-style fixed squares — avoids 1fr row/column stretch into wide bars. */
  const HEATMAP_CELL_PX = 14;
  const HEATMAP_GAP_PX = 4;
  const heatmapNumWeeks = activityHeatmap.numWeeks;
  const heatmapColTemplate = `repeat(${heatmapNumWeeks}, ${HEATMAP_CELL_PX}px)`;
  const heatmapGridW =
    heatmapNumWeeks * HEATMAP_CELL_PX + Math.max(0, heatmapNumWeeks - 1) * HEATMAP_GAP_PX;
  const heatmapGridH = 7 * HEATMAP_CELL_PX + 6 * HEATMAP_GAP_PX;
  const heatmapMonthLabelPositions = useMemo(
    () =>
      activityHeatmap.monthTicks.map((tick) => ({
        ...tick,
        left: tick.weekIndex * (HEATMAP_CELL_PX + HEATMAP_GAP_PX),
      })),
    [activityHeatmap.monthTicks]
  );

  const motivationalTips = [
    "Consistency beats intensity. Solve at least 5 questions daily!",
    "Review your mistakes — they're your best teachers.",
    "Challenge a friend to a mock test today!",
    "Spaced repetition boosts memory by 200%. Use your Revision cards!",
    "Top rankers help others in Gyan++. Help someone today!",
    "A 25-minute focused session is worth 2 hours of distracted study.",
    "Break hard problems into smaller steps. Start with what you know.",
  ];
  const dailyTip = motivationalTips[new Date().getDay() % motivationalTips.length];

  const statCards = [
    {
      icon: Target,
      label: "Questions Done",
      value: totalAnswered,
      tone: "border-amber-500/40 dark:border-amber-400/40",
      iconTone: "text-amber-600 dark:text-amber-300",
    },
    {
      icon: TrendingUp,
      label: "Accuracy",
      value: `${overallAccuracy}%`,
      tone: "border-emerald-500/40 dark:border-emerald-400/40",
      iconTone: "text-emerald-600 dark:text-emerald-300",
    },
    {
      icon: Coins,
      label: "RDM Balance",
      value: profile?.rdm ?? user?.rdm ?? 0,
      tone: "border-orange-500/40 dark:border-orange-400/40",
      iconTone: "text-orange-600 dark:text-orange-300",
    },
    {
      icon: BookOpen,
      label: "Saved",
      value: user?.savedQuestions.length ?? 0,
      tone: "border-violet-500/40 dark:border-violet-400/40",
      iconTone: "text-violet-600 dark:text-violet-300",
    },
  ];

  return (
    <ProtectedRoute>
      <AppLayout streakTimer={streakTimer}>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-1 pb-6">
          <section className="relative overflow-hidden rounded-3xl border border-blue-300/35 bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 p-6 text-white shadow-[0_24px_65px_rgba(37,99,235,0.28)] dark:border-white/10 dark:shadow-[0_26px_70px_rgba(37,99,235,0.35)] md:p-8">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-white/80">Welcome back 👋</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{user?.name}!</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold backdrop-blur">🎓 Class {user?.classLevel}</span>
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold backdrop-blur">📚 {user?.subjectCombo}</span>
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold backdrop-blur">🔬 Science</span>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-14 -top-10 h-40 w-40 rounded-full bg-white/12" />
            <div className="pointer-events-none absolute right-1/3 top-8 h-24 w-24 rounded-full bg-white/10" />
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((stat, i) => (
              <div
                key={stat.label}
                className={`rounded-2xl border bg-card/90 px-4 py-3.5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-950/60 md:py-4 ${stat.tone} ${i === 0 ? "lg:col-start-1" : ""}`}
              >
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 dark:bg-white/5">
                  <stat.icon className={`h-4 w-4 ${stat.iconTone}`} />
                </div>
                <p className="text-2xl font-extrabold tracking-tight text-foreground">{stat.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-emerald-500/5 px-4 py-4 dark:border-orange-400/20 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                <Flame className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                <span className="text-orange-600 dark:text-orange-300">Daily Tip</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date().toLocaleDateString("en-US", { weekday: "long" })}
                </span>
              </p>
            </div>
            <p className="flex-1 text-sm text-muted-foreground">{dailyTip}</p>
            <button
              onClick={() => router.push("/play")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Start Streak
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          <section className="grid gap-5 lg:grid-cols-5">
            <div className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60 lg:col-span-3">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                  <BookOpen className="h-4 w-4" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Quiz breakdown by subject</h2>
              </div>
              <div className="space-y-3">
                {subjectStats.map((stat) => (
                  <SubjectBreakdownCard key={stat.subject} stat={stat} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 dark:bg-slate-900/40">
                <p className="text-sm text-muted-foreground">
                  Total quizzes taken <span className="float-right text-lg font-bold text-foreground">0</span>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/12 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-300">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Quick actions</h2>
              </div>
              <div className="space-y-2.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => router.push(action.path)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-3 text-left transition-all hover:border-primary/35 hover:bg-muted/40 dark:bg-slate-900/45"
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.tone} text-white shadow-sm`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Test performance by category</h2>
              <p className="text-sm text-muted-foreground">Speed · Accuracy · Stamina dials</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {EXAM_CARDS.map((card) => (
                <div key={card.key} className={`rounded-2xl border bg-background/75 p-4 dark:bg-slate-900/50 ${card.tone}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}>
                        <card.icon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-base font-semibold text-foreground">{card.title}</p>
                        <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">0</p>
                      <p className="text-[11px] text-muted-foreground">Tests</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-500">0%</p>
                      <p className="text-[11px] text-muted-foreground">Avg score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-500">—</p>
                      <p className="text-[11px] text-muted-foreground">Best rank</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-around rounded-xl border border-border/60 bg-background/70 py-2 dark:bg-slate-950/50">
                    <RingDial label="Speed" />
                    <RingDial label="Accuracy" />
                    <RingDial label="Stamina" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                <CalendarDays className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Activity heatmap</h2>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-xs text-muted-foreground sm:text-sm">
                  <p className="font-medium text-foreground/90">
                    {activityHeatmap.contributionsInRange} contribution
                    {activityHeatmap.contributionsInRange === 1 ? "" : "s"} in Jan–Jun
                  </p>
                  <p className="break-words" title={activityHeatmap.rangeLabel}>
                    {activityHeatmap.rangeLabel}
                  </p>
                </div>

                <div className="max-w-full overflow-x-auto">
                  <div className="inline-block rounded-xl border border-border/70 bg-background/70 p-3 pb-2 align-middle dark:bg-slate-900/45">
                    <div className="relative mb-1.5 h-4" style={{ width: heatmapGridW }}>
                      {heatmapMonthLabelPositions.map((tick) => (
                        <span
                          key={`${tick.weekIndex}-${tick.label}`}
                          className="absolute top-0 text-left text-[10px] font-medium leading-none text-muted-foreground sm:text-[11px]"
                          style={{ left: tick.left }}
                        >
                          {tick.label}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <div
                        className="grid w-7 shrink-0 text-[9px] font-medium leading-none text-muted-foreground select-none sm:w-8 sm:text-[10px]"
                        style={{
                          gridTemplateRows: `repeat(7, ${HEATMAP_CELL_PX}px)`,
                          rowGap: HEATMAP_GAP_PX,
                          height: heatmapGridH,
                          alignContent: "start",
                        }}
                      >
                        {(["Sun", "", "Tue", "", "Thu", "", "Sat"] as const).map((label, i) => (
                          <div key={i} className="flex items-center justify-end pr-0.5">
                            {label}
                          </div>
                        ))}
                      </div>

                      <div
                        className="grid shrink-0 grid-flow-col"
                        style={{
                          gridTemplateColumns: heatmapColTemplate,
                          gridTemplateRows: `repeat(7, ${HEATMAP_CELL_PX}px)`,
                          gap: HEATMAP_GAP_PX,
                          width: heatmapGridW,
                          height: heatmapGridH,
                        }}
                      >
                        {activityHeatmap.cells.map((cell, idx) => {
                          const intensity = cell.intensity;
                          const title = cell.isFuture
                            ? `${cell.day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · Upcoming`
                            : `${cell.day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${cell.count} question${cell.count === 1 ? "" : "s"}`;
                          const base =
                            "min-h-0 min-w-0 rounded-[2px] outline outline-1 -outline-offset-1 transition-colors";
                          const tone =
                            cell.isFuture
                              ? "bg-muted/30 opacity-45 outline-transparent"
                              : intensity === 0
                                ? "bg-muted/80 outline-border/40 dark:bg-slate-800/90 dark:outline-white/10"
                                : intensity === 1
                                  ? "bg-violet-300/95 outline-violet-500/25 dark:bg-violet-950 dark:outline-violet-500/20"
                                  : intensity === 2
                                    ? "bg-violet-400/95 outline-violet-500/30 dark:bg-violet-800 dark:outline-violet-400/25"
                                    : intensity === 3
                                      ? "bg-violet-500/95 outline-violet-400/35 dark:bg-violet-600 dark:outline-violet-300/30"
                                      : "bg-violet-600 text-white outline-violet-300/40 dark:bg-violet-400 dark:outline-violet-200/35";
                          return (
                            <div
                              key={idx}
                              className={`${base} ${tone} h-full w-full`}
                              title={title}
                              role="img"
                              aria-label={title}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Less</span>
                  <span className="h-3 w-3 rounded-sm bg-muted/80 outline outline-1 -outline-offset-1 outline-border/40 sm:h-3.5 sm:w-3.5 dark:bg-slate-800/90" />
                  <span className="h-3 w-3 rounded-sm bg-violet-300/95 outline outline-1 -outline-offset-1 outline-violet-500/25 sm:h-3.5 sm:w-3.5 dark:bg-violet-950" />
                  <span className="h-3 w-3 rounded-sm bg-violet-400/95 outline outline-1 -outline-offset-1 outline-violet-500/30 sm:h-3.5 sm:w-3.5 dark:bg-violet-800" />
                  <span className="h-3 w-3 rounded-sm bg-violet-500/95 outline outline-1 -outline-offset-1 outline-violet-400/35 sm:h-3.5 sm:w-3.5 dark:bg-violet-600" />
                  <span className="h-3 w-3 rounded-sm bg-violet-600 outline outline-1 -outline-offset-1 outline-violet-300/40 sm:h-3.5 sm:w-3.5 dark:bg-violet-400" />
                  <span>More</span>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:w-[min(100%,280px)] lg:min-w-[220px]">
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2.5 dark:bg-slate-900/55">
                  <p className="text-[11px] text-muted-foreground">Overall Correct</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-500 sm:text-2xl">{totalCorrect}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2.5 dark:bg-slate-900/55">
                  <p className="text-[11px] text-muted-foreground">Overall Wrong</p>
                  <p className="text-xl font-bold tabular-nums text-rose-500 sm:text-2xl">{totalWrong}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2.5 dark:bg-slate-900/55">
                  <p className="text-[11px] text-muted-foreground">Overall Skipped</p>
                  <p className="text-xl font-bold tabular-nums text-muted-foreground sm:text-2xl">{totalSkipped}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2.5 dark:bg-slate-900/55">
                  <p className="text-[11px] text-muted-foreground">Daily Momentum</p>
                  <p className="text-xl font-bold tabular-nums text-amber-500 sm:text-2xl">
                    {Math.max(1, Math.min(7, Math.floor(totalAnswered / 5) || 1))}x
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
