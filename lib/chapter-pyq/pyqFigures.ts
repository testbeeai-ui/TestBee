import type { PyqFigureLinkRow, PyqFigureRow } from "@/lib/chapter-pyq/pyqQuestionRow";

/** `pyq_figures.storage_path` includes this as its first segment. The bucket is public. */
export const PYQ_FIGURE_BUCKET = "pyq";

const FIG_PLACEHOLDER_RE = /\[\[fig:([a-zA-Z0-9_]+)\]\]/g;

/** Ingestion key: `p{page:03d}_x{xref}`, `s2026j_q01_1`, `s2025j_di_q04_1`, `s2025apr_te_q03_1`, `s2026_te_q01_1`. */
const RASTER_KEY = /^(?:p\d+_x\d+|s\d{4}[a-z]{0,3}(?:_[a-z]+)?_q\d+_\d+)$/i;

export type PyqFigureFolder = "physics/figures" | "math/figures";

/** Chapter PYQ subject string → the public folder that subject's drawings use. */
export function pyqFigureFolderForSubject(subject: string): PyqFigureFolder {
  return subject.trim().toLowerCase() === "math" ? "math/figures" : "physics/figures";
}

export type ResolvePyqFigureOpts = {
  /** Stem path appends unused `question_body` figures. Solution HTML must not. */
  appendUnused?: boolean;
  /**
   * Link roles this call may resolve. The stem shows only figures printed with
   * the question; the worked solution may also use `solution_body` figures that
   * belong to the printed write-up and must never appear in the stem.
   */
  roles?: readonly string[];
};

/** Roles a question stem may render. */
export const STEM_FIGURE_ROLES: readonly string[] = ["question_body"];
/** Roles a worked solution may render. */
export const SOLUTION_FIGURE_ROLES: readonly string[] = ["question_body", "solution_body"];

function asFigure(raw: unknown): PyqFigureRow | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return asFigure(raw[0]);
  const o = raw as PyqFigureRow;
  return o.figure_key ? o : null;
}

function figureFromKey(key: string, folder: PyqFigureFolder): PyqFigureRow {
  return {
    figure_key: key,
    storage_path: `${PYQ_FIGURE_BUCKET}/${folder}/${key}.png`,
    public_url: null,
    alt_text: key,
  };
}

function folderFromLinks(links: PyqFigureLinkRow[], fallback: PyqFigureFolder): PyqFigureFolder {
  for (const link of links) {
    const path = asFigure(link.figures)?.storage_path ?? "";
    if (path.includes("math/figures")) return "math/figures";
    if (path.includes("physics/figures")) return "physics/figures";
  }
  return fallback;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function pyqFigurePublicUrl(
  figure: Pick<PyqFigureRow, "storage_path" | "public_url">
): string {
  const stored = figure.public_url?.trim();
  if (stored) return stored;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const path = figure.storage_path.replace(/^\/+/, "");
  const withBucket = path.startsWith(`${PYQ_FIGURE_BUCKET}/`)
    ? path
    : `${PYQ_FIGURE_BUCKET}/${path}`;
  return `${base}/storage/v1/object/public/${withBucket}`;
}

/**
 * Emits only `src`, `alt` and `class` — the attributes `sanitizeMockHtml` allows.
 * `patchMockHtmlImages` adds `loading` / `decoding` / `referrerpolicy` after sanitize.
 */
function imgTag(figure: PyqFigureRow): string {
  const alt = escapeAttr(figure.alt_text ?? figure.figure_key);
  return `<img src="${escapeAttr(pyqFigurePublicUrl(figure))}" alt="${alt}" class="nta-mock-img">`;
}

/**
 * Turns `[[fig:KEY]]` placeholders in a question body into `<img>` tags, then
 * appends any `question_body` figure the body never referenced — the ingestion
 * pipeline links figures independently of placeholder text, and a silently
 * dropped free-body diagram makes a question unanswerable.
 */
export function resolvePyqFigureHtml(
  body: string,
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder = "physics/figures",
  opts?: ResolvePyqFigureOpts
): string {
  const list = links ?? [];
  const roles = opts?.roles ?? STEM_FIGURE_ROLES;
  const stemFigures = list
    .filter((l) => roles.includes(String(l.role)))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((l) => asFigure(l.figures))
    .filter((f): f is PyqFigureRow => Boolean(f));

  const byKey = new Map(stemFigures.map((f) => [f.figure_key, f]));
  const used = new Set<string>();
  const prefix = folderFromLinks(list, folder);

  const withPlaceholders = String(body ?? "").replace(FIG_PLACEHOLDER_RE, (_full, key: string) => {
    const figure = byKey.get(key) ?? (RASTER_KEY.test(key) ? figureFromKey(key, prefix) : null);
    if (!figure) return "";
    used.add(key);
    return imgTag(figure);
  });

  const trailing = stemFigures.filter((f) => !used.has(f.figure_key)).map(imgTag);
  if (opts?.appendUnused === false || trailing.length === 0) {
    return withPlaceholders;
  }
  return `${withPlaceholders.trim()}<p>${trailing.join("")}</p>`;
}
