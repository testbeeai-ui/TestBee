import { resolvePyqFigureHtml, type PyqFigureFolder } from "@/lib/chapter-pyq/pyqFigures";

export type PyqWorkedCallout = {
  text: string;
  tex: string;
};

export type PyqWorkedGridCell = {
  label: string;
  tex: string;
};

export type PyqWorkedBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "callout"; text: string; tex: string }
  | { kind: "display"; tex: string }
  | { kind: "grid"; cells: PyqWorkedGridCell[] }
  | { kind: "figure"; html: string };

export type PyqWorkedPhase = {
  title: string;
  paragraphs: string[];
  callout?: PyqWorkedCallout;
  displays: string[];
  grid: PyqWorkedGridCell[];
  blocks: PyqWorkedBlock[];
};

export type PyqWorkedSolution = {
  answer: string;
  title: string;
  problem_tex: string;
  answer_tex: string;
  answer_note: string;
  phases: PyqWorkedPhase[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function calloutOf(value: unknown): PyqWorkedCallout | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const text = wrapBareTexProse(String(rec.text ?? "").trim());
  const tex = String(rec.tex ?? "").trim();
  if (!text && !tex) return undefined;
  return { text, tex };
}

function gridOf(value: unknown): PyqWorkedGridCell[] {
  if (!Array.isArray(value)) return [];
  const out: PyqWorkedGridCell[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec) continue;
    const label = wrapBareTexProse(String(rec.label ?? "").trim());
    const tex = String(rec.tex ?? "").trim();
    if (label || tex) out.push({ label, tex });
  }
  return out;
}

function blockOf(value: unknown): PyqWorkedBlock | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const kind = String(rec.kind ?? "").trim();
  switch (kind) {
    case "paragraph": {
      const text = wrapBareTexProse(String(rec.text ?? "").trim());
      return isUsefulProse(text) ? { kind: "paragraph", text: cleanProse(text) } : null;
    }
    case "callout": {
      const callout = calloutOf(rec);
      return callout ? { kind: "callout", ...callout } : null;
    }
    case "display": {
      const tex = String(rec.tex ?? "").trim();
      return tex ? { kind: "display", tex } : null;
    }
    case "grid": {
      const cells = gridOf(rec.cells);
      return cells.length > 0 ? { kind: "grid", cells } : null;
    }
    case "figure": {
      const html = String(rec.html ?? "").trim();
      return html ? { kind: "figure", html } : null;
    }
    default:
      return null;
  }
}

export function synthesizePhaseBlocks(input: {
  paragraphs: string[];
  callout?: PyqWorkedCallout;
  displays: string[];
  grid: PyqWorkedGridCell[];
}): PyqWorkedBlock[] {
  const blocks: PyqWorkedBlock[] = [];
  const seenDisplay = new Set<string>();
  const addDisplay = (tex: string) => {
    const key = tex.replace(/\s+/g, "");
    if (!tex || seenDisplay.has(key)) return;
    seenDisplay.add(key);
    blocks.push({ kind: "display", tex });
  };
  const addPieces = (text: string) => {
    for (const piece of splitProseAndMath(text)) {
      if (piece.kind === "display") addDisplay(piece.tex);
      else blocks.push(piece);
    }
  };

  const [first, ...rest] = input.paragraphs;
  if (first) addPieces(first);
  if (input.callout) {
    blocks.push({ kind: "callout", text: input.callout.text, tex: input.callout.tex });
  }
  for (const paragraph of rest) addPieces(paragraph);
  for (const tex of input.displays) addDisplay(tex);
  if (input.grid.length > 0) {
    blocks.push({ kind: "grid", cells: input.grid });
  }
  return blocks;
}

function phaseOf(value: unknown): PyqWorkedPhase | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const title = wrapBareTexProse(String(rec.title ?? "").trim());
  if (!title) return null;
  const paragraphs = strList(rec.paragraphs).map(wrapBareTexProse);
  const callout = calloutOf(rec.callout);
  const displays = strList(rec.displays);
  const grid = gridOf(rec.grid);
  const parsedBlocks = Array.isArray(rec.blocks)
    ? rec.blocks.map(blockOf).filter((block): block is PyqWorkedBlock => block != null)
    : [];
  const blocks = layoutWorkedBlocks(
    parsedBlocks.length > 0
      ? parsedBlocks
      : synthesizePhaseBlocks({ paragraphs, ...(callout ? { callout } : {}), displays, grid })
  );
  const paraFromBlocks = blocks
    .filter((block): block is Extract<PyqWorkedBlock, { kind: "paragraph" }> => block.kind === "paragraph")
    .map((block) => block.text);
  const resolvedParagraphs = paragraphs.length > 0 ? paragraphs : paraFromBlocks;
  if (blocks.length === 0 || resolvedParagraphs.length === 0) return null;
  return {
    title,
    paragraphs: resolvedParagraphs,
    ...(callout ? { callout } : {}),
    displays,
    grid,
    blocks,
  };
}

const WEAK_LEAD_IN =
  /^(so|hence|thus|therefore|then|and|now|henceforth)[,:]?\s*$/i;

function texKey(tex: string): string {
  return tex.replace(/\s+/g, "");
}

