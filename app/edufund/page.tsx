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
import {
  DUMMY_PROPOSALS,
  type Proposal,
  type ProposalCategory,
} from "@/lib/edufundProposals";
import {
  Heart,
  Target,
  GraduationCap,
  ChevronRight,
  Flame,
  Laptop,
  BookOpen,
  FlaskConical,
} from "lucide-react";

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
        <AvatarFallback className="rounded-lg text-muted-foreground text-xs font-bold">S</AvatarFallback>
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
      className="edu-card p-5 space-y-4"
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
    () =>
      [...proposals]
        .sort((a, b) => (b.raised / b.goal) - (a.raised / a.goal))
        .slice(0, 3),
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="edu-page-header mb-6">
              <h1 className="edu-page-title flex items-center gap-2">
                <span className="text-edu-yellow">💛</span>
                EduFund
              </h1>
              <p className="edu-page-desc">
                Support academically committed students who need help funding their education
                essentials.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <Button
                onClick={() => setCreateOpen(true)}
                className="edu-btn-primary flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Create Proposal
              </Button>
              <p className="text-sm text-muted-foreground font-medium">
                {proposals.length} active proposals
              </p>
            </div>

            <div className="space-y-5">
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

          <aside className="space-y-6">
            <div className="edu-card p-5">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-edu-orange" />
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

            <div className="edu-card p-5">
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

            <div className="edu-card p-5">
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
                Meet all criteria to create your own proposal.
              </p>
            </div>
          </aside>
        </div>

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
                    setCreateCategory(
                      e.target.value ? (e.target.value as ProposalCategory) : null
                    )
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
