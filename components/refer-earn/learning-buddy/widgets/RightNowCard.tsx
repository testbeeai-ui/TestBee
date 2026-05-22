"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import DoubtMarkdown from "@/components/doubts/DoubtMarkdown";
import { gyanRightNowPreviewContent } from "@/lib/buddy/gyanBuddyListLine";
import { cn } from "@/lib/utils";
import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function RightNowCard({
  rightNow,
  buddyOnline = false,
}: {
  rightNow: BuddyDashboardResponse["rightNow"];
  buddyOnline?: boolean;
}) {
  const isQuiz = rightNow.kind === "quiz_attempted";
  const isGyanActive = rightNow.kind === "gyan_active";
  const isCommunityPosted = rightNow.kind === "community_posted";
  const isGyanBrowsing = rightNow.kind === "gyan_browsing";
  const isStudying = rightNow.kind === "studying";
  const isOnline = rightNow.kind === "online";
  const isSocialPreview = isGyanActive || isCommunityPosted;
  const isLive =
    buddyOnline &&
    (isQuiz || isGyanActive || isCommunityPosted || isGyanBrowsing || isStudying || isOnline);

  const subject =
    "subject" in rightNow && rightNow.subject != null ? rightNow.subject : null;
  const topic = "topic" in rightNow ? rightNow.topic : null;
  const subtopic = "subtopic" in rightNow ? rightNow.subtopic : null;
  const panel = "panel" in rightNow ? rightNow.panel : null;
  const href = "href" in rightNow ? rightNow.href : null;
  const lastActiveAt = rightNow.lastActiveAt;

  const socialTitle =
    (isGyanActive || isCommunityPosted) && "title" in rightNow ? rightNow.title : null;
  const socialPreview = socialTitle ? gyanRightNowPreviewContent(socialTitle) : null;

  const hasRecentScope = Boolean(subject && (topic || subtopic));
  const scorePercent =
    isQuiz && "scorePercent" in rightNow && typeof rightNow.scorePercent === "number"
      ? Math.round(rightNow.scorePercent)
      : null;
  const setLabel = isQuiz && "setLabel" in rightNow ? rightNow.setLabel : null;

  const statusLabel = isQuiz
    ? "Attempted topic quiz"
    : isGyanActive
      ? "Posted on Gyan++"
      : isCommunityPosted
        ? "Posted on Community"
        : isGyanBrowsing
          ? (buddyOnline ? "On Gyan++ now" : "Recently on Gyan++")
          : isStudying
            ? (buddyOnline ? "Studying now" : "Recently studying")
            : isOnline
              ? (buddyOnline ? "Online now" : "Recently online")
              : hasRecentScope
                ? "Recently on"
                : "Idle";

  const bodyText = isGyanBrowsing
    ? "Browsing Gyan++ · Magic Wall"
    : isOnline
      ? "Exploring TestBee"
      : hasRecentScope
        ? `${subject} · ${topic ?? ""}${subtopic ? ` · ${subtopic}` : ""}`
        : "Nothing recent yet.";

  const accent =
    isQuiz
      ? "sky"
      : isCommunityPosted
        ? "violet"
        : isGyanActive || isGyanBrowsing
          ? "cyan"
          : isStudying || isOnline
            ? "emerald"
            : "neutral";

  const borderClass =
    accent === "sky"
      ? "border-sky-500/35 bg-sky-500/[0.07]"
      : accent === "violet"
        ? "border-violet-500/35 bg-violet-500/[0.07]"
        : accent === "cyan"
          ? "border-cyan-500/35 bg-cyan-500/[0.07]"
          : accent === "emerald"
            ? "border-emerald-500/35 bg-emerald-500/[0.07]"
            : "border-white/10 bg-white/[0.03]";

  const iconClass =
    accent === "sky"
      ? "bg-sky-500/20 text-sky-200"
      : accent === "violet"
        ? "bg-violet-500/20 text-violet-200"
        : accent === "cyan"
          ? "bg-cyan-500/20 text-cyan-200"
          : accent === "emerald"
            ? "bg-emerald-500/20 text-emerald-200"
            : "bg-white/10 text-slate-400";

  const titleClass =
    accent === "sky"
      ? "text-sky-50"
      : accent === "violet"
        ? "text-violet-50"
        : accent === "cyan"
          ? "text-cyan-50"
          : accent === "emerald"
            ? "text-emerald-50"
            : "text-slate-200";

  const linkClass =
    accent === "violet"
      ? "text-violet-300"
      : accent === "sky"
        ? "text-sky-300"
        : "text-cyan-300";

  const subjectBadgeClass =
    accent === "violet"
      ? "bg-violet-500/15 text-violet-200"
      : "bg-cyan-500/15 text-cyan-200";

  const openLinkLabel = isCommunityPosted
    ? "Open community post →"
    : isGyanActive || isGyanBrowsing
      ? "Open Gyan++ →"
      : "Open this subtopic →";

  return (
    <div className={cn("rounded-[10px] border px-3 py-2.5", borderClass)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full",
            iconClass
          )}
        >
          {isLive ? (
            <span className="relative">
              <Radio className="h-3 w-3" />
              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <Radio className="h-3 w-3" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Right now
          </p>
          <p className={cn("truncate text-[13px] font-semibold", titleClass)}>
            {statusLabel}{" "}
            <span className="text-[11px] font-normal text-slate-400">
              · {formatRelative(lastActiveAt)}
            </span>
          </p>
        </div>
      </div>

      {isSocialPreview && socialPreview && href ? (
        <div className="mt-1.5 min-w-0">
          <Link href={href} className="block min-w-0 hover:opacity-95">
            <div
              className="buddy-right-now-gyan-wrap text-[12px] leading-snug text-slate-300"
              title={socialTitle ?? undefined}
            >
              <DoubtMarkdown
                content={socialPreview}
                compact
                className="buddy-right-now-gyan"
              />
            </div>
          </Link>
          {subject ? (
            <span
              className={cn(
                "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                subjectBadgeClass
              )}
            >
              {subject}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 truncate text-[12px] text-slate-300">
          {bodyText}
          {isQuiz && scorePercent != null ? (
            <span className="ml-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
              {scorePercent}%{setLabel ? ` · ${setLabel}` : ""}
            </span>
          ) : panel && !isGyanBrowsing ? (
            <span className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
              {panel}
            </span>
          ) : null}
        </p>
      )}

      {href ? (
        <Link
          href={href}
          className={cn("mt-1.5 inline-block text-[11px] font-semibold hover:underline", linkClass)}
        >
          {openLinkLabel}
        </Link>
      ) : null}
    </div>
  );
}
