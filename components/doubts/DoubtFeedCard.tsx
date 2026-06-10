"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DoubtMarkdown from "./DoubtMarkdown";
import { truncatePreservingInlineMath } from "@/lib/gyan/doubtMarkdownUtils";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import {
  Bookmark,
  MessageSquare,
  Coins,
  Pin,
  Tag,
  GraduationCap,
  Loader2,
  Check,
  Circle,
  School,
  Clock,
  Bot,
  ThumbsUp,
} from "lucide-react";
import DoubtVotePill from "./DoubtVotePill";
import {
  gyanFeedCardClass,
  gyanRdmTextClass,
  gyanSaveBtnActiveClass,
  gyanSaveBtnIdleClass,
} from "./gyanWallStyles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserHoverCard } from "@/components/UserHoverCard";
import CommentInput from "./CommentInput";
import { useToast } from "@/hooks/use-toast";
import { OnboardingClickHerePointer } from "@/components/onboarding/OnboardingClickHerePointer";
import {
  DOUBT_FLAIRS,
  type ExpandedDoubtRow,
  formatTimeAgo,
  getSubjectColor,
  stripHtml,
  isAiTutorAnswer,
  isAiTutorDoubtAuthor,
} from "./doubtTypes";
import { ProfPiAvatar } from "./ProfPiAvatar";
import { PROF_PI_CONFIG } from "@/lib/gyanBotPersonas";
import {
  AiCurriculumSourceStrip,
  pickCurriculumNodeFromDoubt,
} from "@/components/doubts/AiCurriculumSourceStrip";

const PROF_PI_ANSWER_LABEL = PROF_PI_CONFIG.name;

/** Inline-ish markdown+KaTeX for question titles (avoid block margins from a single <p>). */
const DOUBT_TITLE_MARKDOWN_CLASS =
  "[&>p]:inline [&>p]:m-0 [&>p]:text-inherit [&>p]:font-bold [&>p]:leading-inherit";

