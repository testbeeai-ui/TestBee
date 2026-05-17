"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import MathText from "@/components/MathText";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TopicNode } from "@/data/topicTaxonomy";
import { getAdvancedSetBounds, type AdvancedQuizSetIndex } from "@/lib/advancedQuizSets";
import type { ChapterQuizSelectionState } from "@/lib/teacherPortal/chapterQuizUtils";
import {
  topicOptionLabel,
  topicsForChapter,
  uniqueChaptersFor,
} from "@/lib/teacherPortal/chapterQuizUtils";
import { fetchSubtopicContent, type ArtifactBitsQuestion } from "@/lib/subtopicContentService";
import type { Board, ClassLevel, Subject } from "@/types";

export type { ChapterQuizSelectionState };

const SUBJECTS: Subject[] = ["physics", "chemistry", "math"];

const PRACTICE_SETS = [1, 2, 3] as const;

type Props = {
  taxonomy: TopicNode[];
  taxonomyLoading: boolean;
  taxonomyError: string | null;
  value: ChapterQuizSelectionState;
  onChange: (next: ChapterQuizSelectionState) => void;
  selectClassName: string;
};

function pillClass(active: boolean) {
  return active
    ? "border-violet-400/80 bg-violet-500/25 text-violet-100"
    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10";
}

/** Match topic page: single pool when ≤10 advanced MCQs; else 10+10+rest. */
function bitsForPracticeSet(
  all: ArtifactBitsQuestion[],
  setIndex: AdvancedQuizSetIndex
): ArtifactBitsQuestion[] {
  const n = all.length;
  if (n <= 10) return [...all];
  const { start, end } = getAdvancedSetBounds(n, setIndex);
  return all.slice(start, end);
}

