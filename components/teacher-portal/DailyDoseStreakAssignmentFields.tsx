"use client";

import {
  DAILYDOSE_STREAK_TRACKS,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";

type Props = {
  selectedTrackId: DailyDoseStreakTrackId;
  onSelectTrack: (id: DailyDoseStreakTrackId) => void;
};

function pillClass(active: boolean) {
  return active
    ? "border-amber-400/70 bg-amber-500/20 text-amber-50"
    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10";
}

export default function DailyDoseStreakAssignmentFields({ selectedTrackId, onSelectTrack }: Props) {
  const active = DAILYDOSE_STREAK_TRACKS.find((t) => t.id === selectedTrackId);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#0c1020] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">DailyDose · Streak challenge</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Pick one of the five Funbrain streak lanes (same Elo tabs as Play). Students open Play
          from the task link; Streak Survival uses the mixed Funbrain pool with a 5-minute /
          15-question session cap.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Challenge lane
        </label>
        <div className="flex flex-wrap gap-2">
          {DAILYDOSE_STREAK_TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTrack(t.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${pillClass(selectedTrackId === t.id)}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-300">{active.label}: </span>
          {active.blurb}
        </p>
      ) : null}
    </div>
  );
}
