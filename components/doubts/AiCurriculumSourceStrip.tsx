"use client";

import { cn } from "@/lib/utils";

export type AiCurriculumNodeLabels = {
  chapter_label: string;
  topic_label: string;
  subtopic_label: string | null;
};

/** Normalize PostgREST embed (object or single-element array). */
export function pickCurriculumNodeFromDoubt(d: {
  gyan_curriculum_nodes?: unknown;
}): AiCurriculumNodeLabels | null {
  const raw = d.gyan_curriculum_nodes;
  if (raw == null) return null;
  const o = Array.isArray(raw) ? raw[0] : raw;
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const chapter = typeof r.chapter_label === "string" ? r.chapter_label : "";
  const topic = typeof r.topic_label === "string" ? r.topic_label : "";
  const sub = typeof r.subtopic_label === "string" ? r.subtopic_label : null;
  if (!chapter.trim() && !topic.trim() && !(sub && sub.trim())) return null;
  return { chapter_label: chapter, topic_label: topic, subtopic_label: sub };
}

function shorten(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1))}…`;
}

/** Fixed hues per level — distinct from each other and from subject flair chips. */
const CURRICULUM_LEVEL_TONE: Record<"chapter" | "topic" | "subtopic", string> = {
  chapter: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  topic: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  subtopic: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
};

/** One pill: chapter / topic / subtopic each has its own colour system. */
function CurriculumPill({
  kind,
  abbr,
  text,
  fullLabel,
  className,
}: {
  kind: "chapter" | "topic" | "subtopic";
  abbr: string;
  text: string;
  fullLabel: string;
  className?: string;
}) {
  if (!text) return null;
  const role = kind === "chapter" ? "Chapter" : kind === "topic" ? "Topic" : "Subtopic";
  return (
    <span
      className={cn(
        "edu-chip inline-flex max-w-[min(100%,11rem)] min-w-0 shrink-0 items-center gap-1 py-1 pl-2 pr-2.5 text-xs font-semibold sm:max-w-[13rem]",
        CURRICULUM_LEVEL_TONE[kind],
        className,
      )}
      title={`${role}: ${fullLabel}`}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide opacity-80">{abbr}</span>
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

/**
 * Three separate chips — chapter (sky), topic (violet), subtopic (amber). Subject flair stays on the subject pill only.
 */
export function AiCurriculumSourceStrip({
  node,
  className,
}: {
  node: AiCurriculumNodeLabels;
  className?: string;
}) {
  const full = [node.chapter_label, node.topic_label, node.subtopic_label].filter(Boolean).join(" → ");
  const ch = shorten(node.chapter_label, 14);
  const tp = shorten(node.topic_label, 16);
  const sub = node.subtopic_label ? shorten(node.subtopic_label, 14) : null;
  if (!ch && !tp) return null;

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      title={full}
    >
      {ch ? <CurriculumPill kind="chapter" abbr="Ch" text={ch} fullLabel={node.chapter_label} /> : null}
      {tp ? <CurriculumPill kind="topic" abbr="Tp" text={tp} fullLabel={node.topic_label} /> : null}
      {sub ? (
        <CurriculumPill kind="subtopic" abbr="Sub" text={sub} fullLabel={node.subtopic_label ?? ""} />
      ) : null}
    </div>
  );
}