export default function ChapterQuizAssignmentFields({
  taxonomy,
  taxonomyLoading,
  taxonomyError,
  value,
  onChange,
  selectClassName,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ArtifactBitsQuestion[]>([]);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  /** Deter casual copy/export from the preview panel (not a DRM boundary). */
  useEffect(() => {
    if (!previewOpen) return;
    const stopIfInside = (e: ClipboardEvent) => {
      const root = previewPanelRef.current;
      const t = e.target;
      if (!root || !(t instanceof Node) || !root.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("copy", stopIfInside, true);
    document.addEventListener("cut", stopIfInside, true);
    return () => {
      document.removeEventListener("copy", stopIfInside, true);
      document.removeEventListener("cut", stopIfInside, true);
    };
  }, [previewOpen]);

  const chapters = useMemo(() => {
    if (!value.subject || !value.classLevel) return [];
    return uniqueChaptersFor(taxonomy, value.subject, value.classLevel);
  }, [taxonomy, value.subject, value.classLevel]);

  const topicRows = useMemo(() => {
    if (!value.subject || !value.classLevel || !value.chapterTitle) return [];
    return topicsForChapter(taxonomy, value.subject, value.classLevel, value.chapterTitle);
  }, [taxonomy, value.subject, value.classLevel, value.chapterTitle]);

  const selectedNode = value.topicIndex != null ? (topicRows[value.topicIndex] ?? null) : null;

  const subtopicOptions = selectedNode?.subtopics ?? [];

  const patch = (p: Partial<ChapterQuizSelectionState>) => {
    onChange({ ...value, ...p });
  };

  const openPreview = useCallback(async () => {
    if (!selectedNode?.topic || !value.subtopicName || !value.subject || !value.classLevel) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewRows([]);
    try {
      const row = await fetchSubtopicContent({
        board: "CBSE" as Board,
        subject: value.subject,
        classLevel: value.classLevel,
        topic: selectedNode.topic,
        subtopicName: value.subtopicName.trim(),
        level: "advanced",
      });
      const slice = bitsForPracticeSet(row.bitsQuestions, value.advancedSet);
      setPreviewRows(slice);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedNode?.topic, value.advancedSet, value.classLevel, value.subject, value.subtopicName]);

  if (taxonomyLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1020] px-3 py-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
        Loading syllabus for chapter quiz…
      </div>
    );
  }

  if (taxonomyError) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {taxonomyError}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#0c1020] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">Chapter quiz target</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Pick class → subject → chapter → lesson → subtopic, then which practice set (1–3) matches
          the topic page quiz flow.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Class
        </label>
        <div className="relative">
          <select
            value={value.classLevel ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const cl = raw === "11" ? 11 : raw === "12" ? 12 : null;
              patch({
                classLevel: cl as ClassLevel | null,
                subject: null,
                chapterTitle: null,
                topicIndex: null,
                subtopicName: null,
              });
            }}
            className={selectClassName}
          >
            <option value="">Select class…</option>
            <option value="11">Class 11 (PUC 1)</option>
            <option value="12">Class 12 (PUC 2)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {value.classLevel ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Subject
          </label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  patch({
                    subject: s,
                    chapterTitle: null,
                    topicIndex: null,
                    subtopicName: null,
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${pillClass(value.subject === s)}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {value.classLevel && value.subject ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Chapter
          </label>
          <div className="relative">
            <select
              value={value.chapterTitle ?? ""}
              onChange={(e) => {
                const ch = e.target.value || null;
                patch({ chapterTitle: ch, topicIndex: null, subtopicName: null });
              }}
              className={selectClassName}
            >
              <option value="">Select chapter…</option>
              {chapters.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      ) : null}

      {value.chapterTitle && topicRows.length > 0 ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Topic (lesson)
          </label>
          <div className="relative">
            <select
              value={value.topicIndex != null ? String(value.topicIndex) : ""}
              onChange={(e) => {
                const idx = Number(e.target.value);
                patch({
                  topicIndex: Number.isInteger(idx) && idx >= 0 ? idx : null,
                  subtopicName: null,
                });
              }}
              className={selectClassName}
            >
              <option value="">Select topic…</option>
              {topicRows.map((row, i) => (
                <option key={`${row.topic}-${i}`} value={String(i)}>
                  {topicOptionLabel(row)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      ) : value.chapterTitle ? (
        <p className="text-xs text-amber-200/90">
          No topics found for this chapter in the loaded syllabus.
        </p>
      ) : null}

      {selectedNode && subtopicOptions.length > 0 ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Subtopic
          </label>
          <div className="relative">
            <select
              value={value.subtopicName ?? ""}
              onChange={(e) =>
                patch({
                  subtopicName: e.target.value || null,
                  level: "advanced",
                  advancedSet: 1,
                })
              }
              className={selectClassName}
            >
              <option value="">Select subtopic…</option>
              {subtopicOptions.map((st) => (
                <option key={st.name} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      ) : selectedNode ? (
        <p className="text-xs text-amber-200/90">This lesson has no subtopics listed yet.</p>
      ) : null}

      {value.subtopicName && selectedNode ? (
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Practice set
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {PRACTICE_SETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => patch({ level: "advanced", advancedSet: s })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${pillClass(value.advancedSet === s)}`}
              >
                Set {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void openPreview()}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
            >
              <Eye className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              Preview
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Same three sets as the lesson quiz panel. Preview lists stems and options only (no
            marked correct answers).
          </p>
        </div>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[min(85vh,720px)] max-w-2xl overflow-hidden border-white/10 bg-[#0c1020] p-0 text-slate-100">
          <div
            ref={previewPanelRef}
            className="max-h-[min(85vh,720px)] overflow-y-auto p-5 sm:p-6 select-none [-webkit-touch-callout:none] [&_*]:select-none"
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Quiz preview — Set {value.advancedSet}
              </DialogTitle>
              <DialogDescription className="text-left text-slate-400">
                Stems and choices only (no correct markers or solutions). Copy and right-click are
                disabled in this panel. OS-level screenshots cannot be detected or auto-closed in a
                web app.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              {previewLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  Loading questions…
                </div>
              ) : previewError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {previewError}
                </p>
              ) : previewRows.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No MCQs in this set yet. Generate or save advanced quiz questions on the topic page for this
                  subtopic.
                </p>
              ) : (
                <ol className="list-decimal space-y-5 pl-4 marker:text-slate-500">
                  {previewRows.map((q, i) => (
                    <li key={i} className="pl-1">
                      <div className="text-sm font-medium text-slate-100">
                        <MathText as="div" weight="semibold">
                          {q.question}
                        </MathText>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {q.options.map((opt, j) => (
                          <li
                            key={j}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-slate-300"
                          >
                            <span className="mr-2 font-mono text-[11px] text-slate-500">
                              {String.fromCharCode(65 + j)}.
                            </span>
                            <MathText as="span" weight="normal">
                              {opt}
                            </MathText>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
