"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { TeacherPortalSummary, TeacherPortalWallItem } from "@/lib/teacherPortal/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";
import { safeGetSession } from "@/lib/auth/safeSession";

interface GyanWallViewProps {
  summary: TeacherPortalSummary;
  wallItems: TeacherPortalWallItem[];
  teacherId: string;
  /** Deep-link from assignment detail — scroll to and highlight this doubt. */
  focusDoubtId?: string | null;
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
  focusDoubtId = null,
  onPostTeacherSection,
}: GyanWallViewProps) {
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [postingId, setPostingId] = useState<string | null>(null);
  const [activeComposerDoubtId, setActiveComposerDoubtId] = useState<string | null>(null);
  const [expandedAiById, setExpandedAiById] = useState<Record<string, boolean>>({});
  const [pinnedItem, setPinnedItem] = useState<TeacherPortalWallItem | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const focusScrolledRef = useRef(false);
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();
  const teacherRewardRdm = teacherRdmCosts.gyan_teacher_answer;

  useEffect(() => {
    if (!focusDoubtId) {
      setPinnedItem(null);
      focusScrolledRef.current = false;
      return;
    }
    setActiveComposerDoubtId(focusDoubtId);
    if (wallItems.some((item) => item.doubtId === focusDoubtId)) {
      setPinnedItem(null);
      return;
    }
    let cancelled = false;
    setPinLoading(true);
    void (async () => {
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/teacher/wall-doubt?doubtId=${encodeURIComponent(focusDoubtId)}`,
          {
            credentials: "include",
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          item?: TeacherPortalWallItem;
          error?: string;
        };
        if (!cancelled && res.ok && data.item) {
          setPinnedItem(data.item);
        }
      } finally {
        if (!cancelled) setPinLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusDoubtId, wallItems]);

  const displayItems = useMemo(() => {
    if (!pinnedItem) return wallItems;
    if (wallItems.some((item) => item.doubtId === pinnedItem.doubtId)) return wallItems;
    return [pinnedItem, ...wallItems];
  }, [wallItems, pinnedItem]);

  useEffect(() => {
    if (!focusDoubtId || focusScrolledRef.current) return;
    const el = document.getElementById(`gyan-wall-doubt-${focusDoubtId}`);
    if (!el) return;
    focusScrolledRef.current = true;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [focusDoubtId, displayItems]);

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
            Add expert Teacher Sections to student doubts. Earn +{teacherRewardRdm} RDM per teacher
            section.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 sm:px-3 sm:py-1.5 sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          {summary.questionsToday.toLocaleString("en-IN")} questions today
        </div>
      </div>

      {focusDoubtId ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Highlighted below: a student doubt from your Gyan++ assignment. Add your Teacher Section
          to guide them.
        </div>
      ) : null}

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
        {pinLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading assignment doubt…
          </div>
        ) : null}
        {displayItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 text-sm text-slate-400 sm:p-5">
            No doubts available right now.
          </div>
        ) : (
          <div className="grid items-start gap-1.5 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {displayItems.map((item) => {
              const isFocused = focusDoubtId === item.doubtId;
              return (
              <article
                key={item.doubtId}
                id={`gyan-wall-doubt-${item.doubtId}`}
                className={`flex flex-col overflow-hidden rounded-xl border bg-[#111428] transition-shadow ${
                  isFocused
                    ? "border-amber-400/70 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/10"
                    : "border-white/10"
                }`}
              >
                <div className="space-y-1.5 px-2.5 py-2 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="rounded bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200">
                      {item.askerRole === "ai" ? "AI" : "Student"}
                    </div>
                    {isFocused ? (
                      <div className="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200">
                        From assignment
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-400">
                      {item.askerName} · {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[12px] sm:text-sm font-semibold leading-snug">
                    {item.title}
                  </div>
                  {item.body?.trim() ? (
                    <p className="line-clamp-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                      {item.body}
                    </p>
                  ) : null}
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
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
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
                        className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/25"
                      >
                        Add Teacher Section
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(activeComposerDoubtId)}
        onOpenChange={(open) => {
          if (!open) setActiveComposerDoubtId(null);
        }}
      >
        <DialogContent className="max-w-lg border-white/15 bg-[#111428] text-slate-100">
          <DialogHeader>
            <DialogTitle>Teacher Section</DialogTitle>
          </DialogHeader>
          {activeComposerDoubtId ? (
            <div className="space-y-3">
              <textarea
                value={draftById[activeComposerDoubtId] ?? ""}
                onChange={(e) =>
                  setDraftById((prev) => ({ ...prev, [activeComposerDoubtId]: e.target.value }))
                }
                rows={6}
                placeholder="Share a clear explanation, hint, or worked approach…"
                className="w-full resize-y rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <button
                type="button"
                disabled={postingId === activeComposerDoubtId}
                onClick={() => void submit(activeComposerDoubtId)}
                className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
              >
                {postingId === activeComposerDoubtId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting…
                  </>
                ) : (
                  `Post Teacher Section (+${teacherRewardRdm} RDM)`
                )}
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