function looksLikeKeyedChip(tex: string): boolean {
  const t = tex.trim();
  if (!t) return false;
  if (texKey(t).length <= 20) return true;
  return /^[A-Za-z][A-Za-z0-9]*\s*=\s*\S{1,20}$/.test(t);
}

function isCompactAnswerTex(tex: string): boolean {
  const t = tex.trim();
  if (!t || /\\begin\s*\{/.test(t)) return false;
  return texKey(t).length <= 48;
}

function lastDisplayTex(sol: PyqWorkedSolution): string {
  for (let i = sol.phases.length - 1; i >= 0; i--) {
    const blocks = sol.phases[i]!.blocks;
    for (let j = blocks.length - 1; j >= 0; j--) {
      const block = blocks[j]!;
      if (block.kind === "display") return block.tex.trim();
    }
  }
  return "";
}

function optionChoiceNote(answer: string, note: string): string | null {
  const fromAnswer = answer.trim().match(/^(?:option\s*)?([1-4])$/i);
  if (fromAnswer) return `Option ${fromAnswer[1]} is the correct choice`;
  const fromNote = note.match(/\boption\s*([1-4])\b/i);
  if (fromNote) return `Option ${fromNote[1]} is the correct choice`;
  return null;
}

function isOptionDigit(tex: string): boolean {
  return /^[1-4]$/.test(tex.trim());
}

/** Prefer `16` / `K = 1` on the chip over the MCQ option index. */
function compactResultChip(tex: string): string | null {
  const t = tex.trim();
  if (!t) return null;
  if (/^[A-Za-z][A-Za-z0-9]*\s*=\s*\S{1,24}$/.test(t)) return t;
  const parts = splitEqualsOutsideBraces(t);
  if (parts.length >= 2) {
    const rhs = parts[parts.length - 1]!;
    const compact = texKey(rhs);
    if (
      isCompactAnswerTex(rhs) &&
      compact.length <= 20 &&
      !isOptionDigit(rhs) &&
      !compact.includes(",")
    ) {
      return rhs;
    }
  }
  if (isCompactAnswerTex(t) && !isOptionDigit(t) && !texKey(t).includes(",")) return t;
  return null;
}

/** Footer chip: short keyed result + option line, not the last working equation. */
export function polishWorkedSolution(sol: PyqWorkedSolution): PyqWorkedSolution {
  const last = lastDisplayTex(sol);
  const optionNote = optionChoiceNote(sol.answer, sol.answer_note);
  const rawNote = sol.answer_note.trim();
  const note =
    optionNote ??
    (WEAK_LEAD_IN.test(rawNote) || rawNote.length < 3 ? "The keyed result" : rawNote);

  const rawTex = sol.answer_tex.trim();
  const key = sol.answer.trim();
  const sameAsLast = Boolean(last) && texKey(rawTex) === texKey(last);
  const keyedChip = looksLikeKeyedChip(rawTex);
  const dupWorking = sameAsLast && !keyedChip;
  const mathChip = compactResultChip(rawTex) ?? (dupWorking ? compactResultChip(last) : null);
  let tex = rawTex;
  if (mathChip && !isOptionDigit(mathChip)) {
    tex = mathChip;
  } else if (!isCompactAnswerTex(tex) || dupWorking) {
    if (isCompactAnswerTex(key) && !isOptionDigit(key)) tex = key;
    else if (looksLikeKeyedChip(last) && (dupWorking || !isCompactAnswerTex(tex))) tex = last;
    else if (isOptionDigit(key)) tex = key;
    else if (!isCompactAnswerTex(tex)) tex = "";
  }

  return { ...sol, answer_note: wrapBareTexProse(note), answer_tex: tex };
}

function fromJsonObject(raw: Record<string, unknown>): PyqWorkedSolution | null {
  const inner = asRecord(raw.solution);
  if (inner) {
    return fromJsonObject({ ...inner, answer: raw.answer ?? inner.answer });
  }
  const title = String(raw.title ?? "").trim();
  const answer = String(raw.answer ?? "").trim();
  const phasesIn = Array.isArray(raw.phases) ? raw.phases : [];
  const phases = phasesIn.map(phaseOf).filter((p): p is PyqWorkedPhase => p != null);
  if (!title || !answer || phases.length < 2) return null;
  return polishWorkedSolution({
    answer,
    title,
    problem_tex: String(raw.problem_tex ?? "").trim(),
    answer_tex: String(raw.answer_tex ?? "").trim(),
    answer_note: String(raw.answer_note ?? "").trim(),
    phases,
  });
}

const STEP = /^(\d+)\.\s+/;
const PUNCT_ONLY = /^[\s;:,.·•\-–—]+$/;

function numberedChunks(md: string): string[] {
  return md
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=\d+\.\s)/)
    .map((chunk) => chunk.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

function isUsefulProse(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 0 && !PUNCT_ONLY.test(t);
}

function cleanProse(text: string): string {
  return text.replace(/\s+/g, " ").replace(/^[\s;]+/, "").replace(/[\s;]+$/, "").trim();
}

function appendProseToBlocks(blocks: PyqWorkedBlock[], prose: string): void {
  const cleaned = cleanProse(prose);
  if (!cleaned) return;
  const prev = blocks[blocks.length - 1];
  if (prev?.kind === "paragraph") {
    const glue = /^[;:,.!?)]/.test(cleaned) ? "" : " ";
    prev.text = `${prev.text}${glue}${cleaned}`.replace(/\s+/g, " ").trim();
    return;
  }
  if (isUsefulProse(cleaned)) blocks.push({ kind: "paragraph", text: cleaned });
}

