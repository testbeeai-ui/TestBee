import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deletePost as dbDeletePost } from "@/lib/news-blog-db";
import { formatKeyDateEndBadge, formatLinkHostDisplay, keyDatesFeedBlurb } from "../html-feed-and-seo";
import { getExamLabel } from "../post-draft-utils";
import type { Post } from "../types";

export function KeyDatesPostRow({
  post,
  href,
  compact,
  isAdmin,
  onEdit,
}: {
  post: Post;
  href: string;
  compact?: boolean;
  isAdmin?: boolean;
  onEdit?: (post: Post) => void;
}) {
  const host = post.sourceLink ? formatLinkHostDisplay(post.sourceLink) : "";
  return (
    <Link
      href={href}
      className={`group flex w-full items-start text-left transition hover:bg-slate-500/10 ${
        compact
          ? "gap-2 border-b border-slate-600/25 py-2 last:border-b-0"
          : "gap-3 border-b border-slate-600/25 py-3 last:border-b-0"
      }`}
    >
      <div
        className={`flex shrink-0 flex-col rounded-md border border-slate-600/40 bg-[#1a2434] ${
          compact ? "min-w-[3rem] px-1.5 py-1 sm:min-w-[3.5rem]" : "min-w-[3.5rem] px-2 py-1.5 sm:min-w-[4.5rem] sm:px-2.5 sm:py-2"
        }`}
      >
        <span
          className={`font-semibold leading-none text-sky-400 ${compact ? "text-xs" : "text-sm"}`}
        >
          {formatKeyDateEndBadge(post.examDate)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-serif font-semibold leading-snug text-slate-100 ${compact ? "text-xs" : "text-base"}`}
        >
          {post.title}
        </p>
        <p
          className={`text-slate-500 ${compact ? "mt-0.5 text-[10px] leading-relaxed" : "mt-1 text-xs"}`}
        >
          <span className={compact ? "text-slate-400" : "text-slate-400"}>
            {keyDatesFeedBlurb(post) || "-"}
          </span>
          {host ? (
            <>
              <span className="text-slate-600"> · </span>
              <span className="text-slate-500">{host}</span>
            </>
          ) : null}
        </p>
        {!compact ? (
          <p className="mt-1 text-[11px] text-slate-600">{getExamLabel(post.exam)}</p>
        ) : (
          <p className="mt-0.5 text-[10px] text-slate-600">{getExamLabel(post.exam)}</p>
        )}
      </div>
      {isAdmin ? (
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.(post);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-sky-300 transition hover:border-sky-500/70 hover:bg-sky-950/20"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await dbDeletePost(post.id);
              window.location.reload();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-rose-300 transition hover:border-rose-500/70 hover:bg-rose-950/20"
          >
            <Trash2 className="h-3 w-3" /> Del
          </button>
        </div>
      ) : null}
    </Link>
  );
}
