const NUMERIC_DRAFT_RE = /^-?\d*\.?\d*$/;

/** Sanitize a keystroke into a partial decimal (keeps `"-"` and `"3."` typeable). */
export function sanitizeNumericDraft(raw: string): string {
  const stripped = String(raw ?? "").replace(/[^0-9.\-]/g, "");
  const signed = stripped.startsWith("-")
    ? `-${stripped.slice(1).replace(/-/g, "")}`
    : stripped.replace(/-/g, "");
  const parts = signed.split(".");
  const joined = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : signed;
  return NUMERIC_DRAFT_RE.test(joined) ? joined : "";
}

/** `undefined` means "not answered" — that is what the palette and legend counts read. */
export function commitNumericDraft(draft: string): number | undefined {
  const t = draft.trim();
  if (t === "" || t === "-" || t === "." || t === "-.") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