function isDisplayWorthy(tex: string): boolean {
  const t = tex.trim();
  if (!t.includes("=") && /^\s*(?:\\left\s*)?\[/.test(t)) return false;
  if (/\\int|\\sum|\\prod/.test(t)) return true;
  if (/\\frac/.test(t) && (t.includes("=") || t.length >= 20)) return true;
  return t.includes("=") && t.length >= 28;
}

function maskMath(text: string): { masked: string; holes: string[] } {
  const holes: string[] = [];
  const masked = text.replace(/\$\$[\s\S]+?\$\$|\$[^$]+\$/g, (chunk) => {
    holes.push(chunk);
    return `\u0000${holes.length - 1}\u0000`;
  });
  return { masked, holes };
}

function unmaskMath(text: string, holes: string[]): string {
  return text.replace(/\u0000(\d+)\u0000/g, (_all, index: string) => holes[Number(index)] ?? "");
}

const BARE_CARET = /([A-Za-z0-9\u0370-\u03FF)])\^(\{[^{}]*\}|\d+|[A-Za-z])/g;

/** A command (`\frac`), a spacer (`\,`), or a braced subscript (`a_{cm}`) with no `$` is still TeX. Carets stay with wrapBareCarets. */
const BARE_TEX_CMD = /\\[A-Za-z]+|\\[,;:!]|_\{/;

/**
 * glm prose with `\cdot` / `\le` / `\sqrt{…}` but no `$` would reach the student as raw TeX.
 * Pure math becomes one `$…$`; a sentence keeps its words and wraps only the math runs.
 */
/**
 * `v_cm` is one subscript in print; KaTeX would show only `v_c` and a following `m`.
 * A product `A_xB_x` or `F_xv_x` already is single-letter subscripts, so it stays.
 */
function braceBareSubscripts(tex: string): string {
  return tex.replace(/([A-Za-z])_([a-z]{2,})(?!_)/g, (_all, base: string, sub: string) => `${base}_{${sub}}`);
}

function braceDelimitedMath(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g, (full, display: string | undefined, inline: string | undefined) => {
    if (display != null) return `$$${braceBareSubscripts(display)}$$`;
    return `$${braceBareSubscripts(inline ?? "")}$`;
  });
}

export function wrapBareTexProse(text: string): string {
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const tail = text.match(/\s*$/)?.[0] ?? "";
  const t = text.trim();
  if (!t) return text;
  if (t.includes("$")) {
    return (
      lead +
      braceDelimitedMath(
        t
          .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g)
          .map((part) => (part.startsWith("$") ? part : wrapBareTexProse(part)))
          .join("")
      ) +
      tail
    );
  }
  if (!BARE_TEX_CMD.test(t)) return lead + braceDelimitedMath(wrapBareCarets(t)) + tail;
  const hasProse = tokenizeProse(t).some((token) => token.kind === "prose");
  const wrapped = hasProse ? splitBareProseProblemTex(t) : `$${trimTexSpacing(t)}$`;
  return lead + braceDelimitedMath(wrapped) + tail;
}

/** glm prose sometimes writes `x^2` with no `$`; KaTeX auto-render would show the caret. */
const GROUP_CARET = /\)\^(\{[^{}]*\}|\d+|[A-Za-z])/g;

/** `(1-x^7)^K`: the whole group is one formula, so it is wrapped before its inner `x^7`. */
function wrapCaretGroups(text: string): string {
  const { masked, holes } = maskMath(text);
  let out = "";
  let last = 0;
  for (const match of masked.matchAll(GROUP_CARET)) {
    const at = match.index ?? 0;
    let start = -1;
    let depth = 0;
    for (let i = at; i >= last; i--) {
      if (masked[i] === ")") depth += 1;
      else if (masked[i] === "(" && --depth === 0) {
        start = i;
        break;
      }
    }
    if (start < 0) continue;
    const group = masked.slice(start, at + 1);
    if (group.length > 48 || /(?<!\\)[A-Za-z]{4,}/.test(group)) continue;
    const inner = unmaskMath(group, holes.map((h) => h.replace(/^\$+|\$+$/g, "")));
    const exp = match[1]!.replace(/^\{|\}$/g, "");
    out += masked.slice(last, start) + `$${inner}^{${exp}}$`;
    last = at + match[0].length;
  }
  out += masked.slice(last);
  return unmaskMath(out, holes);
}

export function wrapBareCarets(text: string): string {
  if (!text.includes("^")) return text;
  const { masked, holes } = maskMath(wrapCaretGroups(text));
  let out = "";
  let last = 0;
  for (const match of masked.matchAll(BARE_CARET)) {
    const at = match.index ?? 0;
    const base = match[1]!;
    const exp = match[2]!.replace(/^\{|\}$/g, "");
    let start = at;
    if (base === ")") {
      let depth = 0;
      for (let i = at; i >= last; i--) {
        if (masked[i] === ")") depth += 1;
        else if (masked[i] === "(" && --depth === 0) {
          start = i;
          break;
        }
      }
      if (start === at) continue;
    }
    out += masked.slice(last, start) + `$${masked.slice(start, at)}${base}^{${exp}}$`;
    last = at + match[0].length;
  }
  out += masked.slice(last);
  return unmaskMath(out, holes);
}

