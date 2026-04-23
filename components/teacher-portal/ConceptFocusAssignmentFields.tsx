"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Eye, Loader2, BookOpen, Layers, Target, Calculator } from "lucide-react";
import TheoryContent from "@/components/TheoryContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TopicNode } from "@/data/topicTaxonomy";
import {
  topicOptionLabel,
  topicsForChapter,
  uniqueChaptersFor,
} from "@/lib/teacherPortal/chapterQuizUtils";
import { fetchSubtopicContent, type SubtopicContentResponse } from "@/lib/subtopicContentService";
import type { Board, ClassLevel, Subject } from "@/types";

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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<SubtopicContentResponse | null>(null);

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
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const data = await fetchSubtopicContent({
        board: "CBSE" as Board,
        subject: value.subject,
        classLevel: value.classLevel,
        topic: selectedNode.topic,
        subtopicName: value.subtopicName.trim(),
        level: "advanced",
      });
      setPreviewData(data);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedNode?.topic, value.classLevel, value.subject, value.subtopicName]);

  if (taxonomyLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1020] px-3 py-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
        Loading syllabus for concept focus…
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
        <p className="text-sm font-semibold text-slate-200">Concept focus target</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Pick class → subject → chapter → lesson → subtopic to assign theory and revision content.
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <select
                value={value.subtopicName ?? ""}
                onChange={(e) =>
                  patch({
                    subtopicName: e.target.value || null,
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
            {value.subtopicName && (
              <button
                type="button"
                onClick={() => void openPreview()}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2.5 sm:py-0 sm:h-11 text-sm font-semibold text-violet-200 hover:bg-violet-500/25 transition-colors"
              >
                <Eye className="h-4 w-4 opacity-90" aria-hidden />
                Preview Content
              </button>
            )}
          </div>
        </div>
      ) : selectedNode ? (
        <p className="text-xs text-amber-200/90">This lesson has no subtopics listed yet.</p>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] w-[95vw] max-w-4xl overflow-hidden border-white/10 bg-[#0c1020] p-0 text-slate-100 flex flex-col">
          <DialogHeader className="p-5 border-b border-white/5 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-100">
              {value.subtopicName}
            </DialogTitle>
            <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-2 items-center">
              <span>
                {value.subject && value.subject.charAt(0).toUpperCase() + value.subject.slice(1)}
              </span>
              <span>•</span>
              <span>{selectedNode?.topic}</span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#070a14]">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p>Loading subtopic content…</p>
              </div>
            ) : previewError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {previewError}
              </div>
            ) : previewData ? (
              <div className="space-y-8">
                {/* Content Summary Dashboard */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-white/5 bg-[#0c1020] p-3 flex flex-col items-center text-center">
                    <BookOpen className="w-5 h-5 text-sky-400 mb-2" />
                    <span className="text-2xl font-bold text-slate-200">
                      {previewData.theory ? "Yes" : "No"}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
                      Theory
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-[#0c1020] p-3 flex flex-col items-center text-center">
                    <Layers className="w-5 h-5 text-emerald-400 mb-2" />
                    <span className="text-2xl font-bold text-slate-200">
                      {previewData.instacueCards.length}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
                      InstaCue Cards
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-[#0c1020] p-3 flex flex-col items-center text-center">
                    <Target className="w-5 h-5 text-violet-400 mb-2" />
                    <span className="text-2xl font-bold text-slate-200">
                      {previewData.bitsQuestions.length}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
                      Quiz Questions
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-[#0c1020] p-3 flex flex-col items-center text-center">
                    <Calculator className="w-5 h-5 text-amber-400 mb-2" />
                    <span className="text-2xl font-bold text-slate-200">
                      {previewData.practiceFormulas.length}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
                      Numerals
                    </span>
                  </div>
                </div>

                {/* Theory Preview */}
                {previewData.theory ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0c1020] p-5 sm:p-7 shadow-lg">
                    <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                      <BookOpen className="w-5 h-5 text-sky-400" />
                      <h3 className="text-lg font-bold text-slate-100">Theory Preview</h3>
                    </div>
                    <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-slate-100 [&_.katex]:!text-[1.1em]">
                      <TheoryContent theory={previewData.theory} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/5 bg-[#0c1020] p-6 text-center text-sm text-slate-500">
                    No theory content available for this subtopic yet.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
