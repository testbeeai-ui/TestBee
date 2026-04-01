"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronUp, Check, GraduationCap } from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";
import { formatTimeAgo, type ExpandedAnswer } from "./doubtTypes";

interface InlineAnswerProps {
  answer: ExpandedAnswer;
}

export default function InlineAnswer({ answer }: InlineAnswerProps) {
  const isTeacher = answer.profiles?.role === "teacher";
  const isAccepted = answer.is_accepted;
  const name = answer.profiles?.name ?? "Student";
  const initials = name.slice(0, 2).toUpperCase();
  const net = answer.upvotes - answer.downvotes;

  return (
    <div className={`pl-4 py-3 ${isTeacher ? "border-l-4 border-blue-500 bg-blue-500/5" : isAccepted ? "border-l-4 border-emerald-500 bg-emerald-500/5" : "border-l-2 border-border"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <UserHoverCard userId={answer.user_id}>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Avatar className="h-6 w-6 rounded-full shrink-0">
              <AvatarImage src={answer.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="rounded-full text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">{name}</span>
          </div>
        </UserHoverCard>
        {isTeacher && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full">
            <GraduationCap className="w-3 h-3" /> Teacher
          </span>
        )}
        {isAccepted && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" /> Accepted
          </span>
        )}
        <span className="text-xs text-muted-foreground">{formatTimeAgo(answer.created_at)}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{answer.body}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronUp className="w-3.5 h-3.5" /> {net > 0 ? `${net} helpful` : net === 0 ? "0" : `${net}`}
        </span>
      </div>
    </div>
  );
}