function splitThoughtUnits(text: string): string[] {
  const { masked, holes } = maskMath(text.replace(/\s+/g, " ").trim());
  const parts = masked.split(
    /(?<=[.!?])\s+(?=[A-Z])|(?<=;)\s+(?=(?:testing|test|check|try)\b)/i
  );
  return parts
    .map((part) => unmaskMath(part, holes).trim())
    .map((part) => part.replace(/^[;,\s]+/, "").replace(/[;,\s]+$/, "").trim())
    .filter((part) => isUsefulProse(part) && !/^(not zero|no)\.?$/i.test(part));
}

function isEqualsChain(tex: string): boolean {
  const t = tex.trim();
  if (!t.includes("=")) return false;
  return t.length >= 28 || /\\int|\\frac|\\sum|\\prod|\\sqrt/.test(t);
}

function asTrialCheck(unit: string): PyqWorkedGridCell | null {
  const match = unit
    .trim()
    .match(
      /^(?:testing|test|check|try)\s+(\$[^$]+\$)((?:\s+\w+){0,6})?\s*(?:gives|:)\s*([\s\S]+)$/i
    );
  if (!match) return null;
  const rest = match[3]?.trim() ?? "";
  const calc = rest.match(/^\$([^$]+)\$/);
  const tex = (calc ? calc[1] : rest.replace(/^\$/, "").replace(/\$$/, ""))
    .replace(/\.\s*Not zero\.?$/i, "")
    .trim();
  if (!tex) return null;
  return { label: match[1]!, tex };
}

function asEvalGrid(unit: string): PyqWorkedBlock[] | null {
  const maths = [...unit.matchAll(/\$([^$]+)\$/g)].map((match) => match[1]!.trim());
  if (maths.length < 2) return null;
  if (!maths.every((tex) => tex.includes("=") && (tex.length >= 16 || /\\frac|\\int/.test(tex)))) {
    return null;
  }
  const lead = unit
    .replace(/\$[^$]+\$/g, " ")
    .replace(/\s+and\s+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[:]+$/, "")
    .trim();
  const cells: PyqWorkedGridCell[] = maths.map((tex) => {
    const lhs = tex.split("=")[0]?.trim() ?? "";
    const label = lhs.length > 0 && lhs.length <= 24 && !/[+\-]/.test(lhs) ? `$${lhs}$` : "";
    return { label, tex };
  });
  const out: PyqWorkedBlock[] = [];
  if (isUsefulProse(lead) && lead.length <= 80) {
    out.push({ kind: "paragraph", text: `${lead}:`.replace(/::+$/, ":") });
  }
  out.push({ kind: "grid", cells });
  return out;
}

