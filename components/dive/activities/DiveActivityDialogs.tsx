"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TheoryContent from "@/components/TheoryContent";
import InstaCue from "@/components/InstaCue";
import MathText from "@/components/MathText";
import TopicQuizInvestorCard from "@/components/curriculum/TopicQuizInvestorCard";
import RdmRewardInfoTip from "@/components/rdm/RdmRewardInfoTip";
import TopicReferencesUpgradeDialog from "@/components/curriculum/TopicReferencesUpgradeDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  fetchSubtopicContent,
  type ArtifactBitsQuestion,
  type ArtifactFormula,
  type SubtopicContentResponse,
} from "@/lib/curriculum/subtopicContentService";
import {
  diveContentCacheKey,
  getDiveContentCache,
  invalidateDiveContentCache,
  loadDiveContentOnce,
} from "@/lib/dive/diveContentCache";
import {
  getAdvancedQuizSetLockState,
  hasQuestionBankPlanAccess,
  hasTopicReferencesAccess,
  isTopicQuestionBankUnlocked,
  markTopicQuestionBankUnlocked,
  resolvePlanTierFromProfile,
  TOPIC_QUESTION_BANK_UPGRADE_PATH,
} from "@/lib/curriculum/topicQuestionBankAccess";
import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import {
  ADVANCED_QUIZ_BANK_SET_INDICES,
  getAdvancedSetBounds,
  isAdvancedMultiSet,
  isLastNonEmptyAdvancedSet,
  type AdvancedQuizSetIndex,
} from "@/lib/play/quiz/advancedQuizSets";
import {
  fetchFormulaPracticeAttempts,
  saveBitsAttempt,
  saveFormulaPracticeAttempt,
  type BitsAttemptRecord,
} from "@/lib/play/bits/bitsAttemptService";
import { getBitsSignature } from "@/lib/play/bits/bitsSignature";
import { applyTopicQuizAdvancedDailyRdmReward } from "@/lib/rdm/claims/applyTopicQuizAdvancedDailyRdmReward";
import { claimNumeralsFormulaCompleteRdm } from "@/lib/rdm/claims/claimNumeralsFormulaCompleteRdm";
import { claimNumeralsPackCompleteDailyRdm } from "@/lib/rdm/claims/claimNumeralsPackDailyRdm";
import { claimQuizSetCompleteRdm } from "@/lib/rdm/claims/claimQuizSetCompleteRdm";
import {
  isFirstNumeralsPackForRdm,
  isFirstQuizSetForRdm,
  numeralsFinishRdmLabel,
  numeralsRdmTipLines,
  quizFinishRdmLabel,
  quizRdmTipLines,
} from "@/lib/rdm/subtopicUnitRdmCopy";
import {
  DEFAULT_RDM_CONFIG,
  fetchRdmConfig,
  rdmConfigShallowEqual,
  type RdmConfigParams,
} from "@/lib/rdm/rdmConfig";
import { useUserStore } from "@/store/useUserStore";
import {
  INSTACUE_TYPE_ORDER,
  type InstaCueCardType,
} from "@/lib/instacue/instaCueTypeConfig";
import type { InstaCueCard } from "@/data/instaCueCards";
import type { Board, Subject } from "@/types";
import type { DiveActivityId } from "../diveTypes";
import type { DiveSubtopicCandidate } from "@/lib/dive/suggestBatch";
import { stripFormulaDelimiters } from "@/lib/gyan/stripFormulaDelimiters";
import {
  hasAcceptedSubtopicUndertaking,
  markSubtopicUndertakingAccepted,
} from "@/lib/dive/subtopicUndertaking";
import { loadDiveHubProgress, scorePctFromAnswers, submitDiveAssessment, type DiveHubProgress, type DiveHubProgressScope } from "@/lib/dive/diveHubProgress";
import styles from "../styles";
import FinishSummaryPanel from "./FinishSummaryPanel";
import QuizPlayPanel from "./QuizPlayPanel";
import NumeralPlayPanel from "./NumeralPlayPanel";
import UndertakingDialog from "./UndertakingDialog";
import ConceptsPanel from "./ConceptsPanel";
import ReferencesPanel from "./ReferencesPanel";

type Props = {
  open: DiveActivityId | null;
  onOpenChange: (id: DiveActivityId | null) => void;
  onActivityComplete: (
    id: DiveActivityId,
    detail?: { scorePct?: number; correct?: number; total?: number }
  ) => void;
  onUndertakingAccepted: () => void;
  onProgressSynced: (progress: DiveHubProgress) => void;
  progressScope: DiveHubProgressScope;
  undertakingAccepted: boolean;
  classLevel: 11 | 12;
  subject: Subject;
  board?: Board;
  subtopic: DiveSubtopicCandidate;
};

const CONCEPTS_PER_PAGE = 5;

function mapInstaCueCards(
  raw: SubtopicContentResponse["instacueCards"],
  subject: Subject,
  classLevel: 11 | 12,
  topic: string,
  subtopicName: string
): InstaCueCard[] {
  return raw.map((c, i) => {
    const t = (INSTACUE_TYPE_ORDER.includes(c.type as InstaCueCardType)
      ? c.type
      : "concept") as InstaCueCardType;
    return {
      id: `dive-ic-${i}`,
      type: t,
      frontContent: c.frontContent,
      backContent: c.backContent,
      subtopicName,
      topic,
      subject,
      classLevel,
      level: "advanced",
    };
  });
}

