/**
 * Deterministic relative "% of chapter" per subtopic.
 * Each subtopic gets a unique-looking integer; values sum to ~100.
 */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Assign relative weightage percentages for a chapter's subtopic list.
 * Stable for the same ordered names; integers that sum to 100.
 */
export function assignSubtopicRelativePercents(subtopicNames: string[]): number[] {
  const n = subtopicNames.length;
  if (n === 0) return [];
  if (n === 1) return [100];

  const raw = subtopicNames.map((name, i) => {
    const h = hashString(`${name}|${i}`);
    // Spread roughly 4–22 so badges look distinct
    return 4 + (h % 19);
  });

  const sum = raw.reduce((a, b) => a + b, 0);
  const scaled = raw.map((v) => Math.max(1, Math.round((v / sum) * 100)));
  let drift = 100 - scaled.reduce((a, b) => a + b, 0);

  // Fix rounding drift without collapsing uniqueness too hard
  let i = 0;
  while (drift !== 0 && i < scaled.length * 4) {
    const idx = i % scaled.length;
    if (drift > 0) {
      scaled[idx]! += 1;
      drift -= 1;
    } else if (scaled[idx]! > 1) {
      scaled[idx]! -= 1;
      drift += 1;
    }
    i += 1;
  }

  return scaled;
}

export function weightageTierClass(rel: number): "high" | "med" | "low" {
  if (rel >= 13) return "high";
  if (rel >= 7) return "med";
  return "low";
}
