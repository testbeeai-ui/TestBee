"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DoubtMarkdown from "./DoubtMarkdown";
import { truncatePreservingInlineMath } from "@/lib/doubtMarkdownUtils";
import { supabase } from "@/integrations/supabase/client";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronUp,
  Bookmark,
  MessageSquare,
  Coins,
  Pin,
  Tag,
  GraduationCap,
  Loader2,
  Check,
  Circle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UserHoverCard } from "@/components/UserHoverCard";
import CommentInput from "./CommentInput";
import { useToast } from "@/hooks/use-toast";
import {
  DOUBT_FLAIRS,
  type ExpandedDoubtRow,
  getSubjectColor,
  formatTimeAgo,
  stripHtml,
  isAiTutorAnswer,
} from "./doubtTypes";
import { ProfPiAvatar } from "./ProfPiAvatar";
import { PROF_PI_CONFIG } from "@/lib/gyanBotPersonas";

const PROF_PI_ANSWER_LABEL = PROF_PI_CONFIG.name;

interface DoubtFeedCardProps {
  doubt: ExpandedDoubtRow;
  index: number;
  isSaved: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
  profileAvatarUrl?: string | null;
  profileName?: string | null;
  myVote?: number;
  onVote?: (doubtId: string, direction: 1 | -1) => void;
  currentUserId?: string | null;
  isAdmin?: boolean;
  /** True right after this user posted; Prof-Pi answer is generating */
  expectProfPiAnswer?: boolean;
  /** Used to tune comment placeholder (teacher vs student). */
  currentUserRole?: string | null;
}

const PROF_PI_GENERATION_STAGES = [
  "Prof-Pi is thinking it through…",
  "Processing your question and mapping the topic…",
  "Generating a clear, syllabus-grounded answer…",
  "Polishing steps and notation — almost ready to show…",
] as const;

