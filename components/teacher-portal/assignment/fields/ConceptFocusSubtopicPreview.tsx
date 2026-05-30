"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Calculator, Layers, Loader2, Target } from "lucide-react";
import TheoryContent from "@/components/TheoryContent";
import {
  fetchSubtopicContent,
  type SubtopicContentResponse,
} from "@/lib/curriculum/subtopicContentService";
import type { Board, ClassLevel, Subject } from "@/types";
import {
  DEFAULT_PREVIEW_CACHE_TTL_MS,
  getCachedConceptFocusPreview,
  setCachedConceptFocusPreview,
} from "@/lib/play/bits/conceptFocusPreviewCache";

type Props = {
  board?: Board;
  subject: Subject;
  classLevel: ClassLevel;
  topic: string;
  subtopicName: string;
};

export default function ConceptFocusSubtopicPreview({
  board = "CBSE",
  subject,
  classLevel,
  topic,
  subtopicName,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubtopicContentResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const title = subtopicName.trim();
  const subtitle = useMemo(() => {
    const subj = subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : "";
    return `${subj} • ${topic}`.trim();
  }, [subject, topic]);

  useEffect(() => {
    let cancelled = false;
    const keyInput = { board, subject, classLevel, topic, subtopicName: subtopicName.trim() };

    const cached = getCachedConceptFocusPreview(keyInput);
    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setData(null);
    }
    setError(null);

    const run = async () => {
      try {
        const payload = await fetchSubtopicContent({
          board,
          subject,
          classLevel,
          topic,
          subtopicName: subtopicName.trim(),
          level: "advanced",
        });
        if (!cancelled) {
          setData(payload);
          setCachedConceptFocusPreview(keyInput, payload);
        }
      } catch (e) {
        if (!cancelled && !cached?.data) {
          setError(e instanceof Error ? e.message : "Could not load preview");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [board, subject, classLevel, topic, subtopicName]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/5 p-4 sm:p-5">
        <div className="text-lg font-bold text-slate-100 sm:text-xl">{title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400 sm:text-sm">
          {subtitle}
          {refreshing ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">
              Updating…
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#070a14] p-4 sm:p-6">
        {loading ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p>Loading subtopic content…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col items-center rounded-xl border border-white/5 bg-[#0c1020] p-3 text-center">
                <BookOpen className="mb-2 h-5 w-5 text-sky-400" />
                <span className="text-2xl font-bold text-slate-200">
                  {data.theory ? "Yes" : "No"}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Theory
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-white/5 bg-[#0c1020] p-3 text-center">
                <Layers className="mb-2 h-5 w-5 text-emerald-400" />
                <span className="text-2xl font-bold text-slate-200">
                  {data.instacueCards.length}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  InstaCue Cards
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-white/5 bg-[#0c1020] p-3 text-center">
                <Target className="mb-2 h-5 w-5 text-violet-400" />
                <span className="text-2xl font-bold text-slate-200">
                  {data.bitsQuestions.length}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Quiz Questions
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-white/5 bg-[#0c1020] p-3 text-center">
                <Calculator className="mb-2 h-5 w-5 text-amber-400" />
                <span className="text-2xl font-bold text-slate-200">
                  {data.practiceFormulas.length}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Numerals
                </span>
              </div>
            </div>

            {data.theory ? (
              <div className="rounded-2xl border border-white/10 bg-[#0c1020] p-4 shadow-lg sm:p-7">
                <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-3 sm:mb-6 sm:pb-4">
                  <BookOpen className="h-5 w-5 text-sky-400" />
                  <h3 className="text-base font-bold text-slate-100 sm:text-lg">Theory Preview</h3>
                </div>
                <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-slate-100 [&_.katex]:!text-[1.1em]">
                  <TheoryContent theory={data.theory} />
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
    </div>
  );
}