interface DoubtFeedCardProps {
  doubt: ExpandedDoubtRow;
  index: number;
  isSaved: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
  profileAvatarUrl?: string | null;
  profileName?: string | null;
  getMyVote?: (targetType: "doubt" | "answer", targetId: string) => number;
  onVote?: (targetType: "doubt" | "answer", targetId: string, direction: 1 | -1) => void;
  currentUserId?: string | null;
  isAdmin?: boolean;
  /** True right after this user posted; Prof-Pi answer is generating */
  expectProfPiAnswer?: boolean;
  /** Used to tune comment placeholder (teacher vs student). */
  currentUserRole?: string | null;
  upvoteRewardRdm?: number;
  saveRewardRdm?: number;
  teacherRewardRdm?: number;
  commentRewardRdm?: number;
  showEngagePointer?: boolean;
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
  getMyVote,
  onVote,
  currentUserId = null,
  isAdmin = false,
  expectProfPiAnswer = false,
  currentUserRole = null,
  upvoteRewardRdm = 2,
  saveRewardRdm = 3,
  teacherRewardRdm = 30,
  commentRewardRdm = 5,
  showEngagePointer = false,
}: DoubtFeedCardProps) {
  const { toast } = useToast();
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [profPiStoryIdx, setProfPiStoryIdx] = useState(0);

  const FEED_QUESTION_PREVIEW = 320;
  const FEED_AI_PREVIEW = 720;

  const d = doubt;
  const doubtMyVote = getMyVote?.("doubt", d.id) ?? 0;
  const authorName = d.profiles?.name ?? "Student";
  const authorInitials = authorName.slice(0, 2).toUpperCase();
  const doubtLikeCount = d.upvotes;
  const subjectCanon = canonicalDoubtSubject(d.subject);
  const subjectDisplayLabel = subjectCanon ?? (d.subject?.trim() ? d.subject.trim() : null);
  const hasTaggedSubject = Boolean(subjectDisplayLabel);
  const subjectChipColors = getSubjectColor(subjectCanon ?? d.subject ?? null);
  const titleMd = stripHtml(d.title);
  const bodyMd = stripHtml(d.body);
  const isLongBody = bodyMd.length > FEED_QUESTION_PREVIEW;
  const bodyPreviewMd = isLongBody
    ? truncatePreservingInlineMath(bodyMd, FEED_QUESTION_PREVIEW)
    : bodyMd;

  const isAuthorTeacher = d.profiles?.role === "teacher";
  const isAuthorAI = isAiTutorDoubtAuthor(d.profiles);

  const curriculumNode = pickCurriculumNodeFromDoubt(d);
  /** Any doubt linked to a curriculum cell (bot or auto-attached after Prof-Pi). */
  const showCurriculumSource = Boolean(curriculumNode);

  const allAnswers = [...(d.doubt_answers ?? [])];
  const aiAnswers = allAnswers.filter(isAiTutorAnswer);
  const teacherAnswers = allAnswers.filter((a) => a.profiles?.role === "teacher");
  const teacherNames = Array.from(
    new Set(teacherAnswers.map((a) => a.profiles?.name?.trim()).filter(Boolean))
  ) as string[];
  /** Feed: newest student comments first; only two shown — rest on thread page */
  const studentAnswers = allAnswers
    .filter((a) => a.profiles?.role !== "teacher" && !isAiTutorAnswer(a))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const previewStudentComments = studentAnswers.slice(0, 2);
  const moreStudentComments = Math.max(0, studentAnswers.length - 2);

  const showProfPiPending = Boolean(expectProfPiAnswer && aiAnswers.length === 0);
  const showTeacherSection = aiAnswers.length > 0 || showProfPiPending || teacherAnswers.length > 0;

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
        const { session } = await safeGetSession();
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
      toast({
        title: "Subject tagged",
        description: `${flair} — filters and sidebar counts use this label.`,
      });
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
      <div className={gyanFeedCardClass}>
        {/* ── q-head ── */}
        <div className="px-4 pt-3.5 pb-2.5">
          {/* Author row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <UserHoverCard userId={d.user_id}>
              <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                {isAuthorAI ? (
                  <ProfPiAvatar size="md" className="shrink-0" />
                ) : (
                  <Avatar className="h-[34px] w-[34px] rounded-full shrink-0 ring-1 ring-white/10">
                    <AvatarImage src={d.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="rounded-full text-xs font-semibold bg-[#1e3a5f] text-[#8EB8E8]">
                      {authorInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">{authorName}</p>
                  <p className="text-[11px] text-slate-500">{formatTimeAgo(d.created_at)}</p>
                  {isAuthorTeacher && (
                    <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold uppercase bg-[#1a2a45] text-[#5B9A85] px-1.5 py-px rounded-full border border-[#5B9A85]/20">
                      <GraduationCap className="w-2.5 h-2.5" /> Teacher
                    </span>
                  )}
                </div>
              </div>
            </UserHoverCard>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {d.is_resolved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                  <Pin className="w-3.5 h-3.5" /> Pinned
                </span>
              )}
              {(d.bounty_rdm ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-300 text-xs font-bold px-2.5 py-1 border border-violet-500/25">
                  <Coins className="w-3 h-3" /> +{d.bounty_rdm} RDM
                </span>
              )}
            </div>
          </div>

          {/* Question title — same KaTeX rules as body (DoubtMarkdown) */}
          <Link href={`/doubts/${d.id}`} className="block group mb-1">
            <div
              role="heading"
              aria-level={3}
              className="text-sm font-medium text-[#E8EAF0] leading-snug group-hover:text-[#A8D5C5] transition-colors"
            >
              {titleMd ? (
                <DoubtMarkdown content={titleMd} className={DOUBT_TITLE_MARKDOWN_CLASS} />
              ) : (
                <span className="text-muted-foreground">Untitled</span>
              )}
            </div>
          </Link>

          {/* Body — Markdown + KaTeX; long posts link to full thread (Reddit-style) */}
          {bodyMd ? (
            <div className="text-[13px] sm:text-sm text-muted-foreground mb-1">
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

          {subjectDisplayLabel ? (
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                subjectChipColors.bg,
                subjectChipColors.text
              )}
            >
              {subjectDisplayLabel}
            </span>
          ) : null}
          {showCurriculumSource && curriculumNode ? (
            <div className="mt-1.5">
              <AiCurriculumSourceStrip node={curriculumNode} className="min-w-0" />
            </div>
          ) : null}
          {teacherNames.length > 0 && (
            <p className="text-[11px] text-[#5B9A85] mt-1.5 flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Teacher replied
              {teacherNames.length === 1 ? `: ${teacherNames[0]}` : ` (${teacherNames.length})`}
            </p>
          )}

        </div>

        {/* ── q-actions ── */}
        <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5 bg-[#070c18] border-t border-white/[0.04]">
            <div className="relative">
              {showEngagePointer && (
                <div className="absolute -top-11 left-4 z-10 pointer-events-none">
                  <OnboardingClickHerePointer label="Click here" />
                </div>
              )}
              <DoubtVotePill
                likeCount={doubtLikeCount}
                liked={doubtMyVote === 1}
                onLike={() => onVote?.("doubt", d.id, 1)}
                likeTooltip={`Like · +${upvoteRewardRdm} RDM first like today (IST)`}
              />
            </div>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150",
                isSaved ? gyanSaveBtnActiveClass : gyanSaveBtnIdleClass
              )}
              onClick={(e) => onToggleSave(d.id, e)}
            >
              <Bookmark className={cn("w-3.5 h-3.5", isSaved && "fill-current")} />
              {isSaved ? "Saved" : <>Save <span className="text-[#5B9A85] font-normal">(+{saveRewardRdm} RDM)</span></>}
            </button>
            <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-full h-7 max-w-[min(100%,11rem)] text-xs px-2.5 border border-transparent",
                    hasTaggedSubject
                      ? "text-slate-400 hover:text-white hover:border-white/[0.08]"
                      : "text-slate-500 hover:text-slate-300 hover:border-white/[0.06]"
                  )}
                  disabled={!canOpenSubjectPicker}
                  title={
                    canOpenSubjectPicker
                      ? hasTaggedSubject
                        ? `Subject: ${subjectDisplayLabel}. Click to change for sidebar filters.`
                        : "Set subject for sidebar filters"
                      : hasTaggedSubject
                        ? `Subject: ${subjectDisplayLabel}`
                        : d.is_resolved
                          ? "Subject can't be changed after the question is resolved"
                          : "Only the author or an admin can tag the subject"
                  }
                  aria-label={
                    hasTaggedSubject
                      ? canOpenSubjectPicker
                        ? `Subject ${subjectDisplayLabel}, change subject`
                        : `Subject ${subjectDisplayLabel}`
                      : "Tag subject"
                  }
                >
                  <Tag className="w-3.5 h-3.5 mr-1 shrink-0" aria-hidden />
                  <span className="truncate">
                    {hasTaggedSubject ? subjectDisplayLabel : "Tag subject"}
                  </span>
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
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] text-xs text-slate-500 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-150"
              title="Open full thread"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {allAnswers.length > 0
                ? `Thread (${allAnswers.length} ${allAnswers.length === 1 ? "reply" : "replies"})`
                : "Join discussion"}
            </Link>
          </div>

        {/* ── Prof-Pi generating (story beats while /api/gyan-bot-answer runs) ── */}
        {showProfPiPending && (
          <div
            className="border-t border-purple-200/40 bg-gradient-to-b from-purple-500/10 to-transparent px-3 sm:px-5 py-3"
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
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                    {PROF_PI_ANSWER_LABEL}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-500/90">
                    Working on it
                  </span>
                </div>
                <ul className="space-y-1.5 list-none m-0 p-0">
                  {PROF_PI_GENERATION_STAGES.map((label, idx) => {
                    const done = idx < profPiStoryIdx;
                    const active = idx === profPiStoryIdx;
                    const pending = idx > profPiStoryIdx;
                    return (
                      <li key={label} className="flex items-start gap-2.5 text-sm leading-snug">
                        <span
                          className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center"
                          aria-hidden
                        >
                          {done ? (
                            <Check
                              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                              strokeWidth={2.5}
                            />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                          ) : (
                            <Circle
                              className="h-2.5 w-2.5 text-muted-foreground/35"
                              fill="currentColor"
                            />
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
                  Hang tight — this usually takes a few seconds. The card refreshes when the answer
                  is ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Answer section ── */}
        {aiAnswers.length > 0 &&
          (() => {
            const ai = aiAnswers[0];
            const raw = ai.body ?? "";
            const aiLong = raw.length > FEED_AI_PREVIEW;
            const aiMd = aiLong ? truncatePreservingInlineMath(raw, FEED_AI_PREVIEW) : raw;
            const aiLikeCount = ai.upvotes;
            const aiMyVote = getMyVote?.("answer", ai.id) ?? 0;
            return (
              <div className="border-t border-[#3d3580]/30 bg-gradient-to-b from-[#0f0d1f] to-[#0a0f1e]">
                {/* prof-pi-head */}
                <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6c65c8] to-[#389e78] text-[13px] font-bold text-white ring-1 ring-white/10">
                    P
                  </div>
                  <UserHoverCard userId={ai.user_id}>
                    <div className="flex min-w-0 cursor-pointer items-center gap-1.5 hover:opacity-90">
                      <span className="text-[13px] font-semibold text-white">
                        {PROF_PI_ANSWER_LABEL}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#4a43a0]/50 bg-[#13102a] px-2 py-px text-[10px] font-semibold text-[#9b96e0]">
                        <Bot className="w-2.5 h-2.5" />
                        AI Answer
                      </span>
                    </div>
                  </UserHoverCard>
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#389e78] shrink-0">
                    <Clock className="w-3 h-3" />
                    Answered instantly
                  </span>
                </div>

                {/* ans-body */}
                <div className="px-4 pb-3 text-[13px] text-slate-400 leading-[1.75] [&_strong]:text-white [&_li]:text-slate-400 [&_h3]:text-slate-200 [&_h3]:font-semibold">
                  <DoubtMarkdown content={aiMd} />
                  {aiLong ? (
                    <Link
                      href={`/doubts/${d.id}#answer-${ai.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B9A85] hover:text-[#A8D5C5] hover:underline mt-2.5 transition-colors"
                    >
                      Read full answer — open thread
                    </Link>
                  ) : null}
                </div>

                {/* ans-actions — vote pill only (no separate helpful row) */}
                <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-t border-white/[0.04]">
                  <DoubtVotePill
                    likeCount={aiLikeCount}
                    liked={aiMyVote === 1}
                    onLike={() => onVote?.("answer", ai.id, 1)}
                  />
                  <Link
                    href={`/doubts/${d.id}#answer-${ai.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] px-2.5 py-1 text-xs text-slate-500 hover:border-[#5B9A85]/40 hover:text-[#5B9A85] transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Open thread
                  </Link>
                  <button
                    type="button"
                    className={cn(
                      "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
                      isSaved
                        ? gyanSaveBtnActiveClass
                        : gyanSaveBtnIdleClass
                    )}
                    onClick={(e) => onToggleSave(d.id, e)}
                  >
                    <Bookmark className={cn("w-3.5 h-3.5", isSaved && "fill-current")} />
                    {isSaved ? "Saved" : `Save (+${saveRewardRdm} RDM)`}
                  </button>
                </div>
              </div>
            );
          })()}

        {/* ── Teacher section ── */}
        {showTeacherSection && (
          <div
            id={`teacher-section-preview-${d.id}`}
            className="border-t-2 border-[#378ADD]/25 bg-[#070d1a]"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#1a2a45] shrink-0 border border-[#378ADD]/30">
                <School className="w-3 h-3 text-[#8EB8E8]" />
              </span>
              <span className="text-[10px] font-bold text-[#8EB8E8] uppercase tracking-widest flex-1">
                Teacher Section
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[#5B9A85]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#389e78] animate-pulse" />
                Live
              </span>
            </div>
            {teacherAnswers.length === 0 ? (
              (aiAnswers.length > 0 || showProfPiPending) && (
                <div className="px-4 pb-3 border-t border-white/[0.04]">
                  <p className="text-xs text-slate-500 italic mt-2.5">
                    No teacher note yet. Teachers can add exam tips or corrections here.
                  </p>
                </div>
              )
            ) : (
              <div>
                {teacherAnswers.map((ta) => {
                  const tName = ta.profiles?.name ?? "Teacher";
                  const tInitials = tName.slice(0, 2).toUpperCase();
                  const tLikeCount = ta.upvotes;
                  const tMyVote = getMyVote?.("answer", ta.id) ?? 0;
                  return (
                    <div key={ta.id} className="border-t border-white/[0.04] first:border-t-0">
                      <div className="flex items-center justify-between px-4 py-2.5 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserHoverCard userId={ta.user_id}>
                            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
                              <Avatar className="h-6 w-6 rounded-full shrink-0 ring-1 ring-white/10">
                                <AvatarImage src={ta.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback className="rounded-full text-[9px] bg-[#1e3a5f] text-[#8EB8E8] font-semibold">
                                  {tInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-semibold text-white">{tName}</span>
                            </div>
                          </UserHoverCard>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-[#1a2a45] text-[#8EB8E8] px-1.5 py-px rounded-full border border-[#378ADD]/20">
                            <GraduationCap className="w-2.5 h-2.5" /> Teacher
                          </span>
                        </div>
                        <span className={cn("text-[11px] font-semibold shrink-0", gyanRdmTextClass)}>
                          +{teacherRewardRdm} RDM earned
                        </span>
                      </div>
                      <div className="px-4 pb-2.5 text-[13px] text-slate-400 leading-relaxed [&_strong]:text-white">
                        <DoubtMarkdown content={ta.body} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-t border-white/[0.04]">
                        <DoubtVotePill
                          likeCount={tLikeCount}
                          liked={tMyVote === 1}
                          onLike={() => onVote?.("answer", ta.id, 1)}
                        />
                        <Link
                          href={`/doubts/${d.id}#answer-${ta.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#378ADD]/20 px-2.5 py-1 text-xs text-slate-500 hover:border-[#378ADD]/50 hover:text-[#8EB8E8] transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Open thread
                        </Link>
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
          <div className="border-t border-white/[0.04] px-4 pt-3 pb-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                Student Comments ({studentAnswers.length})
              </span>
            </div>
            {previewStudentComments.map((ans) => {
              const commentIsAI = isAiTutorAnswer(ans);
              const aName = commentIsAI ? PROF_PI_ANSWER_LABEL : (ans.profiles?.name ?? "Student");
              const aInitials = aName.slice(0, 2).toUpperCase();
              const aLikes = ans.upvotes;
              return (
                <div key={ans.id} className="flex gap-2.5">
                  {commentIsAI ? (
                    <div className="mt-0.5 shrink-0">
                      <ProfPiAvatar size="sm" />
                    </div>
                  ) : (
                    <UserHoverCard userId={ans.user_id}>
                      <Avatar className="h-7 w-7 rounded-full shrink-0 mt-0.5 cursor-pointer hover:opacity-80 ring-1 ring-white/10">
                        <AvatarImage src={ans.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-full text-[10px] font-bold bg-[#1a1f2c] text-slate-400">
                          {aInitials}
                        </AvatarFallback>
                      </Avatar>
                    </UserHoverCard>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[12px] font-semibold ${commentIsAI ? "text-[#9b96e0]" : "text-white"}`}>
                        {aName}
                      </span>
                      {commentIsAI && (
                        <span className="text-[9px] font-bold uppercase bg-[#13102a] text-[#9b96e0] px-1 py-0.5 rounded-full border border-[#4a43a0]/30">
                          AI tutor
                        </span>
                      )}
                      <span className="text-[11px] text-slate-600">
                        {formatTimeAgo(ans.created_at)}
                      </span>
                      {aLikes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#378ADD]">
                            <ThumbsUp className="h-2 w-2 text-white fill-white" />
                          </span>
                          {aLikes}
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-slate-400 mt-0.5 leading-snug">
                      <DoubtMarkdown content={ans.body} />
                    </div>
                  </div>
                </div>
              );
            })}
            {moreStudentComments > 0 && (
              <Link
                href={`/doubts/${d.id}#doubt-answers`}
                className="inline-flex text-xs font-semibold text-[#5B9A85] hover:text-[#A8D5C5] hover:underline pb-1 transition-colors"
              >
                View {moreStudentComments} more in thread
              </Link>
            )}
          </div>
        )}

        {/* ── Comment input ── */}
        <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.04] bg-[#070c18] relative">
          {showEngagePointer && (
            <div className="absolute -top-11 left-8 z-10 pointer-events-none">
              <OnboardingClickHerePointer label="Comment here" variant="emerald" />
            </div>
          )}
          <CommentInput
            doubtId={d.id}
            onCommentPosted={onRefresh}
            avatarUrl={profileAvatarUrl}
            userName={profileName}
            variant={currentUserRole === "teacher" ? "teacher" : "student"}
            appearance="gyan"
            commentRewardRdm={commentRewardRdm}
          />
        </div>
      </div>
    </motion.div>
  );
}