function liftEqualsChains(text: string): PyqWorkedBlock[] {
  const blocks: PyqWorkedBlock[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$/g;
  let last = 0;
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    appendProseToBlocks(blocks, text.slice(last, match.index));
    const tex = String(match[1] ?? match[2] ?? "").trim();
    if (tex) {
      if (match[1] != null || isEqualsChain(tex)) {
        blocks.push({ kind: "display", tex });
      } else {
        const inline = `$${tex}$`;
        const prev = blocks[blocks.length - 1];
        if (prev?.kind === "paragraph") prev.text = `${prev.text} ${inline}`.trim();
        else blocks.push({ kind: "paragraph", text: inline });
      }
    }
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  appendProseToBlocks(blocks, text.slice(last));
  return blocks.length > 0 ? blocks : [{ kind: "paragraph", text: cleanProse(text) }];
}

function layoutWorkedBlocks(blocks: PyqWorkedBlock[]): PyqWorkedBlock[] {
  const out: PyqWorkedBlock[] = [];
  let trials: PyqWorkedGridCell[] = [];
  const flushTrials = () => {
    if (trials.length === 0) return;
    const last = out[out.length - 1];
    if (last?.kind === "grid") last.cells.push(...trials);
    else out.push({ kind: "grid", cells: trials });
    trials = [];
  };
  for (const block of blocks) {
    if (block.kind !== "paragraph") {
      flushTrials();
      const prev = out[out.length - 1];
      if (block.kind === "display" && prev?.kind === "callout" && texKey(prev.tex) === texKey(block.tex)) {
        continue;
      }
      out.push(block);
      continue;
    }
    for (const unit of splitThoughtUnits(block.text)) {
      const trial = asTrialCheck(unit);
      if (trial) {
        trials.push(trial);
        continue;
      }
      flushTrials();
      const evalGrid = asEvalGrid(unit);
      if (evalGrid) {
        out.push(...evalGrid);
        continue;
      }
      out.push(...liftEqualsChains(unit));
    }
  }
  flushTrials();
  return out.filter((block) => {
    switch (block.kind) {
      case "paragraph":
        return isUsefulProse(block.text);
      case "display":
        return Boolean(block.tex.trim());
      case "grid":
        return block.cells.length > 0;
      case "callout":
        return Boolean(block.text.trim() || block.tex.trim());
      case "figure":
        return Boolean(block.html.trim());
      default: {
        const _exhaustive: never = block;
        return _exhaustive;
      }
    }
  });
}

function splitProseAndMath(text: string): PyqWorkedBlock[] {
  const blocks: PyqWorkedBlock[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$/g;
  let last = 0;
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    appendProseToBlocks(blocks, text.slice(last, match.index));
    const tex = String(match[1] ?? match[2] ?? "").trim();
    if (tex) {
      if (match[1] != null || isDisplayWorthy(tex)) {
        blocks.push({ kind: "display", tex });
      } else {
        const inline = `$${tex}$`;
        const prev = blocks[blocks.length - 1];
        if (prev?.kind === "paragraph") prev.text = `${prev.text} ${inline}`.trim();
        else blocks.push({ kind: "paragraph", text: inline });
      }
    }
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  appendProseToBlocks(blocks, text.slice(last));
  return blocks;
}

function fromNumberedMarkdown(md: string): PyqWorkedSolution | null {
  const steps: string[] = [];
  for (const chunk of numberedChunks(md)) {
    const match = chunk.match(STEP);
    if (match) steps.push(chunk.slice(match[0].length).trim());
  }
  if (steps.length < 2) return null;
  const last = steps[steps.length - 1]!;
  const phases: PyqWorkedPhase[] = steps.map((text, index) => {
    const displays: string[] = [];
    const grid: PyqWorkedGridCell[] = [];
    return {
      title: `Step ${index + 1}`,
      paragraphs: [text],
      displays,
      grid,
      blocks: layoutWorkedBlocks(
        synthesizePhaseBlocks({ paragraphs: [text], displays, grid })
      ),
    };
  });
  return polishWorkedSolution({
    answer: "",
    title: "Worked solution",
    problem_tex: "",
    answer_tex: "",
    answer_note: last,
    phases,
  });
}

/**
 * `## Step 2: Title`, `## Given Information`, `### Notes` — one phase per markdown heading.
 * A leading `Step N:` prefix is stripped so the sheet's own STEP pill is not duplicated.
 */
const MD_HEADING = /^#{1,3}\s+(?:Step\s*[-–]?\s*\d+\s*[:.]?\s*)?(.+)$/i;

/** Any markdown ATX heading at line start marks a structured write-up worth the worked sheet. */
const MD_HEADING_ANY = /^#{1,3}\s+\S/m;
const PAPER_MARK = /<!--\s*paper-ocr\s*-->/g;
const CROP_FIG_TOKEN = /\[\[fig:[a-zA-Z0-9_]*_crop\]\]/gi;
const WATERMARK_LINE =
  /^(?:#\s*)?PaperPhodnaHai$|^www\.mathongo\.com$|^mathongo$|^Questions with Answer Keys$|^Chapter-wise Question Bank$|^JEE Main 20\d{2}/i;
const PAPER_LISTING_PREFIX =
  /^(?:Q\s*\d{1,2}\.\s*(?:\([^)]+\)\s*)?|\d{1,2}\.\s*\([^)]+\)\s*)/;

function paperLineBlocks(line: string, folder: PyqFigureFolder): PyqWorkedBlock[] {
  const trimmed = line.replace(PAPER_LISTING_PREFIX, "").trim();
  if (!trimmed || WATERMARK_LINE.test(trimmed)) return [];
  if (/\[\[fig:/.test(trimmed)) {
    const html = resolvePyqFigureHtml(trimmed, [], folder, { appendUnused: false }).trim();
    if (!html || html === trimmed.replace(/\[\[fig:[a-zA-Z0-9_]+\]\]/g, "").trim()) {
      return trimmed.replace(/\[\[fig:[^\]]+\]\]/g, "").trim()
        ? [{ kind: "paragraph", text: trimmed.replace(/\[\[fig:[^\]]+\]\]/g, "").trim() }]
        : [];
    }
    return html ? [{ kind: "figure", html }] : [];
  }
  const mathOnly = trimmed.match(/^\$([^$]+)\$\s*$/);
  if (mathOnly?.[1]?.trim()) return [{ kind: "display", tex: mathOnly[1].trim() }];
  return splitProseAndMath(trimmed);
}

/** Enriched markdown carries bold markers and bullet dashes the sheet must not render literally. */
function cleanMarkdownLine(line: string): string {
  return line
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s+/, "")
    .trim();
}

