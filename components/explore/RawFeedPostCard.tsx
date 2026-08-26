"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Bookmark, Check, Link2, MessageSquare, MoreVertical, Tag, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DoubtVotePill from "@/components/doubts/DoubtVotePill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHoverCard } from "@/components/UserHoverCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";
import {
  SUBJECT_FEED_ICON as subjectIcon,
} from "./subjectFeedIcons";
import type { RawPostRow } from "./rawFeedTypes";
import {
  getMockPaperSlugFromCommunityPost,
  hrefForMockPaperCommunityShare,
} from "@/lib/mock/mockPaperCommunityLink";
import { getQuizScoreFromPost } from "@/lib/explore/communityPostScore";
import { feedCurriculumChipValues } from "@/lib/explore/feedCurriculumChips";

const subjectLabel: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profiles: { name: string | null } | null;
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export interface RawFeedPostCardProps {
  post: RawPostRow;
  index: number;
  /** Tighter padding/typography for full feed page (small laptop screens). */
  compact?: boolean;
  isSavedForRevision?: boolean;
  myVote: -1 | 0 | 1;
  threadOpen: boolean;
  comments: CommentRow[];
  commentsLoading: boolean;
  commentDraft: string;
  replyParentId: string | null;
  onVote: (direction: 1 | -1) => void;
  onToggleThread: () => void;
  onLoadComments: () => void;
  onCommentDraft: (value: string) => void;
  onSubmitComment: () => void;
  onReplyTo: (commentId: string | null) => void;
  onSaveForRevision: () => void;
  onOpenSourceLink?: () => void;
  canOpenSourceLink?: boolean;
  /** Show post owner menu (delete). */
  isOwnPost?: boolean;
  onDelete?: () => void;
}

