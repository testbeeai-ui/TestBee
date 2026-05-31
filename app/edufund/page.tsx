"use client";

import { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { OnboardingClickHerePointer } from "@/components/onboarding/OnboardingClickHerePointer";
import {
  getOnboardingProgress,
  maybeMarkEdufundOnboardingFromCreateProposal,
} from "@/lib/subscription/freeTrialClient";
import {
  EDUFUND_ONBOARDING_QUERY,
  clearEdufundCreateProposalGuideStep,
  clearEdufundOnboardingFlow,
  isEdufundOnboardingFlowActive,
  startEdufundOnboardingFlow,
} from "@/lib/onboarding/edufundOnboardingFlow";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserHoverCard } from "@/components/UserHoverCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DUMMY_PROPOSALS, type Proposal, type ProposalCategory } from "@/lib/rdm/edufundProposals";
import {
  Heart,
  Target,
  GraduationCap,
  ChevronRight,
  Flame,
  Laptop,
  BookOpen,
  FlaskConical,
  Lock,
  Star,
} from "lucide-react";
import {
  EDUFUND_RDM_GATES,
  EDUFUND_MIN_RDM_CREATE_PROPOSAL,
  estimateDaysToEarnRdmAtDailyRate,
  getEdufundNextGate,
  getEdufundRdmShortfallToNext,
} from "@/lib/dashboard/dashboardSidebarMetrics";
import {
  calculateActiveMultiplier,
  getMultiplierLabel,
  fetchSubscriptionConfig,
  SUBSCRIPTION_CONFIG_DEFAULTS,
  type SubscriptionConfig,
} from "@/lib/subscription/subscriptionConfig";

/** Illustrative daily earn rate for “days to next tier” copy (not a guarantee). */
const ASSUMED_DAILY_RDM = 100;

const CATEGORY_OPTIONS: { value: ProposalCategory; label: string; Icon: typeof Laptop }[] = [
  { value: "Learning Device", label: "Learning Device", Icon: Laptop },
  { value: "Books & Materials", label: "Books & Materials", Icon: BookOpen },
  { value: "Lab Equipment", label: "Lab Equipment", Icon: FlaskConical },
  { value: "Course Fee", label: "Course Fee", Icon: GraduationCap },
];

