import type { PyqFigureLinkRow, PyqFigureRow } from "@/lib/chapter-pyq/pyqQuestionRow";

/** `pyq_figures.storage_path` includes this as its first segment. The bucket is public. */
export const PYQ_FIGURE_BUCKET = "pyq";

const FIG_PLACEHOLDER_RE = /\[\[fig:([a-zA-Z0-9_]+)\]\]/g;

/** Ingestion key scheme `p{page:03d}_x{xref}` — filename is the key. */
const RASTER_KEY = /^p\d+_x\d+$/;

export type PyqFigureFolder = "physics/figures" | "math/figures";

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
  folder: PyqFigureFolder = "physics/figures"
): string {
  const list = links ?? [];
  const stemFigures = list
    .filter((l) => l.role === "question_body")
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
  return trailing.length > 0
    ? `${withPlaceholders.trim()}<p>${trailing.join("")}</p>`
    : withPlaceholders;
}