function fromPaperOcrMarkdown(md: string, folder: PyqFigureFolder): PyqWorkedSolution | null {
  const lines = md
    .replace(PAPER_MARK, "")
    .replace(CROP_FIG_TOKEN, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const phases: PyqWorkedPhase[] = [];
  for (const line of lines) {
    if (WATERMARK_LINE.test(line)) continue;
    const heading = line.match(MD_HEADING);
    if (heading) {
      phases.push({
        title: cleanMarkdownLine(heading[1] ?? ""),
        paragraphs: [],
        displays: [],
        grid: [],
        blocks: [],
      });
      continue;
    }
    if (phases.length === 0) {
      phases.push({ title: "Solution", paragraphs: [], displays: [], grid: [], blocks: [] });
    }
    phases[phases.length - 1]!.blocks.push(...paperLineBlocks(cleanMarkdownLine(line), folder));
  }

  const filled = dropRepeatedOptionStep(phases.filter((phase) => phase.title || phase.blocks.length > 0));
  if (filled.length === 0) return null;
  for (const phase of filled) {
    phase.displays = phase.blocks.filter((b) => b.kind === "display").map((b) => b.tex);
    phase.paragraphs = phase.blocks.filter((b) => b.kind === "paragraph").map((b) => b.text);
  }

  const last = filled[filled.length - 1]!;
  const lastDisplay = [...last.blocks].reverse().find((b) => b.kind === "display");
  const lastProse = [...last.blocks].reverse().find((b) => b.kind === "paragraph");
  const answerTex =
    lastDisplay && lastDisplay.tex.length <= 96 ? lastDisplay.tex : "";
  const note = lastProse?.text?.trim() ?? "";
  return polishWorkedSolution({
    answer: "",
    title: "Worked solution",
    problem_tex: "",
    answer_tex: answerTex,
    answer_note: WEAK_LEAD_IN.test(note) ? "The printed result" : note || "The printed result",
    phases: filled,
  });
}

/** Printed MathonGo write-up. Routed onto the same worked sheet as glm JSON. */
export function isPaperOcrSolution(raw: string): boolean {
  const text = String(raw ?? "");
  return /<!--\s*paper-ocr\s*-->/.test(text) || /\[\[fig:/.test(text);
}

/**
 * Physics MCQ answers are an option, not a derived quantity. The worked sheet
 * takes its FINAL ANSWER chip and note from the *last* step, so appending a
 * closing step that carries only the option leaves the chip empty and the note
 * naming the option — the student sees which option, never the keyed algebra.
 *
 * A printed line that already names the option ("Correct Option (3)") is that
 * closing step. Appending another Final Answer reprints it.
 *
 * Idempotent: a solution that already ends with this step is returned unchanged.
 */
const PAPER_OPTION_FINAL = /##\s*Final Answer\s*\n\s*Option\s*[1-4]\s*$/i;
const PRINTED_OPTION_LINE =
  /^(?:correct\s+)?option\s*\(?\s*[1-4]\s*\)?\.?$|^(?:ans(?:wer)?\.?)\s*(?:is|:)?\s*\(?\s*[1-4]\s*\)?\.?$/i;

function endsWithPrintedOption(text: string): boolean {
  const lines = text
    .trimEnd()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  return PRINTED_OPTION_LINE.test(last);
}

/**
 * The mapper used to append `## Final Answer / Option N` after a paper step
 * that already said "Correct Option (N)". Drop that repeat so the sheet shows
 * one closing step. A lone appended option step is kept: that is the case
 * where the paper never named the option.
 */
function dropRepeatedOptionStep(phases: PyqWorkedPhase[]): PyqWorkedPhase[] {
  if (phases.length < 2) return phases;
  const last = phases[phases.length - 1]!;
  if (!/^final answer$/i.test(last.title.trim())) return phases;
  const only =
    last.blocks.length === 1 && last.blocks[0]?.kind === "paragraph" ? last.blocks[0].text.trim() : "";
  if (!/^option\s+[1-4]$/i.test(only)) return phases;
  const alreadyNamed = phases.slice(0, -1).some((phase) => {
    if (!/final answer/i.test(phase.title)) return false;
    return phase.blocks.some(
      (block) => block.kind === "paragraph" && PRINTED_OPTION_LINE.test(block.text.trim())
    );
  });
  return alreadyNamed ? phases.slice(0, -1) : phases;
}

export function appendOptionFinalStep(md: string, option: number | null | undefined): string {
  const text = String(md ?? "");
  if (!text.trim()) return text;
  if (option == null || !/^[1-4]$/.test(String(option))) return text;
  if (PAPER_OPTION_FINAL.test(text.trimEnd())) return text;
  if (endsWithPrintedOption(text)) return text;
  return `${text.trimEnd()}\n\n## Final Answer\nOption ${option}\n`;
}

const SMASHED_JSON_TEX =
  /[\u0008\u0009\u000b\u000c\u000d]|\n(?:eq|u\b|abla|ot\b|earrow)/;

function jsonHasSmashedTexEscapes(value: unknown): boolean {
  if (typeof value === "string") return SMASHED_JSON_TEX.test(value);
  if (Array.isArray(value)) return value.some(jsonHasSmashedTexEscapes);
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(jsonHasSmashedTexEscapes);
  }
  return false;
}

/** Parse glm JSON, doubling TeX `\` that JSON would eat as `\f` / `\n` / `\t`. */
export function parseJsonWithTexEscapes(text: string): unknown | null {
  const rawText = String(text ?? "").trim();
  if (!rawText.startsWith("{") && !rawText.startsWith("[")) return null;
  let raw: unknown = null;
  let repaired: unknown = null;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch {
    raw = null;
  }
  try {
    repaired = JSON.parse(repairLooseJson(rawText)) as unknown;
  } catch {
    repaired = null;
  }
  if (repaired != null && (raw == null || jsonHasSmashedTexEscapes(raw))) {
    return repaired;
  }
  return raw;
}

/** glm / a \\-collapse pass often leaves `\sin` in JSON source (`\s` is not a JSON escape). */
export function repairLooseJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (!inString) {
      if (c === '"') inString = true;
      out += c;
      continue;
    }
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      const next = text[i + 1] ?? "";
      const after = text[i + 2] ?? "";
      const jsonLetterEscape =
        (next === "b" || next === "f" || next === "n" || next === "r" || next === "t") &&
        !/[A-Za-z]/.test(after);
      if (
        next === '"' ||
        next === "\\" ||
        next === "/" ||
        next === "u" ||
        jsonLetterEscape
      ) {
        out += c;
        escaped = true;
        continue;
      }
      out += "\\\\";
      continue;
    }
    if (c === '"') inString = false;
    out += c;
  }
  return out;
}