function formatAmount(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function ProposalCard({
  proposal,
  index,
  profileId,
  displayName,
  supportingId,
  setSupportingId,
  donationAmount,
  setDonationAmount,
  hypedIds,
  toggleHype,
  onDonate,
}: {
  proposal: Proposal;
  index: number;
  profileId: string;
  displayName: string;
  supportingId: string | null;
  setSupportingId: (id: string | null) => void;
  donationAmount: number;
  setDonationAmount: (n: number) => void;
  hypedIds: Set<string>;
  toggleHype: (id: string) => void;
  onDonate: () => void;
}) {
  const isSupporting = supportingId === proposal.id;
  const isHyped = hypedIds.has(proposal.id);
  const pct = Math.min(100, Math.round((proposal.raised / proposal.goal) * 100));

  const AuthorBlock = profileId ? (
    <UserHoverCard userId={profileId} displayName={displayName}>
      <button
        type="button"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
      >
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src={undefined} />
          <AvatarFallback className="rounded-lg bg-edu-orange/20 text-edu-orange text-xs font-bold">
            {displayName?.slice(0, 2).toUpperCase() ?? "S"}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold text-foreground truncate">
          {displayName ?? "Student"}
        </span>
        <span className="text-xs text-muted-foreground">{proposal.postedDate}</span>
      </button>
    </UserHoverCard>
  ) : (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8 rounded-lg bg-muted">
        <AvatarFallback className="rounded-lg text-muted-foreground text-xs font-bold">
          S
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-semibold text-foreground">Student</span>
      <span className="text-xs text-muted-foreground">{proposal.postedDate}</span>
    </div>
  );

  const categoryInfo = CATEGORY_OPTIONS.find((c) => c.value === proposal.category);
  const CategoryIcon = categoryInfo?.Icon ?? BookOpen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="edu-card space-y-3 p-4 2xl:space-y-4 2xl:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">{AuthorBlock}</div>
        <span className="edu-chip bg-muted/60 text-muted-foreground shrink-0 flex items-center gap-1">
          <CategoryIcon className="w-3.5 h-3.5" />
          {proposal.category}
        </span>
      </div>

      <Link href={`/edufund/${proposal.id}`} className="block group">
        <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors line-clamp-1">
          {proposal.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{proposal.story}</p>
        <span className="text-sm text-primary font-semibold mt-1 inline-block group-hover:underline">
          Read more →
        </span>
      </Link>

      {proposal.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {proposal.badges.map((b) => (
            <span
              key={b.label}
              className="edu-chip bg-edu-yellow/15 text-edu-orange border border-edu-orange/30"
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">
            {formatAmount(proposal.raised)} / {formatAmount(proposal.goal)}
          </span>
          <span className="font-bold text-foreground">{proposal.supporters} supporters</span>
        </div>
        <Progress value={pct} className="h-2.5" />
        <p className="text-xs text-muted-foreground mt-1">{pct}% funded</p>
      </div>

      <AnimatePresence mode="wait">
        {isSupporting ? (
          <motion.div
            key="supporting"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2"
          >
            <Input
              type="number"
              min={1}
              placeholder="Amount (₹)"
              value={donationAmount || ""}
              onChange={(e) => setDonationAmount(Number(e.target.value) || 0)}
              className="max-w-[120px]"
            />
            <Button size="sm" onClick={onDonate} className="edu-btn-primary">
              Donate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSupportingId(null);
                setDonationAmount(0);
              }}
            >
              Cancel
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSupportingId(proposal.id)}
              className="rounded-xl"
            >
              Support this student
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleHype(proposal.id)}
              className={`rounded-full ${isHyped ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:text-white" : ""}`}
            >
              <Flame className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EduFundPage() {
  return (
    <Suspense fallback={null}>
      <EduFundPageContent />
    </Suspense>
  );
}

function EduFundPageContent() {
  const searchParams = useSearchParams();
  const onboardingEdufundQuery = searchParams.get(EDUFUND_ONBOARDING_QUERY);
  const [showCreateProposalGuide, setShowCreateProposalGuide] = useState(false);

  useEffect(() => {
    if (onboardingEdufundQuery === "1") {
      startEdufundOnboardingFlow();
      setShowCreateProposalGuide(true);
      return;
    }
    if (!isEdufundOnboardingFlowActive()) {
      clearEdufundCreateProposalGuideStep();
    }
    setShowCreateProposalGuide(false);
  }, [onboardingEdufundQuery]);

  const dismissCreateProposalGuide = useCallback(() => {
    clearEdufundCreateProposalGuideStep();
    clearEdufundOnboardingFlow();
    setShowCreateProposalGuide(false);
  }, []);

  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());

  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState<ProposalCategory | null>(null);
  const [createGoal, setCreateGoal] = useState("");
  const [createStory, setCreateStory] = useState("");

  const currentUserName = profile?.name ?? user?.user_metadata?.name ?? "Student";
  const currentUserId = user?.id ?? "";

  const [subscriptionCfg, setSubscriptionCfg] = useState<SubscriptionConfig>(
    SUBSCRIPTION_CONFIG_DEFAULTS
  );

  useEffect(() => {
    fetchSubscriptionConfig().then(setSubscriptionCfg).catch(() => {});
  }, []);

  const planTier = (profile?.plan_tier ?? "free_trial") as
    | "free"
    | "free_trial"
    | "starter"
    | "pro";
  const activeMultiplier = calculateActiveMultiplier(
    planTier,
    profile?.subscription_started_at,
    profile?.created_at ?? new Date().toISOString(),
    subscriptionCfg
  );
  const multiplierLabel = getMultiplierLabel(
    planTier,
    profile?.subscription_started_at,
    profile?.created_at ?? new Date().toISOString(),
    subscriptionCfg
  );
  const isSubscribed = planTier === "starter" || planTier === "pro";
  const userRdm = Math.max(0, Math.floor(Number(profile?.rdm ?? 0)));
  const effectiveUserRdm = Math.floor(userRdm * activeMultiplier);
  const nextGate = getEdufundNextGate(effectiveUserRdm);
  const shortfallToNext = getEdufundRdmShortfallToNext(effectiveUserRdm);
  const daysToNextAtRate =
    nextGate != null ? estimateDaysToEarnRdmAtDailyRate(shortfallToNext, ASSUMED_DAILY_RDM) : null;
  const unlockAmountAtNextTier = nextGate != null ? nextGate.unlockInrAmount : null;
  const canContinueToProposal = effectiveUserRdm >= EDUFUND_MIN_RDM_CREATE_PROPOSAL;
  const [communityMembers, setCommunityMembers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/community-members", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const members = Array.isArray(data?.members) ? data.members : [];
        setCommunityMembers(members);
      })
      .catch(() => setCommunityMembers([]));
  }, []);

  const proposals = useMemo(() => {
    return DUMMY_PROPOSALS.map((p, i) => {
      const member = communityMembers[i];
      const profileId = member?.id ?? currentUserId;
      const displayName = member?.name ?? currentUserName;
      return {
        ...p,
        profileId,
        displayName,
      };
    });
  }, [communityMembers, currentUserId, currentUserName]);

  const topSupported = useMemo(
    () => [...proposals].sort((a, b) => b.raised / b.goal - a.raised / a.goal).slice(0, 3),
    [proposals]
  );

  const toggleHype = (id: string) => {
    setHypedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        toast({ title: "Hype sent! 🔥", description: "You hyped this proposal." });
      }
      return next;
    });
  };

  const handlePublish = () => {
    const title = createTitle.trim();
    const goal = Number(createGoal);
    const story = createStory.trim();
    if (!title) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!createCategory) {
      toast({ title: "Select a category", variant: "destructive" });
      return;
    }
    if (isNaN(goal) || goal < 100) {
      toast({ title: "Goal must be at least ₹100", variant: "destructive" });
      return;
    }
    if (!story) {
      toast({ title: "Story required", variant: "destructive" });
      return;
    }
    toast({
      title: "Proposal created",
      description: "Your proposal has been published. (Demo: no backend.)",
    });
    setCreateOpen(false);
    setCreateTitle("");
    setCreateCategory(null);
    setCreateGoal("");
    setCreateStory("");
  };

  const handleDonate = () => {
    if (donationAmount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    toast({
      title: "Thank you!",
      description: `You donated ₹${donationAmount.toLocaleString("en-IN")}. (Demo: no backend.)`,
    });
    setSupportingId(null);
    setDonationAmount(0);
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 2xl:gap-6">
          <div>
            <div className="edu-page-header mb-4 2xl:mb-6">
              <h1 className="edu-page-title flex items-center gap-2">
                <span className="text-edu-yellow">💛</span>
                EduFund
              </h1>
              <p
                className={cn(
                  "edu-page-desc",
                  showCreateProposalGuide && "max-w-lg text-muted-foreground"
                )}
              >
                {showCreateProposalGuide
                  ? "Tap Create Proposal below to continue your onboarding checklist."
                  : "Support academically committed students who need help funding their education essentials."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 2xl:gap-4 2xl:mb-6">
              <div
                className={cn("relative inline-flex", showCreateProposalGuide && "pt-10 sm:pt-11")}
              >
                {showCreateProposalGuide ? (
                  <div className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 sm:left-8 sm:translate-x-0">
                    <OnboardingClickHerePointer label="Click here" variant="violet" />
                  </div>
                ) : null}
                <Button
                  onClick={() => {
                    if (showCreateProposalGuide) {
                      dismissCreateProposalGuide();
                    }
                    setRequirementsOpen(true);
                    if (!getOnboardingProgress().edufund) {
                      maybeMarkEdufundOnboardingFromCreateProposal();
                    }
                  }}
                  className={cn(
                    "edu-btn-primary flex items-center gap-2",
                    showCreateProposalGuide &&
                      "ring-2 ring-violet-400/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  <Heart className="w-4 h-4" />
                  Create Proposal
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {proposals.length} active proposals
              </p>
            </div>

            <div className="space-y-4 2xl:space-y-5">
              {proposals.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  index={i}
                  profileId={p.profileId}
                  displayName={p.displayName}
                  supportingId={supportingId}
                  setSupportingId={setSupportingId}
                  donationAmount={donationAmount}
                  setDonationAmount={setDonationAmount}
                  hypedIds={hypedIds}
                  toggleHype={toggleHype}
                  onDonate={handleDonate}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-4 2xl:space-y-6">
            <div className="edu-card p-4 2xl:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground 2xl:mb-4">
                <Target className="h-4 w-4 shrink-0 text-edu-orange 2xl:h-5 2xl:w-5" />
                How EduFund Works
              </h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">1.</span>
                  Students create proposals for education essentials.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">2.</span>
                  Supporters donate or hype proposals they believe in.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">3.</span>
                  Funds help students achieve their academic goals.
                </li>
              </ol>
            </div>

            <div className="edu-card p-4 2xl:p-5">
              <h3 className="font-bold text-foreground mb-4">Top Supported</h3>
              <div className="space-y-3">
                {topSupported.map((p) => {
                  const pct = Math.min(100, Math.round((p.raised / p.goal) * 100));
                  const initials = (p.displayName ?? "S").slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={p.id}
                      href={`/edufund/${p.id}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-10 w-10 rounded-lg shrink-0">
                        <AvatarFallback className="rounded-lg bg-edu-orange/20 text-edu-orange text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary">
                          {p.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pct}% funded · {p.supporters} supporters
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="edu-card p-4 2xl:p-5">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-edu-orange" />
                Eligibility to Publish
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-edu-green">✓</span> Minimum 5 accepted answers
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-edu-green">✓</span> Account at least 7 days old
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-edu-green">✓</span> Scholar rank or higher
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-edu-green">✓</span> No active violations
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                When self-serve proposals open, you will need all of the above. You cannot submit
                from the app yet — use Create Proposal only to review tier progress for now.
              </p>
            </div>
          </aside>
        </div>

        <Dialog open={requirementsOpen} onOpenChange={setRequirementsOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[1360px] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0b0f19] p-3 text-slate-200 shadow-2xl sm:w-[min(96vw,1360px)] sm:p-4 lg:p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8 font-display text-xl font-bold text-white">
                <Lock className="h-5 w-5 shrink-0 text-sky-400" aria-hidden />
                Requirements to Unlock
              </DialogTitle>
              <DialogDescription className="text-left text-slate-400">
                <span className="block pt-1 leading-relaxed">
                  EduFund proposals unlock step by step as you earn{" "}
                  <strong className="font-semibold text-white">RDM</strong> through learning and
                  engagement activity on the platform.
                </span>
              </DialogDescription>
            </DialogHeader>

            {/* Investor layout: left = tiers table + status (bottom); right = eligibility + notes */}
            <div className="grid grid-cols-1 gap-3 py-1 lg:grid-cols-2 lg:items-stretch lg:gap-4">
              <div className="flex min-h-0 flex-col gap-3">
                <section className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-2.5 sm:p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-400 sm:text-[11px]">
                    EduFund tiers (RDM thresholds + unlocked amount)
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700/80">
                    <table className="w-full min-w-[280px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/90 bg-slate-900/80 text-left text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
                          <th className="px-3 py-2.5 font-semibold">Level / Badge</th>
                          <th className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            Threshold RDM
                          </th>
                          <th className="px-3 py-2.5 text-right font-semibold">Amount unlocked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {EDUFUND_RDM_GATES.map((g) => {
                          const tierUnlockAmount = g.unlockInrAmount;
                          return (
                            <tr
                              key={g.name}
                              className="border-b border-slate-800/90 last:border-b-0 odd:bg-slate-900/30 even:bg-slate-950/20"
                            >
                              <td className="px-3 py-1.5">
                                <span className="inline-flex items-center gap-2 font-semibold text-white">
                                  <Star
                                    className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                                    aria-hidden
                                  />
                                  {g.name}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
                                {g.need.toLocaleString("en-IN")} RDM
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className="inline-block rounded-md border border-white/25 bg-emerald-600/85 px-2.5 py-1 text-xs font-bold tabular-nums text-white shadow-sm sm:text-sm">
                                  {formatAmount(tierUnlockAmount)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="mt-auto space-y-2">
                  {!isSubscribed && (
                    <>
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 sm:p-3 text-xs text-amber-300 space-y-1 shadow-md">
                        <p className="font-bold flex items-center gap-1.5 text-xs sm:text-sm text-amber-400">
                          <span>⚠️</span> Subscription Required to Publish Proposals
                        </p>
                        <p className="leading-relaxed text-[11px] sm:text-xs">
                          Only premium subscribed students (<strong>Starter</strong> or <strong>Pro</strong>) can compose and submit proposals to raise funds.
                        </p>
                        <p className="leading-relaxed text-slate-300 text-[10px] sm:text-[11px]">
                          Under your current Free/Trial multiplier of <strong>0.25×</strong>, a raw total of <strong>20,000 RDM</strong> is required to yield the 5,000 effective RDM Sprout gate. 
                          Upgrading to a premium plan elevates your multiplier to 1.0× or higher—instantly fast-tracking your grant!
                        </p>
                      </div>

                      <div className="rounded-xl border border-violet-500/30 bg-violet-600/10 p-2.5 sm:p-3 text-violet-200 shadow-md">
                        <p className="text-[11px] leading-snug sm:text-xs">
                          Proposals require a premium subscription (Starter or Pro). Upgrade your plan to unlock full EduFund grant composing and unlock cash aid up to ₹50,000!
                        </p>
                      </div>
                    </>
                  )}

                  {isSubscribed && (
                    <div className="rounded-lg border border-sky-500/30 bg-slate-900/50 px-3 py-3 sm:px-4">
                      <p className="text-[11px] leading-relaxed text-slate-300 sm:text-sm">
                        Creation Proposal feature will become automatically enabled for you once the
                        minimum threshold of {EDUFUND_MIN_RDM_CREATE_PROPOSAL.toLocaleString("en-IN")}{" "}
                        RDM is achieved. Keep up the consistent study!
                      </p>
                    </div>
                  )}
              </div>
            </div>
            <section className="flex flex-col gap-2 rounded-xl border border-slate-700/70 bg-slate-950/30 p-2.5 sm:p-3 text-[10.5px] leading-snug text-slate-400 sm:text-xs">
              <div className="space-y-1.5 rounded-xl border border-sky-500/25 bg-sky-950/25 p-2.5 sm:p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-400 sm:text-[11px]">
                    Eligibility Snapshot
                  </p>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>Your Raw RDM</span>
                    <span className="font-bold tabular-nums text-white">
                      {userRdm.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>Active Multiplier</span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={cn(
                        "font-bold px-2.5 py-0.5 rounded-full text-[15px] sm:text-base border shadow-sm",
                        isSubscribed 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                      )}>
                        {activeMultiplier.toFixed(2)}x
                      </span>
                      {planTier !== "free_trial" && (
                        <span className="text-[10px] text-slate-500">{multiplierLabel.split("—")[1]?.trim() ?? ""}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3 text-sm border-t border-slate-700/50 pt-2 dark:border-slate-800/50">
                    <span className="font-semibold text-emerald-400">Effective EduFund RDM</span>
                    <span className="font-extrabold text-emerald-400 tabular-nums">
                      {effectiveUserRdm.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {nextGate ? (
                    <>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          Nearest tier slab (
                          <strong className="font-semibold text-white">{nextGate.name}</strong>)
                        </span>
                        <span className="font-semibold tabular-nums text-white">
                          {nextGate.need.toLocaleString("en-IN")} RDM
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>Your eligibility shortfall</span>
                        <span className="font-bold tabular-nums text-red-400">
                          {shortfallToNext.toLocaleString("en-IN")} RDM
                        </span>
                      </div>
                      {unlockAmountAtNextTier != null ? (
                        <>
                          <div className="border-t border-slate-600/80 pt-2" />
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="inline-flex flex-wrap items-center gap-1 text-slate-300">
                              Amount unlocked at{" "}
                              <strong className="font-semibold text-white">{nextGate.name}</strong>
                            </span>
                            <span className="font-bold tabular-nums text-emerald-400">
                              {formatAmount(unlockAmountAtNextTier)}
                            </span>
                          </div>
                        </>
                      ) : null}
                      
                      {!isSubscribed && (
                        <div className="rounded-lg bg-violet-600/10 border border-violet-500/20 p-2 text-[10px] text-violet-300 leading-normal">
                          💡 Upgrading to premium instantly unlocks your <strong>1.0x rate</strong>—raising your effective RDM to <strong>{userRdm.toLocaleString("en-IN")} RDM</strong> and instantly shrinking your shortfall to only <strong>{Math.max(0, nextGate.need - userRdm).toLocaleString("en-IN")} RDM</strong>!
                        </div>
                      )}

                      <p className="text-[11px] leading-snug text-slate-400 sm:text-xs">
                        At about{" "}
                        <strong className="font-semibold text-white">
                          {ASSUMED_DAILY_RDM} RDM/day
                        </strong>
                        , you may reach{" "}
                        <strong className="font-semibold text-white">{nextGate.name}</strong> in{" "}
                        <strong className="font-semibold text-white">
                          {daysToNextAtRate != null ? daysToNextAtRate : "—"}
                        </strong>{" "}
                        day{daysToNextAtRate === 1 ? "" : "s"}
                        {daysToNextAtRate == null ? " (set a positive earn rate)" : ""}. Unlocking{" "}
                        <strong className="font-semibold text-white">{nextGate.name}</strong> can
                        open up to{" "}
                        <strong className="font-semibold text-white">
                          {unlockAmountAtNextTier != null
                            ? formatAmount(unlockAmountAtNextTier)
                            : "—"}
                        </strong>{" "}
                        proposal amount.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      You are at or above the highest RDM tier shown here (
                      {EDUFUND_RDM_GATES[EDUFUND_RDM_GATES.length - 1]?.name}). In-app proposal
                      submission remains subject to product rollout and account checks.
                    </p>
                  )}
                </div>
                  <div className="space-y-1.5 rounded-xl border border-slate-700/80 bg-slate-900/45 p-2 sm:p-2.5 text-[10px] sm:text-[11px] leading-snug">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-400 sm:text-[11px]">
                      Notes to students
                    </p>
                  <p>
                    <strong className="text-white">Note:</strong> MasterBlaster can unlock
                    scholarships up to INR 10L once they get a Rank in a recognized college.
                  </p>
                  <p>
                    <strong className="text-white">Imp:</strong> Although you can unlock funds, such
                    diligence on its own can help a student earn high Board marks and a Rank in a
                    recognized competitive exam.
                  </p>
                  <p>
                    <strong className="text-white">Total EduFund grants: ₹90,000</strong> can be
                    raised through consistent learning alone in{" "}
                    <strong className="text-white">12 months</strong>.
                  </p>
                  <p>
                    <strong className="text-white">Note:</strong> The unlocked amount is the amount
                    for which the student can create a proposal to raise funds from philanthropists
                    and/or NGOs.
                  </p>
                </div>
              </section>
            </div>

            <DialogFooter className="flex-col gap-2 border-t border-slate-800/90 pt-3 sm:flex-row sm:justify-between sm:pt-4">
              <Button
                variant="outline"
                className="rounded-full border-slate-500 bg-transparent font-bold text-white hover:bg-slate-800/80 hover:text-white"
                asChild
              >
                <Link href="/refer-earn">Earn RDM</Link>
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  className="rounded-full font-bold text-white hover:bg-slate-800 hover:text-white"
                  onClick={() => setRequirementsOpen(false)}
                >
                  Close
                </Button>
                 <Button
                  className="rounded-full border-0 bg-gradient-to-r from-violet-600 to-blue-600 font-bold text-white shadow-lg hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!canContinueToProposal || !isSubscribed}
                  title={
                    !isSubscribed
                      ? "Premium plan subscription required"
                      : canContinueToProposal
                      ? "Open the proposal form"
                      : `Reach ${EDUFUND_MIN_RDM_CREATE_PROPOSAL.toLocaleString("en-IN")} RDM (Sprout) to continue`
                  }
                  onClick={() => {
                    setRequirementsOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  Continue to proposal
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Proposal</DialogTitle>
              <DialogDescription>
                Share your education funding need. Proposals are reviewed for authenticity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edufund-title">Title</Label>
                <Input
                  id="edufund-title"
                  placeholder="e.g. Need a laptop for JEE preparation"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edufund-category">Category</Label>
                <select
                  id="edufund-category"
                  aria-label="Category"
                  value={createCategory ?? ""}
                  onChange={(e) =>
                    setCreateCategory(e.target.value ? (e.target.value as ProposalCategory) : null)
                  }
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edufund-goal">Goal Amount (₹)</Label>
                <Input
                  id="edufund-goal"
                  type="number"
                  min={100}
                  placeholder="e.g. 15000"
                  value={createGoal}
                  onChange={(e) => setCreateGoal(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edufund-story">Your Story</Label>
                <Textarea
                  id="edufund-story"
                  placeholder="Explain your situation and how the funds will help..."
                  value={createStory}
                  onChange={(e) => setCreateStory(e.target.value)}
                  className="mt-1 min-h-[140px]"
                />
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                Anti-plagiarism: Your story must be original. Plagiarized content will result in
                proposal rejection and possible account restrictions.
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handlePublish} className="edu-btn-primary">
                Publish Proposal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}
