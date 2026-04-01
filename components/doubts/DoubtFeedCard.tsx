"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, Bookmark, MessageSquare, Coins, Pin, Tag, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/UserHoverCard";
import CommentInput from "./CommentInput";
import { useToast } from "@/hooks/use-toast";
import {
  type ExpandedDoubtRow,
  type ExpandedAnswer,
  getSubjectColor,
  formatTimeAgo,
  stripHtml,
} from "./doubtTypes";

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
}

function isAIAnswer(a: ExpandedAnswer) {
  const role = a.profiles?.role ?? "";
  const name = (a.profiles?.name ?? "").toLowerCase();
  return role === "ai" || name.includes("gyan++ ai") || name.includes("ai bot");
}

export default function DoubtFeedCard({ doubt, index, isSaved, onToggleSave, onRefresh, profileAvatarUrl, profileName, myVote = 0, onVote }: DoubtFeedCardProps) {
  const { toast } = useToast();
  const [showAllComments, setShowAllComments] = useState(false);
  const [showBody, setShowBody] = useState(false);

  const d = doubt;
  const authorName = d.profiles?.name ?? "Student";
  const authorInitials = authorName.slice(0, 2).toUpperCase();
  const net = d.upvotes - d.downvotes;
  const subjectColor = getSubjectColor(d.subject);
  const bodyText = stripHtml(d.body);
  const isLongBody = bodyText.length > 200;

  const isAuthorTeacher = d.profiles?.role === "teacher";
  const isAuthorAI = d.profiles?.role === "ai"
    || (d.profiles?.name ?? "").toLowerCase().includes("gyan++ ai")
    || (d.profiles?.name ?? "").toLowerCase().includes("ai bot");

  const allAnswers = [...(d.doubt_answers ?? [])];
  const aiAnswers = allAnswers.filter(isAIAnswer);
  const teacherAnswers = allAnswers.filter(a => a.profiles?.role === "teacher");
  const teacherNames = Array.from(
    new Set(teacherAnswers.map((a) => a.profiles?.name?.trim()).filter(Boolean))
  ) as string[];
  const studentAnswers = allAnswers
    .filter(a => a.profiles?.role !== "teacher" && !isAIAnswer(a))
    .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));

  const visibleComments = showAllComments ? studentAnswers : studentAnswers.slice(0, 2);
  const hiddenComments = studentAnswers.length - 2;

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
                <Avatar className="h-9 w-9 rounded-full shrink-0">
                  <AvatarImage src={d.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className={`rounded-full text-xs font-bold ${isAuthorAI ? "bg-purple-500 text-white" : isAuthorTeacher ? "bg-blue-500 text-white" : ""}`}>
                    {authorInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{authorName}</span>
                  {isAuthorAI && (
                    <span className="text-[10px] font-bold uppercase bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded-full">AI-generated</span>
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

          {/* Body text */}
          {bodyText && (
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed sm:leading-[1.65] mb-1">
              {isLongBody && !showBody ? bodyText.slice(0, 200) + "..." : bodyText}
            </p>
          )}
          {isLongBody && (
            <button type="button" onClick={() => setShowBody(!showBody)} className="text-xs font-semibold text-primary hover:underline mb-2">
              {showBody ? "Show less" : "Read more"}
            </button>
          )}

          {/* Subject chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-1">
            {d.subject && (
              <span className={`edu-chip text-xs font-semibold ${subjectColor.bg} ${subjectColor.text}`}>{d.subject}</span>
            )}
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

          {/* Action row */}
          <div className="flex items-center gap-0.5 -ml-2 flex-wrap">
            <span className="inline-flex items-center rounded-lg overflow-hidden border border-border/50">
              <button
                type="button"
                onClick={() => onVote?.(d.id, 1)}
                className={`flex items-center gap-0.5 px-2 py-1.5 text-xs font-semibold transition-colors ${myVote === 1 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                title="Upvote"
              >
                <ChevronUp className="w-4 h-4" />
                <span className="tabular-nums font-bold">{net}</span>
              </button>
              <span className="w-px h-5 bg-border/60 shrink-0" />
              <button
                type="button"
                onClick={() => onVote?.(d.id, -1)}
                className={`flex items-center px-2 py-1.5 text-xs transition-colors ${myVote === -1 ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                title="Downvote"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </span>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg h-8 text-xs font-semibold text-muted-foreground hover:text-primary px-2.5"
              onClick={() => toast({ title: "Tag subject coming soon!" })}
            >
              <Tag className="w-3.5 h-3.5 mr-1" /> Tag subject
            </Button>
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

        {/* ── AI Answer section ── */}
        {aiAnswers.length > 0 && (
          <div className="border-t border-purple-200/40 bg-purple-500/5 px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 rounded-full shrink-0">
                  <AvatarFallback className="rounded-full text-[10px] bg-purple-500 text-white font-bold">AI</AvatarFallback>
                </Avatar>
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Gyan++ AI</span>
                <span className="text-xs text-muted-foreground">· Answered instantly</span>
              </div>
              {aiAnswers[0].is_accepted && d.bounty_rdm ? (
                <span className="text-xs text-muted-foreground font-medium">-{d.bounty_rdm} RDM · bounty distributed</span>
              ) : null}
            </div>
            <p className="text-sm sm:text-[15px] text-foreground leading-relaxed sm:leading-[1.65] mb-2 whitespace-pre-wrap">{aiAnswers[0].body}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <ChevronUp className="w-3.5 h-3.5" /> {Math.max(0, aiAnswers[0].upvotes - aiAnswers[0].downvotes)} helpful
              </span>
            </div>
          </div>
        )}

        {/* ── Teacher section ── */}
        {teacherAnswers.map((ta) => {
          const tName = ta.profiles?.name ?? "Teacher";
          const tInitials = tName.slice(0, 2).toUpperCase();
          const tNet = ta.upvotes - ta.downvotes;
          return (
            <div key={ta.id} className="border-t border-emerald-200/40">
              {/* Green header bar */}
              <div className="flex items-center justify-between px-5 py-2 bg-emerald-500/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Teacher section</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <UserHoverCard userId={ta.user_id}>
                    <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
                      <Avatar className="h-5 w-5 rounded-full shrink-0">
                        <AvatarImage src={ta.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-full text-[9px] bg-blue-500 text-white font-bold">{tInitials}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground">{tName}</span>
                    </div>
                  </UserHoverCard>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded-full">
                    <GraduationCap className="w-2.5 h-2.5" /> Teacher
                  </span>
                </div>
                <span className="text-xs text-emerald-600 font-semibold shrink-0">+10 RDM earned</span>
              </div>
              {/* Answer body */}
              <div className="px-5 py-3 bg-emerald-500/5">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ta.body}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <ChevronUp className="w-3.5 h-3.5" /> {tNet} teacher upvotes
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Comments section ── */}
        {studentAnswers.length > 0 && (
          <div className="border-t border-border/50 px-5 pt-3 pb-2 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Student comments ({studentAnswers.length})
              </span>
              {studentAnswers.length > 2 && !showAllComments && (
                <button type="button" onClick={() => setShowAllComments(true)} className="text-xs font-semibold text-primary hover:underline">
                  Show all
                </button>
              )}
            </div>
            {visibleComments.map((ans) => {
              const commentIsAI = isAIAnswer(ans);
              const aName = commentIsAI ? "Gyan++ AI" : (ans.profiles?.name ?? "Student");
              const aInitials = aName.slice(0, 2).toUpperCase();
              const aNet = ans.upvotes - ans.downvotes;
              return (
                <div key={ans.id} className="flex gap-2.5">
                  {commentIsAI ? (
                    <Avatar className="h-7 w-7 rounded-full shrink-0 mt-0.5">
                      <AvatarFallback className="rounded-full text-[10px] bg-purple-500 text-white font-bold">AI</AvatarFallback>
                    </Avatar>
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
                        <span className="text-[10px] font-bold uppercase bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded-full">Chatbot</span>
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
                    <p className="text-sm text-foreground leading-relaxed mt-0.5">{ans.body}</p>
                  </div>
                </div>
              );
            })}
            {!showAllComments && hiddenComments > 0 && (
              <button type="button" onClick={() => setShowAllComments(true)} className="text-xs font-semibold text-primary hover:underline pb-1">
                View {hiddenComments} more comments
              </button>
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
          />
        </div>
      </div>
    </motion.div>
  );
}