function jsonObjectBlob(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  if (!trimmed.includes('"phases"') && !trimmed.includes('"answer"')) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function parseWorkedJson(blob: string): PyqWorkedSolution | null {
  const parsed = parseJsonWithTexEscapes(blob);
  const rec = asRecord(parsed);
  if (!rec) return null;
  return fromJsonObject(rec);
}

export function parsePyqWorkedSolution(
  raw: string,
  folder: PyqFigureFolder = "math/figures"
): PyqWorkedSolution | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (isPaperOcrSolution(text) && !text.startsWith("{")) {
    return fromPaperOcrMarkdown(text, folder);
  }
  const blob = jsonObjectBlob(text);
  if (blob) return parseWorkedJson(blob);
  // Enriched solutions are plain `## Step N:` markdown with no paper-ocr marker;
  // they ride the same worked sheet instead of the raw-text modal.
  if (MD_HEADING_ANY.test(text)) return fromPaperOcrMarkdown(text, folder);
  return fromNumberedMarkdown(text);
}

function stripMathDelimiters(tex: string): string {
  const t = tex.trim();
  const display = t.match(/^\$\$([\s\S]*)\$\$$/);
  if (display?.[1] != null) return display[1].trim();
  const inline = t.match(/^\$([\s\S]*)\$$/);
  if (inline?.[1] != null && !inline[1].includes("$")) return inline[1].trim();
  return t;
}

export function wrapDisplayTex(tex: string): string {
  const stripped = braceBareSubscripts(stripMathDelimiters(tex));
  const t = stackEqualsChain(stripped);
  if (!t) return "";
  if (t.startsWith("$$") || t.startsWith("$")) return t;
  return `$$${t}$$`;
}

export function wrapInlineTex(tex: string): string {
  const t = tex.trim();
  if (!t) return "";
  if (t.startsWith("$")) return t;
  return `$${t}$`;
}

/** Turn `A = B = C = D` into a wrapped aligned block so long checks stay on screen. */
export function stackEqualsChain(tex: string): string {
  const t = tex.trim();
  if (!t) return "";
  if (/\\begin\{aligned\}/.test(t) || /\\\\/.test(t)) return t;
  const parts = splitEqualsOutsideBraces(t);
  if (parts.length < 3) return t;
  const lines = parts.map((part, index) => (index === 0 ? `& ${part}` : `&= ${part}`));
  return `\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}`;
}

function splitEqualsOutsideBraces(tex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}" && depth > 0) {
      depth -= 1;
      continue;
    }
    if (ch === "=" && depth === 0 && tex[i - 1] !== "\\") {
      parts.push(tex.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(tex.slice(start).trim());
  return parts.filter(Boolean);
}

function readBraceGroup(source: string, openIndex: number): { inner: string; end: number } | null {
  if (source[openIndex] !== "{") return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { inner: source.slice(openIndex + 1, i), end: i };
    }
  }
  return null;
}

function isTextCommandAt(source: string, index: number): boolean {
  if (!source.startsWith("\\text", index)) return false;
  if (
    source.startsWith("\\textbf", index) ||
    source.startsWith("\\textrm", index) ||
    source.startsWith("\\textit", index) ||
    source.startsWith("\\textstyle", index)
  ) {
    return false;
  }
  const after = index + 5;
  return after < source.length && (source[after] === "{" || source[after] === " " || source[after] === "\t");
}

const NESTING_OPEN = /^\\(?:left|begin)(?![A-Za-z])/;
const NESTING_CLOSE = /^\\(?:right|end)(?![A-Za-z])/;

/**
 * Top-level `\text{…}` groups only: one inside `\frac{…}`, `1^{\text{st}}`, `\left\{…\right\}` or
 * `\begin{cases}` is part of that formula, and splitting there leaves `$` islands KaTeX rejects.
 */
function topLevelTextGroups(t: string): { start: number; end: number; inner: string }[] {
  const groups: { start: number; end: number; inner: string }[] = [];
  let braces = 0;
  let nesting = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === "\\") {
      const rest = t.slice(i);
      if (NESTING_OPEN.test(rest)) nesting += 1;
      else if (NESTING_CLOSE.test(rest)) nesting = Math.max(0, nesting - 1);
      else if (braces === 0 && nesting === 0 && isTextCommandAt(t, i)) {
        const braceAt = t.indexOf("{", i);
        const group = braceAt >= 0 ? readBraceGroup(t, braceAt) : null;
        if (group) {
          groups.push({ start: i, end: group.end, inner: group.inner });
          i = group.end;
          continue;
        }
      }
      i += 1;
      continue;
    }
    if (ch === "{") braces += 1;
    else if (ch === "}") braces = Math.max(0, braces - 1);
  }
  return groups;
}

