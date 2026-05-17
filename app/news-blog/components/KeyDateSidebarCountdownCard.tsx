import Link from "next/link";
import { KEY_DATE_SIDEBAR_ACCENTS } from "../constants";
import { daysFromTodayLocal } from "../key-date-time";
import type { Post } from "../types";

export function KeyDateSidebarCountdownCard({
  post,
  href,
  accent,
}: {
  post: Post;
  href: string;
  accent: (typeof KEY_DATE_SIDEBAR_ACCENTS)[number];
}) {
  const raw = daysFromTodayLocal(post.examDate);

  const countdown =
    Number.isNaN(raw) || !post.examDate.trim() ? (
      <span className="text-[10px] font-medium text-slate-500">-</span>
    ) : raw < 0 ? (
      <span className={`text-[10px] font-semibold leading-none ${accent.numPast}`}>Passed</span>
    ) : raw === 0 ? (
      <span className={`text-[11px] font-semibold leading-none ${accent.num}`}>Today</span>
    ) : raw === 1 ? (
      <span className="inline-flex items-baseline gap-0.5">
        <span className={`text-lg font-bold tabular-nums leading-none ${accent.num}`}>1</span>
        <span className="text-[9px] font-medium leading-none text-slate-500">day</span>
      </span>
    ) : (
      <span className="inline-flex items-baseline gap-0.5">
        <span className={`text-lg font-bold tabular-nums leading-none ${accent.num}`}>{raw}</span>
        <span className="text-[9px] font-medium leading-none text-slate-500">days</span>
      </span>
    );

  return (
    <Link
      href={href}
      className={`block w-full rounded-xl border px-3 py-2 text-left shadow-sm transition hover:brightness-[1.03] ${accent.border}`}
    >
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-100 sm:text-[11px]">
        {post.title}
      </p>
      <div className="mt-1">{countdown}</div>
    </Link>
  );
}
