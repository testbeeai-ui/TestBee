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
  | { kind: "grid"; cells: PyqWorkedGridCell[] };

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
  const text = String(rec.text ?? "").trim();
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
    const label = String(rec.label ?? "").trim();
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
      const text = String(rec.text ?? "").trim();
      return isUsefulProse(text) ? { kind: "paragraph", text: cleanProse(text) } : null;
    }
    case "callout": {
      const text = String(rec.text ?? "").trim();
      const tex = String(rec.tex ?? "").trim();
      if (!text && !tex) return null;
      return { kind: "callout", text, tex };
    }
    case "display": {
      const tex = String(rec.tex ?? "").trim();
      return tex ? { kind: "display", tex } : null;
    }
    case "grid": {
      const cells = gridOf(rec.cells);
      return cells.length > 0 ? { kind: "grid", cells } : null;
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
  const title = String(rec.title ?? "").trim();
  if (!title) return null;
  const paragraphs = strList(rec.paragraphs);
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
  return {
    answer,
    title,
    problem_tex: String(raw.problem_tex ?? "").trim(),
    answer_tex: String(raw.answer_tex ?? "").trim(),
    answer_note: String(raw.answer_note ?? "").trim(),
    phases,
  };
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
    if (block.kind === "paragraph") return isUsefulProse(block.text);
    if (block.kind === "display") return Boolean(block.tex.trim());
    if (block.kind === "grid") return block.cells.length > 0;
    return true;
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
  return {
    answer: "",
    title: "Worked solution",
    problem_tex: "",
    answer_tex: "",
    answer_note: last,
    phases,
  };
}

export function parsePyqWorkedSolution(raw: string): PyqWorkedSolution | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      const rec = asRecord(parsed);
      if (rec) {
        const worked = fromJsonObject(rec);
        if (worked) return worked;
      }
    } catch {
      return null;
    }
    return null;
  }
  return fromNumberedMarkdown(text);
}

export function wrapDisplayTex(tex: string): string {
  const t = stackEqualsChain(tex.trim());
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
  const parts = t
    .split(/(?<!\\)=/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return t;
  const lines = parts.map((part, index) => (index === 0 ? `& ${part}` : `&= ${part}`));
  return `\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}`;
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

/** Turn `\text{If } \theta_1 \text{ and } …` into wrapping `If $\theta_1$ and …`. */
export function unwrapProblemTex(tex: string): string {
  const t = tex.trim();
  if (!t) return "";
  let i = 0;
  let out = "";
  let mathBuf = "";
  const flushMath = () => {
    const math = mathBuf.replace(/\s+/g, " ").trim();
    mathBuf = "";
    if (!math) return;
    if (out && !/\s$/.test(out)) out += " ";
    out += `$${math}$`;
  };
  while (i < t.length) {
    if (isTextCommandAt(t, i)) {
      const braceAt = t.indexOf("{", i);
      const group = braceAt >= 0 ? readBraceGroup(t, braceAt) : null;
      if (group) {
        flushMath();
        out += group.inner.replace(/~/g, " ");
        i = group.end + 1;
        continue;
      }
    }
    mathBuf += t[i];
    i += 1;
  }
  flushMath();
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

export function problemTexForQuestion(tex: string): { display: boolean; text: string } {
  const t = tex.trim();
  if (!t) return { display: false, text: "" };
  if (/\\text\s*\{/.test(t)) {
    return { display: false, text: unwrapProblemTex(t) };
  }
  if (t.includes("$") && !t.startsWith("$$")) {
    return { display: false, text: t };
  }
  return { display: true, text: t };
}
