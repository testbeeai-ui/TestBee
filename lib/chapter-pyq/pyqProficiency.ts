import type { PyqAttemptTally } from "@/lib/chapter-pyq/pyqAttemptStore";
import { pyqTestMarks, pyqTestMaxMarks } from "@/lib/chapter-pyq/pyqTestSetup";

export type PyqProficiencyBand = "none" | "needs-work" | "building" | "solid" | "strong";

export type PyqProficiency = {
  percent: number;
  band: PyqProficiencyBand;
  label: string;
};

/** Floors, highest first. 55% lands in `building`, matching the design reference. */
const BAND_FLOORS: { min: number; band: PyqProficiencyBand }[] = [
  { min: 80, band: "strong" },
  { min: 60, band: "solid" },
  { min: 40, band: "building" },
  { min: 0, band: "needs-work" },
];

export const PYQ_PROFICIENCY_LABELS: Record<PyqProficiencyBand, string> = {
  none: "Not started",
  "needs-work": "Needs work",
  building: "Building",
  solid: "Solid",
  strong: "Strong",
};

/**
 * How well a chapter is understood, on the chapter PYQ marking scheme (+4 right, −1 wrong,
 * blank 0) rather than raw accuracy — a wrong answer costs a student twice what a right one
 * earns, so accuracy alone flatters a guesser. Marks can go negative, so the result is
 * clamped at 0.
 */
export function pyqProficiencyPercent(tally: PyqAttemptTally): number {
  const maxMarks = pyqTestMaxMarks(tally.attempted);
  if (maxMarks <= 0) return 0;
  const marks = pyqTestMarks(tally.right, tally.wrong);
  return Math.max(0, Math.round((marks / maxMarks) * 100));
}

/** An untouched chapter is `none`, not a failed `needs-work` at 0%. */
export function pyqProficiencyBand(percent: number, attempted: number): PyqProficiencyBand {
  if (attempted <= 0) return "none";
  return (BAND_FLOORS.find((floor) => percent >= floor.min) ?? BAND_FLOORS[BAND_FLOORS.length - 1]!)
    .band;
}

export function pyqProficiency(tally: PyqAttemptTally): PyqProficiency {
  const percent = pyqProficiencyPercent(tally);
  const band = pyqProficiencyBand(percent, tally.attempted);
  return { percent, band, label: PYQ_PROFICIENCY_LABELS[band] };
}
