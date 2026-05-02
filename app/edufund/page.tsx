"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { DUMMY_PROPOSALS, type Proposal, type ProposalCategory } from "@/lib/edufundProposals";
import {
  Heart,
  Target,
  GraduationCap,
  ChevronRight,
  Flame,
  IndianRupee,
  Laptop,
  BookOpen,
  FlaskConical,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  EDUFUND_RDM_GATES,
  estimateDaysToEarnRdmAtDailyRate,
  getEdufundNextGate,
  getEdufundRdmShortfallToNext,
} from "@/lib/dashboardSidebarMetrics";

/** Illustrative daily earn rate for “days to next tier” copy (not a guarantee). */
const ASSUMED_DAILY_RDM = 100;

/** Investor-aligned proposal unlock amount shown at each EduFund tier. */
const EDUFUND_UNLOCK_AMOUNT_BY_TIER = {
  Sprout: 3000,
  Scholar: 15000,
  Champion: 50000,
  Elite: 100000,
  MasterBlaster: 200000,
} as const;

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
  const userRdm = Math.max(0, Math.floor(Number(profile?.rdm ?? 0)));
  const nextGate = getEdufundNextGate(userRdm);
  const shortfallToNext = getEdufundRdmShortfallToNext(userRdm);
  const daysToNextAtRate =
    nextGate != null
      ? estimateDaysToEarnRdmAtDailyRate(shortfallToNext, ASSUMED_DAILY_RDM)
      : null;
  const unlockAmountAtNextTier =
    nextGate != null
      ? EDUFUND_UNLOCK_AMOUNT_BY_TIER[
          nextGate.name as keyof typeof EDUFUND_UNLOCK_AMOUNT_BY_TIER
        ] ?? null
      : null;
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
              <p className="edu-page-desc">
                Support academically committed students who need help funding their education
                essentials.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 2xl:gap-4 2xl:mb-6">
              <Button
                onClick={() => setRequirementsOpen(true)}
                className="edu-btn-primary flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Create Proposal
              </Button>
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
                When self-serve proposals open, you will need all of the above. You cannot submit from the
                app yet — use Create Proposal only to review tier progress for now.
              </p>
            </div>
          </aside>
        </div>

        <Dialog open={requirementsOpen} onOpenChange={setRequirementsOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[1360px] max-h-[92vh] overflow-y-auto rounded-2xl p-3 sm:w-[min(96vw,1360px)] sm:p-4 lg:p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl">
                <Lock className="h-5 w-5 text-primary shrink-0" />
                Requirements to Unlock
              </DialogTitle>
              <DialogDescription className="text-left space-y-3 pt-1">
                <span className="block text-muted-foreground">
                  EduFund proposals unlock step by step as you earn{" "}
                  <strong className="text-foreground">RDM</strong> through learning and engagement activity on
                  the platform.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2.5 py-1 sm:gap-3 lg:grid-cols-2 lg:items-start">
              <section className="h-full rounded-xl border border-border/70 bg-muted/10 p-2.5 sm:p-3 lg:p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  EduFund tiers (RDM thresholds + unlocked amount)
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {EDUFUND_RDM_GATES.map((g) => {
                    const tierUnlockAmount =
                      EDUFUND_UNLOCK_AMOUNT_BY_TIER[
                        g.name as keyof typeof EDUFUND_UNLOCK_AMOUNT_BY_TIER
                      ] ?? 0;
                    return (
                      <li key={g.name} className="rounded-lg border border-border/80 bg-card/40 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-edu-yellow shrink-0" />
                            {g.name}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {g.need.toLocaleString("en-IN")} RDM
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1">
                          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-emerald-200">
                            <IndianRupee className="h-3 w-3" />
                            Amount unlocked
                          </span>
                          <span className="text-sm font-bold tabular-nums text-emerald-300">
                            {formatAmount(tierUnlockAmount)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] sm:text-xs leading-snug text-muted-foreground">
                  <strong className="text-foreground">Sprout</strong>,{" "}
                  <strong className="text-foreground">Scholar</strong>,{" "}
                  <strong className="text-foreground">Champion</strong>,{" "}
                  <strong className="text-foreground">Elite</strong>, and{" "}
                  <strong className="text-foreground">MasterBlaster</strong> mark EduFund benefit tiers on
                  the platform. Starting a proposal from this screen is not turned on yet — these
                  thresholds still describe how RDM maps to future grants and visibility.
                </p>
              </section>

              <section className="h-full rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] sm:text-xs leading-snug text-muted-foreground space-y-2.5 sm:space-y-3 sm:p-3 lg:p-4">
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
                  <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-primary/90">
                    Eligibility Snapshot
                  </p>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Your current RDM</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {userRdm.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {nextGate ? (
                    <>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          Nearest tier slab (<strong className="text-foreground">{nextGate.name}</strong>)
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {nextGate.need.toLocaleString("en-IN")} RDM
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 text-sm border-t border-border/60 pt-2.5">
                        <span className="text-muted-foreground">Your eligibility shortfall</span>
                        <span className="font-bold text-destructive tabular-nums">
                          {shortfallToNext.toLocaleString("en-IN")} RDM
                        </span>
                      </div>
                      {unlockAmountAtNextTier != null ? (
                        <div className="flex justify-between gap-3 text-sm border-t border-border/60 pt-2.5">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <IndianRupee className="h-3.5 w-3.5 text-emerald-300" />
                            Amount unlocked at{" "}
                            <strong className="text-foreground">{nextGate.name}</strong>
                          </span>
                          <span className="font-bold tabular-nums text-emerald-300">
                            {formatAmount(unlockAmountAtNextTier)}
                          </span>
                        </div>
                      ) : null}
                      <p className="text-[11px] sm:text-xs leading-snug text-muted-foreground">
                        At about <strong className="text-foreground">{ASSUMED_DAILY_RDM} RDM/day</strong>,
                        you may reach <strong className="text-foreground">{nextGate.name}</strong> in{" "}
                        <strong className="text-foreground">
                          {daysToNextAtRate != null ? daysToNextAtRate : "—"}
                        </strong>{" "}
                        day{daysToNextAtRate === 1 ? "" : "s"}
                        {daysToNextAtRate == null ? " (set a positive earn rate)" : ""}. Unlocking{" "}
                        <strong className="text-foreground">{nextGate.name}</strong> can open up to{" "}
                        <strong className="text-foreground">
                          {unlockAmountAtNextTier != null ? formatAmount(unlockAmountAtNextTier) : "—"}
                        </strong>{" "}
                        proposal amount.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You are at or above the highest RDM tier shown here (
                      {EDUFUND_RDM_GATES[EDUFUND_RDM_GATES.length - 1]?.name}). In-app proposal submission
                      remains closed until we enable it for everyone.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-card/30 p-3 space-y-1.5">
                  <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-primary/90">
                    Investor Notes
                  </p>
                  <p>
                    <strong className="text-foreground">Note:</strong> MasterBlaster can unlock scholarships
                    upto INR 10L once they get a Rank in recognized college.
                  </p>
                  <p>
                    <strong className="text-foreground">Imp:</strong> Although you can unlock funds, such
                    diligence on its own can make a student get a high Board marks + a Rank in recognized
                    competitive exam.
                  </p>
                  <p>
                    <strong className="text-foreground">Total EduFund grants:</strong>{" "}
                    <strong className="text-foreground">₹90,000</strong> can be raised through consistent
                    learning alone in <strong className="text-foreground">12 months</strong>.
                  </p>
                  <p>
                    <strong className="text-foreground">Note:</strong> The unlocked amount is the amount for
                    which the student can create proposal to raise fund from philanthropists and/or NGOs.
                  </p>
                </div>

                <p className="text-[11px] sm:text-xs leading-snug text-muted-foreground border-t border-border pt-2.5">
                  <strong className="text-foreground">Policy:</strong> You can&apos;t submit a proposal from
                  this screen yet — even if your RDM is high. When applications open, we&apos;ll ask for a
                  healthy account (similar checks to the eligibility panel on this page).
                </p>
              </section>
            </div>

            <DialogFooter className="flex-col gap-2 pt-1 sm:flex-row sm:justify-between">
              <Button variant="outline" className="rounded-xl font-bold" asChild>
                <Link href="/refer-earn">Earn RDM</Link>
              </Button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="rounded-xl font-bold"
                  onClick={() => setRequirementsOpen(false)}
                >
                  Close
                </Button>
                <Button
                  className="edu-btn-primary rounded-xl font-bold"
                  disabled
                  title="Proposal creation from this page is not available yet"
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
