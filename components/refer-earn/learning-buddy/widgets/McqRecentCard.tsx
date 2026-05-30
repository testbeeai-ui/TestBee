"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";
import { TileFrame } from "./TileFrame";

function shortTitle(value: string, max = 40): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function McqRecentCard({ rows }: { rows: BuddyDashboardResponse["mcqRecent"] }) {
  return (
    <TileFrame title="Recent MCQs" accent="emerald">
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500">No topic quizzes or mock tests yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const pct =
              typeof row.scorePercent === "number" && Number.isFinite(row.scorePercent)
                ? Math.round(row.scorePercent)
                : null;
            const tone =
              pct == null
                ? "text-slate-300"
                : pct >= 70
                  ? "text-emerald-300"
                  : pct >= 40
                    ? "text-amber-300"
                    : "text-rose-300";
            return (
              <li key={`${row.id}:${row.takenAt}`} className="flex items-center gap-1.5">
                <FileCheck2 className="h-3 w-3 shrink-0 text-emerald-300" />
                <Link
                  href={row.href}
                  className="min-w-0 flex-1 truncate text-[11.5px] text-slate-200 hover:text-white hover:underline"
                >
                  {shortTitle(row.paperName)}
                </Link>
                <span className={`text-[11px] font-bold ${tone}`}>
                  {pct == null ? "—" : `${pct}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </TileFrame>
  );
}
