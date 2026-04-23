"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { TeacherPortalSummary, TeacherPortalWallItem } from "@/lib/teacherPortal/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    <div className="h-full rounded-xl border border-white/10 bg-[#15162b] p-3 sm:p-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">{props.label}</div>
      <div className={`mt-1 font-serif text-2xl sm:text-3xl ${props.accent}`}>{props.value}</div>
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">
            Gyan++ <span className="text-emerald-400 italic">Teacher Wall</span>
          </h1>
          <p className="text-sm text-slate-400">
            Add expert Teacher Sections to student doubts. Earn +30 RDM per upvoted answer.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
          <Sparkles className="h-3.5 w-3.5" />
          {summary.questionsToday.toLocaleString("en-IN")} questions today
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="rounded-xl border border-white/10 bg-[#15162b] p-5 text-sm text-slate-400">
            No doubts available right now.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {wallItems.map((item) => (
              <article
                key={item.doubtId}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111428]"
              >
                <div className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="rounded bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200">
                      {item.askerRole === "ai" ? "AI" : "Student"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.askerName} · {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-sm leading-relaxed text-slate-300">{item.body}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded bg-white/5 px-2 py-1">▲ {item.upvotes} upvotes</span>
                    <span className="rounded bg-white/5 px-2 py-1">
                      {item.peerCommentsCount} peer comments
                    </span>
                    <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-200">
                      +30 RDM if you add Teacher Section
                    </span>
                  </div>
                </div>
                <div className="mt-auto border-t border-violet-400/20 bg-violet-500/5 px-4 py-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-200">
                    Teacher Section
                  </div>

                  {item.hasCurrentTeacherAnswer ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5">
                      <div className="text-xs font-semibold text-emerald-200">
                        You already posted your Teacher Section for this doubt.
                      </div>
                      {item.currentTeacherAnswerPreview ? (
                        <p className="mt-1 text-xs leading-relaxed text-emerald-100/90">
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
                        className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
                      >
                        Post Teacher Section (+30 RDM)
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
        <DialogContent className="w-[95vw] max-w-[760px] rounded-2xl border border-white/15 bg-[#111428] text-slate-100">
          {(() => {
            const active = wallItems.find((w) => w.doubtId === activeComposerDoubtId) ?? null;
            if (!active) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8 text-lg font-semibold">Teacher Section</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-semibold text-slate-100">{active.title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{active.body}</p>
                  </div>

                  <textarea
                    value={draftById[active.doubtId] ?? ""}
                    onChange={(e) =>
                      setDraftById((prev) => ({ ...prev, [active.doubtId]: e.target.value }))
                    }
                    rows={7}
                    placeholder="Add your expert insight — exam tip, examiner perspective, or clarification..."
                    className="w-full rounded-lg border border-white/20 bg-[#07070f] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-violet-400"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submit(active.doubtId)}
                      disabled={
                        postingId === active.doubtId || !(draftById[active.doubtId] ?? "").trim()
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
                    >
                      {postingId === active.doubtId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Post Teacher Section (+30 RDM)
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
