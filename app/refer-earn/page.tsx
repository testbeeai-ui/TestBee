"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import InlineRdmChallenge from "@/components/play/InlineRdmChallenge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { computeStreakDays } from "@/lib/dashboard/gauntletStreak";
import {
  formatReferDurationMmSs,
  getReferChallengeSpecs,
  referChallengeSessionDurationSec,
  referChallengeSpec,
  type ReferChallengePublicSpec,
  type ReferClaimKey,
} from "@/lib/rdm/referral/referEarnChallenges";
import { reportChallengeYourselfAttempt } from "@/lib/rdm/reports/reportChallengeYourselfAttempt";
import { cn } from "@/lib/utils";
import { EARN_LEARN_AUTO_CLAIM_LINE } from "@/lib/rdm/referral/referEarnAutoClaimCopy";
import {
  DEFAULT_RDM_CONFIG,
  fetchRdmConfig,
  rdmConfigShallowEqual,
  type RdmConfigParams,
} from "@/lib/rdm/rdmConfig";
import type { PlayDomain } from "@/types";
import { EarnLearnRightColumn } from "@/components/refer-earn/EarnLearnRightColumn";
import { EDUFUND_RDM_GATES } from "@/lib/dashboard/dashboardSidebarMetrics";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  Info,
  Link2,
  Loader2,
  Play,
  Send,
  Sparkles,
  Star,
  Timer,
  Users,
} from "lucide-react";

type ReferTab = "how" | "tiers" | "leaderboard" | "faq" | "learning_buddy";

const TAB_ITEMS: {
  key: ReferTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "how", label: "How it works", icon: Clock },
  { key: "tiers", label: "Reward tiers", icon: Star },
  { key: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { key: "faq", label: "FAQ", icon: Info },
  { key: "learning_buddy", label: "Learning Buddy", icon: Users },
];

type RedeemMarketingKey =
  | "redeem_practice_packs_from_rdm"
  | "redeem_mock_tests_from_rdm"
  | "redeem_analytics_pro_from_rdm"
  | "redeem_edufund_entry_from_rdm";

const REWARD_USE_BASE: ReadonlyArray<{
  title: string;
  emoji: string;
  titleClass: string;
  borderClass: string;
  configKey: RedeemMarketingKey;
}> = [
  {
    title: "Practice Packs",
    emoji: "🎁",
    titleClass: "text-violet-300",
    borderClass: "border-violet-500/30",
    configKey: "redeem_practice_packs_from_rdm",
  },
  {
    title: "Mock Tests",
    emoji: "📝",
    titleClass: "text-amber-300",
    borderClass: "border-amber-500/30",
    configKey: "redeem_mock_tests_from_rdm",
  },
  {
    title: "Analytics Pro",
    emoji: "📊",
    titleClass: "text-teal-300",
    borderClass: "border-teal-500/30",
    configKey: "redeem_analytics_pro_from_rdm",
  },
  {
    title: "EduFund Entry",
    emoji: "🏆",
    titleClass: "text-rose-300",
    borderClass: "border-rose-500/30",
    configKey: "redeem_edufund_entry_from_rdm",
  },
];

const GRANT_TIER_KEYS = ["sprout", "scholar", "champion", "elite", "masterblaster"] as const;
const GRANT_TIER_ICONS = ["🌱", "📚", "🏆", "🚀", "👑"] as const;

/** EduFund grant tiers — thresholds and ₹ unlocked from `EDUFUND_RDM_GATES` only. */
const GRANT_TIERS = EDUFUND_RDM_GATES.map((g, i) => ({
  key: GRANT_TIER_KEYS[i]!,
  name: g.name,
  threshold: g.need,
  grant: "₹" + g.unlockInrAmount.toLocaleString("en-IN"),
  icon: GRANT_TIER_ICONS[i]!,
}));

function referMinPct(spec: ReferChallengePublicSpec): number {
  return Math.round((spec.minCorrect / spec.questionCount) * 100);
}

