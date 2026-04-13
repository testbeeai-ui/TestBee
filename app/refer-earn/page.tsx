"use client";

import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Droplets,
  Flame,
  Gift,
  Info,
  Link2,
  Mail,
  Send,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";

type ReferTab = "how" | "tiers" | "leaderboard" | "streak";

const TAB_ITEMS: { key: ReferTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "how", label: "How it works", icon: Info },
  { key: "tiers", label: "Reward tiers", icon: Star },
  { key: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { key: "streak", label: "Streak bonus", icon: Droplets },
];

/** Per-tab outline + tint so each reads as its own control (minimal, professional). */
const TAB_STYLE: Record<
  ReferTab,
  { idle: string; active: string; iconIdle: string; iconActive: string }
> = {
  how: {
    idle: "border-violet-500/40 bg-violet-500/[0.04] text-slate-600 hover:border-violet-400/55 hover:bg-violet-500/10 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-slate-300 dark:hover:bg-violet-500/15",
    active:
      "border-violet-400/70 bg-violet-500/15 text-violet-950 shadow-sm ring-1 ring-violet-500/20 dark:border-violet-400/55 dark:bg-violet-500/20 dark:text-violet-50 dark:ring-violet-400/25",
    iconIdle: "text-violet-600/80 dark:text-violet-400/80",
    iconActive: "text-violet-700 dark:text-violet-200",
  },
  tiers: {
    idle: "border-amber-500/40 bg-amber-500/[0.04] text-slate-600 hover:border-amber-400/55 hover:bg-amber-500/10 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-slate-300 dark:hover:bg-amber-500/15",
    active:
      "border-amber-400/70 bg-amber-500/15 text-amber-950 shadow-sm ring-1 ring-amber-500/20 dark:border-amber-400/55 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-400/25",
    iconIdle: "text-amber-600/80 dark:text-amber-400/80",
    iconActive: "text-amber-800 dark:text-amber-200",
  },
  leaderboard: {
    idle: "border-sky-500/40 bg-sky-500/[0.04] text-slate-600 hover:border-sky-400/55 hover:bg-sky-500/10 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-slate-300 dark:hover:bg-sky-500/15",
    active:
      "border-sky-400/70 bg-sky-500/15 text-sky-950 shadow-sm ring-1 ring-sky-500/20 dark:border-sky-400/55 dark:bg-sky-500/20 dark:text-sky-50 dark:ring-sky-400/25",
    iconIdle: "text-sky-600/80 dark:text-sky-400/80",
    iconActive: "text-sky-800 dark:text-sky-200",
  },
  streak: {
    idle: "border-teal-500/40 bg-teal-500/[0.04] text-slate-600 hover:border-teal-400/55 hover:bg-teal-500/10 dark:border-teal-500/35 dark:bg-teal-500/10 dark:text-slate-300 dark:hover:bg-teal-500/15",
    active:
      "border-teal-400/70 bg-teal-500/15 text-teal-950 shadow-sm ring-1 ring-teal-500/20 dark:border-teal-400/55 dark:bg-teal-500/20 dark:text-teal-50 dark:ring-teal-400/25",
    iconIdle: "text-teal-600/80 dark:text-teal-400/80",
    iconActive: "text-teal-800 dark:text-teal-200",
  },
};

const FAQ_ITEMS = [
  {
    q: "What uses RDM?",
    a: "RDM can be redeemed for Practice Packs, Full Mock Tests, Analytics Pro, and EduFund scholarship entries. More rewards are added regularly.",
  },
  { q: "How many RDM do I get per referral?", a: "Base reward starts at 50 RDM per referral and increases with milestone tiers." },
  { q: "Does my friend also get RDM?", a: "Yes. When your friend joins through your link and completes onboarding, both of you earn RDM." },
  { q: "When does the leaderboard reset?", a: "Leaderboard resets monthly. Next reset is shown in the leaderboard header." },
];

