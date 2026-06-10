"use client";

import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DoubtVotePillProps {
  /** Total likes (upvotes). */
  likeCount: number;
  liked?: boolean;
  onLike?: () => void;
  disabled?: boolean;
  likeTooltip?: string;
  className?: string;
  /** @deprecated use likeCount */
  netVotes?: number;
  /** @deprecated use liked */
  myVote?: number;
  /** @deprecated use onLike */
  onVote?: (direction: 1 | -1) => void;
  /** @deprecated use likeTooltip */
  upvoteTooltip?: string;
}

export default function DoubtVotePill({
  likeCount: likeCountProp,
  liked: likedProp,
  onLike,
  disabled = false,
  likeTooltip,
  className,
  netVotes,
  myVote = 0,
  onVote,
  upvoteTooltip,
}: DoubtVotePillProps) {
  const likeCount = likeCountProp ?? Math.max(0, netVotes ?? 0);
  const liked = likedProp ?? myVote === 1;
  const tooltip = likeTooltip ?? upvoteTooltip;
  const canLike = Boolean(onLike ?? onVote) && !disabled;

  const handleLike = () => {
    if (onLike) onLike();
    else onVote?.(1);
  };

  const likeBtn = (
    <button
      type="button"
      onClick={handleLike}
      disabled={!canLike}
      className={cn(
        "inline-flex flex-col items-center justify-center gap-0.5 min-w-[3.25rem] px-2 py-1 rounded-lg transition-colors font-sans",
        canLike && "hover:bg-white/[0.04]",
        liked ? "text-[#6B9FD4]" : "text-slate-400",
        !canLike && "cursor-default opacity-70"
      )}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
    >
      <ThumbsUp
        className={cn("h-[18px] w-[18px]", liked && "fill-[#6B9FD4] text-[#6B9FD4]")}
        strokeWidth={2}
      />
      <span className="text-[11px] font-semibold leading-none">Like</span>
    </button>
  );

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {likeCount > 0 ? (
        <div className="flex items-center gap-1.5 pr-0.5">
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#378ADD]"
            aria-hidden
          >
            <ThumbsUp className="h-2.5 w-2.5 text-white fill-white" />
          </span>
          <span className="text-xs font-medium text-slate-400 tabular-nums">{likeCount}</span>
        </div>
      ) : null}
      {tooltip && canLike ? (
        <Tooltip>
          <TooltipTrigger asChild>{likeBtn}</TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-semibold max-w-[14rem]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        likeBtn
      )}
    </div>
  );
}