/** Turn `\text{If } \theta_1 \text{ and } …` into wrapping `If $\theta_1$ and …`. */
export function unwrapProblemTex(tex: string): string {
  const t = tex.trim();
  if (!t) return "";
  let out = "";
  const pushMath = (raw: string) => {
    const full = trimTexSpacing(raw.replace(/\s+/g, " "));
    const tail = full.match(/[.,;]+$/)?.[0] ?? "";
    const math = trimTexSpacing(full.slice(0, full.length - tail.length));
    if (!math) {
      out += tail;
      return;
    }
    if (out && !/\s$/.test(out)) out += " ";
    out += `$${math}$${tail}`;
  };
  let at = 0;
  for (const group of topLevelTextGroups(t)) {
    pushMath(t.slice(at, group.start));
    out += group.inner.replace(/~/g, " ");
    at = group.end + 1;
  }
  pushMath(t.slice(at));
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

const WEAK_PROSE = new Set([
  "a", "an", "as", "at", "be", "by", "if", "in", "is", "it", "of", "on", "or", "so", "to", "we",
]);
const TRAILING_PUNCT = /[,.;:!?]+$/;

type ProseToken = { raw: string; kind: "prose" | "weak" | "punct" | "math" };

function proseTokenKind(raw: string): ProseToken["kind"] {
  if (/^[,.;:!?]+$/.test(raw)) return "punct";
  const word = raw.replace(TRAILING_PUNCT, "");
  if (/^[A-Za-z]{3,}$/.test(word)) return "prose";
  if (WEAK_PROSE.has(word.toLowerCase())) return "weak";
  return "math";
}

/** A `\\` line break or `\,` / `\ ` / `\quad` spacer right before `$` would escape the closing delimiter. */
function trimTexSpacing(math: string): string {
  const edge = String.raw`(?:\\\\|\\[,;:! ]|\\q?quad(?![A-Za-z])|\s)+`;
  return math.replace(new RegExp(`^${edge}`), "").replace(new RegExp(`${edge}$`), "");
}

/** Words inside an open `{…}` (`\text{ on }`, `\frac{a + b}{c}`) belong to the math around them. */
function tokenizeProse(tex: string): ProseToken[] {
  let depth = 0;
  return tex
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const inside = depth > 0;
      for (const ch of raw.replace(/\\[{}]/g, "")) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      return { raw, kind: inside || depth > 0 ? "math" : proseTokenKind(raw) };
    });
}

function isBareProseProblemTex(tex: string): boolean {
  if (tex.includes("$")) return false;
  return tokenizeProse(tex).filter((token) => token.kind === "prose").length >= 4;
}

/** A glm `problem_tex` written as a plain English sentence: prose stays text, runs of math get `$…$`. */
function splitBareProseProblemTex(tex: string): string {
  const tokens = tokenizeProse(tex);
  const neighbourKind = (from: number, step: number): ProseToken["kind"] | "edge" => {
    for (let i = from + step; i >= 0 && i < tokens.length; i += step) {
      if (tokens[i]!.kind !== "punct") return tokens[i]!.kind;
    }
    return "edge";
  };
  for (let changed = true; changed; ) {
    changed = false;
    tokens.forEach((token, i) => {
      if (token.kind !== "weak") return;
      const capitalised = /^[A-Z]/.test(token.raw);
      const near = [neighbourKind(i, -1), neighbourKind(i, 1)];
      if (capitalised || near.includes("prose") || near.includes("edge")) {
        token.kind = "prose";
        changed = true;
      } else if (near.every((kind) => kind === "math")) {
        token.kind = "math";
        changed = true;
      }
    });
  }
  const parts: string[] = [];
  let math: string[] = [];
  const flushMath = () => {
    if (math.length === 0) return;
    const joined = math.join(" ");
    const tail = joined.match(TRAILING_PUNCT)?.[0] ?? "";
    const body = trimTexSpacing(joined.slice(0, joined.length - tail.length));
    parts.push(body ? `$${body}$${tail}` : tail);
    math = [];
  };
  tokens.forEach((token, i) => {
    const isMath =
      token.kind === "math" ||
      token.kind === "weak" ||
      (token.kind === "punct" && math.length > 0 && neighbourKind(i, 1) === "math");
    if (isMath) {
      math.push(token.raw);
      return;
    }
    flushMath();
    parts.push(token.raw);
  });
  flushMath();
  return parts.join(" ");
}

export function problemTexForQuestion(tex: string): { display: boolean; text: string } {
  const t = tex.trim();
  if (!t) return { display: false, text: "" };
  if (t.includes("$") && !t.startsWith("$$")) {
    return { display: false, text: t };
  }
  if (topLevelTextGroups(t).length > 0) {
    return { display: false, text: unwrapProblemTex(t) };
  }
  if (isBareProseProblemTex(t)) {
    return { display: false, text: splitBareProseProblemTex(t) };
  }
  return { display: true, text: t };
}
