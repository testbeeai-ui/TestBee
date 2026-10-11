import { cn } from "@/lib/utils";
import type { PyqAttemptTally } from "@/lib/chapter-pyq/pyqAttemptStore";
import { pyqProficiency, type PyqProficiencyBand } from "@/lib/chapter-pyq/pyqProficiency";

type Tone = {
  ring: string;
  bar: string;
  value: string;
  badge: string;
};

const TONES: Record<PyqProficiencyBand, Tone> = {
  none: {
    ring: "text-[#3A4560]",
    bar: "bg-[#3A4560]",
    value: "text-[#94A3B8]",
    badge: "border-[#2A3348] bg-[#1C2333] text-[#94A3B8]",
  },
  "needs-work": {
    ring: "text-[#F43F5E]",
    bar: "bg-[#F43F5E]",
    value: "text-[#FDA4AF]",
    badge: "border-[#F43F5E]/25 bg-[#F43F5E]/[0.12] text-[#FDA4AF]",
  },
  building: {
    ring: "text-[#F59E0B]",
    bar: "bg-[#F59E0B]",
    value: "text-[#FCD34D]",
    badge: "border-[#F59E0B]/25 bg-[#F59E0B]/[0.12] text-[#FCD34D]",
  },
  solid: {
    ring: "text-[#6366F1]",
    bar: "bg-[#6366F1]",
    value: "text-[#A5B4FC]",
    badge: "border-[#6366F1]/25 bg-[#6366F1]/[0.12] text-[#A5B4FC]",
  },
  strong: {
    ring: "text-[#10B981]",
    bar: "bg-[#10B981]",
    value: "text-[#6EE7B7]",
    badge: "border-[#10B981]/25 bg-[#10B981]/[0.12] text-[#6EE7B7]",
  },
};

/**
 * Ring and text column share `STRIP_HEIGHT`, and the column spreads its three rows across it, so
 * the label's cap and the badge's baseline sit flush with the ring's top and bottom edges.
 */
const STRIP_HEIGHT = "h-12";

const RING_RADIUS = 17;
const RING_STROKE = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Track colour is lighter than the card's `#1C2333` because this strip sits on its own fill. */
const TRACK = "#26304A";

/** Marks-weighted understanding of a chapter, banded into a plain-English label. */
export default function ChapterPyqProficiency({ tally }: { tally: PyqAttemptTally }) {
  const { percent, band, label } = pyqProficiency(tally);
  const tone = TONES[band];

  return (
    <div
      className="mt-2 flex items-center gap-3 overflow-hidden rounded-lg border border-[#243049] bg-[#151A28] px-3 py-1.5"
      role="group"
      aria-label={`Proficiency ${percent} percent, ${label}`}
    >
      <div aria-hidden="true" className={cn("relative shrink-0", STRIP_HEIGHT, "w-12")}>
        <svg viewBox="0 0 44 44" className={cn("h-full w-full -rotate-90", tone.ring)}>
          <circle cx="22" cy="22" r={RING_RADIUS} fill="none" stroke={TRACK} strokeWidth={RING_STROKE} />
          {/* A round cap on a zero-length arc still paints a dot, so draw nothing at 0%. */}
          {percent > 0 && (
            <circle
              cx="22"
              cy="22"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
              className="transition-[stroke-dashoffset] duration-500"
            />
          )}
        </svg>
        <span
          className={cn(
            "absolute inset-0 grid place-items-center text-[0.66rem] font-bold leading-none tabular-nums",
            tone.value
          )}
        >
          {percent}%
        </span>
      </div>

      <div aria-hidden="true" className={cn("flex min-w-0 flex-1 flex-col justify-between", STRIP_HEIGHT)}>
        <span className="text-[0.6rem] font-bold uppercase leading-none tracking-[0.08em] text-[#7C8AA5]">
          Proficiency
        </span>
        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: TRACK }}>
          <div
            className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[0.6rem] font-bold leading-none",
            tone.badge
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