const REWARD_USES = [
  { title: "Practice Packs", from: "from 50 RDM", color: "border-violet-500/40 text-violet-700 dark:text-violet-300" },
  { title: "Mock Tests", from: "from 100 RDM", color: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  { title: "Analytics Pro", from: "from 200 RDM", color: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
  { title: "EduFund Entry", from: "from 500 RDM", color: "border-rose-500/40 text-rose-700 dark:text-rose-300" },
];

const MILESTONES = [
  { name: "Starter", range: "0–4 friends · Base reward per referral", reward: "+50", color: "border-slate-500/30" },
  { name: "Bronze", range: "5–14 friends · Unlock mock test credits", reward: "+75", color: "border-orange-500/30" },
  { name: "Silver", range: "15–29 friends · Analytics Pro unlocked", reward: "+100", color: "border-cyan-500/30" },
  { name: "Gold", range: "30–49 friends · EduFund entry + profile badge", reward: "+150", color: "border-amber-500/30" },
  { name: "Legend", range: "50+ friends · Scholarship nomination + swag kit", reward: "+250", color: "border-fuchsia-500/30" },
];

const LEADERBOARD = [
  { rank: 1, name: "Arjun K.", refs: 47, rdm: "2,350" },
  { rank: 2, name: "Priya R.", refs: 38, rdm: "1,900" },
  { rank: 3, name: "Sneha M.", refs: 31, rdm: "1,550" },
  { rank: 4, name: "Vikram B.", refs: 24, rdm: "1,200" },
  { rank: 5, name: "Nisha D.", refs: 19, rdm: "950" },
];

const STREAK_DAYS = [
  { day: "Mon", reward: "+10", active: true },
  { day: "Tue", reward: "+10", active: true },
  { day: "Wed", reward: "+15", active: false },
  { day: "Thu", reward: "+15", active: false },
  { day: "Fri", reward: "+20", active: false },
  { day: "Sat", reward: "+25", active: false },
  { day: "Sun", reward: "+100", active: false },
];

export default function ReferEarnPage() {
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const [tab, setTab] = useState<ReferTab>("how");
  const [openFaq, setOpenFaq] = useState(0);

  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const friendsReferred = 0;
  const perReferral = 50;
  const bonusAtFive = 100;

  const referralCode = useMemo(() => {
    const fallbackHandle = (user?.name || "sanlit7x").replace(/\s+/g, "").slice(0, 7);
    const seed = (profile?.id || fallbackHandle).replace(/-/g, "").slice(0, 7).toUpperCase();
    return `edublast.in/join?ref=${seed}`;
  }, [profile?.id, user?.name]);

  const copyReferralLink = async () => {
    const link = typeof window !== "undefined" ? `${window.location.origin}/join?ref=${referralCode.split("=").pop()}` : referralCode;
    await navigator.clipboard.writeText(link);
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <section className="rounded-3xl border border-violet-300/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 md:p-7 shadow-lg dark:border-violet-500/35 dark:from-[#0f1023] dark:via-[#0b0d1a] dark:to-[#0a0c17] dark:shadow-[0_30px_80px_rgba(20,15,50,0.55)]">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-4 py-1 text-sm font-bold text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300">
                <Sparkles className="mr-1.5 h-4 w-4" /> REFER & EARN RDM
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground md:text-6xl dark:text-white">
                <span className="text-amber-600 dark:text-amber-300">{rdm}</span> RDM balance
              </h1>
              <p className="mt-3 text-lg text-muted-foreground dark:text-slate-300">
                RDM (Reward Miles) unlock practice packs, mock tests & exclusive study tools.
                <br className="hidden md:block" />
                Share EduBlast and earn more with every friend who joins.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-4xl font-black text-amber-600 dark:text-amber-300">{friendsReferred}</p>
                  <p className="text-sm font-semibold text-muted-foreground dark:text-slate-300">Friends referred</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-300">+{perReferral}</p>
                  <p className="text-sm font-semibold text-muted-foreground dark:text-slate-300">RDM per referral</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-4xl font-black text-rose-600 dark:text-rose-300">+{bonusAtFive}</p>
                  <p className="text-sm font-semibold text-muted-foreground dark:text-slate-300">Bonus at 5 friends</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-card/80 p-3 md:p-4 dark:border-slate-700 dark:bg-slate-950/45">
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="flex min-h-12 flex-1 items-center rounded-xl border border-border bg-background/90 px-3 text-left text-foreground dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                    <Link2 className="mr-2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
                    <span className="truncate font-bold">{referralCode}</span>
                  </div>
                  <Button
                    onClick={copyReferralLink}
                    className="rounded-xl bg-violet-600 px-5 font-bold text-white hover:bg-violet-500"
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copy link
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground dark:text-slate-300">
                  <span className="mr-1">Share via</span>
                  <button className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                    WhatsApp
                  </button>
                  <button className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 font-semibold text-sky-700 dark:text-sky-300">
                    <Send className="mr-1 inline h-3.5 w-3.5" /> Telegram
                  </button>
                  <button className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-semibold text-cyan-700 dark:text-cyan-300">
                    <Mail className="mr-1 inline h-3.5 w-3.5" /> Twitter / X
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-2 md:p-3 dark:border-slate-800 dark:bg-[#0b0e18]">
            <div className="flex flex-wrap gap-2 md:gap-2.5">
              {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                const s = TAB_STYLE[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#0b0e18] ${
                      active ? s.active : s.idle
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? s.iconActive : s.iconIdle}`} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {tab === "how" ? (
            <section className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
                <h2 className="mb-4 text-3xl font-black text-foreground dark:text-white">3 steps to earn RDM</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { title: "Copy your link", body: "Your unique referral link is ready above. Tap copy — it takes 1 second.", icon: Link2 },
                    { title: "Share with friends", body: "Send via WhatsApp, Telegram, or Instagram. Works best in study groups.", icon: Send },
                    { title: "Both of you earn", body: "You get 50 RDM instantly. Your friend gets 25 RDM welcome bonus.", icon: Sparkles },
                  ].map((item, i) => (
                    <div key={item.title} className="rounded-xl border border-border bg-muted/40 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-sm font-black text-violet-700 dark:text-violet-300">
                        {i + 1}
                      </div>
                      <item.icon className="mb-2 h-5 w-5 text-violet-700 dark:text-violet-300" />
                      <p className="text-2xl font-black text-foreground dark:text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
                <h2 className="mb-4 text-3xl font-black text-foreground dark:text-white">What can you do with RDM?</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {REWARD_USES.map((item) => (
                    <div key={item.title} className={`rounded-xl border bg-muted/40 p-4 dark:bg-slate-900/40 ${item.color}`}>
                      <Gift className="mb-3 h-5 w-5" />
                      <p className="text-xl font-black">{item.title}</p>
                      <p className="text-sm text-muted-foreground dark:text-slate-300">{item.from}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {tab === "tiers" ? (
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-3xl font-black text-foreground dark:text-white">Referral milestones</h2>
                <span className="text-sm font-semibold text-muted-foreground dark:text-slate-400">You are at Starter</span>
              </div>
              <div className="space-y-3">
                {MILESTONES.map((tier) => (
                  <div key={tier.name} className={`rounded-xl border bg-muted/40 p-4 dark:bg-slate-900/40 ${tier.color}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-2xl font-black text-foreground dark:text-white">{tier.name}</p>
                        <p className="text-sm text-muted-foreground dark:text-slate-300">{tier.range}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black text-amber-600 dark:text-amber-300">{tier.reward}</p>
                        <p className="text-xs font-semibold text-muted-foreground dark:text-slate-400">RDM / referral</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-muted dark:bg-slate-800">
                      <div className="h-1.5 rounded-full bg-muted-foreground/60 dark:bg-slate-500" style={{ width: tier.name === "Starter" ? "10%" : "0%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "leaderboard" ? (
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-3xl font-black text-foreground dark:text-white">
                  <Trophy className="h-7 w-7 text-amber-600 dark:text-amber-300" /> Top referrers this month
                </h2>
                <span className="text-sm font-semibold text-muted-foreground dark:text-slate-400">Resets Jun 1</span>
              </div>
              <div className="space-y-2">
                {LEADERBOARD.map((row) => (
                  <div key={row.rank} className="rounded-xl border border-border bg-muted/40 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-center text-lg font-black text-muted-foreground dark:text-slate-400">{row.rank}</div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-xs font-black text-amber-700 dark:text-amber-300">
                          {row.name.split(" ").map((part) => part[0]).join("")}
                        </div>
                        <p className="text-xl font-black text-foreground dark:text-white">{row.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-muted-foreground dark:text-slate-400">{row.refs} refs</p>
                        <p className="text-3xl font-black text-amber-600 dark:text-amber-300">{row.rdm} RDM</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 text-center text-lg font-black text-violet-300">—</div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-200">
                        YOU
                      </div>
                      <p className="text-xl font-black text-foreground dark:text-white">{profile?.name || user?.name || "You"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-muted-foreground dark:text-slate-400">{friendsReferred} refs</p>
                      <p className="text-3xl font-black text-violet-300">{rdm} RDM</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "streak" ? (
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-3xl font-black text-foreground dark:text-white">
                  <Flame className="h-6 w-6 text-violet-600 dark:text-violet-300" /> Daily sharing streak
                </h2>
                <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-sm font-bold text-rose-300">
                  Day 1 of 7
                </span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground dark:text-slate-300">
                Share your link every day for 7 days to earn a massive streak bonus. Miss a day and the streak resets.
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
                {STREAK_DAYS.map((d) => (
                  <div
                    key={d.day}
                    className={`rounded-xl border px-3 py-2 text-center ${
                      d.active
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : d.day === "Sun"
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-border bg-muted/40 dark:border-slate-700 dark:bg-slate-900/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase text-muted-foreground dark:text-slate-300">{d.day}</p>
                    <p className={`mt-1 text-xl font-black ${d.active ? "text-emerald-600 dark:text-emerald-300" : d.day === "Sun" ? "text-violet-600 dark:text-violet-300" : "text-foreground dark:text-slate-300"}`}>{d.reward}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-violet-500/35 bg-violet-500/10 p-3">
                <p className="text-lg font-black text-violet-300">7-day streak bonus: +195 RDM total</p>
                <p className="text-sm text-muted-foreground dark:text-slate-300">Complete all 7 days to also unlock a Legend badge on your profile.</p>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-4 md:p-5 dark:border-slate-800 dark:bg-[#0b0e18]">
            <h2 className="mb-2 text-3xl font-black text-foreground dark:text-white">Frequently asked questions</h2>
            <div className="divide-y divide-border dark:divide-slate-800">
              {FAQ_ITEMS.map((item, idx) => {
                const open = idx === openFaq;
                return (
                  <div key={item.q} className="py-1">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      className="flex w-full items-center justify-between py-3 text-left"
                    >
                      <span className="text-2xl font-black text-foreground dark:text-white">{item.q}</span>
                      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-slate-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-slate-400" />}
                    </button>
                    {open ? <p className="pb-3 text-sm text-muted-foreground dark:text-slate-300">{item.a}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

