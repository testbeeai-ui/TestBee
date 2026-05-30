"use client";

import Link from "next/link";

import { Play, SquareRadical, Zap } from "lucide-react";

import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";

import { TileFrame } from "./TileFrame";

function PlayRowIcon({
  kind,
}: {
  kind: BuddyDashboardResponse["playArena"]["recent"][number]["kind"];
}) {
  const Icon = kind === "daily_dose" ? Zap : kind === "quant_blitz" ? SquareRadical : Play;

  return <Icon className="h-3 w-3 text-lime-300" />;
}

export function PlayArenaCard({ data }: { data: BuddyDashboardResponse["playArena"] }) {
  return (
    <TileFrame title="Play Arena" accent="amber">
      {data.recent.length > 0 ? (
        <ul className="space-y-0">
          {data.recent.slice(0, 3).map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-start gap-2 border-b border-white/8 py-2 last:border-0 hover:opacity-90"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-lime-500/10">
                  <PlayRowIcon kind={row.kind} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-100">{row.title}</p>

                  <p className="truncate text-[10px] text-slate-500">{row.subtitle}</p>
                </div>

                {row.rdmBadge ? (
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-300">
                    {row.rdmBadge}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10.5px] text-slate-500">No recent Play activity.</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-center">
          <p className="text-[16px] font-bold text-emerald-300">{data.playRdmMissedToday}</p>

          <p className="text-[9px] uppercase tracking-wide text-slate-500">Play RDM missed</p>
        </div>

        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-center">
          <p className="text-[16px] font-bold text-slate-100">{data.blitzRoundsToday}</p>

          <p className="text-[9px] uppercase tracking-wide text-slate-500">Blitz rounds today</p>
        </div>
      </div>

      <p className="mt-1.5 text-[10px] text-slate-500">
        {data.rdmEarnedToday} Play RDM today · {data.gauntletStreakDays}d gauntlet streak
      </p>
    </TileFrame>
  );
}
