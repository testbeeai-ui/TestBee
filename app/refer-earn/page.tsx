"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import InlineRdmChallenge from "@/components/play/InlineRdmChallenge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { computeStreakDays } from "@/lib/gauntletStreak";
import {
  markReferChallengeDone,
  readReferChallengesDone,
  REFER_CHALLENGE_SPECS,
  referChallengeSpec,
  type ReferChallengePublicSpec,
  type ReferClaimKey,
} from "@/lib/referEarnChallenges";
import { cn } from "@/lib/utils";
import type { PlayDomain } from "@/types";
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
  Play,
  Send,
  Sparkles,
  Star,
  Timer,
} from "lucide-react";

type ReferTab = "how" | "tiers" | "leaderboard" | "faq";

const TAB_ITEMS: { key: ReferTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "how", label: "How it works", icon: Clock },
  { key: "tiers", label: "Reward tiers", icon: Star },
  { key: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { key: "faq", label: "FAQ", icon: Info },
];

const FAQ_ITEMS = [
  {
    q: "What uses RDM?",
    a: "RDM can be redeemed for Practice Packs, Full Mock Tests, Analytics Pro, and EduFund scholarship entries. More rewards are added regularly.",
  },
  {
    q: "How many RDM do I get per referral?",
    a: "You earn 50 RDM when your friend signs up using your link. You get an additional 100 RDM bonus when you hit 5 referrals in a week.",
  },
  {
    q: "Does my friend also get RDM?",
    a: "Yes! Your friend gets 25 RDM as a welcome bonus when they sign up through your link. It appears in their balance after onboarding.",
  },
  {
    q: "When does the leaderboard reset?",
    a: "The referral leaderboard resets every Monday at 12:00 AM IST. Your total RDM balance never resets — only the weekly ranking does.",
  },
];

const REWARD_USES = [
  { title: "Practice Packs", from: "from 50 RDM", emoji: "🎁", titleClass: "text-violet-300", borderClass: "border-violet-500/30" },
  { title: "Mock Tests", from: "from 100 RDM", emoji: "📝", titleClass: "text-amber-300", borderClass: "border-amber-500/30" },
  { title: "Analytics Pro", from: "from 200 RDM", emoji: "📊", titleClass: "text-teal-300", borderClass: "border-teal-500/30" },
  { title: "EduFund Entry", from: "from 500 RDM", emoji: "🏆", titleClass: "text-rose-300", borderClass: "border-rose-500/30" },
];

/** EduFund-style grant tiers (RDM thresholds); ₹ copy matches investor mock. */
const GRANT_TIERS = [
  { key: "sprout", name: "Sprout", threshold: 1000, grant: "₹3,000", icon: "🌱" },
  { key: "scholar", name: "Scholar", threshold: 3000, grant: "₹12,000", icon: "📚" },
  { key: "champion", name: "Champion", threshold: 8000, grant: "₹50,000", icon: "🏆" },
] as const;

const DAILY_CHALLENGE_RDM_CAP = 50;

function referMinPct(spec: ReferChallengePublicSpec): number {
  return Math.round((spec.minCorrect / spec.questionCount) * 100);
}

