"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { TeacherPortalSummary, TeacherPortalWallItem } from "@/lib/teacherPortal/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";

interface GyanWallViewProps {
  summary: TeacherPortalSummary;
  wallItems: TeacherPortalWallItem[];
  teacherId: string;
  onPostTeacherSection: (input: {
    doubtId: string;
    teacherId: string;
    body: string;
  }) => Promise<void>;
}

function Stat(props: { label: string; value: string; accent: string }) {
  return (
    <div className="h-full rounded-xl border border-white/10 bg-[#15162b] p-2 sm:p-2.5 lg:p-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">{props.label}</div>
      <div className={`mt-0.5 font-serif text-[13px] sm:text-2xl lg:text-3xl ${props.accent}`}>
        {props.value}
      </div>
    </div>
  );
}

export default function GyanWallView({
  summary,
  wallItems,
  teacherId,
  onPostTeacherSection,
}: GyanWallViewProps) {
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [postingId, setPostingId] = useState<string | null>(null);
  const [activeComposerDoubtId, setActiveComposerDoubtId] = useState<string | null>(null);
  const [expandedAiById, setExpandedAiById] = useState<Record<string, boolean>>({});
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();
  const teacherRewardRdm = teacherRdmCosts.gyan_teacher_answer;

  const submit = async (doubtId: string) => {
    const body = draftById[doubtId]?.trim();
    if (!body) return;
    setPostingId(doubtId);
    try {
      await onPostTeacherSection({ doubtId, teacherId, body });
      setDraftById((prev) => ({ ...prev, [doubtId]: "" }));
      setActiveComposerDoubtId(null);
    } finally {
      setPostingId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="font-serif text-lg sm:text-3xl lg:text-4xl">
            Gyan++ <span className="text-emerald-400 italic">Teacher Wall</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Add expert Teacher Sections to student doubts. Earn +{teacherRewardRdm} RDM per teacher section.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 sm:px-3 sm:py-1.5 sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          {summary.questionsToday.toLocaleString("en-IN")} questions today
        </div>
      </div>

      <div className="grid gap-1.5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Students helped"
          value={summary.totalStudents.toLocaleString("en-IN")}
          accent="text-emerald-300"
        />
        <Stat
          label="Teacher sections"
          value={summary.teacherSectionsWritten.toLocaleString("en-IN")}
          accent="text-violet-300"
        />
        <Stat
          label="RDM earned"
          value={`+${summary.teacherRdmWeek.toLocaleString("en-IN")}`}
          accent="text-amber-300"
        />
        <Stat
          label="Avg upvotes"
          value={summary.avgTeacherUpvotes.toLocaleString("en-IN")}
          accent="text-rose-300"
        />
      </div>

      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
          Pending doubts from your subjects
        </div>
        {wallItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 text-sm text-slate-400 sm:p-5">
            No doubts available right now.
          </div>
        ) : (
          <div className="grid items-start gap-1.5 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {wallItems.map((item) => (
              <article
                key={item.doubtId}
                className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111428]"
              >
                <div className="space-y-1.5 px-2.5 py-2 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="rounded bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200">
                      {item.askerRole === "ai" ? "AI" : "Student"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.askerName} · {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[12px] sm:text-sm font-semibold leading-snug">
                    {item.title}
                  </div>
                  <div className="space-y-2">
                    {item.aiAnswerBody ? (
                      <div className="rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-2 sm:p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                            AI answer (quick)
                          </div>
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-200">
                            Optional
                          </span>
                        </div>
                        <div
                          className={`mt-1 doubt-markdown doubt-markdown-compact gyan-wall-ai-markdown ${
                            expandedAiById[item.doubtId] ? "" : "line-clamp-4"
                          }`}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {item.aiAnswerBody}
                          </ReactMarkdown>
                        </div>
                        {item.aiAnswerBody.trim().length > 260 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAiById((prev) => ({
                                ...prev,
                                [item.doubtId]: !prev[item.doubtId],
                              }))
                            }
                            className="mt-1 text-[11px] font-semibold text-emerald-200 hover:underline sm:text-xs"
                          >
                            {expandedAiById[item.doubtId] ? "Show less" : "Read more"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 sm:gap-2 sm:text-xs">
                    <span className="rounded bg-white/5 px-2 py-1">▲ {item.upvotes} upvotes</span>
                    <span className="rounded bg-white/5 px-2 py-1">
                      {item.peerCommentsCount} peer comments
                    </span>
                    <span className="rounded bg-white/5 px-2 py-1">
                      {item.teacherAnswersCount} teacher sections
                    </span>
                    <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-200">
                      +{teacherRewardRdm} RDM if you add Teacher Section
                    </span>
                  </div>
                </div>
                <div className="border-t border-violet-400/20 bg-violet-500/5 px-2.5 py-2 sm:px-4 sm:py-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-200">
                    Teacher Section
                  </div>

                  {item.hasCurrentTeacherAnswer ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
                      <div className="text-xs font-semibold text-emerald-200">
                        You already posted your Teacher Section for this doubt.
                      </div>
                      {item.currentTeacherAnswerPreview ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/90 sm:text-xs">
                          {item.currentTeacherAnswerPreview}
                          {item.currentTeacherAnswerPreview.length >= 180 ? "…" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveComposerDoubtId(item.doubtId)}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full bg-violet-500 px-3 py-2 text-[10.5px] font-semibold text-white hover:bg-violet-400 sm:min-h-10 sm:px-4 sm:py-2.5 sm:text-xs"
                      >
                        Post Teacher Section (+{teacherRewardRdm} RDM)
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(activeComposerDoubtId)}
        onOpenChange={(next) => {
          if (!next) setActiveComposerDoubtId(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-[760px] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#111428] p-4 text-slate-100 sm:p-6">
          {(() => {
            const active = wallItems.find((w) => w.doubtId === activeComposerDoubtId) ?? null;
            if (!active) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8 text-base font-semibold sm:text-lg">
                    Teacher Section
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">
                      {active.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      {active.body}
                    </p>
                    {active.aiAnswerBody ? (
                      <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                          AI answer (quick)
                        </div>
                        <div className="mt-1 doubt-markdown doubt-markdown-compact gyan-wall-ai-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {active.aiAnswerBody}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : null}
                    {active.teacherAnswersCount > 0 ? (
                      <div className="mt-3 text-[11px] text-slate-400 sm:text-xs">
                        Teacher sections so far:{" "}
                        <span className="font-semibold">{active.teacherAnswersCount}</span>
                      </div>
                    ) : null}
                  </div>

                  <textarea
                    value={draftById[active.doubtId] ?? ""}
                    onChange={(e) =>
                      setDraftById((prev) => ({ ...prev, [active.doubtId]: e.target.value }))
                    }
                    rows={6}
                    placeholder="Add your expert insight — exam tip, examiner perspective, or clarification..."
                    className="w-full rounded-lg border border-white/20 bg-[#07070f] px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-violet-400 sm:text-sm"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submit(active.doubtId)}
                      disabled={
                        postingId === active.doubtId || !(draftById[active.doubtId] ?? "").trim()
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
                    >
                      {postingId === active.doubtId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Post Teacher Section (+{teacherRewardRdm} RDM)
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
