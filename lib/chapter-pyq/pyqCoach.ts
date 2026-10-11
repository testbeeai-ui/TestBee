import { parseJsonWithTexEscapes, wrapBareTexProse } from "@/lib/chapter-pyq/pyqWorkedSolution";

export type PyqCoachTipStep = {
  title: string;
  body: string;
  callout: string;
};

const TRAILING_INTEG_CALLOUT = /^([\s\S]*?[.])\s+(\$[^$]*\\int[^$]*\$)\s*$/;
const TRAILING_MATH_CALLOUT = /^([\s\S]*?)(\$[^$]+\$)\.?\s*$/;
const CALLOUT_TEX_CMD = /\\(?:int|frac|tan|sec|sin|cos|ln|log|cot|csc|sum|sqrt|mathrm)/;

export type PyqCoachFormula = {
  name: string;
  tex: string;
  note: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(raw: string): unknown | null {
  return parseJsonWithTexEscapes(raw);
}

export function parsePyqCoachTips(raw: string): PyqCoachTipStep[] | null {
  const parsed = parseJson(raw);
  const rec = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : rec?.tips;
  if (!Array.isArray(list) || list.length === 0) return null;
  const steps: PyqCoachTipStep[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const title = wrapBareTexProse(String(row.title ?? "").trim());
    const body = wrapBareTexProse(String(row.body ?? "").trim());
    const calloutRaw = wrapBareTexProse(String(row.callout ?? "").trim());
    if (!title || !body) continue;
    const split = splitCoachTipCallout(body, calloutRaw);
    steps.push({ title, body: split.body, callout: split.callout });
  }
  return steps.length > 0 ? steps : null;
}

/** Pull a trailing formula out of the prose so the timeline can box it. */
export function splitCoachTipCallout(
  body: string,
  callout = ""
): { body: string; callout: string } {
  const given = callout.trim();
  if (given) return { body: body.trim(), callout: given };
  const text = body.trim();
  const integ = text.match(TRAILING_INTEG_CALLOUT);
  if (integ?.[1] && integ[2] && integ[1].trim().length >= 12) {
    return { body: integ[1].trim(), callout: integ[2].trim() };
  }
  const last = text.match(TRAILING_MATH_CALLOUT);
  const prefix = last?.[1]?.trim() ?? "";
  const tex = last?.[2]?.trim() ?? "";
  if (!prefix || !tex || prefix.length < 24 || !CALLOUT_TEX_CMD.test(tex)) {
    return { body: text, callout: "" };
  }
  return { body: prefix.replace(/[,:;]\s*$/, ""), callout: tex };
}

export function parsePyqCoachFormulas(raw: string): PyqCoachFormula[] | null {
  const parsed = parseJson(raw);
  const rec = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : rec?.formulas;
  if (!Array.isArray(list) || list.length === 0) return null;
  const items: PyqCoachFormula[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const name = wrapBareTexProse(prettyCoachFormulaName(String(row.name ?? "").trim()));
    const tex = String(row.tex ?? "").trim();
    const note = wrapBareTexProse(String(row.note ?? "").trim());
    if (!name || !tex) continue;
    items.push({ name, tex, note });
  }
  return items.length > 0 ? items : null;
}

/** Prefix the formula card caption so a student can tell it is a hint, not more math. */
export function formatCoachFormulaNote(note: string): string {
  const text = note.trim();
  if (!text) return "";
  const body = text.replace(/^note\s*:\s*/i, "").trim();
  return body ? `Note : ${body}` : "";
}

/** glm often writes ascii `sqrt3/2` in formula titles. The card label is CSS-uppercase, so that becomes SQRT3/2 unless it is real KaTeX. */
export function prettyCoachFormulaName(name: string): string {
  let s = name.trim();
  if (!s) return s;
  s = s.replace(/(-?)(\d+)\s*\/\s*sqrt\s*(\d+)\b/gi, (_m, sign: string, num: string, den: string) => {
    const minus = sign === "-" ? "-" : "";
    return `$${minus}\\dfrac{${num}}{\\sqrt{${den}}}$`;
  });
  s = s.replace(/(^|[^\\])sqrt\s*(\d+)\s*\/\s*(\d+)\b/gi, (_m, pre: string, a: string, b: string) => {
    return `${pre}$\\dfrac{\\sqrt{${a}}}{${b}}$`;
  });
  s = s.replace(/(^|[^\\])sqrt\s*(\d+)\b/gi, (_m, pre: string, a: string) => {
    return `${pre}$\\sqrt{${a}}$`;
  });
  s = s.replace(/√(\d+)/g, (_m, a: string) => `$\\sqrt{${a}}$`);
  s = s.replace(/\bcos\s+theta\b/gi, "$\\cos\\theta$");
  s = s.replace(/\bsin\s+theta\b/gi, "$\\sin\\theta$");
  s = s.replace(/\btan\s+theta\b/gi, "$\\tan\\theta$");
  return s;
}

export function buildFallbackTips(topicName: string): string {
  return JSON.stringify({
    tips: [
      {
        title: `Approach for ${topicName}`,
        body: `Analyze the given values and identify the fundamental concepts governing ${topicName}. Formulate your equations step-by-step before calculating.`,
        callout: "",
      },
    ],
  });
}

export function buildFallbackFormulas(topicName: string, solutionMd?: string | null): string {
  const matches = [...(solutionMd ?? "").matchAll(/\$\$?([^$]+)\$?\$?/g)]
    .map((m) => m[1].trim())
    .filter((t) => t.length >= 3 && t.length <= 60 && (t.includes("=") || t.includes("\\int") || t.includes("\\frac")));

  if (matches.length > 0) {
    const uniqueTex = [...new Set(matches)].slice(0, 3);
    const formulas = uniqueTex.map((tex, idx) => ({
      name: `Formula ${idx + 1}`,
      tex,
      note: `Key relation for ${topicName}`,
    }));
    return JSON.stringify({ formulas });
  }

  return JSON.stringify({
    formulas: [
      {
        name: `${topicName} Relation`,
        tex: `\\text{Apply governing equations for } ${topicName}`,
        note: "Use standard formulas for this topic.",
      },
    ],
  });
}