/** Refer & Earn page typography (single sans scale). */
const reLabel = "text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500";
const reBody = "text-xs leading-relaxed text-slate-400";
const reTitle = "text-sm font-semibold text-white";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatInt(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function ReferEarnPage() {
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const isReferAdmin = useIsAppAdmin();
  const [tab, setTab] = useState<ReferTab>("how");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ReferClaimKey | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [playedToday, setPlayedToday] = useState<{ academic: boolean; funbrain: boolean }>({
    academic: false,
    funbrain: false,
  });
  const [referDone, setReferDone] = useState<Partial<Record<ReferClaimKey, boolean>>>({});
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const inlineChallengeRef = useRef<HTMLDivElement>(null);
  const [activeReferClaim, setActiveReferClaim] = useState<ReferClaimKey | null>(null);

  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const friendsReferred = 0;
  const perReferral = 50;
  const bonusAtFive = 100;

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
      setReferDone({});
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
    setReferDone(readReferChallengesDone(uid, today));
  }, [profile?.id]);

  useEffect(() => {
    void loadGauntletMeta();
  }, [loadGauntletMeta]);

  useLayoutEffect(() => {
    if (!activeReferClaim) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inlineChallengeRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      });
    });
  }, [activeReferClaim]);

  const copyReferralLink = async () => {
    const link = shareUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/join?ref=${refCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = encodeURIComponent(`Join me on EduBlast — learn through questions. ${shareUrl || ""}`);
  const waHref = `https://wa.me/?text=${shareText}`;
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(shareUrl || "")}&text=${encodeURIComponent("Join me on EduBlast")}`;
  const xHref = `https://twitter.com/intent/tweet?text=${shareText}`;

  const selectedCard: ReferChallengePublicSpec | null = selectedClaim ? referChallengeSpec(selectedClaim) ?? null : null;
  const playedForSelected = selectedClaim ? referDone[selectedClaim] === true : false;
  /** Learners: one completion per claim per day. Admins: unlimited starts (no daily lock). */
  const startChallengeLocked = playedForSelected && !isReferAdmin;

  const handleReferChallengeTerminal = useCallback(
    (info: { claimKey: ReferClaimKey; outcome: "won" | "lost" }) => {
      const uid = profile?.id;
      if (uid && !isReferAdmin) markReferChallengeDone(uid, todayUtc(), info.claimKey);
      if (uid) setReferDone(readReferChallengesDone(uid, todayUtc()));
      void loadGauntletMeta();
    },
    [profile?.id, isReferAdmin, loadGauntletMeta],
  );

  const tierBanner = useMemo(() => {
    const next = GRANT_TIERS.find((t) => rdm < t.threshold);
    if (!next) return null;
    const more = Math.max(0, next.threshold - rdm);
    const refs = Math.ceil(more / perReferral);
    return `Each referral adds +${perReferral} RDM. You need ${formatInt(more)} more RDM for ${next.name} tier — about ${refs} referral${refs === 1 ? "" : "s"} at base reward.`;
  }, [rdm, perReferral]);

  const userDisplayName = profile?.name || user?.name || "You";

  return (
    <ProtectedRoute>
      <AppLayout>
        <div
          className={cn(
            "mx-auto w-full max-w-6xl space-y-4 pb-8 font-sans text-slate-200",
            "[--re-bg:#070714] [--re-card:#12122a] [--re-border:rgba(124,107,255,0.18)] [--re-purple:#7c6bff] [--re-amber:#f5a623]",
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
              Share EduBlast with classmates and earn RDM every time someone joins. Or challenge yourself right now — complete
              the Daily Gauntlet on Play and track your streak here.
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
                  Refer &amp; Earn RDM
                </div>
                <div className="flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
                  <span className="font-sans text-3xl font-semibold tabular-nums text-[var(--re-amber)] md:text-4xl">
                    {formatInt(rdm)}
                  </span>
                  <span className="text-base text-slate-400">RDM balance</span>
                </div>
                <p className={cn("mt-2 text-center sm:text-left", reBody)}>
                  RDM (Reward Miles) unlock practice packs, mock tests &amp; exclusive study tools. Share EduBlast and earn more
                  with every friend who joins.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                    <p className="text-xl font-bold tabular-nums text-slate-300">{friendsReferred}</p>
                    <p className={reLabel}>Friends referred</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                    <p className="text-xl font-bold tabular-nums text-teal-400">+{perReferral}</p>
                    <p className={reLabel}>RDM per referral</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2.5 text-center">
                    <p className="text-xl font-bold tabular-nums text-amber-400">+{bonusAtFive}</p>
                    <p className={reLabel}>Bonus at 5 friends</p>
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
                    <span className="truncate font-mono text-[13px] text-slate-200">{displayHost}</span>
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
                <a
                  href={shareUrl ? tgHref : undefined}
                  className="inline-flex items-center rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-300 hover:bg-sky-500/15"
                >
                  <Send className="mr-1 h-3 w-3" /> Telegram
                </a>
                <a
                  href={shareUrl ? xHref : undefined}
                  className="inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Twitter / X
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-violet-500/45 bg-violet-500/15 text-violet-100"
                          : "border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-200",
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
                    {[
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
                        body: "Send via WhatsApp, Telegram, or study groups. Works best when it’s personal.",
                        icon: Send,
                        ring: "text-teal-400",
                      },
                      {
                        n: 3,
                        title: "Both of you earn",
                        body: "You get 50 RDM when referrals are tracked. Your friend gets a welcome bonus after onboarding.",
                        icon: Sparkles,
                        ring: "text-amber-400",
                      },
                    ].map((s) => (
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
                    {REWARD_USES.map((item) => (
                      <div
                        key={item.title}
                        className={cn("rounded-[11px] border bg-black/20 p-3 text-center", item.borderClass)}
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
                    {GRANT_TIERS.map((tier) => {
                      const pct = Math.min(100, Math.round((rdm / tier.threshold) * 100));
                      const more = Math.max(0, tier.threshold - rdm);
                      let unlocked = false;
                      let inProgress = false;
                      if (tier.key === "sprout") {
                        unlocked = rdm >= tier.threshold;
                        inProgress = !unlocked;
                      } else if (tier.key === "scholar") {
                        unlocked = rdm >= tier.threshold;
                        inProgress = !unlocked && rdm >= 1000;
                      } else {
                        unlocked = rdm >= tier.threshold;
                        inProgress = !unlocked && rdm >= 3000;
                      }
                      const badge = unlocked ? "Unlocked" : inProgress ? "In progress" : "Locked";
                      const fill =
                        tier.key === "sprout"
                          ? "bg-teal-500"
                          : tier.key === "scholar"
                            ? "bg-[var(--re-purple)]"
                            : "bg-[var(--re-amber)]";
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
                                  !unlocked && !inProgress && "bg-amber-500/10 text-amber-200/80",
                                )}
                              >
                                {badge}
                              </span>
                            </div>
                            <p className={cn("mt-0.5", reBody)}>
                              {formatInt(tier.threshold)} RDM threshold
                              {unlocked ? ` · You have ${formatInt(rdm)} RDM` : more > 0 ? ` · ${formatInt(more)} more to go` : ""}
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                              <div className={cn("h-full rounded-full transition-all", fill)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div
                            className={cn(
                              "shrink-0 self-center text-sm font-bold",
                              tier.key === "sprout" && "text-teal-400",
                              tier.key === "scholar" && "text-violet-300",
                              tier.key === "champion" && "text-amber-400",
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
                  <p className={cn("flex items-center gap-2", reLabel)}>
                    <span>Top referrers this week</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </p>
                  <p className={cn("rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-5 text-center", reBody)}>
                    Referral rankings will appear here once referral events are stored. Your invites still help friends join —
                    share your link above.
                  </p>
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
                            <span className="ml-1 rounded bg-teal-500/25 px-1.5 py-0.5 text-[10px] text-teal-200">YOU</span>
                          </p>
                          <p className={cn(reBody, "text-[11px]")}>{friendsReferred} friends · {formatInt(rdm)} RDM balance</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="border-t border-white/10 pt-3 text-center text-[11px] text-slate-500">
                    Refer 5 friends to jump into the top 5 · Leaderboard resets every Monday
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
                          <span className="text-slate-500">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                        </button>
                        {open ? <p className={cn("pb-3", reBody)}>{item.a}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* RIGHT — Challenges */}
            <section
              className="rounded-[14px] border p-4 shadow-[0_24px_60px_rgba(8,6,24,0.45)]"
              style={{ background: "var(--re-card)", borderColor: "var(--re-border)" }}
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
                    Start a challenge below (separate from the <strong className="text-white">Play</strong> hub). Max{" "}
                    <strong className="text-[var(--re-amber)]">{DAILY_CHALLENGE_RDM_CAP} RDM</strong> per day from challenges once RDM
                    tracking is enabled.
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
                      <p className={cn(reBody, "text-[11px]")}>Daily RDM earned from challenges</p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--re-amber)] to-fuchsia-500"
                          style={{ width: `${Math.min(100, (0 / DAILY_CHALLENGE_RDM_CAP) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[var(--re-amber)]">
                      0 / {DAILY_CHALLENGE_RDM_CAP} RDM
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Challenge RDM is not written to the database yet. Refer challenges use their own timers, strikes, and Supabase question
                  fetch — separate from /play DailyDose or streak. This bar will fill when tracking ships.
                </TooltipContent>
              </Tooltip>

              <p className={cn("mb-2 flex items-center gap-2 font-bold tracking-[0.08em] text-slate-400", reLabel)}>
                <span className="text-slate-300">STEP 1 · CHOOSE YOUR RDM CLAIM TARGET</span>
                <span className="h-px flex-1 bg-white/10" />
              </p>
              {isReferAdmin ? (
                <p className="mb-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-medium text-violet-100/95">
                  Admin mode: challenge starts are unlimited today (daily lock does not apply).
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REFER_CHALLENGE_SPECS.map((c) => {
                  const sel = selectedClaim === c.key;
                  const done = referDone[c.key] === true;
                  const minPct = referMinPct(c);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setSelectedClaim(c.key);
                        window.setTimeout(() => {
                          detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      }}
                      className={cn(
                        "relative flex w-full flex-col items-center overflow-hidden rounded-[12px] border px-3 pb-3 pt-3 text-center transition",
                        "border-white/10 bg-black/20",
                        "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40",
                        sel &&
                          cn(
                            "z-[1] border-transparent ring-2 ring-offset-2 ring-offset-[var(--re-card)]",
                            c.selClass,
                            c.key === "50" && "shadow-[0_0_32px_rgba(245,166,35,0.28)]",
                            c.key !== "50" && "shadow-[0_0_28px_rgba(124,107,255,0.2)]",
                          ),
                      )}
                    >
                      <div className={cn("font-sans text-2xl font-semibold tabular-nums", c.accent)}>{c.rdm}</div>
                      <p className={cn(reBody, "text-[11px] text-slate-500")}>RDM</p>
                      <span
                        className={cn(
                          "mt-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          c.domain === "funbrain" ? "bg-sky-500/15 text-sky-300" : "bg-violet-500/15 text-violet-200",
                        )}
                      >
                        {c.typeLabel}
                      </span>
                      <p className={cn("mt-2 max-w-full", reTitle)}>{c.name}</p>
                      <p className={cn("mt-1 max-w-full", reBody, "text-[11px]")}>{c.cardDesc}</p>
                      <p className={cn("mt-0.5 max-w-full", reBody, "text-[10px] text-slate-500")}>{c.cardSubline}</p>
                      <span className="mt-2 inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        <Check className="h-3 w-3 text-emerald-400" />
                        Min {minPct}% to win
                      </span>
                      {done && !isReferAdmin ? (
                        <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          Done today
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
                    : "border-dashed border-white/15",
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
                            {selectedCard.headerEmoji} Claim details
                          </p>
                        </div>
                      </div>
                      <span className={cn("shrink-0 text-sm font-bold tabular-nums", selectedCard.accent)}>
                        +{selectedCard.rdm} RDM on win
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {selectedCard.sessionMinutes} minutes
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                        {selectedCard.questionCount} questions
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                          selectedCard.domain === "funbrain"
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : "border-violet-500/35 bg-violet-500/10 text-violet-100",
                        )}
                      >
                        Min {referMinPct(selectedCard)}% correct
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          selectedCard.domain === "funbrain"
                            ? "border-sky-500/35 bg-sky-500/10 text-sky-200"
                            : "border-violet-500/35 bg-violet-500/12 text-violet-100",
                        )}
                      >
                        {selectedCard.categoryPill}
                      </span>
                    </div>

                    <ul className="mt-4 space-y-2.5 text-[13px] leading-snug text-slate-300">
                      <li className="flex gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} />
                        <span>
                          Answer at least <strong className="text-white">{selectedCard.minCorrect}</strong> out of{" "}
                          <strong className="text-white">{selectedCard.questionCount}</strong> correctly to earn RDM
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={2.25} />
                        <span>
                          Complete within <strong className="text-white">{selectedCard.sessionMinutes} minutes</strong> — time runs
                          out, quiz ends
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <Star className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" strokeWidth={2.25} />
                        <span>RDM credited instantly to your balance on passing (when RDM tracking is enabled)</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-bold text-rose-400">
                          3
                        </span>
                        <span>
                          <strong className="text-white">Strikes 3/3</strong> — three wrong answers end the run. No auto-next: tap{" "}
                          <strong className="text-white">Next</strong> after each answer.
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
                          "ring-2 ring-violet-300/45 ring-offset-2 ring-offset-[var(--re-card)]",
                        )}
                        onClick={() => {
                          setActiveReferClaim(selectedCard.key);
                        }}
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Start challenge
                      </Button>
                    </div>
                    {startChallengeLocked ? (
                      <p className="mt-2 text-center text-[11px] text-slate-500">You already finished this challenge today.</p>
                    ) : isReferAdmin && playedForSelected ? (
                      <p className="mt-2 text-center text-[11px] text-violet-300/90">
                        You completed this earlier today — as admin you can replay anytime.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
                </>
              ) : null}

              {activeReferClaim && referChallengeSpec(activeReferClaim) ? (
                <div ref={inlineChallengeRef} className="scroll-mt-28">
                  <InlineRdmChallenge
                    key={activeReferClaim}
                    spec={referChallengeSpec(activeReferClaim)!}
                    onClose={() => setActiveReferClaim(null)}
                    onTerminal={handleReferChallengeTerminal}
                    streakDays={streakDays}
                    dailyRdmEarned={0}
                    dailyRdmCap={DAILY_CHALLENGE_RDM_CAP}
                  />
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
