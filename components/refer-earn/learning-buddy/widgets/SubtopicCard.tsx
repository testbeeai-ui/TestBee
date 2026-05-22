"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";
import { TileFrame } from "./TileFrame";

function compactSubtopic(
  subject: string | null | undefined,
  topic: string | null | undefined,
  subtopic: string | null | undefined
): string {
  const parts = [subject, topic, subtopic].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  const joined = parts.join(" · ");
  if (joined.length <= 60) return joined;
  return `${joined.slice(0, 59)}…`;
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SubtopicCard({
  data,
}: {
  data: BuddyDashboardResponse["subtopic"];
}) {
  const recent = data.completedRecent.slice(0, 5);
  const showCurrent = data.current;
  const showLastOn = !showCurrent && data.lastOn;

  return (
    <TileFrame title="Subtopic" accent="fuchsia">
      {showCurrent ? (
        <div className="mb-1.5 flex items-start gap-1.5 rounded-md border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-2 py-1.5">
          <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-fuchsia-300" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200">
              Currently reading
            </p>
            {data.current!.href ? (
              <Link
                href={data.current!.href}
                className="block truncate text-[11.5px] font-medium text-slate-100 hover:underline"
              >
                {compactSubtopic(
                  data.current!.subject,
                  data.current!.topic,
                  data.current!.subtopic
                )}
              </Link>
            ) : (
              <p className="truncate text-[11.5px] font-medium text-slate-100">
                {compactSubtopic(
                  data.current!.subject,
                  data.current!.topic,
                  data.current!.subtopic
                )}
              </p>
            )}
          </div>
        </div>
      ) : showLastOn ? (
        <div className="mb-1.5 flex items-start gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Last on subtopic · {formatRelative(data.lastOn!.updatedAt)}
            </p>
            {data.lastOn!.href ? (
              <Link
                href={data.lastOn!.href}
                className="block truncate text-[11.5px] font-medium text-slate-200 hover:underline"
              >
                {compactSubtopic(
                  data.lastOn!.subject,
                  data.lastOn!.topic,
                  data.lastOn!.subtopic
                )}
              </Link>
            ) : (
              <p className="truncate text-[11.5px] font-medium text-slate-200">
                {compactSubtopic(
                  data.lastOn!.subject,
                  data.lastOn!.topic,
                  data.lastOn!.subtopic
                )}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {recent.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          No completed subtopics yet. Shows when your buddy taps Mark as complete on a lesson.
        </p>
      ) : (
        <>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recently completed
          </p>
          <ul className="space-y-1">
            {recent.map((row, idx) => (
              <li key={`${row.topic}:${row.subtopic}:${idx}`} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                {row.href ? (
                  <Link
                    href={row.href}
                    className="flex-1 truncate text-[11.5px] text-slate-200 hover:text-white hover:underline"
                  >
                    {compactSubtopic(row.subject, row.topic, row.subtopic)}
                  </Link>
                ) : (
                  <span className="flex-1 truncate text-[11.5px] text-slate-200">
                    {compactSubtopic(row.subject, row.topic, row.subtopic)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </TileFrame>
  );
}