export default function DiveActivityDialogs({
  open,
  onOpenChange,
  onActivityComplete,
  onUndertakingAccepted,
  onProgressSynced,
  progressScope,
  undertakingAccepted,
  classLevel,
  subject,
  board = "CBSE",
  subtopic,
}: Props) {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const setRdmFromProfile = useUserStore((s) => s.setRdmFromProfile);
  const [rdmConfig, setRdmConfig] = useState<RdmConfigParams>(() => ({ ...DEFAULT_RDM_CONFIG }));
  const [content, setContent] = useState<SubtopicContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  /** Avoid refetch loops when numerals stay empty after a forced reload. */
  const numeralsRefetchTriedRef = useRef<string | null>(null);
  /** Same for Learning Outcomes — packs live in a separate table filled after cache. */
  const outcomesRefetchTriedRef = useRef<string | null>(null);
  const [refsUpgradeOpen, setRefsUpgradeOpen] = useState(false);
  const [conceptPage, setConceptPage] = useState(0);
  const [quizPlaySet, setQuizPlaySet] = useState<AdvancedQuizSetIndex | null>(null);
  const [quizQIndex, setQuizQIndex] = useState(0);
  const [quizPicked, setQuizPicked] = useState<string | null>(null);
  const [quizUpsell, setQuizUpsell] = useState(false);
  const [questionBankUnlocked, setQuestionBankUnlocked] = useState(false);
  const [numeralIdx, setNumeralIdx] = useState<number | null>(null);
  const [numeralQ, setNumeralQ] = useState(0);
  const [numeralPicked, setNumeralPicked] = useState<string | null>(null);
  /** Formula indices with a saved practice attempt (done tick on pack cards). */
  const [numeralDoneIdxs, setNumeralDoneIdxs] = useState<Set<number>>(() => new Set());
  const [undertakingOpen, setUndertakingOpen] = useState(false);
  const [undertakingChecked, setUndertakingChecked] = useState(false);
  /** Once accepted for this subtopic (persisted), Quiz + Numerals + Outcomes skip the dialog. */
  const [undertakingPassedForSubtopic, setUndertakingPassedForSubtopic] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [numeralAnswers, setNumeralAnswers] = useState<Record<number, string>>({});
  const [outcomesPlaying, setOutcomesPlaying] = useState(false);
  const [outcomesQIndex, setOutcomesQIndex] = useState(0);
  const [outcomesPicked, setOutcomesPicked] = useState<string | null>(null);
  const [outcomesAnswers, setOutcomesAnswers] = useState<Record<number, string>>({});
  const [finishSummary, setFinishSummary] = useState<{
    activity: "quiz" | "numerals" | "outcomes";
    scorePct: number;
    correct: number;
    total: number;
    rdmLabel: string;
    rdmHighlight: boolean;
  } | null>(null);

  const hubProgress = useMemo(
    () => loadDiveHubProgress(subtopic.id),
    [subtopic.id, finishSummary]
  );

  const lessonPath = useMemo(
    () =>
      buildTopicPath(
        board,
        subject,
        classLevel,
        subtopic.topicTitle,
        subtopic.name,
        "advanced",
        undefined,
        subtopic.chapterTitle
      ),
    [board, subject, classLevel, subtopic]
  );

  const plan = resolvePlanTierFromProfile(profile);
  const userId = profile?.id ?? "anon";
  const hasPaidQuestionBank = hasQuestionBankPlanAccess(plan);

  useEffect(() => {
    setQuestionBankUnlocked(isTopicQuestionBankUnlocked({ userId, lessonPath }));
  }, [userId, lessonPath]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchRdmConfig();
      if (cancelled) return;
      setRdmConfig((prev) => (rdmConfigShallowEqual(prev, next) ? prev : next));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const localOk = hasAcceptedSubtopicUndertaking(userId, lessonPath);
    const accepted = undertakingAccepted || localOk;
    setUndertakingPassedForSubtopic(accepted);
    if (undertakingAccepted && !localOk) {
      markSubtopicUndertakingAccepted(userId, lessonPath);
    }
    setUndertakingOpen(false);
    setUndertakingChecked(false);
  }, [userId, lessonPath, undertakingAccepted]);

  const contentKey = useMemo(
    () =>
      diveContentCacheKey({
        board,
        subject,
        classLevel,
        topic: subtopic.topicTitle,
        subtopicName: subtopic.name,
      }),
    [board, subject, classLevel, subtopic.topicTitle, subtopic.name]
  );

  /** Classes is a local placeholder — never block on network. */
  const needsContentFetch = open != null && open !== "classes";

  const load = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (!opts?.force) {
        const cached = getDiveContentCache(contentKey);
        if (cached) {
          setContent(cached);
          setLoading(false);
          return;
        }
      } else {
        invalidateDiveContentCache(contentKey);
      }
      if (!opts?.silent) setLoading(true);
      try {
        const data = await loadDiveContentOnce(
          contentKey,
          () =>
            fetchSubtopicContent({
              board,
              subject,
              classLevel,
              topic: subtopic.topicTitle,
              subtopicName: subtopic.name,
              level: "advanced",
            }),
          { force: opts?.force }
        );
        setContent(data);
      } catch {
        setContent(null);
        toast({ title: "Could not load subtopic content", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [board, subject, classLevel, subtopic, toast, contentKey]
  );

  // Reset play UI when the open activity changes — separate from content fetch.
  useEffect(() => {
    if (!open) return;
    setConceptPage(0);
    setQuizPlaySet(null);
    setQuizQIndex(0);
    setQuizPicked(null);
    setQuizAnswers({});
    setNumeralIdx(null);
    setNumeralQ(0);
    setNumeralPicked(null);
    setNumeralAnswers({});
    setOutcomesPlaying(false);
    setOutcomesQIndex(0);
    setOutcomesPicked(null);
    setOutcomesAnswers({});
    setFinishSummary(null);
  }, [open]);

  // Single content load path: warm on hub mount; show spinner only when an activity needs it.
  useEffect(() => {
    if (open != null && !needsContentFetch) {
      setLoading(false);
      return;
    }
    const cached = getDiveContentCache(contentKey);
    if (cached) {
      setContent(cached);
      setLoading(false);
      return;
    }
    void load({ silent: open == null });
  }, [open, needsContentFetch, contentKey, load]);

  const instaCards = useMemo(() => {
    if (!content) return [];
    return mapInstaCueCards(
      content.instacueCards,
      subject,
      classLevel,
      subtopic.topicTitle,
      subtopic.name
    );
  }, [content, subject, classLevel, subtopic]);

  const conceptCards = useMemo(() => {
    return [...instaCards].sort(
      (a, b) =>
        INSTACUE_TYPE_ORDER.indexOf(a.type) - INSTACUE_TYPE_ORDER.indexOf(b.type)
    );
  }, [instaCards]);

  const bits = content?.bitsQuestions ?? [];
  const formulas = content?.practiceFormulas ?? [];
  const outcomesQs = content?.learningOutcomesQuestions ?? [];
  const multiSet = isAdvancedMultiSet("advanced", bits.length);
  const qbankUnlocked = questionBankUnlocked;

  // Stale Dive cache can hide numerals that were filled later in DB — force one refetch.
  useEffect(() => {
    if (open !== "numerals" || loading) return;
    if (formulas.length > 0) {
      numeralsRefetchTriedRef.current = null;
      return;
    }
    if (numeralsRefetchTriedRef.current === contentKey) return;
    numeralsRefetchTriedRef.current = contentKey;
    void load({ silent: true, force: true });
  }, [open, formulas.length, contentKey, loading, load]);

  // Stale Dive cache can hide Learning Outcomes packs seeded after the last fetch.
  useEffect(() => {
    if (open !== "outcomes" || loading) return;
    if (outcomesQs.length > 0) {
      outcomesRefetchTriedRef.current = null;
      return;
    }
    if (outcomesRefetchTriedRef.current === contentKey) return;
    outcomesRefetchTriedRef.current = contentKey;
    void load({ silent: true, force: true });
  }, [open, outcomesQs.length, contentKey, loading, load]);

  // Hydrate per-formula done ticks when Numerals opens (same attempt store as RDM claim).
  useEffect(() => {
    if (open !== "numerals" || formulas.length === 0 || !profile?.id) {
      return;
    }
    let cancelled = false;
    const level = progressScope.level ?? "advanced";
    const indices = formulas
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => (f.bitsQuestions?.length ?? 0) > 0)
      .map(({ i }) => i);
    if (indices.length === 0) {
      setNumeralDoneIdxs(new Set());
      return;
    }
    void (async () => {
      try {
        const attempts = await fetchFormulaPracticeAttempts(
          {
            board,
            subject,
            classLevel,
            topic: progressScope.topic,
            subtopicName: progressScope.subtopicName,
            level,
          },
          indices
        );
        if (cancelled) return;
        const done = new Set<number>();
        for (const fi of indices) {
          const fqs = formulas[fi]?.bitsQuestions ?? [];
          const fAtt = attempts[fi];
          if (fAtt && fAtt.bitsSignature === getBitsSignature(fqs)) {
            done.add(fi);
          }
        }
        setNumeralDoneIdxs(done);
      } catch {
        if (!cancelled) setNumeralDoneIdxs(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    formulas,
    profile?.id,
    board,
    subject,
    classLevel,
    progressScope.topic,
    progressScope.subtopicName,
    progressScope.level,
  ]);

  const close = () => onOpenChange(null);

  const markDone = (
    id: DiveActivityId,
    detail?: { scorePct?: number; correct?: number; total?: number }
  ) => {
    onActivityComplete(id, detail);
  };

  const resetQuizPlay = () => {
    setQuizPlaySet(null);
    setQuizQIndex(0);
    setQuizPicked(null);
    setQuizAnswers({});
  };

  const resetNumeralPlay = () => {
    setNumeralIdx(null);
    setNumeralQ(0);
    setNumeralPicked(null);
    setNumeralAnswers({});
  };

  const resetOutcomesPlay = () => {
    setOutcomesPlaying(false);
    setOutcomesQIndex(0);
    setOutcomesPicked(null);
    setOutcomesAnswers({});
  };

  const agreeUndertaking = () => {
    markSubtopicUndertakingAccepted(userId, lessonPath);
    setUndertakingPassedForSubtopic(true);
    setUndertakingChecked(false);
    setUndertakingOpen(false);
    onUndertakingAccepted();
  };

  useEffect(() => {
    if (open !== "quiz" && open !== "numerals" && open !== "outcomes") {
      setUndertakingOpen(false);
      setUndertakingChecked(false);
      return;
    }
    if (undertakingPassedForSubtopic || undertakingAccepted || hasAcceptedSubtopicUndertaking(userId, lessonPath)) {
      if (!undertakingPassedForSubtopic) setUndertakingPassedForSubtopic(true);
      setUndertakingOpen(false);
      return;
    }
    setUndertakingChecked(false);
    setUndertakingOpen(true);
  }, [open, undertakingPassedForSubtopic, userId, lessonPath]);

  // Learning Outcomes: after undertaking (once), jump straight into MCQs — no "Check my level" gate.
  useEffect(() => {
    if (open !== "outcomes") return;
    if (undertakingOpen) return;
    if (!undertakingPassedForSubtopic) return;
    if (loading) return;
    if (finishSummary?.activity === "outcomes") return;
    if (outcomesQs.length === 0) {
      setOutcomesPlaying(false);
      return;
    }
    setOutcomesPlaying(true);
    setOutcomesQIndex(0);
    setOutcomesPicked(null);
    setOutcomesAnswers({});
  }, [
    open,
    undertakingOpen,
    undertakingPassedForSubtopic,
    loading,
    outcomesQs.length,
    finishSummary,
  ]);

  const startQuizSet = (setIndex: AdvancedQuizSetIndex) => {
    const lock = getAdvancedQuizSetLockState(setIndex, {
      plan,
      questionBankUnlocked: qbankUnlocked,
    });
    if (lock.locked) {
      if (lock.reason === "needs_question_bank_unlock") {
        toast({
          title: "Open Question Bank first",
          description: "Tap Open Question Bank to unlock Sets 2–6 for this sub-topic.",
        });
        return;
      }
      setQuizUpsell(true);
      return;
    }
    setQuizAnswers({});
    setQuizPlaySet(setIndex);
    setQuizQIndex(0);
    setQuizPicked(null);
  };

  const handleQuestionBankClick = () => {
    if (!hasPaidQuestionBank) {
      setQuizUpsell((open) => !open);
      return;
    }
    markTopicQuestionBankUnlocked({ userId, lessonPath });
    setQuestionBankUnlocked(true);
    setQuizUpsell(false);
    toast({
      title: "Question bank unlocked",
      description: "Sets 2–6 are ready — start them below.",
    });
  };

  const quizSetQuestions = useMemo((): ArtifactBitsQuestion[] => {
    if (quizPlaySet == null) return [];
    if (!multiSet) return bits;
    const { start, end } = getAdvancedSetBounds(bits.length, quizPlaySet);
    return bits.slice(start, end);
  }, [quizPlaySet, multiSet, bits]);

  const activeFormula: ArtifactFormula | null =
    numeralIdx != null ? formulas[numeralIdx] ?? null : null;

  const finishQuizSet = async () => {
    const setIndex: AdvancedQuizSetIndex = quizPlaySet ?? 1;
    const optimistic = scorePctFromAnswers(quizSetQuestions, quizAnswers);
    const { start } = getAdvancedSetBounds(bits.length, setIndex);
    const quizSetRdm = rdmConfig.subtopic_quiz_set_rdm;
    const quizOverallRdm = rdmConfig.subtopic_quiz_advanced_rdm;
    const isLastSet = isLastNonEmptyAdvancedSet(bits.length, setIndex);
    const isFirstSet = isFirstQuizSetForRdm(setIndex);
    let rdmLabel = quizFinishRdmLabel({
      setIndex,
      setPct: optimistic.scorePct,
      setRdm: quizSetRdm,
      overallRdm: quizOverallRdm,
      isLastSet,
      creditedParts: [],
    });
    let rdmHighlight = false;

    const selectedAnswers: Record<string, number> = {};
    for (let local = 0; local < quizSetQuestions.length; local++) {
      const ans = quizAnswers[local];
      if (ans == null) continue;
      const optIdx = quizSetQuestions[local]?.options.indexOf(ans) ?? -1;
      if (optIdx < 0) continue;
      const globalIdx = multiSet ? start + local : local;
      selectedAnswers[String(globalIdx)] = optIdx;
    }

    try {
      const verified = await submitDiveAssessment({
        scope: progressScope,
        kind: "quiz",
        answers: quizAnswers,
        quizSetIndex: quizPlaySet ?? undefined,
      });
      const scored = verified ?? optimistic;
      if (verified) onProgressSynced(verified.progress);

      // Same attempt store + claim path as classic Lessons topic quiz.
      try {
        const payload: BitsAttemptRecord = {
          board,
          subject,
          classLevel,
          topic: progressScope.topic,
          subtopicName: progressScope.subtopicName,
          level: "advanced",
          bitsSignature: getBitsSignature(bits),
          totalQuestions: scored.total,
          correctCount: scored.correct,
          wrongCount: Math.max(0, scored.total - scored.correct),
          selectedAnswers,
          submittedAt: new Date().toISOString(),
        };
        await saveBitsAttempt(payload, { set: setIndex });

        const creditedParts: string[] = [];
        const setPct =
          scored.total > 0 ? (scored.correct / scored.total) * 100 : 0;
        let setAlreadyClaimed = false;
        let overallAlreadyClaimed = false;
        let overallBelowThreshold = false;
        try {
          // +N only on set 1 at ≥60% — later sets never earn per-set RDM.
          if (isFirstSet && setPct >= 60) {
            const setClaim = await claimQuizSetCompleteRdm({
              board,
              subject,
              classLevel,
              topic: progressScope.topic,
              subtopicName: progressScope.subtopicName,
              level: "advanced",
              quizSet: setIndex,
            });
            if (setClaim.awarded && setClaim.balance != null) {
              setRdmFromProfile(setClaim.balance);
              void refreshProfile();
              creditedParts.push(`+${quizSetRdm} set 1`);
              rdmHighlight = true;
              toast({
                title: `+${quizSetRdm} RDM`,
                description: "Quiz set 1: ≥60%. Credited once for this subtopic.",
              });
            } else if (setClaim.reason === "already_claimed_set") {
              setAlreadyClaimed = true;
            }
          }
        } catch {
          // Set claim failed; still try overall on last set.
        }

        if (isLastSet) {
          try {
            const reward = await applyTopicQuizAdvancedDailyRdmReward(
              {
                board,
                subject,
                classLevel,
                topic: progressScope.topic,
                subtopicName: progressScope.subtopicName,
              },
              { refreshProfile }
            );
            if (reward.awarded) {
              creditedParts.push(`+${quizOverallRdm} overall`);
              rdmHighlight = true;
              toast({
                title: `+${quizOverallRdm} RDM`,
                description:
                  "Topic quiz: ≥60% overall with all sets complete. Credited once for this subtopic.",
              });
            } else if (
              reward.reason === "already_claimed_subtopic" ||
              reward.reason === "already_claimed_today"
            ) {
              overallAlreadyClaimed = true;
              if (creditedParts.length === 0) {
                toast({
                  title: "Overall quiz bonus already claimed",
                  description: `You already earned +${quizOverallRdm} RDM for this subtopic's quiz.`,
                });
              }
            } else if (reward.reason === "below_threshold") {
              overallBelowThreshold = true;
            } else if (
              reward.reason &&
              ![
                "not_multiset_advanced",
                "content_not_found",
                "missing_set_1",
                "missing_set_2",
                "missing_set_3",
                "no_attempts_store",
              ].includes(reward.reason) &&
              !reward.reason.startsWith("missing_set_") &&
              !reward.reason.startsWith("incomplete_or_invalid_counts_set_") &&
              !reward.reason.startsWith("signature_mismatch_set_")
            ) {
              if (creditedParts.length === 0) {
                toast({
                  variant: "destructive",
                  title: "Topic quiz RDM",
                  description: reward.reason,
                });
              }
            }
          } catch {
            // overall claim best-effort
          }
        }

        rdmLabel = quizFinishRdmLabel({
          setIndex,
          setPct,
          setRdm: quizSetRdm,
          overallRdm: quizOverallRdm,
          isLastSet,
          creditedParts,
          setAlreadyClaimed,
          overallAlreadyClaimed,
          overallBelowThreshold,
        });
      } catch {
        rdmLabel = "Sync failed — retry set";
        toast({
          title: "Quiz score saved, but RDM attempt sync failed",
          description: "Retry this set later to credit quiz RDM.",
          variant: "destructive",
        });
      }

      markDone("quiz", scored);
      setFinishSummary({
        activity: "quiz",
        scorePct: scored.scorePct,
        correct: scored.correct,
        total: scored.total,
        rdmLabel,
        rdmHighlight,
      });
    } catch {
      markDone("quiz", optimistic);
      setFinishSummary({
        activity: "quiz",
        scorePct: optimistic.scorePct,
        correct: optimistic.correct,
        total: optimistic.total,
        rdmLabel: "Offline — retry later",
        rdmHighlight: false,
      });
      toast({ title: "Score saved locally — sync when online", variant: "destructive" });
    }
    resetQuizPlay();
  };

  const finishNumerals = async () => {
    const questions = activeFormula?.bitsQuestions ?? [];
    const optimistic = scorePctFromAnswers(questions, numeralAnswers);
    const formulaIndex = numeralIdx;
    const formulaRdm = rdmConfig.subtopic_numerals_formula_rdm;
    const numeralsOverallRdm = rdmConfig.subtopic_numerals_pack_rdm;
    const isFirstPack =
      formulaIndex != null && isFirstNumeralsPackForRdm(formulaIndex, formulas);
    let rdmLabel = numeralsFinishRdmLabel({
      isFirstPack,
      packPct: optimistic.scorePct,
      formulaRdm,
      overallRdm: numeralsOverallRdm,
      allPacksSubmitted: false,
      creditedParts: [],
    });
    let rdmHighlight = false;

    const selectedAnswers: Record<string, number> = {};
    for (let i = 0; i < questions.length; i++) {
      const ans = numeralAnswers[i];
      if (ans == null) continue;
      const optIdx = questions[i]?.options.indexOf(ans) ?? -1;
      if (optIdx < 0) continue;
      selectedAnswers[String(i)] = optIdx;
    }

    try {
      const verified = await submitDiveAssessment({
        scope: progressScope,
        kind: "numerals",
        answers: numeralAnswers,
        formulaIndex: formulaIndex ?? undefined,
      });
      const scored = verified ?? optimistic;
      if (verified) onProgressSynced(verified.progress);

      // Same formula-practice store + pack claim as classic Lessons numerals.
      if (formulaIndex != null && questions.length > 0) {
        try {
          const level = progressScope.level ?? "advanced";
          const payload: BitsAttemptRecord = {
            board,
            subject,
            classLevel,
            topic: progressScope.topic,
            subtopicName: progressScope.subtopicName,
            level,
            bitsSignature: getBitsSignature(questions),
            totalQuestions: scored.total,
            correctCount: scored.correct,
            wrongCount: Math.max(0, scored.total - scored.correct),
            selectedAnswers,
            submittedAt: new Date().toISOString(),
          };
          await saveFormulaPracticeAttempt(payload, formulaIndex);
          setNumeralDoneIdxs((prev) => {
            const next = new Set(prev);
            next.add(formulaIndex);
            return next;
          });

          const creditedParts: string[] = [];
          const packPct =
            scored.total > 0 ? (scored.correct / scored.total) * 100 : 0;
          let formulaAlreadyClaimed = false;
          let overallAlreadyClaimed = false;
          let overallBelowThreshold = false;
          try {
            // +N only on the first formula pack at ≥60%.
            if (isFirstPack && packPct >= 60) {
              const formulaClaim = await claimNumeralsFormulaCompleteRdm({
                board,
                subject,
                classLevel,
                topic: progressScope.topic,
                subtopicName: progressScope.subtopicName,
                level,
                formulaIndex,
              });
              if (formulaClaim.awarded && formulaClaim.balance != null) {
                setRdmFromProfile(formulaClaim.balance);
                void refreshProfile();
                creditedParts.push(`+${formulaRdm} first pack`);
                rdmHighlight = true;
                toast({
                  title: `+${formulaRdm} RDM`,
                  description:
                    "First numerals pack: ≥60%. Credited once for this subtopic.",
                });
              } else if (formulaClaim.reason === "already_claimed_formula") {
                formulaAlreadyClaimed = true;
              }
            }
          } catch {
            // Formula claim failed; still try overall when all packs done.
          }

          const formulaIndices = formulas
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => (f.bitsQuestions?.length ?? 0) > 0)
            .map(({ i }) => i);

          const attempts = await fetchFormulaPracticeAttempts(
            {
              board,
              subject,
              classLevel,
              topic: progressScope.topic,
              subtopicName: progressScope.subtopicName,
              level,
            },
            formulaIndices
          );

          let allWithQuestionsSubmitted = true;
          for (const fi of formulaIndices) {
            const fqs = formulas[fi]?.bitsQuestions ?? [];
            const fSig = getBitsSignature(fqs);
            const fAtt = attempts[fi];
            if (!fAtt || fAtt.bitsSignature !== fSig) {
              allWithQuestionsSubmitted = false;
              break;
            }
          }

          if (allWithQuestionsSubmitted) {
            const packClaim = await claimNumeralsPackCompleteDailyRdm({
              board,
              subject,
              classLevel,
              topic: progressScope.topic,
              subtopicName: progressScope.subtopicName,
              level,
            });
            if (packClaim.awarded && packClaim.balance != null) {
              setRdmFromProfile(packClaim.balance);
              void refreshProfile();
              creditedParts.push(`+${numeralsOverallRdm} overall`);
              rdmHighlight = true;
              toast({
                title: `+${numeralsOverallRdm} RDM`,
                description:
                  "Numerals: ≥60% overall with every formula submitted. Credited once for this subtopic.",
              });
            } else if (
              packClaim.reason === "already_claimed_subtopic" ||
              packClaim.reason === "already_claimed_today"
            ) {
              overallAlreadyClaimed = true;
              if (creditedParts.length === 0) {
                toast({
                  title: "Overall numerals bonus already claimed",
                  description: `You already earned +${numeralsOverallRdm} RDM for this subtopic's numerals.`,
                });
              }
            } else if (packClaim.reason === "below_threshold") {
              overallBelowThreshold = true;
            } else if (
              packClaim.reason &&
              packClaim.reason !== "incomplete_numerals"
            ) {
              if (creditedParts.length === 0) {
                toast({
                  variant: "destructive",
                  title: "Numerals RDM",
                  description: packClaim.reason,
                });
              }
            }
          }

          rdmLabel = numeralsFinishRdmLabel({
            isFirstPack,
            packPct,
            formulaRdm,
            overallRdm: numeralsOverallRdm,
            allPacksSubmitted: allWithQuestionsSubmitted,
            creditedParts,
            formulaAlreadyClaimed,
            overallAlreadyClaimed,
            overallBelowThreshold,
          });
        } catch {
          rdmLabel = "Sync failed — retry pack";
          toast({
            title: "Numerals score saved, but RDM attempt sync failed",
            description: "Retry this pack later to credit numerals RDM.",
            variant: "destructive",
          });
        }
      }

      markDone("numerals", scored);
      setFinishSummary({
        activity: "numerals",
        scorePct: scored.scorePct,
        correct: scored.correct,
        total: scored.total,
        rdmLabel,
        rdmHighlight,
      });
    } catch {
      markDone("numerals", optimistic);
      setFinishSummary({
        activity: "numerals",
        scorePct: optimistic.scorePct,
        correct: optimistic.correct,
        total: optimistic.total,
        rdmLabel: "Offline — retry later",
        rdmHighlight: false,
      });
      toast({ title: "Score saved locally — sync when online", variant: "destructive" });
    }
    resetNumeralPlay();
  };

  const finishOutcomes = async () => {
    const optimistic = scorePctFromAnswers(outcomesQs, outcomesAnswers);
    try {
      const verified = await submitDiveAssessment({
        scope: progressScope,
        kind: "outcomes",
        answers: outcomesAnswers,
      });
      const scored = verified ?? optimistic;
      if (verified) onProgressSynced(verified.progress);
      markDone("outcomes", scored);
      setFinishSummary({
        activity: "outcomes",
        scorePct: scored.scorePct,
        correct: scored.correct,
        total: scored.total,
        rdmLabel: "—",
        rdmHighlight: false,
      });
    } catch {
      markDone("outcomes", optimistic);
      setFinishSummary({
        activity: "outcomes",
        scorePct: optimistic.scorePct,
        correct: optimistic.correct,
        total: optimistic.total,
        rdmLabel: "—",
        rdmHighlight: false,
      });
      toast({ title: "Score saved locally — sync when online", variant: "destructive" });
    }
    resetOutcomesPlay();
  };

  const titleFor = (id: DiveActivityId): string => {
    switch (id) {
      case "details":
        return "Details";
      case "concepts":
        return "Concepts";
      case "instacue":
        return "InstaCue";
      case "quiz":
        return "Quiz";
      case "numerals":
        return "Numerals";
      case "outcomes":
        return "Learning Outcomes";
      case "references":
        return "References";
      case "classes":
        return "Classes";
      default: {
        const _exhaustive: never = id;
        return _exhaustive;
      }
    }
  };

  return (
    <>
      <Dialog
        open={open != null && !undertakingOpen}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <DialogContent
          hideClose={open === "instacue"}
          overlayClassName={
            open === "instacue" ? "bg-slate-950/70 backdrop-blur-[3px]" : undefined
          }
          className={
            open === "instacue"
              ? `${styles.instaDialog} max-h-[min(88vh,760px)] w-[min(440px,calc(100vw-1.5rem))] max-w-md overflow-y-auto p-0 text-[var(--dive-text)] sm:rounded-[18px]`
              : open === "quiz" || open === "numerals" || open === "outcomes"
                ? open === "quiz" && quizPlaySet == null && finishSummary?.activity !== "quiz"
                  ? `${styles.quizDialog} max-h-[min(86vh,640px)] w-[min(640px,calc(100vw-1.5rem))] max-w-2xl overflow-y-auto border-slate-800 !bg-[#0b0f17] p-0 text-[var(--dive-text)] shadow-2xl sm:rounded-2xl`
                  : `${styles.quizDialog} h-[min(80vh,680px)] max-h-[80vh] w-[min(840px,calc(100vw-1.5rem))] max-w-3xl overflow-hidden border-slate-800 !bg-[#0b0f17] p-0 text-[var(--dive-text)] shadow-2xl sm:rounded-2xl`
                : open === "details"
                  ? `${styles.quizDialog} h-[min(88vh,880px)] max-h-[88vh] w-[min(920px,calc(100vw-1.5rem))] max-w-4xl overflow-hidden border-slate-800 !bg-[#0b0f17] p-0 text-[var(--dive-text)] shadow-2xl sm:rounded-2xl`
                  : open === "classes"
                    ? "w-[min(540px,calc(100vw-1.5rem))] max-w-lg overflow-hidden border-slate-800 !bg-[#0b0f17] p-0 text-white shadow-2xl sm:rounded-2xl"
                    : open === "references" || open === "concepts"
                      ? `${styles.quizDialog} max-h-[min(82vh,720px)] w-[min(560px,calc(100vw-1.5rem))] max-w-xl overflow-hidden border-slate-800 !bg-[#0b0f17] p-0 text-[var(--dive-text)] shadow-2xl sm:rounded-2xl`
                      : "h-[min(88vh,860px)] max-h-[88vh] w-[min(840px,calc(100vw-1.5rem))] max-w-3xl overflow-y-auto border-slate-800 !bg-[#0b0f17] p-0 text-[var(--dive-text)] shadow-2xl sm:rounded-2xl sm:max-w-3xl"
          }
        >
          {open === "instacue" ? (
            <>
              <DialogTitle className="sr-only">InstaCue</DialogTitle>
              <div className={styles.instaShellBar}>
                <p className={styles.instaShellLabel}>Study cards</p>
                <button
                  type="button"
                  className={styles.instaShellClose}
                  onClick={close}
                  aria-label="Close InstaCue"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span className={styles.instaShellCloseText}>Close</span>
                </button>
              </div>
            </>
          ) : open === "details" ? (
            <DialogHeader className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 bg-[#0d121c] px-6 py-3.5 pr-14 text-left">
              <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                <span className="text-emerald-400">📖</span>
                <span>Details · {subtopic?.name || "Overview"}</span>
              </DialogTitle>
            </DialogHeader>
          ) : open === "classes" ? (
            <DialogHeader className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 bg-[#0d121c] px-6 py-3.5 pr-14 text-left">
              <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                <span className="text-purple-400">🎥</span>
                <span>Classes · {subtopic?.name || "Live Sessions"}</span>
              </DialogTitle>
            </DialogHeader>
          ) : open === "references" ? (
            <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0d121c] px-6 py-3.5 pr-14 text-left">
              <DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/25"
                  aria-hidden
                >
                  <i className="ti ti-link text-[15px]" />
                </span>
                <span>References</span>
              </DialogTitle>
            </DialogHeader>
          ) : open === "concepts" ? (
            <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0d121c] px-6 py-3.5 pr-14 text-left">
              <DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/25"
                  aria-hidden
                >
                  <i className="ti ti-bulb text-[15px]" />
                </span>
                <span>Concepts</span>
              </DialogTitle>
            </DialogHeader>
          ) : open === "quiz" || open === "numerals" || open === "outcomes" ? (
            <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0d121c] px-6 py-3 pr-14 text-left">
              <DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold leading-none tracking-tight text-white">
                <span
                  className={
                    open === "quiz"
                      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/25"
                      : open === "numerals"
                        ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/25"
                        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/25"
                  }
                  aria-hidden
                >
                  <i
                    className={
                      open === "quiz"
                        ? "ti ti-list-check text-[15px]"
                        : open === "numerals"
                          ? "ti ti-math text-[15px]"
                          : "ti ti-target text-[15px]"
                    }
                  />
                </span>
                <span className="leading-none">{titleFor(open)}</span>
                {open === "quiz" ? (
                  <RdmRewardInfoTip
                    title="Quiz RDM"
                    ariaLabel="Quiz RDM reward details"
                    align="start"
                    triggerClassName="h-5 w-5 border-amber-700/40"
                    lines={quizRdmTipLines(
                      rdmConfig.subtopic_quiz_set_rdm,
                      rdmConfig.subtopic_quiz_advanced_rdm
                    )}
                  />
                ) : null}
                {open === "numerals" ? (
                  <RdmRewardInfoTip
                    title="Numerals RDM"
                    ariaLabel="Numerals RDM reward details"
                    align="start"
                    triggerClassName="h-5 w-5 border-amber-700/40"
                    lines={numeralsRdmTipLines(
                      rdmConfig.subtopic_numerals_formula_rdm,
                      rdmConfig.subtopic_numerals_pack_rdm
                    )}
                  />
                ) : null}
              </DialogTitle>
            </DialogHeader>
          ) : (
            <DialogHeader className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 bg-[#0d121c] px-6 py-3.5 text-left">
              <DialogTitle className="text-sm font-extrabold text-white">
                {open ? titleFor(open) : ""}
              </DialogTitle>
            </DialogHeader>
          )}

          {loading && needsContentFetch ? (
            <div className={styles.aiLoading}>
              <div className={styles.dotSpin} /> Loading…
            </div>
          ) : null}

          {!loading && open === "details" ? (
            <div className={`${styles.quizModalBody} flex flex-col h-full min-h-0`}>
              {content?.theory?.trim() ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                  {/* Topic Title Header Banner */}
                  <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 via-teal-500/5 to-transparent p-4 sm:p-5 shadow-sm">
                    <div className="mb-1.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                        📖 Overview &amp; Core Theory
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {subtopic.topicTitle}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                      {subtopic.name}
                    </h2>
                  </div>

                  {/* Theory Markdown Content */}
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-7 shadow-sm text-slate-200 text-sm sm:text-base leading-relaxed">
                    <TheoryContent theory={content.theory} />
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <strong>No details yet</strong>
                  Overview content for this sub-topic is not generated yet.
                </div>
              )}

              {/* Reviewed Sticky Bottom Bar */}
              <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#0d121c] px-5 py-3.5 sm:px-8 shrink-0">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <i className="ti ti-check-circle text-emerald-400 text-sm" aria-hidden="true" />
                  Complete reading to update progress
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 px-6 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => {
                    markDone("details");
                    close();
                  }}
                >
                  <i className="ti ti-check text-sm" aria-hidden="true" />
                  <span>Mark reviewed</span>
                </button>
              </div>
            </div>
          ) : null}

          {!loading && open === "concepts" ? (
            <ConceptsPanel
              cards={conceptCards}
              page={conceptPage}
              pageSize={CONCEPTS_PER_PAGE}
              onPageChange={setConceptPage}
              onDone={() => {
                markDone("concepts");
                close();
              }}
            />
          ) : null}

          {!loading && open === "instacue" ? (
            <div className={styles.instaShellBody}>
              {instaCards.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No InstaCue cards yet</strong>
                  Flip cards will show here when content is ready.
                </div>
              ) : (
                <InstaCue
                  cards={instaCards}
                  topicName={subtopic.topicTitle}
                  subtopicName={subtopic.name}
                  level="advanced"
                  subject={subject}
                  classLevel={classLevel}
                  onCardValidated={() => markDone("instacue")}
                />
              )}
            </div>
          ) : null}

          {!loading && open === "quiz" ? (
            <div
              className={
                finishSummary?.activity === "quiz"
                  ? `${styles.quizModalBody} ${styles.quizModalBodyScroll}`
                  : quizPlaySet != null
                    ? styles.quizModalBody
                    : `${styles.quizModalBody} overflow-y-auto px-6 py-5 sm:px-7 sm:py-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]`
              }
            >
              {finishSummary?.activity === "quiz" ? (
                <FinishSummaryPanel
                  title="Quiz complete"
                  scorePct={finishSummary.scorePct}
                  correct={finishSummary.correct}
                  total={finishSummary.total}
                  rdmLabel={finishSummary.rdmLabel}
                  rdmHighlight={finishSummary.rdmHighlight}
                  onContinue={() => {
                    setFinishSummary(null);
                    close();
                  }}
                />
              ) : bits.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No quiz questions yet</strong>
                  MCQ sets will appear when Bits content exists for this sub-topic.
                </div>
              ) : quizPlaySet != null ? (
                <QuizPlayPanel
                  questions={quizSetQuestions}
                  index={quizQIndex}
                  picked={quizPicked}
                  onPick={(v) => {
                    setQuizPicked(v);
                    setQuizAnswers((prev) => ({ ...prev, [quizQIndex]: v }));
                  }}
                  onPrev={() => {
                    setQuizQIndex((i) => {
                      const next = Math.max(0, i - 1);
                      setQuizPicked(quizAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onNext={() => {
                    setQuizQIndex((i) => {
                      const next = Math.min(quizSetQuestions.length - 1, i + 1);
                      setQuizPicked(quizAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onBack={resetQuizPlay}
                  onFinish={finishQuizSet}
                  canFinish={
                    quizSetQuestions.length > 0 &&
                    Object.keys(quizAnswers).length >= quizSetQuestions.length
                  }
                />
              ) : (
                <>
                  <TopicQuizInvestorCard
                    subtopicTitle={subtopic.name}
                    subject={subject}
                    set1QuestionCount={
                      multiSet
                        ? getAdvancedSetBounds(bits.length, 1).length
                        : bits.length
                    }
                    onStartSet1={() => startQuizSet(1)}
                    showQuestionBank={multiSet && bits.length > 5 && !qbankUnlocked}
                    questionBankUpsellOpen={quizUpsell}
                    onQuestionBankClick={handleQuestionBankClick}
                    onDismissUpsell={() => setQuizUpsell(false)}
                    upgradeHref={TOPIC_QUESTION_BANK_UPGRADE_PATH}
                    bestScorePct={hubProgress.quizScore}
                    bankSets={
                      multiSet && qbankUnlocked
                        ? ADVANCED_QUIZ_BANK_SET_INDICES.filter(
                            (s) => getAdvancedSetBounds(bits.length, s).length > 0
                          ).map((s) => {
                            const lock = getAdvancedQuizSetLockState(s, {
                              plan,
                              questionBankUnlocked: qbankUnlocked,
                            });
                            const len = getAdvancedSetBounds(bits.length, s).length;
                            return {
                              setIndex: s,
                              questionCount: len,
                              locked: lock.locked,
                              label: `Set ${s}`,
                              sublabel: lock.locked
                                ? "Premium · Starter / Pro"
                                : `${len} questions`,
                              onPlay: () => startQuizSet(s),
                            };
                          })
                        : []
                    }
                    rdmInfo={{
                      badgeAmount: rdmConfig.subtopic_quiz_advanced_rdm,
                      perSetAmount: rdmConfig.subtopic_quiz_set_rdm,
                      overallAmount: rdmConfig.subtopic_quiz_advanced_rdm,
                    }}
                    rdmHint={`+${rdmConfig.subtopic_quiz_set_rdm} RDM on set 1 (≥60%) · +${rdmConfig.subtopic_quiz_advanced_rdm} overall (≥60%, once per subtopic).`}
                  />
                </>
              )}
            </div>
          ) : null}

          {!loading && open === "numerals" ? (
            <div
              className={
                finishSummary?.activity === "numerals"
                  ? `${styles.quizModalBody} ${styles.quizModalBodyScroll}`
                  : activeFormula
                    ? styles.quizModalBody
                    : styles.modalBody
              }
            >
              {finishSummary?.activity === "numerals" ? (
                <FinishSummaryPanel
                  title="Numerals complete"
                  scorePct={finishSummary.scorePct}
                  correct={finishSummary.correct}
                  total={finishSummary.total}
                  rdmLabel={finishSummary.rdmLabel}
                  rdmHighlight={finishSummary.rdmHighlight}
                  onContinue={() => {
                    setFinishSummary(null);
                    close();
                  }}
                />
              ) : formulas.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No numerals yet</strong>
                  Practice formulas will show when content is ready.
                </div>
              ) : activeFormula ? (
                <NumeralPlayPanel
                  formula={activeFormula}
                  qIndex={numeralQ}
                  picked={numeralPicked}
                  onPick={(v) => {
                    setNumeralPicked(v);
                    setNumeralAnswers((prev) => ({ ...prev, [numeralQ]: v }));
                  }}
                  onPrev={() => {
                    setNumeralQ((i) => {
                      const next = Math.max(0, i - 1);
                      setNumeralPicked(numeralAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onNext={() => {
                    setNumeralQ((i) => {
                      const max = Math.max(0, (activeFormula.bitsQuestions.length || 1) - 1);
                      const next = Math.min(max, i + 1);
                      setNumeralPicked(numeralAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onBack={resetNumeralPlay}
                  onFinish={finishNumerals}
                  canFinish={
                    (activeFormula.bitsQuestions.length === 0 && true) ||
                    Object.keys(numeralAnswers).length >= activeFormula.bitsQuestions.length
                  }
                />
              ) : (
                <>
                  {/* ── NUMERALS HERO HEADER ───────────────────────────────── */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "20px",
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #1a1040 0%, #140d35 50%, #0f1729 100%)",
                    border: "1.5px solid rgba(168,85,247,0.25)",
                    boxShadow: "0 4px 20px rgba(168,85,247,0.1)",
                    position: "relative",
                    overflow: "visible",
                  }}>
                    {/* purple glow orb — clipped by its own layer so the RDM tip can overflow */}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        overflow: "hidden",
                        borderRadius: "16px",
                        pointerEvents: "none",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: "-20px", left: "-10px",
                        width: "80px", height: "80px",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)",
                      }} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
                      {/* icon box */}
                      <div style={{
                        width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                        boxShadow: "0 4px 14px rgba(124,58,237,0.45)",
                      }}>
                        <i className="ti ti-math" style={{ fontSize: "18px", color: "#fff" }} aria-hidden="true" />
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#e9d5ff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                          Numerals Pack
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(196,164,255,0.7)", marginTop: "2px" }}>
                          {formulas.length} formula{formulas.length === 1 ? "" : "s"} · Solve &amp; earn
                        </div>
                      </div>
                    </div>

                    {/* Right: score or earn badge */}
                    {hubProgress.numeralScore != null ? (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px",
                        position: "relative",
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(196,164,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Best Score
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                          <span style={{ fontSize: "24px", fontWeight: 900, color: "#4ade80", lineHeight: 1, letterSpacing: "-0.03em" }}>
                            {hubProgress.numeralScore}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80" }}>%</span>
                        </div>
                        <div style={{
                          width: "64px", height: "4px", borderRadius: "2px",
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${hubProgress.numeralScore}%`, height: "100%", borderRadius: "2px",
                            background: "linear-gradient(90deg, #22c55e, #4ade80)",
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "6px 12px", borderRadius: "999px",
                          background: "#2a1f00", border: "1.5px solid #78450a",
                          fontSize: "11.5px", fontWeight: 700, color: "#fbbf24",
                        }}>
                          <i className="ti ti-coin" style={{ fontSize: "13px" }} aria-hidden="true" />
                          +{rdmConfig.subtopic_numerals_pack_rdm} RDM
                        </div>
                        <RdmRewardInfoTip
                          title="Numerals RDM"
                          ariaLabel="Numerals RDM reward details"
                          triggerStyle={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "999px",
                            background: "#2a1f00",
                            border: "1.5px solid #78450a",
                            color: "#fbbf24",
                          }}
                          lines={numeralsRdmTipLines(
                            rdmConfig.subtopic_numerals_formula_rdm,
                            rdmConfig.subtopic_numerals_pack_rdm
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* ── FORMULA CARDS GRID ──────────────────────────────────── */}
                  <div className={styles.numeralGrid}>
                    {formulas.map((f, i) => {
                      const isDone = numeralDoneIdxs.has(i);
                      return (
                      <button
                        key={`${f.name}-${i}`}
                        type="button"
                        className={`${styles.numeralCard}${isDone ? ` ${styles.numeralCardDone}` : ""}`}
                        onClick={() => {
                          setNumeralAnswers({});
                          setNumeralIdx(i);
                          setNumeralQ(0);
                          setNumeralPicked(null);
                        }}
                      >
                        {/* Card top: index badge + title + play icon */}
                        <div className={styles.numeralCardTop}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1, minWidth: 0 }}>
                            <span
                              className={isDone ? styles.numeralIndexDone : undefined}
                              style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: "20px", height: "20px", flexShrink: 0,
                              borderRadius: "6px",
                              background: isDone ? undefined : "rgba(168,85,247,0.15)",
                              border: isDone ? undefined : "1px solid rgba(168,85,247,0.3)",
                              fontSize: "10px", fontWeight: 800,
                              color: isDone ? undefined : "#c084fc",
                              lineHeight: 1,
                              marginTop: "1px",
                            }}>
                              {isDone ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : i + 1}
                            </span>
                            <span className={styles.numeralCardTitle}>{f.name}</span>
                          </div>
                          <span
                            className={`${styles.numeralPlayIcon}${isDone ? ` ${styles.numeralPlayIconDone}` : ""}`}
                            aria-hidden
                          >
                            {isDone ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                          </span>
                        </div>

                        {/* Formula display */}
                        <div className={styles.numeralFormula}>
                          <MathText>{`$$${stripFormulaDelimiters(f.formulaLatex)}$$`}</MathText>
                        </div>

                        {/* Footer */}
                        <div className={styles.numeralCardFoot}>
                          <span style={{ color: "rgba(148,163,184,0.7)", fontWeight: 600, fontSize: "11px" }}>
                            {f.bitsQuestions.length} practice Qs
                          </span>
                          <span
                            className={isDone ? styles.numeralDoneCta : undefined}
                            style={{
                              marginLeft: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              color: isDone ? undefined : "#a78bfa",
                              fontWeight: 700,
                              fontSize: "11.5px",
                            }}
                          >
                            {isDone ? (
                              <>
                                Done
                                <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden />
                              </>
                            ) : (
                              <>
                                Solve
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M7 3.5L9.5 6 7 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </>
                            )}
                          </span>
                        </div>
                      </button>
                      );
                    })}
                  </div>

                  {/* ── RDM REWARD STRIP ───────────────────────────────────── */}
                  <div style={{
                    marginTop: "16px",
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: "#1a1205",
                    border: "1.5px solid #78350f",
                  }}>
                    <div style={{
                      width: "32px", height: "32px", flexShrink: 0, borderRadius: "9px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#92400e", fontSize: "16px",
                    }}>
                      🪙
                    </div>
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#fbbf24", lineHeight: 1.3 }}>
                        +{rdmConfig.subtopic_numerals_pack_rdm} RDM overall
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 500, color: "#92400e", marginTop: "1px" }}>
                        +{rdmConfig.subtopic_numerals_formula_rdm} on first pack at ≥60% · overall once per subtopic at ≥60%
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {!loading && open === "outcomes" ? (
            <div
              className={
                finishSummary?.activity === "outcomes"
                  ? `${styles.quizModalBody} ${styles.quizModalBodyScroll}`
                  : styles.quizModalBody
              }
            >
              {finishSummary?.activity === "outcomes" ? (
                <FinishSummaryPanel
                  title="Learning Outcomes complete"
                  scorePct={finishSummary.scorePct}
                  correct={finishSummary.correct}
                  total={finishSummary.total}
                  rdmLabel={finishSummary.rdmLabel}
                  rdmHighlight={finishSummary.rdmHighlight}
                  onContinue={() => {
                    setFinishSummary(null);
                    close();
                  }}
                />
              ) : outcomesQs.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No Learning Outcomes quiz yet</strong>
                  Self-check MCQs will appear when outcomes content exists for this sub-topic.
                </div>
              ) : (
                <QuizPlayPanel
                  questions={outcomesQs}
                  index={outcomesQIndex}
                  picked={outcomesPicked}
                  onPick={(v) => {
                    setOutcomesPicked(v);
                    setOutcomesAnswers((prev) => ({ ...prev, [outcomesQIndex]: v }));
                  }}
                  onPrev={() => {
                    setOutcomesQIndex((i) => {
                      const next = Math.max(0, i - 1);
                      setOutcomesPicked(outcomesAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onNext={() => {
                    setOutcomesQIndex((i) => {
                      const next = Math.min(outcomesQs.length - 1, i + 1);
                      setOutcomesPicked(outcomesAnswers[next] ?? null);
                      return next;
                    });
                  }}
                  onBack={() => {
                    resetOutcomesPlay();
                    close();
                  }}
                  onFinish={finishOutcomes}
                  canFinish={
                    outcomesQs.length > 0 &&
                    Object.keys(outcomesAnswers).length >= outcomesQs.length
                  }
                  backLabel="← Close"
                />
              )}
            </div>
          ) : null}

          {!loading && open === "references" ? (
            <ReferencesPanel
              plan={plan}
              hasAccess={hasTopicReferencesAccess(plan)}
              references={content?.references ?? []}
              onUpgrade={() => setRefsUpgradeOpen(true)}
              onDone={() => {
                markDone("references");
                close();
              }}
            />
          ) : null}

          {open === "classes" ? (
            <div className="p-6 sm:p-8 text-center flex flex-col items-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-inner">
                <i className="ti ti-video text-2xl" aria-hidden="true" />
              </div>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-purple-300">
                🎥 Live &amp; Recorded Sessions
              </span>
              <h3 className="mb-2 text-base sm:text-lg font-extrabold text-white">
                No classes scheduled yet
              </h3>
              <p className="mb-6 max-w-md text-xs sm:text-sm font-medium leading-relaxed text-slate-400">
                When mentors schedule live interactive sessions or upload video lectures for{" "}
                <strong className="text-slate-200">{subtopic.name}</strong>, they will show up here.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-all hover:bg-slate-700 active:scale-95"
                onClick={close}
              >
                <span>Close Window</span>
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <UndertakingDialog
        open={undertakingOpen}
        checked={undertakingChecked}
        onCheckedChange={setUndertakingChecked}
        onAgree={agreeUndertaking}
        onDismiss={() => {
          setUndertakingOpen(false);
          if (!undertakingPassedForSubtopic) close();
        }}
      />

      <TopicReferencesUpgradeDialog open={refsUpgradeOpen} onOpenChange={setRefsUpgradeOpen} />
    </>
  );
}
