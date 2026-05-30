"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { TopicNode } from "@/data/topicTaxonomy";
import {
  topicOptionLabel,
  topicsForChapter,
  uniqueChaptersFor,
} from "@/lib/teacherPortal/chapterQuizUtils";
import type { Board, ClassLevel, Subject } from "@/types";
import ConceptFocusSubtopicPreview from "@/components/teacher-portal/assignment/fields/ConceptFocusSubtopicPreview";

export type ConceptFocusSelectionState = {
  classLevel: ClassLevel | null;
  subject: Subject | null;
  chapterTitle: string | null;
  topicIndex: number | null;
  subtopicName: string | null;
};

export const initialConceptFocusSelection = (): ConceptFocusSelectionState => ({
  classLevel: null,
  subject: null,
  chapterTitle: null,
  topicIndex: null,
  subtopicName: null,
});

export function conceptFocusSelectionComplete(
  sel: ConceptFocusSelectionState,
  taxonomy: TopicNode[]
): boolean {
  if (
    !sel.classLevel ||
    !sel.subject ||
    !sel.chapterTitle ||
    sel.topicIndex == null ||
    !sel.subtopicName?.trim()
  ) {
    return false;
  }
  const topics = topicsForChapter(taxonomy, sel.subject, sel.classLevel, sel.chapterTitle);
  const node = topics[sel.topicIndex];
  if (!node) return false;
  return node.subtopics.some((s) => s.name === sel.subtopicName);
}

const SUBJECTS: Subject[] = ["physics", "chemistry", "math"];

type Props = {
  taxonomy: TopicNode[];
  taxonomyLoading: boolean;
  taxonomyError: string | null;
  value: ConceptFocusSelectionState;
  onChange: (next: ConceptFocusSelectionState) => void;
  selectClassName: string;
};

function pillClass(active: boolean) {
  return active
    ? "border-violet-400/80 bg-violet-500/25 text-violet-100"
    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10";
}

export default function ConceptFocusAssignmentFields({
  taxonomy,
  taxonomyLoading,
  taxonomyError,
  value,
  onChange,
  selectClassName,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // Preview UI is rendered by `ConceptFocusSubtopicPreview` (self-fetching).

  const chapters =
    value.subject && value.classLevel
      ? uniqueChaptersFor(taxonomy, value.subject, value.classLevel)
      : [];

  const topicRows =
    value.subject && value.classLevel && value.chapterTitle
      ? topicsForChapter(taxonomy, value.subject, value.classLevel, value.chapterTitle)
      : [];

  const selectedNode = value.topicIndex != null ? (topicRows[value.topicIndex] ?? null) : null;
  const subtopicOptions = selectedNode?.subtopics ?? [];

  const patch = (p: Partial<ConceptFocusSelectionState>) => {
    onChange({ ...value, ...p });
  };

  const openPreview = useCallback(async () => {
    if (!selectedNode?.topic || !value.subtopicName || !value.subject || !value.classLevel) return;
    setPreviewOpen(true);
    // Fetching happens inside the preview component.
  }, [selectedNode?.topic, value.classLevel, value.subject, value.subtopicName]);

  if (taxonomyLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2.5 text-xs text-slate-400 sm:text-sm">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-400 sm:h-4 sm:w-4" />
        Loading syllabus…
      </div>
    );
  }

  if (taxonomyError) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200 sm:text-sm">
        {taxonomyError}
      </p>
    );
  }

  const chevronCls =
    "pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 sm:right-3 sm:h-4 sm:w-4";
  /** Hide native select chevron so only our icon shows (avoid double arrows). */
  const selectWithChevronClass = `${selectClassName} appearance-none pr-9 sm:pr-10`;

  return (
    <div className="rounded-lg border border-white/5 bg-black/25 p-1.5 sm:p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-white/[0.06] pb-1.5">
        <span className="text-xs font-semibold text-slate-200">Concept focus</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">
          <span className="hidden sm:inline">Class · Subject · Chapter · Lesson · Subtopic</span>
          <span className="sm:hidden">Fill in order</span>
        </span>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {/* Row 1–2: class + subject side by side on md+ */}
        <div
          className={
            value.classLevel
              ? "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-0"
              : "grid grid-cols-1"
          }
        >
          <div className="min-w-0 space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
                className={selectWithChevronClass}
              >
                <option value="">Select class…</option>
                <option value="11">Class 11 (PUC 1)</option>
                <option value="12">Class 12 (PUC 2)</option>
              </select>
              <ChevronDown className={chevronCls} />
            </div>
          </div>

          {value.classLevel ? (
            <div className="min-w-0 space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </label>
              <div className="flex flex-wrap gap-1.5">
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
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize sm:px-3 sm:py-1.5 sm:text-xs ${pillClass(value.subject === s)}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Row 3–4: chapter + topic */}
        {value.classLevel && value.subject ? (
          <div
            className={
              value.chapterTitle && topicRows.length > 0
                ? "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-3"
                : "grid grid-cols-1"
            }
          >
            <div className="min-w-0 space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Chapter
              </label>
              <div className="relative">
                <select
                  value={value.chapterTitle ?? ""}
                  onChange={(e) => {
                    const ch = e.target.value || null;
                    patch({ chapterTitle: ch, topicIndex: null, subtopicName: null });
                  }}
                  className={selectWithChevronClass}
                >
                  <option value="">Select chapter…</option>
                  {chapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <ChevronDown className={chevronCls} />
              </div>
            </div>

            {value.chapterTitle && topicRows.length > 0 ? (
              <div className="min-w-0 space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Lesson (topic)
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
                    className={selectWithChevronClass}
                  >
                    <option value="">Select topic…</option>
                    {topicRows.map((row, i) => (
                      <option key={`${row.topic}-${i}`} value={String(i)}>
                        {topicOptionLabel(row)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={chevronCls} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {value.chapterTitle && topicRows.length === 0 && value.classLevel && value.subject ? (
          <p className="text-[11px] leading-snug text-amber-200/90">
            No topics found for this chapter in the loaded syllabus.
          </p>
        ) : null}

        {/* Row 5: subtopic + preview */}
        {selectedNode && subtopicOptions.length > 0 ? (
          <div
            className={
              value.subtopicName
                ? "grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                : "space-y-1"
            }
          >
            <div className="min-w-0 space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Subtopic
              </label>
              <div className="relative">
                <select
                  value={value.subtopicName ?? ""}
                  onChange={(e) =>
                    patch({
                      subtopicName: e.target.value || null,
                    })
                  }
                  className={selectWithChevronClass}
                >
                  <option value="">Select subtopic…</option>
                  {subtopicOptions.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className={chevronCls} />
              </div>
            </div>
            {value.subtopicName ? (
              <button
                type="button"
                onClick={() => void openPreview()}
                className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/25 sm:h-10 sm:w-auto sm:self-end sm:rounded-xl sm:text-sm"
              >
                <Eye className="h-3.5 w-3.5 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                Preview
              </button>
            ) : null}
          </div>
        ) : selectedNode ? (
          <p className="text-[11px] leading-snug text-amber-200/90">
            This lesson has no subtopics listed yet.
          </p>
        ) : null}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-4xl flex-col overflow-hidden border-white/10 bg-[#0c1020] p-0 text-slate-100">
          {value.subject && value.classLevel && selectedNode?.topic && value.subtopicName ? (
            <ConceptFocusSubtopicPreview
              subject={value.subject}
              classLevel={value.classLevel}
              topic={selectedNode.topic}
              subtopicName={value.subtopicName}
            />
          ) : (
            <div className="p-6 text-sm text-slate-400">Preview unavailable.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
