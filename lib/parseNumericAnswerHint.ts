/**
 * Parse a numeric answer hint from past/mock paper JSON answer fields.
 * Handles brackets, word numbers, accepted multi-value lists, and thousand separators.
 */
export function parseNumericAnswerHint(answerRaw: string): number | null {
  const s = String(answerRaw).trim().replace(/−/g, "-");
  if (!s || /^(small\s*answer|-|\*|n\/?a|wrongans|wrong)$/i.test(s)) return null;

  const bracket = s.match(/\[(-?\d+(?:\.\d+)?)\]/);
  if (bracket) {
    const n = Number(bracket[1]);
    return Number.isFinite(n) ? n : null;
  }

  // Accepted-range / multi-value lists like "2120,2121" or "2120,2121,...,2140".
  // Distinguish from thousand-separated forms (e.g. "2,120", "1,234,567").
  const rawParts = s
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    // Drop ellipsis markers from range lists ("2120,2121,...,2140").
    .filter((p) => !/^\.+$/.test(p));
  const rangeParts = rawParts
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n) && Math.abs(n) < 1e9);
  // Only treat as a list when every remaining token is numeric (no prose crumbs).
  if (rangeParts.length >= 2 && rangeParts.length === rawParts.length) {
    const normalized = s.replace(/\s/g, "");
    const isThousandSeparated = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized);
    const sorted = [...rangeParts].sort((a, b) => a - b);
    const span = sorted[sorted.length - 1]! - sorted[0]!;
    // "212,213" matches the thousand pattern but is a tight accepted-answer list.
    // "500,600,700" also matches but is a wide multi-value list — use median.
    // Keep genuine thousands: short leading group ("1,234,567") or zero-padding ("10,020").
    const hasLeadingZeroGroup = rawParts.some((p, i) => i > 0 && /^0\d/.test(p));
    const firstGroupLen = rawParts[0]!.replace(/^-/, "").length;
    const looksLikeAnswerList =
      !isThousandSeparated ||
      (!hasLeadingZeroGroup && (span <= 50 || (rangeParts.length >= 3 && firstGroupLen >= 3)));
    if (looksLikeAnswerList) {
      return Math.round(sorted[Math.floor(sorted.length / 2)]!);
    }
  }

  const wordMap: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const word = s.toLowerCase().match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word && wordMap[word[1]!] != null && !/-?\d/.test(s)) {
    return wordMap[word[1]!]!;
  }

  const compact = s.replace(/,/g, "").replace(/\s+/g, " ");
  const m = compact.match(/-?\s*\d+(?:\.\d+)?/);
  if (m) {
    const n = Number.parseFloat(m[0].replace(/\s/g, ""));
    if (!Number.isFinite(n) || Math.abs(n) >= 1e9) return null;
    return n;
  }
  return null;
}