export default function RawFeedPostCard({
  post,
  index,
  isSavedForRevision = false,
  myVote,
  threadOpen,
  comments,
  commentsLoading,
  commentDraft,
  replyParentId,
  onVote,
  onToggleThread,
  onLoadComments,
  onCommentDraft,
  onSubmitComment,
  onReplyTo,
  onSaveForRevision,
  onOpenSourceLink,
  canOpenSourceLink = false,
  isOwnPost = false,
  onDelete,
  compact = false,
}: RawFeedPostCardProps) {
  const name = post.profiles?.name || "Learner";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const subjKey = (post.subject || "physics").toLowerCase() as Subject;
  const SubjectGlyph = subjectIcon[subjKey] || subjectIcon.physics;
  const subjName = subjectLabel[subjKey] || post.subject || "General";
  const likeCount = post.upvote_count ?? 0;
  const liked = myVote === 1;
  const n = post.comment_count ?? 0;
  const threadLabelFull =
    n === 0 ? "Thread" : n === 1 ? "Thread (1 reply)" : `Thread (${n} replies)`;
  const quizScore = getQuizScoreFromPost(post);
  const showScoreBar = quizScore !== null && quizScore.total > 0;
  const scoreBarColor =
    quizScore && quizScore.percent >= 60
      ? "bg-emerald-500"
      : quizScore && quizScore.percent >= 40
        ? "bg-amber-500"
        : "bg-red-500";
  const mockPaperShareSlug = getMockPaperSlugFromCommunityPost(
    post.source_type,
    post.source_payload
  );
  const contextChips: { key: string; label: string; value: string; tone: string }[] = [];
  if (post.subject) {
    contextChips.push({
      key: "subject",
      label: "",
      value: subjName,
      tone: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
    });
  }
  const curriculumChips = feedCurriculumChipValues({
    chapterRef: post.chapter_ref,
    topicRef: post.topic_ref,
    subtopicRef: post.subtopic_ref,
  });
  if (curriculumChips.chapter) {
    contextChips.push({
      key: "chapter",
      label: "CH",
      value: curriculumChips.chapter,
      tone: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
    });
  }
  if (curriculumChips.topic) {
    contextChips.push({
      key: "topic",
      label: "TP",
      value: curriculumChips.topic,
      tone: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    });
  }
  if (curriculumChips.subtopic) {
    contextChips.push({
      key: "subtopic",
      label: "SUB",
      value: curriculumChips.subtopic,
      tone: "bg-amber-500/15 text-amber-200 ring-amber-400/35",
    });
  }

  const openThread = () => {
    if (!threadOpen) {
      onLoadComments();
    }
    onToggleThread();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={cn(compact && "text-[12px] sm:text-[13px] xl:text-sm")}
    >
      <div className={cn("flex items-start gap-2 px-3 pt-2.5", compact && "px-3 pt-2")}>
        <UserHoverCard userId={post.user_id} displayName={name}>
          <div className="flex min-w-0 items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-violet-600/80 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold text-foreground sm:text-[12px] xl:text-[13px]">
                  {name}
                </span>
                {post.upvote_count >= 3 ? (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500"
                    title="Active contributor"
                  >
                    <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatTimeAgo(post.created_at)}
              </p>
            </div>
          </div>
        </UserHoverCard>
        <span
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            subjKey === "math" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
            subjKey === "physics" && "border-blue-500/30 bg-blue-500/10 text-blue-300",
            subjKey === "chemistry" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          <SubjectGlyph className="h-3 w-3" aria-hidden />
          {subjName}
        </span>
        {isOwnPost && onDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span
                className="ml-auto inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Post options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {post.tags && post.tags.length > 0 ? (
        <div className={cn("flex flex-wrap gap-1 px-3 pb-1 pl-[2.75rem]", compact && "pl-[2.65rem]")}>
          {post.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-slate-800"
            >
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      <div className={cn("space-y-1 px-3 pb-2 pl-[2.75rem]", compact && "pl-[2.65rem]")}>
        {post.title && post.title.trim().length > 0 ? (
          <>
            <p className="text-[11px] font-semibold leading-snug text-foreground lg:text-[12px]">
              {post.title.trim()}
            </p>
            {post.content.trim().length > 0 ? (
              <p className="text-[10.5px] leading-relaxed text-muted-foreground lg:text-[11px]">
                {post.content}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[12px] leading-relaxed text-foreground sm:text-[13px]">{post.content}</p>
        )}
        {contextChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {contextChips.map((chip) => (
              <span
                key={chip.key}
                className={cn(
                  "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset lg:text-[10.5px]",
                  chip.key === "subject" && "max-w-[5.5rem]",
                  chip.key === "chapter" && "max-w-[min(10rem,38%)]",
                  chip.key === "topic" && "max-w-[min(9rem,34%)]",
                  chip.key === "subtopic" && "max-w-[min(7.5rem,30%)]",
                  chip.tone
                )}
                title={chip.value}
              >
                {chip.label ? <span className="shrink-0 opacity-85">{chip.label}</span> : null}
                <span className="truncate">{chip.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {showScoreBar && quizScore ? (
        <div className="flex items-center gap-2 border-t border-border/80 bg-muted/30 px-4 py-2 dark:border-white/10 dark:bg-slate-900/50">
          <span className="text-[11px] text-muted-foreground">Score</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border dark:bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all", scoreBarColor)}
              style={{ width: `${Math.max(2, quizScore.percent)}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-foreground">{quizScore.percent}%</span>
          {quizScore.total > 0 ? (
            <span className="text-[10px] font-semibold text-emerald-300">
              {quizScore.correct}/{quizScore.total} correct
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center gap-1 border-t border-white/[0.06] bg-[#070c18]/80 px-2.5 py-1.5",
          compact && "px-2"
        )}
      >
        <DoubtVotePill
          likeCount={likeCount}
          liked={liked}
          onLike={() => onVote(liked ? -1 : 1)}
          likeTooltip={liked ? "Unlike" : "Like this post"}
        />

        <button
          type="button"
          onClick={openThread}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-white/10 hover:text-slate-200 sm:text-[11px]"
        >
          <MessageSquare className="h-3 w-3 shrink-0" />
          <span className="max-w-[7rem] truncate sm:max-w-none">{threadLabelFull}</span>
        </button>

        <button
          type="button"
          onClick={onSaveForRevision}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors sm:text-[11px]",
            isSavedForRevision
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-white/[0.06] text-slate-400 hover:border-white/10 hover:text-slate-200"
          )}
        >
          <Bookmark className={cn("h-3 w-3 shrink-0", isSavedForRevision && "fill-current")} />
          <span className="hidden sm:inline">
            {isSavedForRevision ? "Saved" : "Save for revision"}
          </span>
          <span className="sm:hidden">{isSavedForRevision ? "Saved" : "Save"}</span>
        </button>

        <span className="ml-auto hidden items-center gap-1 text-[10px] text-slate-500 sm:inline-flex">
          <Tag className="h-3 w-3 opacity-70" />
          {subjName}
        </span>
            {mockPaperShareSlug ? (
              <Link
                href={hrefForMockPaperCommunityShare(mockPaperShareSlug)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs",
                  "border-amber-500/45 bg-amber-500/12 text-amber-950 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]",
                  "hover:bg-amber-500/20 hover:border-amber-500/60 dark:text-amber-100 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.2)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                )}
                title="Open this paper on Prep"
                aria-label="Open this paper on Prep"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Open paper</span>
                <span className="sm:hidden">Paper</span>
              </Link>
            ) : null}
            {canOpenSourceLink ? (
              <button
                type="button"
                onClick={onOpenSourceLink}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-white transition-all sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs",
                  "border-primary/45 bg-primary/12 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]",
                  "hover:bg-primary/20 hover:border-primary/60 hover:text-white hover:shadow-[0_0_0_1px_rgba(59,130,246,0.28)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                )}
                title="Open source topic"
                aria-label="Open source topic link"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                Link
              </button>
            ) : null}
          </div>

          {threadOpen ? (
            <div className="mx-3 mb-3 space-y-3 rounded-xl border border-border bg-muted/20 p-2.5 dark:border-white/10 dark:bg-slate-900/40 sm:p-3">
              {commentsLoading ? (
                <p className="text-xs text-muted-foreground">Loading thread…</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No replies yet. Start the thread.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => {
                    const cn_ = c.profiles?.name || "Learner";
                    const depth = c.parent_id
                      ? "ml-4 border-l border-border pl-3 dark:border-white/10"
                      : "";
                    return (
                      <li key={c.id} className={depth}>
                        <div className="flex items-baseline justify-between gap-2">
                          <UserHoverCard userId={c.user_id} displayName={cn_}>
                            <span className="text-xs font-bold text-foreground hover:opacity-80">
                              {cn_}
                            </span>
                          </UserHoverCard>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatTimeAgo(c.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                          {c.body}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-[10px] font-semibold text-primary hover:underline"
                          onClick={() => onReplyTo(c.id)}
                        >
                          Reply
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {replyParentId ? (
                <p className="text-[10px] text-muted-foreground">
                  Replying to a comment —{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => onReplyTo(null)}
                  >
                    Cancel
                  </button>
                </p>
              ) : null}
              <div className="space-y-2">
                <Textarea
                  placeholder="Write a comment…"
                  value={commentDraft}
                  onChange={(e) => onCommentDraft(e.target.value)}
                  rows={2}
                  className="min-h-[56px] resize-y text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-lg text-xs font-bold"
                    onClick={onSubmitComment}
                  >
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
    </motion.article>
  );
}
