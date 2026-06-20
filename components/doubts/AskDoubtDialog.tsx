"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import DoubtMarkdown from "@/components/doubts/DoubtMarkdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft, RotateCcw } from "lucide-react";
import { DOUBT_DUPLICATE_MIN_SIMILARITY } from "./doubtTypes";

const ASK_DOUBT_SUBJECTS = ["Physics", "Chemistry", "Math"] as const;
import {
  applyNormalizedPasteToField,
  normalizePastedMathForDoubt,
} from "@/lib/normalizePastedDoubtMath";
import { notifyBuddyActivityRefresh } from "@/lib/buddy/buddyActivityEvents";
import { incrementPrepCalendarDay, localDayISO } from "@/lib/dashboard/prepCalendarClient";
import { safeGetSession } from "@/lib/auth/safeSession";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { gyanDoubtLimitToastCopy } from "@/lib/subscription/gyanDoubtsLimits";

interface AskDoubtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful post; `doubtId` is set when the RPC returns an id (for Prof-Pi pending UI). */
  onDoubtPosted?: (doubtId?: string | null) => void;
}

const DRAFT_KEY = "doubts-ask-draft";

export default function AskDoubtDialog({ open, onOpenChange, onDoubtPosted }: AskDoubtDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");

  /** Live KaTeX preview of the typed/pasted question, post-normalization. */
  const previewSrc = useMemo(() => {
    const trimmed = title.trim();
    if (!trimmed) return "";
    try {
      return normalizePastedMathForDoubt(trimmed);
    } catch {
      return trimmed;
    }
  }, [title]);
  const [askStep, setAskStep] = useState(1);
  const [duplicateMatches, setDuplicateMatches] = useState<
    { id: string; title: string; similarity_score: number }[]
  >([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const duplicateCheckGenRef = useRef(0);

  const resetAskDialogState = useCallback(() => {
    duplicateCheckGenRef.current += 1;
    setAskStep(1);
    setTitle("");
    setBody("");
    setSubject("");
    setDuplicateMatches([]);
    setDuplicateChecking(false);
    setSubmitLoading(false);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const handleStartAsNew = useCallback(() => {
    clearDraft();
    resetAskDialogState();
  }, [clearDraft, resetAskDialogState]);

  const hydrateFromSessionOrReset = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        resetAskDialogState();
        return;
      }
      const d = JSON.parse(raw) as Record<string, unknown>;
      resetAskDialogState();
      if (d.title != null) setTitle(String(d.title));
      if (d.body != null) setBody(String(d.body));
      if (d.subject != null) setSubject(String(d.subject));
      if (typeof d.askStep === "number" && d.askStep === 3) {
        setAskStep(3);
        if (Array.isArray(d.duplicateMatches)) {
          setDuplicateMatches(
            d.duplicateMatches as { id: string; title: string; similarity_score: number }[]
          );
        }
      }
    } catch {
      resetAskDialogState();
    }
  }, [resetAskDialogState]);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    if (askStep !== 1) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          body,
          subject,
          askStep,
          duplicateMatches,
        })
      );
    } catch {
      /* ignore */
    }
  }, [title, body, subject, askStep, duplicateMatches]);

  // Load draft when dialog opens.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      hydrateFromSessionOrReset();
    });
  }, [open, hydrateFromSessionOrReset]);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      duplicateCheckGenRef.current += 1;
      setDuplicateChecking(false);
      setSubmitLoading(false);
      setAskStep(1);
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (open) saveDraft();
  }, [open, saveDraft]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitLoading(true);
    const nt = normalizePastedMathForDoubt(title.trim());
    const nb = normalizePastedMathForDoubt(body.trim());
    setTitle(nt);
    setBody(nb);
    const authHeaders = await getClientApiAuthHeaders();
    const postRes = await fetch("/api/gyan/doubt-post", {
      method: "POST",
      credentials: "include",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nt,
        body: nb || "",
        subject: subject.trim(),
        costRdm: 0,
        bountyRdm: 0,
      }),
    });
    setSubmitLoading(false);
    const res = (await postRes.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: unknown;
      error?: string;
      limitReached?: boolean;
      daily_rdm?: { awarded?: boolean; amount?: number };
    };
    if (!postRes.ok) {
      setAskStep(1);
      if (res.limitReached) {
        const access = (res as { access?: { dailyLimit?: number } }).access;
        const limit = access?.dailyLimit ?? 1;
        const copy = gyanDoubtLimitToastCopy(limit);
        toast({
          variant: "destructive",
          title: copy.title,
          description: typeof res.error === "string" ? res.error : copy.description,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not post doubt",
          description:
            typeof res.error === "string" ? res.error : `HTTP ${postRes.status}`,
        });
      }
      return;
    }
    if (res?.ok) {
      notifyBuddyActivityRefresh();
      clearDraft();
      resetAskDialogState();
      toast({
        title: "Doubt posted!",
        description:
          res.daily_rdm?.awarded && res.daily_rdm.amount
            ? `+${res.daily_rdm.amount} RDM — first question milestone today (IST).`
            : undefined,
      });
      void (async () => {
        const at = (await safeGetSession()).session?.access_token;
        await incrementPrepCalendarDay(at ?? undefined, "doubt", localDayISO());
      })();
      handleDialogOpenChange(false);
      const rawId = res.id;
      const doubtId =
        typeof rawId === "string"
          ? rawId.trim()
          : rawId != null && String(rawId) !== ""
            ? String(rawId).trim()
            : null;
      onDoubtPosted?.(doubtId ?? null);
      if (doubtId) {
        let accessToken = (await safeGetSession()).session?.access_token ?? null;
        if (!accessToken) {
          await supabase.auth.refreshSession();
          accessToken = (await safeGetSession()).session?.access_token ?? null;
        }
        if (!accessToken) {
          toast({
            title: "Prof-Pi was not triggered",
            description:
              "No session token after posting. Refresh the page and try again, or check you are signed in.",
            variant: "destructive",
          });
        } else {
          await new Promise((r) => setTimeout(r, 400));
          const apiUrl = `${window.location.origin}/api/gyan-bot-answer`;
          void fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ doubtId }),
          })
            .then(async (res) => {
              if (res.ok) return;
              const err = (await res.json().catch(() => ({}))) as {
                error?: string;
                hint?: string;
                supabaseError?: string;
                envDiagSummary?: string;
              };
              const hintHasKeyMsg = err.hint?.toLowerCase().includes("invalid api key");
              const supa = err.supabaseError && !hintHasKeyMsg ? `\n\n${err.supabaseError}` : "";
              const extra = err.hint ? `\n\n${err.hint}` : "";
              const diag = err.envDiagSummary ? `\n\n${err.envDiagSummary}` : "";
              toast({
                title: "Prof-Pi could not answer yet",
                description: `${err.error ?? `Server returned ${res.status}`}${supa}${extra}${diag}`,
                variant: "destructive",
              });
            })
            .catch(() => {
              toast({
                title: "Prof-Pi request failed",
                description:
                  "Network error calling /api/gyan-bot-answer. Check connection and deployment.",
                variant: "destructive",
              });
            });
        }
      }
    } else {
      setAskStep(1);
      toast({ title: res?.error ?? "Failed to post", variant: "destructive" });
    }
  };

  const handleStep1Next = () => {
    if (
      !title.trim() ||
      !subject ||
      !ASK_DOUBT_SUBJECTS.includes(subject as (typeof ASK_DOUBT_SUBJECTS)[number])
    ) {
      toast({ title: "Title and subject required", variant: "destructive" });
      return;
    }
    const nt = normalizePastedMathForDoubt(title.trim());
    const nb = normalizePastedMathForDoubt(body.trim());
    setTitle(nt);
    setBody(nb);
    const checkGen = ++duplicateCheckGenRef.current;
    setDuplicateChecking(true);
    setAskStep(2);
    void supabase.rpc("search_doubt_duplicates", { p_title: nt }).then(({ data, error }) => {
      if (checkGen !== duplicateCheckGenRef.current) return;
      setDuplicateChecking(false);
      if (error) {
        setDuplicateMatches([]);
        void handleSubmit();
        return;
      }
      const rows = (data || []) as { id: string; title: string; similarity_score: number }[];
      const similar = rows.filter((r) => r.similarity_score >= DOUBT_DUPLICATE_MIN_SIMILARITY);
      if (similar.length > 0) {
        setDuplicateMatches(similar);
        setAskStep(3);
      } else {
        setDuplicateMatches([]);
        void handleSubmit();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a Doubt</DialogTitle>
          <DialogDescription>
            {askStep === 1 &&
              "Type your question — paste from notes, a textbook, or the web. We tidy LaTeX automatically. Use the live preview to confirm your math renders the way you want."}
            {askStep === 2 && "Checking for similar questions..."}
            {askStep === 3 && "We found similar questions. Is yours here?"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {askStep === 1 && (
            <>
              <div>
                <Label className="text-sm font-bold">Question</Label>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text/plain");
                    const el = e.currentTarget;
                    const { value, caret } = applyNormalizedPasteToField(
                      title,
                      el.selectionStart ?? 0,
                      el.selectionEnd ?? 0,
                      pasted
                    );
                    setTitle(value);
                    queueMicrotask(() => el.setSelectionRange(caret, caret));
                  }}
                  placeholder={"Write your question — paste LaTeX, equations or working freely"}
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm mt-1 resize-none font-mono overflow-y-auto leading-relaxed"
                  rows={4}
                  style={{ maxHeight: "9.5rem" }}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Use <code className="rounded bg-muted px-1 py-0.5 text-[11px]">$…$</code> for
                  inline math and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">$$…$$</code> for block
                  math. Fenced{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">```latex</code> and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">\[ … \]</code> and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">[ … ]</code> blocks are
                  converted automatically.
                </p>
              </div>
              <div>
                <Label className="text-sm font-bold">Preview</Label>
                <div
                  className="mt-1 rounded-xl border border-dashed border-input bg-muted/30 px-3 py-2 text-sm overflow-y-auto"
                  style={{ minHeight: "4.5rem", maxHeight: "9.5rem" }}
                  aria-live="polite"
                >
                  {previewSrc.trim() ? (
                    <DoubtMarkdown content={previewSrc} className="text-sm" />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Start typing — your question will render here with formatted math.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-bold">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ASK_DOUBT_SUBJECTS.map((flair) => (
                    <Button
                      key={flair}
                      type="button"
                      variant={subject === flair ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setSubject(flair)}
                    >
                      {flair}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
          {askStep === 2 && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              {submitLoading && !duplicateChecking ? (
                <span className="text-sm text-muted-foreground">Posting your doubt…</span>
              ) : (
                <span className="text-sm text-muted-foreground">Checking for similar questions…</span>
              )}
            </div>
          )}
          {askStep === 3 && duplicateMatches.length > 0 && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
              <p className="font-semibold text-foreground">Similar questions we found:</p>
              <ul className="space-y-2">
                {duplicateMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/doubts/${m.id}`}
                      className="text-sm text-primary hover:underline line-clamp-2 block py-1"
                      onClick={() => handleDialogOpenChange(false)}
                    >
                      {m.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Open any link above if it answers your question, or continue to post yours.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          {askStep === 1 && (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={handleStartAsNew}
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Start as new
              </Button>
              <Button
                className="rounded-xl"
                onClick={handleStep1Next}
                disabled={!title.trim() || !subject || duplicateChecking || submitLoading}
              >
                {duplicateChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post
              </Button>
            </>
          )}
          {askStep === 2 && (
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={submitLoading || duplicateChecking}
              onClick={() => {
                duplicateCheckGenRef.current += 1;
                setDuplicateChecking(false);
                setSubmitLoading(false);
                setAskStep(1);
              }}
            >
              Cancel
            </Button>
          )}
          {askStep === 3 && (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => setAskStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => {
                  setDuplicateMatches([]);
                  void handleSubmit();
                }}
                disabled={submitLoading}
              >
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Post my question
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
