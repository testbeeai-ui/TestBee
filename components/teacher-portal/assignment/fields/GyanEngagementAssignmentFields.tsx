"use client";

const inputClassName =
  "h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400";

type Props = {
  topicFocus: string;
  subtopicHint: string;
  onTopicFocusChange: (v: string) => void;
  onSubtopicHintChange: (v: string) => void;
};

export default function GyanEngagementAssignmentFields({
  topicFocus,
  subtopicHint,
  onTopicFocusChange,
  onSubtopicHintChange,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#0c1020] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">Gyan++ engagement</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          Students post doubts on what you taught (for example yesterday&apos;s subtopic). Their
          checklist links to Gyan++.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Topic / lesson focus (optional)
        </label>
        <input
          value={topicFocus}
          onChange={(e) => onTopicFocusChange(e.target.value)}
          placeholder="e.g. Unit II — Arithmetic Progression"
          className={inputClassName}
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Subtopic you taught (optional)
        </label>
        <input
          value={subtopicHint}
          onChange={(e) => onSubtopicHintChange(e.target.value)}
          placeholder="e.g. nth term; sum of n terms"
          className={inputClassName}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        The assignment checklist opens Gyan++ with the ask dialog when students follow the task
        link.
      </p>
    </div>
  );
}
