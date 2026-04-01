"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { UserHoverCard } from "@/components/UserHoverCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DUMMY_PROPOSALS } from "@/lib/edufundProposals";
import type { Proposal, ProposalCategory } from "@/lib/edufundProposals";
import {
  Flame,
  Laptop,
  BookOpen,
  FlaskConical,
  GraduationCap,
} from "lucide-react";

const CATEGORY_ICONS: Record<ProposalCategory, typeof Laptop> = {
  "Learning Device": Laptop,
  "Books & Materials": BookOpen,
  "Lab Equipment": FlaskConical,
  "Course Fee": GraduationCap,
};

function formatAmount(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export default function EduFundDetailPage() {
  const params = useParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const id = params?.id as string | undefined;

  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState(0);
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());

  const baseProposal = useMemo(
    () => (id ? DUMMY_PROPOSALS.find((p) => p.id === id) : null),
    [id]
  );
  const proposalIndex = baseProposal ? DUMMY_PROPOSALS.findIndex((p) => p.id === id) : -1;

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

  const member = proposalIndex >= 0 ? communityMembers[proposalIndex] : null;
  const profileId = member?.id ?? user?.id ?? "";
  const displayName = member?.name ?? profile?.name ?? user?.user_metadata?.name ?? "Student";
  const proposal = baseProposal;
  const isSupporting = proposal && supportingId === proposal.id;
  const isHyped = proposal ? hypedIds.has(proposal.id) : false;
  const pct = proposal
    ? Math.min(100, Math.round((proposal.raised / proposal.goal) * 100))
    : 0;

  const toggleHype = () => {
    if (!proposal) return;
    setHypedIds((prev) => {
      const next = new Set(prev);
      if (next.has(proposal.id)) {
        next.delete(proposal.id);
      } else {
        next.add(proposal.id);
        toast({ title: "Hype sent! 🔥", description: "You hyped this proposal." });
      }
      return next;
    });
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

  if (!proposal) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-3xl mx-auto text-center py-16">
            <h2 className="text-2xl font-bold text-foreground mb-2">Proposal not found.</h2>
            <p className="text-muted-foreground mb-4">
              The proposal you&apos;re looking for may have been removed or doesn&apos;t exist.
            </p>
            <Link href="/edufund">
              <Button variant="outline" className="rounded-xl">
                ← Back to EduFund
              </Button>
            </Link>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const CategoryIcon = CATEGORY_ICONS[proposal.category] ?? BookOpen;

  const AuthorBlock = profileId ? (
    <UserHoverCard userId={profileId} displayName={displayName}>
      <button
        type="button"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
      >
        <Avatar className="h-10 w-10 rounded-xl">
          <AvatarImage src={undefined} />
          <AvatarFallback className="rounded-xl bg-edu-orange/20 text-edu-orange text-sm font-bold">
            {displayName?.slice(0, 2).toUpperCase() ?? "S"}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-foreground">{displayName ?? "Student"}</span>
        <span className="text-sm text-muted-foreground">{proposal.postedDate}</span>
      </button>
    </UserHoverCard>
  ) : (
    <div className="flex items-center gap-2">
      <Avatar className="h-10 w-10 rounded-xl bg-muted">
        <AvatarFallback className="rounded-xl text-muted-foreground text-sm font-bold">
          S
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold text-foreground">Student</span>
      <span className="text-sm text-muted-foreground">{proposal.postedDate}</span>
    </div>
  );

  const paragraphs = proposal.fullStory.split(/\n\n+/).filter(Boolean);

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <Link
            href="/edufund"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Back to EduFund
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="edu-card p-6 space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">{AuthorBlock}</div>
              <span className="edu-chip bg-muted/60 text-muted-foreground shrink-0 flex items-center gap-1">
                <CategoryIcon className="w-4 h-4" />
                {proposal.category}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{proposal.title}</h1>

            <div className="prose prose-sm max-w-none text-foreground">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-muted-foreground mb-3 last:mb-0">
                  {p}
                </p>
              ))}
            </div>

            {proposal.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
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
              <Progress value={pct} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{pct}% funded</p>
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
                  <Button size="sm" onClick={handleDonate} className="edu-btn-primary">
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
                    onClick={toggleHype}
                    className={`rounded-full ${isHyped ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:text-white" : ""}`}
                  >
                    <Flame className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="edu-card p-6 mt-6"
          >
            <h3 className="font-bold text-foreground mb-4">About the author</h3>
            {profileId ? (
              <UserHoverCard userId={profileId} displayName={displayName}>
                <div className="flex items-start gap-4 cursor-pointer hover:opacity-90 transition-opacity">
                  <Avatar className="h-14 w-14 rounded-xl shrink-0">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="rounded-xl bg-edu-orange/20 text-edu-orange text-lg font-bold">
                      {displayName?.slice(0, 2).toUpperCase() ?? "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{displayName ?? "Student"}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Academically committed student on EduBlast
                    </p>
                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                      <span>RDM: —</span>
                      <span>Answers: —</span>
                      <span>Streak: —</span>
                    </div>
                  </div>
                </div>
              </UserHoverCard>
            ) : (
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 rounded-xl bg-muted shrink-0">
                  <AvatarFallback className="rounded-xl text-muted-foreground text-lg font-bold">
                    S
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">Student</p>
                  <p className="text-sm text-muted-foreground mt-0.5">No profile data</p>
                  <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                    <span>RDM: 0</span>
                    <span>Answers: 0</span>
                    <span>Streak: 0</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
