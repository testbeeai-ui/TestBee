"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Shuffle, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECT_LABELS, subjectEmojis } from "@/components/prep-mock/constants";
import { formatMockExamTime } from "@/components/prep-mock/utils/mockLatexReview";
import {
  buildCbseMcqShareTemplates,
  formatMockAccuracyPercent,
  getCbseMcqShareOutcome,
  pickNextCbseMcqShareTemplate,
} from "@/lib/mock/cbseMcqShareTemplates";
import { subjectBreakdownFromSection } from "@/lib/mock/mockTestAttemptTypes";
import type { Subject } from "@/types";
import { cn } from "@/lib/utils";

type CbseChapterQuizCommunityShareProps = {
  chapterTitle: string;
  subject: Subject;
  classLevel: 11 | 12;
  paperId: string;
  paperSlug: string;
  attemptKey: string;
  correct: number;
  total: number;
  answeredCount: number;
  durationSeconds: number;
};

const TONE_STYLES = {
  achievement: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/35",
  progress: "from-primary/20 via-primary/5 to-transparent border-primary/35",
  comeback: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/35",
} as const;

export default function CbseChapterQuizCommunityShare({
  chapterTitle,
  subject,
  classLevel,
  paperId,
  paperSlug,
  attemptKey,
  correct,
  total,
  answeredCount,
  durationSeconds,
}: CbseChapterQuizCommunityShareProps) {
  const { toast } = useToast();
  const { user: authUser, refreshProfile } = useAuth();
  const setRdmFromProfile = useUserStore((s) => s.setRdmFromProfile);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [posting, setPosting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareRewardRdm, setShareRewardRdm] = useState(40);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("rdm_config")
      .select("value")
      .eq("key", "cbse_mcq_community_share_rdm")
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled || !data?.value) return;
          setShareRewardRdm(Math.max(1, Math.trunc(Number(data.value))));
        },
        () => {}
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const outcome = useMemo(() => getCbseMcqShareOutcome(correct, total), [correct, total]);

  const templates = useMemo(() => {
    const appUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/mock-test?tab=mcq`
        : "https://edublast.in/mock-test?tab=mcq";
    return buildCbseMcqShareTemplates({
      chapterTitle,
      subjectLabel: SUBJECT_LABELS[subject],
      classLevel,
      correct,
      total,
      answeredCount,
      marksLabel: `${correct}/${total}`,
      accuracyPct: formatMockAccuracyPercent(correct, total),
      timeTakenLabel: formatMockExamTime(durationSeconds),
      appUrl,
      outcome,
    });
  }, [chapterTitle, subject, classLevel, correct, total, answeredCount, durationSeconds, outcome]);

  const activeTemplate = templates.length > 0 ? templates[templateIndex % templates.length]! : null;

  const handlePostToCommunity = useCallback(async () => {
    if (!authUser?.id) {
      toast({
        title: "Sign in required",
        description: "Log in to post your chapter quiz to the community.",
        variant: "destructive",
      });
      return;
    }
    const tmpl = templates[templateIndex % Math.max(1, templates.length)];
    if (!tmpl) return;

    setPosting(true);
    try {
      const subjectBreakdown = subjectBreakdownFromSection({
        [subject]: { correct, total },
      });

      const { data, error } = await supabase
        .from("lessons_raw_posts")
        .insert({
          user_id: authUser.id,
          kind: "post",
          title: tmpl.title.length > 200 ? `${tmpl.title.slice(0, 197)}…` : tmpl.title,
          content: tmpl.communityContent,
          tags: ["cbse_mcq_chapter", "prep-mock"],
          subject,
          source_type: "cbse_mcq_chapter",
          source_payload: {
            templateId: tmpl.id,
            paperId,
            paperSlug,
            chapterTitle,
            subject,
            classLevel,
            correct,
            total,
            answeredCount,
            tone: tmpl.tone,
            outcome,
            attemptKey,
            sessionKind: "mcq_chapter",
            sharePaperKind: "cbse_mcq_chapter",
            subjectBreakdown,
          },
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Post created but ID was not returned.");
      const postId = String(data.id);
      setPreviewOpen(false);

      const rewardLabel = `+${shareRewardRdm} RDM`;
      const communityRdmMessages: Record<string, string> = {
        already_claimed_session: `You already received ${rewardLabel} for sharing this chapter run.`,
        missing_attempt_key: "This post could not be tied to your finished quiz for the bonus.",
        invalid_source: "This post did not qualify for the community share bonus.",
        wrong_owner: "Account mismatch while claiming RDM.",
        post_not_found: "Post was not found when claiming RDM.",
        unauthenticated: "Sign in to claim RDM.",
      };

      const { data: claimRaw, error: claimRpcError } = await supabase.rpc(
        "claim_cbse_mcq_community_share_rdm" as any,
        { p_post_id: postId }
      );

      let rdmLine = "";
      if (claimRpcError) {
        rdmLine = " Bonus RDM could not be verified right now.";
      } else {
        const claim = claimRaw as unknown as Record<string, unknown> | null;
        if (claim?.ok === true) {
          const bal = claim.new_rdm_balance;
          const awarded =
            typeof claim.rdm_awarded === "number" && Number.isFinite(claim.rdm_awarded)
              ? Math.max(1, Math.trunc(claim.rdm_awarded))
              : shareRewardRdm;
          if (typeof bal === "number" && Number.isFinite(bal)) {
            setRdmFromProfile(bal);
          } else {
            void refreshProfile();
          }
          rdmLine = ` +${awarded} RDM added for sharing.`;
        } else {
          const reason = typeof claim?.denial_reason === "string" ? claim.denial_reason : "unknown";
          rdmLine = ` ${communityRdmMessages[reason] ?? `No bonus RDM (${reason}).`}`;
        }
      }

      toast({
        title: "Posted to community",
        description: `Your CBSE chapter quiz is live on the feed.${rdmLine}`,
        action: (
          <ToastAction
            altText="View post"
            onClick={() => {
              window.location.href = `/home?focusPost=${encodeURIComponent(postId)}`;
            }}
          >
            View post
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({
        title: "Community post failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  }, [
    authUser?.id,
    templates,
    templateIndex,
    subject,
    correct,
    total,
    answeredCount,
    paperId,
    paperSlug,
    chapterTitle,
    classLevel,
    outcome,
    attemptKey,
    shareRewardRdm,
    toast,
    setRdmFromProfile,
    refreshProfile,
  ]);

  const handleWhatsApp = useCallback(() => {
    const tmpl = templates[templateIndex % Math.max(1, templates.length)];
    if (!tmpl || typeof window === "undefined") return;
    const url = `https://wa.me/?text=${encodeURIComponent(tmpl.whatsappText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [templates, templateIndex]);

  if (!activeTemplate || templates.length === 0) return null;

  const toneStyle = TONE_STYLES[activeTemplate.tone];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-inner sm:p-5",
        toneStyle
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Share this result
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {outcome === "win" ? "Win" : "Comeback"} set · Caption {templateIndex + 1}/
            {templates.length} · {activeTemplate.tone}
            <span className="text-foreground/70"> · WhatsApp uses a different message.</span>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-[11px]"
          disabled={posting}
          onClick={() => {
            if (templates.length <= 1) return;
            setTemplateIndex((prev) => pickNextCbseMcqShareTemplate(prev, templates.length));
          }}
        >
          <Shuffle className="mr-1 h-3.5 w-3.5" />
          Shuffle
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/50 p-3 backdrop-blur-sm sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">{subjectEmojis[subject]}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            CBSE MCQ · Class {classLevel}
          </span>
        </div>
        <p className="text-sm font-bold leading-snug text-foreground">{activeTemplate.title}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {activeTemplate.communityContent}
        </p>
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          Score {correct}/{total} · {formatMockAccuracyPercent(correct, total)}% ·{" "}
          {formatMockExamTime(durationSeconds)}
        </p>
      </div>

      {!authUser?.id ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sign in to post to the community. WhatsApp still works from this device.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 border-amber-500/40 bg-amber-500/10 font-semibold text-amber-950 hover:bg-amber-500/20 dark:text-amber-100"
          disabled={posting || !authUser?.id}
          onClick={() => setPreviewOpen(true)}
        >
          <Users className="mr-1.5 h-4 w-4" />
          Post to Community
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-9" onClick={handleWhatsApp}>
          <MessageCircle className="mr-1.5 h-4 w-4" />
          WhatsApp
        </Button>
      </div>

      <p className="mt-2 text-xs leading-snug text-muted-foreground">
        <strong className="text-foreground">Share bonus:</strong> up to{" "}
        <strong>{`+${shareRewardRdm} RDM`}</strong> on a verified Post to Community (once per quiz
        run). WhatsApp is external only.
      </p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl border-border bg-background">
          <DialogHeader>
            <DialogTitle>Preview community post</DialogTitle>
            <DialogDescription>
              This posts to the Lessons feed after you tap <strong>Post now</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {activeTemplate.title}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {activeTemplate.communityContent}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="edu-btn-primary font-bold"
              disabled={posting}
              onClick={() => void handlePostToCommunity()}
            >
              {posting ? "Posting…" : "Post now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
