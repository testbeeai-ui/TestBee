"use client";

import Link from "next/link";
import { HelpCircle, MessageCircleQuestion } from "lucide-react";
import { gyanBuddyListLine } from "@/lib/buddy/gyanBuddyListLine";
import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";
import { TileFrame } from "./TileFrame";

const LIST_LIMIT = 5;

export function GyanRecentCard({ rows }: { rows: BuddyDashboardResponse["gyanRecent"] }) {
  const items = rows.slice(0, LIST_LIMIT);

  return (
    <TileFrame title="Recent Gyan++" accent="cyan">
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">No recent Gyan++ activity.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((row) => {
            const Icon = row.kind === "doubt" ? HelpCircle : MessageCircleQuestion;
            const line = gyanBuddyListLine(row.title);
            return (
              <li key={`${row.kind}:${row.id}`} className="flex items-center gap-1.5">
                <Icon
                  className={
                    row.kind === "doubt"
                      ? "h-3 w-3 shrink-0 text-amber-300"
                      : "h-3 w-3 shrink-0 text-cyan-300"
                  }
                  aria-hidden
                />
                <Link
                  href={row.href}
                  className="min-w-0 flex-1 truncate text-[11.5px] text-slate-200 hover:text-white hover:underline"
                  title={line}
                >
                  {line}
                </Link>
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  {row.kind === "doubt" ? "Ask" : "Reply"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </TileFrame>
  );
}