export default function DoubtFeedCard({
  doubt,
  index,
  isSaved,
  onToggleSave,
  onRefresh,
  profileAvatarUrl,
  profileName,
  myVote = 0,
  onVote,
  currentUserId = null,
  isAdmin = false,
  expectProfPiAnswer = false,
  currentUserRole = null,
}: DoubtFeedCardProps) {
  const { toast } = useToast();
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [profPiStoryIdx, setProfPiStoryIdx] = useState(0);

  const FEED_QUESTION_PREVIEW = 320;
  const FEED_AI_PREVIEW = 720;

  const d = doubt;
  const authorName = d.profiles?.name ?? "Student";
  const authorInitials = authorName.slice(0, 2).toUpperCase();
  const net = d.upvotes - d.downvotes;
  const subjectCanon = canonicalDoubtSubject(d.subject);
  const subjectColor = getSubjectColor(subjectCanon ?? d.subject);
  const bodyMd = stripHtml(d.body);
  const isLongBody = bodyMd.length > FEED_QUESTION_PREVIEW;
  const bodyPreviewMd = isLongBody ? truncatePreservingInlineMath(bodyMd, FEED_QUESTION_PREVIEW) : bodyMd;

  const isAuthorTeacher = d.profiles?.role === "teacher";
  const isAuthorAI = d.profiles?.role === "ai"
    || (d.profiles?.name ?? "").toLowerCase().includes("gyan++ ai")
    || (d.profiles?.name ?? "").toLowerCase().includes("ai bot")
    || (d.profiles?.name ?? "").toLowerCase().includes("prof-pi")
    || (d.profiles?.name ?? "").toLowerCase().includes("profpi");

  const allAnswers = [...(d.doubt_answers ?? [])];
  const aiAnswers = allAnswers.filter(isAiTutorAnswer);
  const teacherAnswers = allAnswers.filter(a => a.profiles?.role === "teacher");
  const teacherNames = Array.from(
    new Set(teacherAnswers.map((a) => a.profiles?.name?.trim()).filter(Boolean))
  ) as string[];
  /** Feed: newest student comments first; only two shown — rest on thread page */
  const studentAnswers = allAnswers
    .filter(a => a.profiles?.role !== "teacher" && !isAiTutorAnswer(a))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const previewStudentComments = studentAnswers.slice(0, 2);
  const moreStudentComments = Math.max(0, studentAnswers.length - 2);

  const showProfPiPending = Boolean(expectProfPiAnswer && aiAnswers.length === 0);
  const showTeacherSection =
    aiAnswers.length > 0 || showProfPiPending || teacherAnswers.length > 0;

  useEffect(() => {
    if (!showProfPiPending) {
      setProfPiStoryIdx(0);
      return;
    }
    setProfPiStoryIdx(0);
    const last = PROF_PI_GENERATION_STAGES.length - 1;
    const tick = window.setInterval(() => {
      setProfPiStoryIdx((i) => {
        if (i >= last) {
          window.clearInterval(tick);
          return i;
        }
        return Math.min(i + 1, last);
      });
    }, 2600);
    return () => clearInterval(tick);
  }, [showProfPiPending, d.id]);

  const canAuthorTag = Boolean(currentUserId && currentUserId === d.user_id && !d.is_resolved);
  const canAdminTag = Boolean(isAdmin);
  const canOpenSubjectPicker = canAuthorTag || canAdminTag;

  const applySubjectFlair = async (flair: (typeof DOUBT_FLAIRS)[number]) => {
    if (!canOpenSubjectPicker) return;
    setSubjectSaving(true);
    try {
      if (canAuthorTag) {
        const { error } = await supabase.from("doubts").update({ subject: flair }).eq("id", d.id);
        if (error) throw error;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not signed in");
        const res = await fetch("/api/admin/doubt-subject", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ doubtId: d.id, subject: flair }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast({ title: "Subject tagged", description: `${flair} — filters and sidebar counts use this label.` });
      setSubjectPopoverOpen(false);
      onRefresh();
    } catch (e) {
      toast({
        title: "Could not update subject",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubjectSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
    >
      <div className="edu-card rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200">

        {/* ── Main post area ── */}
        <div className="p-5 sm:p-6 pb-3">

          {/* Author row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <UserHoverCard userId={d.user_id}>
              <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                {isAuthorAI ? (
                  <ProfPiAvatar size="md" className="shrink-0" />
                ) : (
                  <Avatar className="h-9 w-9 rounded-full shrink-0">
                    <AvatarImage src={d.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className={`rounded-full text-xs font-bold ${isAuthorTeacher ? "bg-blue-500 text-white" : ""}`}>
                      {authorInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{authorName}</span>
                  {isAuthorAI && (
                    <span className="text-[10px] font-bold uppercase bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded-full">
                      {PROF_PI_ANSWER_LABEL} tutor
                    </span>
                  )}
                  {isAuthorTeacher && (
                    <span className="text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <GraduationCap className="w-2.5 h-2.5" /> Teacher
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatTimeAgo(d.created_at)}</span>
                </div>
              </div>
            </UserHoverCard>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {d.is_resolved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <Pin className="w-3.5 h-3.5" /> Pinned
                </span>
              )}
              {(d.bounty_rdm ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-edu-orange/20 text-edu-orange text-xs font-bold px-2.5 py-1 border border-edu-orange/30">
                  <Coins className="w-3 h-3" /> +{d.bounty_rdm} RDM bounty
                </span>
              )}
            </div>
          </div>

          {/* Question title */}
          <Link href={`/doubts/${d.id}`} className="block group mb-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug sm:leading-tight group-hover:text-primary transition-colors">
              {d.title}
            </h3>
          </Link>

          {/* Body — Markdown + KaTeX; long posts link to full thread (Reddit-style) */}
          {bodyMd ? (
            <div className="text-sm sm:text-[15px] text-muted-foreground mb-1">
              <DoubtMarkdown content={bodyPreviewMd} />
              {isLongBody ? (
                <Link
                  href={`/doubts/${d.id}#doubt-body`}
                  className="inline-block text-xs font-semibold text-primary hover:underline mt-1.5"
                >
                  Read more — open full thread
                </Link>
              ) : null}
            </div>
          ) : null}

          {/* Subject chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-1">
            {subjectCanon ? (
              <span className={`edu-chip text-xs font-semibold ${subjectColor.bg} ${subjectColor.text}`}>{subjectCanon}</span>
            ) : d.subject?.trim() ? (
              <span className="edu-chip text-xs font-semibold bg-muted text-muted-foreground" title="Unrecognized subject — tag again to fix filters">
                {d.subject.trim()}
              </span>
            ) : canOpenSubjectPicker ? (
              <span className="edu-chip text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200">Untagged</span>
            ) : null}
            {d.is_resolved && (
              <span className="edu-chip bg-emerald-500/10 text-emerald-600 text-xs font-semibold">Resolved</span>
            )}
            {teacherNames.length > 0 && (
              <span className="edu-chip bg-blue-500/10 text-blue-600 text-xs font-semibold inline-flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Teacher replied{teacherNames.length === 1 ? `: ${teacherNames[0]}` : ` (${teacherNames.length})`}
              </span>
            )}
          </div>

          {/* Action row — compact vote pill: up = blue, down = orange when active */}
          <div className="flex items-center gap-2 -ml-1 flex-wrap">
            <div
              className={cn(
                "inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full border shadow-sm transition-colors duration-150",
                // Neutral: charcoal capsule — same height as adjacent h-8 actions
                myVote === 0 && "border-zinc-600/90 bg-[#2e3238] dark:bg-[#2a2e35]",
                // Upvoted: blue (per product preference)
                myVote === 1 && "border-blue-400 bg-[#2e3238] dark:bg-[#2a2e35] ring-1 ring-blue-400/25",
                // Downvoted: orange
                myVote === -1 && "border-orange-400 bg-[#2e3238] dark:bg-[#2a2e35] ring-1 ring-orange-400/25"
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onVote?.(d.id, 1)}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      myVote === 0 && "text-zinc-100 hover:bg-blue-400/12 hover:text-blue-300",
                      myVote === 1 && "bg-blue-400/14 text-blue-400",
                      myVote === -1 && "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                    )}
                    aria-label="Upvote"
                  >
                    <ArrowBigUp className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-semibold">
                  Upvote
                </TooltipContent>
              </Tooltip>
              <div
                className={cn(
                  "flex h-8 min-w-[1.75rem] max-w-[3rem] items-center justify-center border-x border-zinc-600/70 px-1.5 tabular-nums text-xs font-bold leading-none",
                  myVote === 0 && "bg-black/25 text-zinc-100 dark:bg-black/30",
                  myVote === 1 && "border-blue-400/35 bg-black/35 text-sky-100",
                  myVote === -1 && "border-orange-400/35 bg-black/35 text-amber-100"
                )}
              >
                {net}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onVote?.(d.id, -1)}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      myVote === 0 && "text-zinc-100 hover:bg-orange-400/12 hover:text-orange-300",
                      myVote === -1 && "bg-orange-400/14 text-orange-400",
                      myVote === 1 && "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                    )}
                    aria-label="Downvote"
                  >
                    <ArrowBigDown className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-semibold">
                  Downvote
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg h-8 text-xs font-semibold text-muted-foreground hover:text-primary px-2.5"
              onClick={(e) => onToggleSave(d.id, e)}
            >
              <Bookmark className={`w-3.5 h-3.5 mr-1 ${isSaved ? "fill-current text-primary" : ""}`} />
              {isSaved ? "Saved" : "Save for revision"}
            </Button>
            <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-lg h-8 text-xs font-semibold text-muted-foreground hover:text-primary px-2.5"
                  disabled={!canOpenSubjectPicker}
                  title={
                    canOpenSubjectPicker
                      ? "Set subject for sidebar filters"
                      : d.is_resolved
                        ? "Subject can’t be changed after the question is resolved"
                        : "Only the author or an admin can tag the subject"
                  }
                >
                  <Tag className="w-3.5 h-3.5 mr-1" /> Tag subject
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(100vw-2rem,20rem)] rounded-xl p-3">
                <p className="text-xs font-bold text-foreground mb-2">Subject for filters</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Pick one label so this thread appears under the correct chip in the left sidebar.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DOUBT_FLAIRS.map((flair) => (
                    <Button
                      key={flair}
                      type="button"
                      size="sm"
                      variant={subjectCanon === flair ? "default" : "outline"}
                      className="rounded-lg text-xs h-8"
                      disabled={subjectSaving}
                      onClick={() => void applySubjectFlair(flair)}
                    >
                      {flair}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Link
              href={`/doubts/${d.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Open full thread on the doubt page"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {allAnswers.length > 0
                ? `Thread (${allAnswers.length} ${allAnswers.length === 1 ? "reply" : "replies"})`
                : "Join discussion"}
            </Link>
          </div>
        </div>

        {/* ── Prof-Pi generating (story beats while /api/gyan-bot-answer runs) ── */}
        {showProfPiPending && (
          <div
            className="border-t border-purple-200/40 bg-gradient-to-b from-purple-500/10 to-transparent px-5 py-3"
            aria-busy="true"
            aria-live="polite"
            aria-label={`${PROF_PI_ANSWER_LABEL} is preparing an answer`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <ProfPiAvatar size="sm" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{PROF_PI_ANSWER_LABEL}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-500/90">Working on it</span>
                </div>
                <ul className="space-y-1.5 list-none m-0 p-0">
                  {PROF_PI_GENERATION_STAGES.map((label, idx) => {
                    const done = idx < profPiStoryIdx;
                    const active = idx === profPiStoryIdx;
                    const pending = idx > profPiStoryIdx;
                    return (
                      <li key={label} className="flex items-start gap-2.5 text-sm leading-snug">
                        <span className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center" aria-hidden>
                          {done ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                          ) : (
                            <Circle className="h-2.5 w-2.5 text-muted-foreground/35" fill="currentColor" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "min-w-0",
                            done && "text-muted-foreground",
                            active && "font-medium text-foreground",
                            pending && "text-muted-foreground/45"
                          )}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Hang tight — this usually takes a few seconds. The card refreshes when the answer is ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Answer section ── */}
        {aiAnswers.length > 0 && (() => {
          const ai = aiAnswers[0];
          const raw = ai.body ?? "";
          const aiLong = raw.length > FEED_AI_PREVIEW;
          const aiMd = aiLong ? truncatePreservingInlineMath(raw, FEED_AI_PREVIEW) : raw;
          return (
            <div className="border-t border-purple-200/40 bg-purple-500/5 px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserHoverCard userId={ai.user_id}>
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg hover:opacity-90 min-w-0">
                      <ProfPiAvatar size="sm" />
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-400 tracking-tight">{PROF_PI_ANSWER_LABEL}</span>
                    </span>
                  </UserHoverCard>
                  <span className="text-xs text-muted-foreground shrink-0">· Answered instantly</span>
                </div>
                {ai.is_accepted && d.bounty_rdm ? (
                  <span className="text-xs text-muted-foreground font-medium">-{d.bounty_rdm} RDM · bounty distributed</span>
                ) : null}
              </div>
              <div className="text-sm sm:text-[15px] text-foreground mb-2">
                <DoubtMarkdown content={aiMd} />
                {aiLong ? (
                  <Link
                    href={`/doubts/${d.id}#answer-${ai.id}`}
                    className="inline-block text-xs font-semibold text-primary hover:underline mt-2"
                  >
                    Read full answer — open thread
                  </Link>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <ChevronUp className="w-3.5 h-3.5" /> {Math.max(0, ai.upvotes - ai.downvotes)} helpful
                </span>
                <Link
                  href={`/doubts/${d.id}#answer-${ai.id}`}
                  className="text-[11px] font-medium text-primary/80 hover:text-primary hover:underline"
                  title="Open thread and use Report → Incorrect formula or fact"
                >
                  Wrong formula? Report on thread
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ── Teacher section (bar always when AI / pending / or teacher replies exist) ── */}
        {showTeacherSection && (
          <div id={`teacher-section-preview-${d.id}`} className="border-t border-emerald-200/40">
            <div className="flex items-center justify-between px-5 py-2 bg-emerald-500/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide shrink-0">
                  Teacher section
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
              </div>
            </div>
            {teacherAnswers.length === 0 ? (
              (aiAnswers.length > 0 || showProfPiPending) && (
                <div className="px-5 py-3 bg-emerald-500/5">
                  <p className="text-sm text-muted-foreground">
                    No teacher note yet. Teachers can add exam tips or corrections here; it stays separate from student comments.
                  </p>
                  <Link
                    href={`/doubts/${d.id}#teacher-section`}
                    className="inline-block text-xs font-semibold text-primary hover:underline mt-2"
                  >
                    Open thread — add in teacher section
                  </Link>
                </div>
              )
            ) : (
              <div className="divide-y divide-emerald-200/30">
                {teacherAnswers.map((ta) => {
                  const tName = ta.profiles?.name ?? "Teacher";
                  const tInitials = tName.slice(0, 2).toUpperCase();
                  const tNet = ta.upvotes - ta.downvotes;
                  return (
                    <div key={ta.id} className="bg-emerald-500/5">
                      <div className="flex items-center justify-between px-5 py-2 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <UserHoverCard userId={ta.user_id}>
                            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 min-w-0">
                              <Avatar className="h-6 w-6 rounded-full shrink-0">
                                <AvatarImage src={ta.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback className="rounded-full text-[9px] bg-blue-500 text-white font-bold">
                                  {tInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-semibold text-foreground truncate">{tName}</span>
                            </div>
                          </UserHoverCard>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">
                            <GraduationCap className="w-2.5 h-2.5" /> Teacher
                          </span>
                        </div>
                        <span className="text-xs text-emerald-600 font-semibold shrink-0">+10 RDM earned</span>
                      </div>
                      <div className="px-5 pb-3 pt-0">
                        <DoubtMarkdown content={ta.body} className="text-sm text-foreground" />
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <ChevronUp className="w-3.5 h-3.5" /> {tNet} teacher upvotes
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Comments section ── */}
        {studentAnswers.length > 0 && (
          <div className="border-t border-border/50 px-5 pt-3 pb-2 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Student comments ({studentAnswers.length})
              </span>
            </div>
            {previewStudentComments.map((ans) => {
              const commentIsAI = isAiTutorAnswer(ans);
              const aName = commentIsAI ? PROF_PI_ANSWER_LABEL : (ans.profiles?.name ?? "Student");
              const aInitials = aName.slice(0, 2).toUpperCase();
              const aNet = ans.upvotes - ans.downvotes;
              return (
                <div key={ans.id} className="flex gap-2.5">
                  {commentIsAI ? (
                    <div className="mt-0.5 shrink-0">
                      <ProfPiAvatar size="sm" />
                    </div>
                  ) : (
                    <UserHoverCard userId={ans.user_id}>
                      <Avatar className="h-7 w-7 rounded-full shrink-0 mt-0.5 cursor-pointer hover:opacity-80">
                        <AvatarImage src={ans.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-full text-[10px] font-bold">{aInitials}</AvatarFallback>
                      </Avatar>
                    </UserHoverCard>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${commentIsAI ? "text-purple-700 dark:text-purple-400" : "text-foreground"}`}>{aName}</span>
                      {commentIsAI && (
                        <span className="text-[10px] font-bold uppercase bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded-full">AI tutor</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(ans.created_at)}</span>
                      {!commentIsAI && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+5 RDM earned</span>
                      )}
                      {aNet > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <ChevronUp className="w-3 h-3" /> {aNet}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-foreground mt-0.5">
                      <DoubtMarkdown content={ans.body} />
                    </div>
                  </div>
                </div>
              );
            })}
            {moreStudentComments > 0 && (
              <Link
                href={`/doubts/${d.id}#doubt-answers`}
                className="inline-flex text-xs font-semibold text-primary hover:underline pb-1"
              >
                View {moreStudentComments} more in thread →
              </Link>
            )}
          </div>
        )}

        {/* ── Comment input ── */}
        <div className="px-5 pb-4">
          <CommentInput
            doubtId={d.id}
            onCommentPosted={onRefresh}
            avatarUrl={profileAvatarUrl}
            userName={profileName}
            variant={currentUserRole === "teacher" ? "teacher" : "student"}
          />
        </div>
      </div>
    </motion.div>
  );
}