/** Earn & Learn page typography (single sans scale). */
const reLabel = "text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500";
const reBody = "text-xs leading-relaxed text-slate-400";
const reTitle = "text-sm font-semibold text-white";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatInt(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatReferralCreditedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const REFER_TAB_KEYS = new Set<ReferTab>([
  "how",
  "tiers",
  "leaderboard",
  "faq",
  "learning_buddy",
]);

function ReferEarnPageContent() {
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const isReferAdmin = useIsAppAdmin();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReferTab>("how");

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && REFER_TAB_KEYS.has(fromUrl as ReferTab)) {
      setTab(fromUrl as ReferTab);
    }
  }, [searchParams]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ReferClaimKey | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [playedToday, setPlayedToday] = useState<{ academic: boolean; funbrain: boolean }>({
    academic: false,
    funbrain: false,
  });
  const [referClaims, setReferClaims] = useState<
    Partial<Record<ReferClaimKey, { winClaimed: boolean; shareClaimed: boolean }>>
  >({});
  const [dailyRdmEarned, setDailyRdmEarned] = useState(0);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const inlineChallengeRef = useRef<HTMLDivElement>(null);
  const [activeReferClaim, setActiveReferClaim] = useState<ReferClaimKey | null>(null);
  /** Snapshot at challenge start so `rdmConfig` refetches do not replace `spec` and reset MCQ state. */
  const [challengeSessionSpec, setChallengeSessionSpec] =
    useState<ReferChallengePublicSpec | null>(null);
  const challengeActiveRef = useRef(false);
  const [friendsReferred, setFriendsReferred] = useState(0);
  const [weeklyReferrals, setWeeklyReferrals] = useState(0);
  const [leaderboardRows, setLeaderboardRows] = useState<
    { rank: number; userId: string; name: string; referralCount: number }[]
  >([]);
  const [leaderboardWeekLabel, setLeaderboardWeekLabel] = useState<string | null>(null);
  const [referralStatsLoading, setReferralStatsLoading] = useState(false);
  const [myReferralHistory, setMyReferralHistory] = useState<
    {
      id: string;
      creditedAt: string;
      creditedWeekStartIst: string;
      refereeName: string;
    }[]
  >([]);
  const [rdmConfig, setRdmConfig] = useState<RdmConfigParams>(() => ({ ...DEFAULT_RDM_CONFIG }));

  useEffect(() => {
    challengeActiveRef.current = activeReferClaim !== null;
  }, [activeReferClaim]);

  const mergeRdmConfig = useCallback((next: RdmConfigParams) => {
    setRdmConfig((prev) => (rdmConfigShallowEqual(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    void fetchRdmConfig().then(mergeRdmConfig);
  }, [mergeRdmConfig]);

  /** Refresh config when the tab becomes visible again — not during an active challenge (avoids MCQ reset). No `window` focus listener (too noisy). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void fetchRdmConfig().then((next) => {
        if (challengeActiveRef.current) return;
        mergeRdmConfig(next);
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mergeRdmConfig]);

  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const perReferral = rdmConfig.referral_referrer_reward;
  const bonusAtFive = rdmConfig.referral_weekly_bonus_rdm;
  const weeklyTarget = rdmConfig.referral_weekly_bonus_threshold;
  const refereeWelcome = rdmConfig.referral_referee_welcome;
  const dailyChallengeRdmCap = rdmConfig.refer_challenge_daily_rdm_cap;

  const currentChallengeSpecs = useMemo(() => getReferChallengeSpecs(rdmConfig), [rdmConfig]);

  const rewardUsesDisplay = useMemo(
    () =>
      REWARD_USE_BASE.map((item) => ({
        ...item,
        from: `from ${formatInt(rdmConfig[item.configKey])} RDM`,
      })),
    [rdmConfig]
  );

  const howItWorksSteps = useMemo(
    () => [
      {
        n: 1,
        title: "Copy your link",
        body: "Your unique referral link is ready above. Tap copy — it takes 1 second.",
        icon: Link2,
        ring: "text-violet-400",
      },
      {
        n: 2,
        title: "Share with friends",
        body: "Send via WhatsApp or your study groups. Works best when it’s personal.",
        icon: Send,
        ring: "text-teal-400",
      },
      {
        n: 3,
        title: "Both of you earn",
        body: `You get ${perReferral} RDM when referrals are tracked. Your friend gets ${refereeWelcome} RDM as a welcome bonus after onboarding.`,
        icon: Sparkles,
        ring: "text-amber-400",
      },
    ],
    [perReferral, refereeWelcome]
  );

  const FAQ_ITEMS = useMemo(() => {
    const pp = rdmConfig.redeem_practice_packs_from_rdm;
    const mt = rdmConfig.redeem_mock_tests_from_rdm;
    const ap = rdmConfig.redeem_analytics_pro_from_rdm;
    const ef = rdmConfig.redeem_edufund_entry_from_rdm;
    return [
      {
        q: "What uses RDM?",
        a: `RDM can be redeemed for Practice Packs (from ${formatInt(pp)} RDM), Full Mock Tests (from ${formatInt(mt)} RDM), Analytics Pro (from ${formatInt(ap)} RDM), and EduFund scholarship entries (from ${formatInt(ef)} RDM). More rewards are added regularly.`,
      },
      {
        q: "How many RDM do I get per referral?",
        a: `You earn ${perReferral} RDM when your friend signs up using your link. You get an additional ${bonusAtFive} RDM bonus when you hit ${weeklyTarget} referrals in a week.`,
      },
      {
        q: "Does my friend also get RDM?",
        a: `Yes! Your friend gets ${refereeWelcome} RDM as a welcome bonus when they sign up through your link. It appears in their balance after onboarding.`,
      },
      {
        q: "When does the leaderboard reset?",
        a: "The referral leaderboard resets every Monday at 12:00 AM IST. Your total RDM balance never resets — only the weekly ranking does.",
      },
      {
        q: "How do challenge RDM rewards work (MentaMill / FunBrain / Arena)?",
        a: `${EARN_LEARN_AUTO_CLAIM_LINE} Referral bonuses from your invite link are credited when referrals are tracked, separately from challenge RDM.`,
      },
    ];
  }, [rdmConfig, perReferral, bonusAtFive, weeklyTarget, refereeWelcome]);

  const refCode = useMemo(() => {
    const fallbackHandle = (user?.name || "guest").replace(/\s+/g, "").slice(0, 7);
    const seed = (profile?.id || fallbackHandle).replace(/-/g, "").slice(0, 7).toUpperCase();
    return seed;
  }, [profile?.id, user?.name]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?ref=${refCode}`;
  }, [refCode]);

  const displayHost = useMemo(() => {
    if (typeof window === "undefined") return `edublast.in/join?ref=${refCode}`;
    try {
      const host = window.location.host;
      return `${host}/join?ref=${refCode}`;
    } catch {
      return `edublast.in/join?ref=${refCode}`;
    }
  }, [refCode]);

  const loadGauntletMeta = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) {
      setStreakDays(0);
      setPlayedToday({ academic: false, funbrain: false });
      setReferClaims({});
      setDailyRdmEarned(0);
      return;
    }
    const today = todayUtc();
    const { data: rows } = await supabase
      .from("daily_gauntlet_attempts")
      .select("gauntlet_date")
      .eq("user_id", uid)
      .order("gauntlet_date", { ascending: false })
      .limit(120);

    const dates = [...new Set((rows ?? []).map((r) => r.gauntlet_date))];
    setStreakDays(computeStreakDays(dates));

    const played = { academic: false, funbrain: false };
    for (const domain of ["academic", "funbrain"] as PlayDomain[]) {
      const { data: lb } = await supabase.rpc("get_daily_gauntlet_leaderboard", {
        p_gauntlet_date: today,
        p_domain: domain,
      });
      const lbRows = (lb as { user_id?: string }[]) || [];
      if (lbRows.some((r) => r.user_id === uid)) played[domain] = true;
    }
    setPlayedToday(played);
    const { data: referStatus } = await supabase.rpc("get_refer_challenge_day_status", {
      p_claim_date: today,
    });
    const status = (referStatus ?? null) as {
      ok?: boolean;
      daily_earned?: number;
      claims?: { challenge_key?: string; win_claimed?: boolean; share_claimed?: boolean }[];
    } | null;
    if (status?.ok) {
      setDailyRdmEarned(Number(status.daily_earned ?? 0));
      const nextClaims: Partial<
        Record<ReferClaimKey, { winClaimed: boolean; shareClaimed: boolean }>
      > = {};
      for (const row of status.claims ?? []) {
        const key = row.challenge_key as ReferClaimKey | undefined;
        if (!key) continue;
        nextClaims[key] = {
          winClaimed: Boolean(row.win_claimed),
          shareClaimed: Boolean(row.share_claimed),
        };
      }
      setReferClaims(nextClaims);
    } else {
      setDailyRdmEarned(0);
      setReferClaims({});
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadGauntletMeta();
  }, [loadGauntletMeta]);

  const loadReferralStats = useCallback(async () => {
    if (!profile?.id) {
      setFriendsReferred(0);
      setWeeklyReferrals(0);
      setLeaderboardRows([]);
      setLeaderboardWeekLabel(null);
      setMyReferralHistory([]);
      return;
    }
    setReferralStatsLoading(true);
    try {
      const [statsRes, lbRes, mineRes] = await Promise.all([
        fetch("/api/referral/stats", { credentials: "include", cache: "no-store" }),
        fetch("/api/referral/leaderboard", { cache: "no-store" }),
        fetch("/api/referral/my-referrals", { credentials: "include", cache: "no-store" }),
      ]);
      if (statsRes.ok) {
        const j = (await statsRes.json()) as {
          totalReferrals?: number;
          weeklyReferrals?: number;
        };
        setFriendsReferred(typeof j.totalReferrals === "number" ? j.totalReferrals : 0);
        setWeeklyReferrals(typeof j.weeklyReferrals === "number" ? j.weeklyReferrals : 0);
      }
      if (lbRes.ok) {
        const j = (await lbRes.json()) as {
          entries?: { rank: number; userId: string; name: string; referralCount: number }[];
          weekStartIst?: string;
        };
        setLeaderboardRows(Array.isArray(j.entries) ? j.entries : []);
        setLeaderboardWeekLabel(typeof j.weekStartIst === "string" ? j.weekStartIst : null);
      }
      if (mineRes.ok) {
        const j = (await mineRes.json()) as {
          entries?: {
            id: string;
            creditedAt: string;
            creditedWeekStartIst: string;
            refereeName: string;
          }[];
        };
        setMyReferralHistory(Array.isArray(j.entries) ? j.entries : []);
      } else {
        setMyReferralHistory([]);
      }
    } catch {
      setFriendsReferred(0);
      setWeeklyReferrals(0);
      setMyReferralHistory([]);
    } finally {
      setReferralStatsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadReferralStats();
  }, [loadReferralStats, profile?.rdm]);

  useEffect(() => {
    if (tab === "leaderboard") void loadReferralStats();
  }, [tab, loadReferralStats]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void loadReferralStats();
    };
    const onFocus = () => void loadReferralStats();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadReferralStats]);

  useLayoutEffect(() => {
    if (!activeReferClaim) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inlineChallengeRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      });
    });
  }, [activeReferClaim]);

  const copyReferralLink = async () => {
    const link =
      shareUrl ||
      `${typeof window !== "undefined" ? window.location.origin : ""}/join?ref=${refCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = encodeURIComponent(
    `Join me on EduBlast — learn through questions. ${shareUrl || ""}`
  );
  const waHref = `https://api.whatsapp.com/send?text=${shareText}`;

  const selectedCard: ReferChallengePublicSpec | null = selectedClaim
    ? (referChallengeSpec(selectedClaim, rdmConfig) ?? null)
    : null;
  const selectedClaimState = selectedClaim ? referClaims[selectedClaim] : undefined;
  const playedForSelected = Boolean(selectedClaimState?.winClaimed);
  const startChallengeLocked =
    !isReferAdmin &&
    !!selectedCard &&
    dailyRdmEarned + selectedCard.totalRdm > dailyChallengeRdmCap;

  const handleReferChallengeTerminal = useCallback(
    (_info: { claimKey: ReferClaimKey; outcome: "won" | "lost" }) => {
      void reportChallengeYourselfAttempt();
      void loadGauntletMeta();
    },
    [loadGauntletMeta]
  );

  const tierBanner = useMemo(() => {
    const next = GRANT_TIERS.find((t) => rdm < t.threshold);
    if (!next) return null;
    const more = Math.max(0, next.threshold - rdm);
    const refs = Math.ceil(more / perReferral);
    return `Each referral adds +${perReferral} RDM. You need ${formatInt(more)} more RDM for ${next.name} tier — about ${refs} referral${refs === 1 ? "" : "s"} at base reward.`;
  }, [rdm, perReferral]);

  const userDisplayName = profile?.name || user?.name || "You";
  const myLeaderboardEntry = useMemo(
    () => leaderboardRows.find((e) => e.userId === profile?.id),
    [leaderboardRows, profile?.id]
  );

  const selectReferTab = useCallback((key: ReferTab) => {
    if (key === "learning_buddy") {
      setActiveReferClaim(null);
      setChallengeSessionSpec(null);
      setSelectedClaim(null);
    }
    setTab(key);
  }, []);

  const showLearningBuddyPanel = tab === "learning_buddy";

  return (
    <ProtectedRoute>
      <AppLayout>
        <div
          className={cn(
            "mx-auto w-full max-w-6xl space-y-4 pb-8 font-sans text-slate-200",
            "[--re-bg:#070714] [--re-card:#12122a] [--re-border:rgba(124,107,255,0.18)] [--re-purple:#7c6bff] [--re-amber:#f5a623]"
          )}
        >
          {/* Page hero */}
          <header className="text-center">
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300/95">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Earn more · Rise faster
            </div>
            <h1 className="text-balance font-sans text-2xl font-bold tracking-tight text-white md:text-3xl md:leading-tight">
              Refer friends & challenge yourself
            </h1>
            <p className={cn("mx-auto mt-2 max-w-2xl", reBody)}>
              Share EduBlast with classmates and earn RDM every time someone joins. Or challenge
              yourself right now — complete the Daily Gauntlet on Play and track your streak here.
            </p>
          </header>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            {/* LEFT */}
            <div className="space-y-4">
              <section
                className="rounded-[14px] border p-4 shadow-[0_24px_60px_rgba(8,6,24,0.45)]"
                style={{ background: "var(--re-card)", borderColor: "var(--re-border)" }}
              >
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/35 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  Earn &amp; Learn RDM
                </div>
                <div className="flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
                  <span className="font-sans text-3xl font-semibold tabular-nums text-[var(--re-amber)] md:text-4xl">
                    {formatInt(rdm)}
                  </span>
                  <span className="text-base text-slate-400">RDM balance</span>
                </div>
                <p className={cn("mt-2 text-center sm:text-left", reBody)}>
                  RDM (Reward Miles) unlock practice packs, mock tests &amp; exclusive study tools.
                  Share EduBlast and earn more with every friend who joins.
                </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                      <p className="text-xl font-bold tabular-nums text-slate-300">
                        {friendsReferred}
                      </p>
                      <p className={reLabel}>Friends referred</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                      <p className="text-xl font-bold tabular-nums text-teal-400">+{perReferral}</p>
                      <p className={reLabel}>RDM per referral</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                      <p className="text-xl font-bold tabular-nums text-amber-400">+{bonusAtFive}</p>
                      <p className={reLabel}>Bonus at {weeklyTarget} / week</p>
                    </div>
                  </div>
              </section>

              <div>
                <p className={cn("mb-2 flex items-center gap-2", reLabel)}>
                  <span>Your unique referral link</span>
                  <span className="h-px flex-1 bg-white/10" />
                </p>
                <div className="flex flex-col gap-2 rounded-[12px] border border-white/10 bg-[var(--re-card)] p-1.5 sm:flex-row sm:items-stretch">
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate font-mono text-[13px] text-slate-200">
                      {displayHost}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    className="h-11 shrink-0 rounded-lg bg-[var(--re-purple)] px-5 font-semibold text-white hover:opacity-95"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" /> Copy link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-500">Share via</span>
                <a
                  href={shareUrl ? waHref : undefined}
                  className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/15"
                >
                  WhatsApp
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
                  const active = tab === key;
                  const isLearningBuddy = key === "learning_buddy";
                  if (isLearningBuddy) {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectReferTab(key)}
                        className={cn(
                          "group relative rounded-full p-[1.5px] transition-all duration-300",
                          active
                            ? "bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-400 shadow-[0_0_22px_rgba(34,211,238,0.35)]"
                            : "bg-gradient-to-r from-cyan-500/70 via-fuchsia-500/60 to-amber-400/70 hover:shadow-[0_0_18px_rgba(217,70,239,0.28)]"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                            active
                              ? "bg-gradient-to-r from-cyan-950/90 via-fuchsia-950/85 to-amber-950/80 text-cyan-50"
                              : "bg-[#0a0818] text-cyan-200/95 group-hover:text-white"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5",
                              active ? "text-amber-200" : "text-cyan-300 group-hover:text-fuchsia-200"
                            )}
                          />
                          {label}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectReferTab(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-violet-500/45 bg-violet-500/15 text-violet-100"
                          : "border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-200"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {tab === "how" ? (
                <div className="space-y-4">
                  <p className={cn("flex items-center gap-2", reLabel)}>
                    <span>3 steps to earn RDM</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {howItWorksSteps.map((s) => (
                      <div
                        key={s.n}
                        className="rounded-[12px] border border-white/10 bg-[var(--re-card)] p-4"
                        style={{ background: "var(--re-card)" }}
                      >
                        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-200">
                          {s.n}
                        </div>
                        <s.icon className={cn("mb-2 h-5 w-5", s.ring)} />
                        <p className={reTitle}>{s.title}</p>
                        <p className={cn("mt-1", reBody)}>{s.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className={cn("flex items-center gap-2", reLabel)}>
                    <span>What can you do with RDM?</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </p>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {rewardUsesDisplay.map((item) => (
                      <div
                        key={item.title}
                        className={cn(
                          "rounded-[11px] border bg-black/20 p-3 text-center",
                          item.borderClass
                        )}
                      >
                        <div className="mb-1 text-lg">{item.emoji}</div>
                        <p className={cn(reTitle, item.titleClass)}>{item.title}</p>
                        <p className={cn(reBody, "text-center text-slate-500")}>{item.from}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "tiers" ? (
                <div className="space-y-3">
                  <p className={cn("flex items-center gap-2", reLabel)}>
                    <span>EduFund grant tiers</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </p>
                  <div className="space-y-2">
                    {GRANT_TIERS.map((tier, tierIdx) => {
                      const pct = Math.min(100, Math.round((rdm / tier.threshold) * 100));
                      const more = Math.max(0, tier.threshold - rdm);
                      const prevThreshold = tierIdx === 0 ? 0 : GRANT_TIERS[tierIdx - 1].threshold;
                      const unlocked = rdm >= tier.threshold;
                      const inProgress = !unlocked && rdm >= prevThreshold;
                      const badge = unlocked ? "Unlocked" : inProgress ? "In progress" : "Locked";
                      const fill =
                        tier.key === "sprout"
                          ? "bg-teal-500"
                          : tier.key === "scholar"
                            ? "bg-[var(--re-purple)]"
                            : tier.key === "champion"
                              ? "bg-[var(--re-amber)]"
                              : tier.key === "elite"
                                ? "bg-sky-500"
                                : "bg-orange-500";
                      return (
                        <div
                          key={tier.key}
                          className="flex gap-3 rounded-[12px] border border-white/10 bg-[var(--re-card)] p-3"
                          style={{ background: "var(--re-card)" }}
                        >
                          <div className="text-2xl">{tier.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={reTitle}>{tier.name}</span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  unlocked && "bg-teal-500/15 text-teal-300",
                                  inProgress && "bg-violet-500/15 text-violet-200",
                                  !unlocked && !inProgress && "bg-amber-500/10 text-amber-200/80"
                                )}
                              >
                                {badge}
                              </span>
                            </div>
                            <p className={cn("mt-0.5", reBody)}>
                              {formatInt(tier.threshold)} RDM threshold
                              {unlocked
                                ? ` · You have ${formatInt(rdm)} RDM`
                                : more > 0
                                  ? ` · ${formatInt(more)} more to go`
                                  : ""}
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                              <div
                                className={cn("h-full rounded-full transition-all", fill)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div
                            className={cn(
                              "shrink-0 self-center text-sm font-bold",
                              tier.key === "sprout" && "text-teal-400",
                              tier.key === "scholar" && "text-violet-300",
                              tier.key === "champion" && "text-amber-400"
                            )}
                          >
                            {tier.grant}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {tierBanner ? (
                    <div className="rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
                      {tierBanner}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "leaderboard" ? (
                <div className="space-y-3">
                  <p className={cn("flex flex-wrap items-center gap-2", reLabel)}>
                    <span>Top referrers this week</span>
                    {referralStatsLoading ? (
                      <span className="font-normal normal-case tracking-normal text-violet-400/90">
                        Updating…
                      </span>
                    ) : null}
                    <span className="h-px min-w-[2rem] flex-1 bg-white/10" />
                  </p>
                  {leaderboardWeekLabel ? (
                    <div className="space-y-1">
                      <p className={cn("text-[11px] text-slate-500")}>
                        Week starting {leaderboardWeekLabel} (IST)
                      </p>
                      <p className={cn("text-[11px] text-slate-500/90")}>
                        This ranking counts only referrals <span className="text-slate-400">credited in that IST week</span>{" "}
                        (for the weekly leaderboard &amp; +100 bonus). Your full history is below.
                      </p>
                    </div>
                  ) : null}
                  {leaderboardRows.length === 0 ? (
                    <p
                      className={cn(
                        "rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-5 text-center",
                        reBody
                      )}
                    >
                      No referrals this week yet. Share your link — the first names will show up
                      here.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {leaderboardRows.map((row) => {
                        const isYou = row.userId === profile?.id;
                        return (
                          <li
                            key={row.userId}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2.5",
                              isYou
                                ? "border-teal-500/40 bg-teal-500/10"
                                : "border-white/10 bg-[var(--re-card)]"
                            )}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="w-7 shrink-0 text-center text-sm font-bold text-slate-400">
                                {row.rank}
                              </span>
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-200">
                                {row.name
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("truncate", reTitle)}>
                                  {row.name}
                                  {isYou ? (
                                    <span className="ml-1 rounded bg-teal-500/25 px-1.5 py-0.5 text-[10px] text-teal-200">
                                      YOU
                                    </span>
                                  ) : null}
                                </p>
                                {isYou ? (
                                  <p className={cn(reBody, "mt-0.5 text-[11px] text-slate-500")}>
                                    {friendsReferred} all-time · {formatInt(rdm)} RDM balance
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-teal-300">
                              {row.referralCount}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="border-t border-white/10 pt-4">
                    <p className={cn("flex flex-wrap items-center gap-2", reLabel)}>
                      <span>Your referrals (all time)</span>
                      <span className="h-px min-w-[2rem] flex-1 bg-white/10" />
                    </p>
                    <p className={cn("mt-1 text-[11px] text-slate-500")}>
                      Everyone who finished onboarding through your link — newest first. Includes every week, not only
                      the current one.
                    </p>
                    {myReferralHistory.length === 0 ? (
                      <p
                        className={cn(
                          "mt-3 rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center",
                          reBody
                        )}
                      >
                        No completed referrals yet. When friends use your link and finish setup, they appear here.
                      </p>
                    ) : (
                      <ul className="mt-3 max-h-[min(360px,50vh)] space-y-2 overflow-y-auto pr-1">
                        {myReferralHistory.map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-col gap-1 rounded-[12px] border border-white/10 bg-[var(--re-card)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-600/40 text-[10px] font-bold text-slate-200">
                                {row.refereeName
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("truncate", reTitle)}>{row.refereeName}</p>
                                <p className={cn(reBody, "text-[11px] text-slate-500")}>
                                  Credited {formatReferralCreditedAt(row.creditedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className={cn(reBody, "text-[11px] text-slate-500")}>IST week (for bonus)</p>
                              <p className="text-xs font-medium tabular-nums text-slate-300">
                                {row.creditedWeekStartIst}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {myLeaderboardEntry ? null : (
                    <div className="rounded-[12px] border border-teal-500/35 bg-teal-500/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-8 text-center text-sm font-bold text-teal-400">—</span>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold text-teal-200">
                            {userDisplayName
                              .split(/\s+/)
                              .filter(Boolean)
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "YOU"}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("truncate", reTitle)}>
                              You — {userDisplayName}{" "}
                              <span className="ml-1 rounded bg-teal-500/25 px-1.5 py-0.5 text-[10px] text-teal-200">
                                YOU
                              </span>
                            </p>
                            <p className={cn(reBody, "text-[11px]")}>
                              Not in the top 20 this week yet · {weeklyReferrals} this week ·{" "}
                              {friendsReferred} all-time · {formatInt(rdm)} RDM balance
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="border-t border-white/10 pt-3 text-center text-[11px] text-slate-500">
                    Refer {weeklyTarget} friends in a week for +{bonusAtFive} RDM
                    bonus · Leaderboard resets every Monday (IST)
                  </p>
                </div>
              ) : null}

              {tab === "faq" ? (
                <div className="divide-y divide-white/10 rounded-[12px] border border-white/10 bg-[var(--re-card)]">
                  {FAQ_ITEMS.map((item, idx) => {
                    const open = openFaq === idx;
                    return (
                      <div key={item.q} className="px-3">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(open ? null : idx)}
                          className="flex w-full items-center justify-between gap-2 py-3 text-left"
                        >
                          <span className={reTitle}>{item.q}</span>
                          <span className="text-slate-500">
                            {open ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                        {open ? <p className={cn("pb-3", reBody)}>{item.a}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {showLearningBuddyPanel ? (
                <p
                  className={cn(
                    "rounded-[12px] border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-center",
                    reBody
                  )}
                >
                  <span className="font-semibold text-cyan-200">Learning Buddy</span>{" "}
                  <span className="hidden lg:inline">
                    opens on the right — use the gradient panel or &quot;Back to challenges&quot;
                    when you&apos;re done.
                  </span>
                  <span className="lg:hidden">
                    opens in a full-screen panel — scroll down to challenges when you close it.
                  </span>
                </p>
              ) : null}
            </div>

            {/* RIGHT — Challenges or Learning Buddy (animated) */}
            <EarnLearnRightColumn
              showLearningBuddy={showLearningBuddyPanel}
              onBackToChallenges={() => selectReferTab("how")}
            >
              {!activeReferClaim ? (
                <>
                  <div className="mb-3 flex flex-col gap-2 rounded-[12px] border border-violet-500/20 bg-gradient-to-br from-[#0d0d22] to-[#12102e] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className={cn("flex items-center gap-2", reTitle)}>
                        <Star className="h-4 w-4 text-amber-300/90" />
                        Challenge yourself — Earn more RDM
                      </div>
                      <p className={cn("mt-1", reBody)}>
                        Start a challenge below (separate from the{" "}
                        <strong className="text-white">Play</strong> hub). Max{" "}
                        <strong className="text-[var(--re-amber)]">
                          {dailyChallengeRdmCap} RDM
                        </strong>{" "}
                        per day from challenges once RDM tracking is enabled.
                      </p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 sm:self-center">
                      <span className="text-orange-400">🔥</span> {streakDays} day streak
                    </div>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mb-3 flex cursor-help items-center gap-2 rounded-[10px] border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-lg">⚡</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn(reBody, "text-[11px]")}>
                            Daily RDM earned from challenges
                          </p>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[var(--re-amber)] to-fuchsia-500"
                              style={{
                                width: `${Math.min(100, (dailyRdmEarned / dailyChallengeRdmCap) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[var(--re-amber)]">
                          {dailyRdmEarned} / {dailyChallengeRdmCap} RDM
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      Auto-claim RDM is tracked separately from /play DailyDose and streak.{" "}
                      {EARN_LEARN_AUTO_CLAIM_LINE} A challenge card is locked when its total (win +
                      share) would exceed your remaining daily cap.
                    </TooltipContent>
                  </Tooltip>

                  <p
                    className={cn(
                      "mb-2 flex items-center gap-2 font-bold tracking-[0.08em] text-slate-400",
                      reLabel
                    )}
                  >
                    <span className="text-slate-300">STEP 1 · CHOOSE YOUR CHALLENGE (AUTO-CLAIM RDM)</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </p>
                  {isReferAdmin ? (
                    <p className="mb-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-medium text-violet-100/95">
                      Admin mode: challenge starts are unlimited today (daily lock does not apply).
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {currentChallengeSpecs.map((c) => {
                      const sel = selectedClaim === c.key;
                      const claimState = referClaims[c.key];
                      const done = Boolean(claimState?.winClaimed && claimState?.shareClaimed);
                      const lockedByCap =
                        !isReferAdmin && dailyRdmEarned + c.totalRdm > dailyChallengeRdmCap;
                      const minPct = referMinPct(c);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={lockedByCap}
                          onClick={() => {
                            setSelectedClaim(c.key);
                            window.setTimeout(() => {
                              detailPanelRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }, 80);
                          }}
                          className={cn(
                            "relative flex w-full flex-col items-center overflow-hidden rounded-[12px] border px-3 pb-3 pt-3 text-center transition",
                            "border-white/10 bg-black/20",
                            "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-45",
                            sel &&
                              cn(
                                "z-[1] border-transparent ring-2 ring-offset-2 ring-offset-[var(--re-card)]",
                                c.selClass,
                                c.key === "50" && "shadow-[0_0_32px_rgba(245,166,35,0.28)]",
                                c.key !== "50" && "shadow-[0_0_28px_rgba(124,107,255,0.2)]"
                              )
                          )}
                        >
                          <div
                            className={cn(
                              "font-sans text-2xl font-semibold tabular-nums",
                              c.accent
                            )}
                          >
                            {c.totalRdm}
                          </div>
                          <p className={cn(reBody, "text-[11px] text-slate-500")}>RDM</p>
                          <span
                            className={cn(
                              "mt-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              c.domain === "funbrain"
                                ? "bg-sky-500/15 text-sky-300"
                                : "bg-violet-500/15 text-violet-200"
                            )}
                          >
                            {c.typeLabel}
                          </span>
                          <p className={cn("mt-2 max-w-full", reTitle)}>{c.name}</p>
                          <p className={cn("mt-1 max-w-full", reBody, "text-[11px]")}>
                            {c.cardDesc}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 max-w-full",
                              reBody,
                              "text-[10px] text-slate-500"
                            )}
                          >
                            {c.cardSubline}
                          </p>
                          <span className="mt-2 inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            <Check className="h-3 w-3 text-emerald-400" />
                            Min {minPct}% to win
                          </span>
                          <span className="mt-1 inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            Win +{c.winRdm} · Share +{c.shareRdm} · Auto-claim
                          </span>
                          {lockedByCap ? (
                            <span className="absolute left-2 top-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                              Cap lock
                            </span>
                          ) : null}
                          {done ? (
                            <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              Win + share credited
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    ref={detailPanelRef}
                    className={cn(
                      "mt-3 min-h-[88px] scroll-mt-24 rounded-[14px] border bg-black/25 p-3 md:scroll-mt-28",
                      selectedCard
                        ? "border-violet-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "border-dashed border-white/15"
                    )}
                  >
                    {!selectedCard ? (
                      <div className="flex h-full min-h-[72px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                        <Clock className="h-8 w-8 opacity-40" />
                        <span>Select a challenge above to see details</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-2xl" aria-hidden>
                              🏆
                            </span>
                            <div>
                              <p className={cn(reTitle, "text-base")}>{selectedCard.name}</p>
                              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                {selectedCard.headerEmoji} Auto-claim rewards
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-bold tabular-nums",
                              selectedCard.accent
                            )}
                          >
                            +{selectedCard.winRdm} RDM on win · +{selectedCard.shareRdm} on share
                            (auto-claim)
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span className="font-mono tabular-nums text-amber-100/95">
                              {formatReferDurationMmSs(referChallengeSessionDurationSec(selectedCard))}
                            </span>
                            <span className="font-normal text-slate-400">session</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                            {selectedCard.questionCount} questions
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-slate-200">
                            <Timer className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                            {formatReferDurationMmSs(selectedCard.readPhaseSec)} stem
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-slate-200">
                            <Timer className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                            {formatReferDurationMmSs(selectedCard.optionsPhaseSec)} choices
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                              selectedCard.domain === "funbrain"
                                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                                : "border-violet-500/35 bg-violet-500/10 text-violet-100"
                            )}
                          >
                            Min {referMinPct(selectedCard)}% correct
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              selectedCard.domain === "funbrain"
                                ? "border-sky-500/35 bg-sky-500/10 text-sky-200"
                                : "border-violet-500/35 bg-violet-500/12 text-violet-100"
                            )}
                          >
                            {selectedCard.categoryPill}
                          </span>
                        </div>

                        <ul className="mt-4 space-y-2.5 text-[13px] leading-snug text-slate-300">
                          <li className="flex gap-2.5">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                              strokeWidth={2.5}
                            />
                            <span>
                              Answer at least{" "}
                              <strong className="text-white">{selectedCard.minCorrect}</strong> out
                              of{" "}
                              <strong className="text-white">{selectedCard.questionCount}</strong>{" "}
                              correctly to earn RDM
                            </span>
                          </li>
                          <li className="flex gap-2.5">
                            <Timer
                              className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                              strokeWidth={2.25}
                            />
                            <span>
                              Finish before the session timer hits{" "}
                              <strong className="font-mono text-white tabular-nums">
                                {formatReferDurationMmSs(
                                  referChallengeSessionDurationSec(selectedCard)
                                )}
                              </strong>{" "}
                              — at zero, the run ends.
                            </span>
                          </li>
                          <li className="flex gap-2.5">
                            <Timer
                              className="mt-0.5 h-4 w-4 shrink-0 text-sky-400"
                              strokeWidth={2.25}
                            />
                            <span>
                              Each question:{" "}
                              <strong className="font-mono text-white tabular-nums">
                                {formatReferDurationMmSs(selectedCard.readPhaseSec)}
                              </strong>
                              <span className="text-slate-500"> + </span>
                              <strong className="font-mono text-violet-200 tabular-nums">
                                {formatReferDurationMmSs(selectedCard.optionsPhaseSec)}
                              </strong>
                              <span className="text-slate-500">
                                {" "}
                                {selectedCard.readPhaseSec >= 50
                                  ? "(Academic Arena & Pro)"
                                  : "(FunBrain & MentaMill)"}
                              </span>
                              {selectedCard.key === "10" ? (
                                <>
                                  {" "}
                                  · Session{" "}
                                  <strong className="font-mono text-amber-200 tabular-nums">
                                    {formatReferDurationMmSs(
                                      referChallengeSessionDurationSec(selectedCard)
                                    )}
                                  </strong>
                                </>
                              ) : null}
                            </span>
                          </li>
                          <li className="flex gap-2.5">
                            <Star
                              className="mt-0.5 h-4 w-4 shrink-0 text-violet-400"
                              strokeWidth={2.25}
                            />
                            <span>
                              <strong className="text-white">{selectedCard.winRdm} RDM</strong>{" "}
                              credits when you pass the bar;{" "}
                              <strong className="text-white">{selectedCard.shareRdm} RDM</strong>{" "}
                              may credit after a verified share (Earn &amp; Learn).
                            </span>
                          </li>
                          <li className="flex gap-2.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-bold text-rose-400">
                              3
                            </span>
                            <span>
                              <strong className="text-white">Strikes 3/3</strong> — three wrong
                              answers end the run. Tap <strong className="text-white">Next</strong>{" "}
                              after you answer; if time runs out on a question, it auto-advances.
                            </span>
                          </li>
                        </ul>

                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-white/15 bg-transparent text-slate-200"
                            onClick={() => setSelectedClaim(null)}
                          >
                            Clear selection
                          </Button>
                          <Button
                            type="button"
                            disabled={startChallengeLocked}
                            className={cn(
                              "inline-flex items-center gap-2 bg-[var(--re-purple)] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-45",
                              "ring-2 ring-violet-300/45 ring-offset-2 ring-offset-[var(--re-card)]"
                            )}
                            onClick={() => {
                              setChallengeSessionSpec(selectedCard);
                              setActiveReferClaim(selectedCard.key);
                            }}
                          >
                            <Play className="h-4 w-4 fill-current" />
                            {startChallengeLocked
                              ? "Daily cap reached for this card"
                              : "Start challenge"}
                          </Button>
                        </div>
                        {startChallengeLocked ? (
                          <p className="mt-2 text-center text-[11px] text-rose-200/90">
                            You have {dailyRdmEarned}/{dailyChallengeRdmCap} RDM today. This card
                            needs {selectedCard.totalRdm} total (win + share), so it is locked.
                          </p>
                        ) : null}
                        {isReferAdmin && playedForSelected ? (
                          <p className="mt-2 text-center text-[11px] text-violet-300/90">
                            You completed this earlier today — as admin you can replay anytime.
                          </p>
                        ) : playedForSelected ? (
                          <p className="mt-2 text-center text-[11px] text-slate-400">
                            Testing mode: you can replay this challenge unlimited times today.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {activeReferClaim && challengeSessionSpec ? (
                <div ref={inlineChallengeRef} className="scroll-mt-28">
                  <InlineRdmChallenge
                    key={activeReferClaim}
                    spec={challengeSessionSpec}
                    onClose={() => {
                      setActiveReferClaim(null);
                      setChallengeSessionSpec(null);
                    }}
                    onTerminal={handleReferChallengeTerminal}
                    streakDays={streakDays}
                    dailyRdmEarned={dailyRdmEarned}
                    dailyRdmCap={dailyChallengeRdmCap}
                    onClaimsUpdated={loadGauntletMeta}
                  />
                </div>
              ) : null}
            </EarnLearnRightColumn>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function ReferEarnPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <AppLayout>
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" aria-hidden />
              <span className="sr-only">Loading Earn &amp; Learn…</span>
            </div>
          </AppLayout>
        </ProtectedRoute>
      }
    >
      <ReferEarnPageContent />
    </Suspense>
  );
}
