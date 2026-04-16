"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChevronDown, ChevronUp, MessageSquare, Tag } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";
import { SUBJECT_FEED_ICON as subjectIcon, SUBJECT_FEED_ICON_CLASS as subjectIconClass } from "./subjectFeedIcons";
import type { RawPostRow } from "./rawFeedTypes";

const subjectLabel: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
  biology: "Biology",
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
}

export default function RawFeedPostCard({
  post,
  index,
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
  const score = post.upvote_count - post.downvote_count;
  const n = post.comment_count ?? 0;
  const threadLabel = n === 0 ? "Thread" : n === 1 ? "Thread (1 reply)" : `Thread (${n} replies)`;

  const openThread = () => {
    if (!threadOpen) {
      onLoadComments();
    }
    onToggleThread();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="p-4"
    >
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-bold text-foreground">{name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <SubjectGlyph className={cn("h-3.5 w-3.5", subjectIconClass[subjKey] || "text-blue-600")} />
              {subjName}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
          </div>
          {post.chapter_ref ? <p className="mt-1 text-xs font-medium text-primary">{post.chapter_ref}</p> : null}
          {post.tags && post.tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-slate-800"
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
          {post.title && post.title.trim().length > 0 ? (
            <>
              <p className="mt-2 text-sm font-bold leading-snug text-foreground">{post.title.trim()}</p>
              {post.content.trim().length > 0 ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.content}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.content}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div
              className="inline-flex items-stretch overflow-hidden rounded-full border border-sky-500/45 text-xs tabular-nums dark:border-sky-400/35"
              role="group"
              aria-label="Vote"
            >
              <button
                type="button"
                onClick={() => onVote(1)}
                className={cn(
                  "flex items-center justify-center px-2 py-1 transition-colors hover:bg-sky-500/15",
                  myVote === 1 && "bg-sky-500/25 text-sky-200"
                )}
                aria-label="Upvote"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="flex min-w-[2.25rem] items-center justify-center border-x border-sky-500/45 bg-muted/40 px-2 py-1 font-bold text-foreground dark:border-sky-400/35 dark:bg-slate-900/60">
                {score}
              </div>
              <button
                type="button"
                onClick={() => onVote(-1)}
                className={cn(
                  "flex items-center justify-center px-2 py-1 transition-colors hover:bg-slate-500/15",
                  myVote === -1 && "bg-slate-600/40 text-slate-100"
                )}
                aria-label="Downvote"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onSaveForRevision}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Bookmark className="h-4 w-4 shrink-0" />
              Save for revision
            </button>

            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              title="Subject is set on the post"
            >
              <Tag className="h-4 w-4 shrink-0 opacity-70" />
              <span className="font-medium text-foreground/80">{subjName}</span>
            </span>

            <button
              type="button"
              onClick={openThread}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              {threadLabel}
            </button>
          </div>

          {threadOpen ? (
            <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/20 p-3 dark:border-white/10 dark:bg-slate-900/40">
              {commentsLoading ? (
                <p className="text-xs text-muted-foreground">Loading thread…</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No replies yet. Start the thread.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => {
                    const cn_ = c.profiles?.name || "Learner";
                    const depth = c.parent_id ? "ml-4 border-l border-border pl-3 dark:border-white/10" : "";
                    return (
                      <li key={c.id} className={depth}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{cn_}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatTimeAgo(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{c.body}</p>
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
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onReplyTo(null)}>
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
                  <Button type="button" size="sm" className="h-8 rounded-lg text-xs font-bold" onClick={onSubmitComment}>
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
