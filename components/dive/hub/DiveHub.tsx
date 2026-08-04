"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { useToast } from "@/hooks/use-toast";
import { syncAllSavedContent } from "@/lib/saved/savedContentService";
import {
  displayClassLabel,
  displaySubjectLabel,
} from "@/lib/dive/chapterWeightage";
import {
  fetchDiveHubProgressFromDb,
  flushDiveHubProgressSave,
  loadDiveHubProgress,
  mergeDiveHubProgress,
  saveDiveHubProgress,
  scheduleDiveHubProgressSave,
  type DiveHubProgress,
  type DiveHubProgressScope,
} from "@/lib/dive/diveHubProgress";
import type { Board, Subject, SavedRevisionUnit } from "@/types";
import type { DiveSubtopicCandidate } from "@/lib/dive/suggestBatch";
import DiveActivityDialogs from "../activities/DiveActivityDialogs";
import { DIVE_TRACKED_ACTIVITY_IDS, type DiveActivityId } from "../diveTypes";
import styles from "../styles";
import DiveButton from "../ui/DiveButton";
import DiveProgressBar from "../ui/DiveProgressBar";
import { buildDiveActivityCards } from "./diveActivityCards";

type Props = {
  classLevel: 11 | 12;
  subject: Subject;
  chapterTitle: string;
  subtopic: DiveSubtopicCandidate;
  board?: Board;
  onBack: () => void;
  onNewDive: () => void;
};

function applyProgressState(
  progress: DiveHubProgress,
  setters: {
    setCompleted: (v: Set<DiveActivityId>) => void;
    setQuizScore: (v: number | null) => void;
    setNumeralScore: (v: number | null) => void;
    setOutcomesScore: (v: number | null) => void;
    setUndertakingAccepted: (v: boolean) => void;
  }
) {
  setters.setCompleted(new Set(progress.completed));
  setters.setQuizScore(progress.quizScore);
  setters.setNumeralScore(progress.numeralScore);
  setters.setOutcomesScore(progress.outcomesScore);
  setters.setUndertakingAccepted(progress.undertakingAccepted);
}

/** Remount on subtopic change so local progress resets without sync setState-in-effect. */
export default function DiveHub(props: Props) {
  return <DiveHubInner key={props.subtopic.id} {...props} />;
}

function DiveHubInner({
  classLevel,
  subject,
  chapterTitle,
  subtopic,
  board = "CBSE",
  onBack,
  onNewDive,
}: Props) {
  const { profile } = useAuth();
  const saveRevisionUnit = useUserStore((s) => s.saveRevisionUnit);
  const savedUnits = useUserStore((s) => s.user?.savedRevisionUnits ?? []);
  const { toast } = useToast();

  const boot = useMemo(() => loadDiveHubProgress(subtopic.id), [subtopic.id]);
  const [completed, setCompleted] = useState<Set<DiveActivityId>>(
    () => new Set(boot.completed)
  );
  const [active, setActive] = useState<DiveActivityId | null>(null);
  const [reviseAdded, setReviseAdded] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(() => boot.quizScore);
  const [numeralScore, setNumeralScore] = useState<number | null>(() => boot.numeralScore);
  const [outcomesScore, setOutcomesScore] = useState<number | null>(() => boot.outcomesScore);
  const [undertakingAccepted, setUndertakingAccepted] = useState(
    () => boot.undertakingAccepted
  );
  /** Block DB writes until first hydrate finishes (avoids empty local overwriting server). */
  const [dbSyncReady, setDbSyncReady] = useState(false);
  const hydrateGen = useRef(0);

  const progressScope = useMemo((): DiveHubProgressScope => {
    return {
      board,
      subject,
      classLevel,
      topic: subtopic.topicTitle,
      subtopicName: subtopic.name,
      level: "advanced",
    };
  }, [board, subject, classLevel, subtopic.topicTitle, subtopic.name]);

  const currentProgress = useMemo((): DiveHubProgress => {
    return {
      completed: Array.from(completed),
      quizScore,
      numeralScore,
      outcomesScore,
      undertakingAccepted,
    };
  }, [completed, quizScore, numeralScore, outcomesScore, undertakingAccepted]);

  // Async DB hydrate only — setState runs in promise callbacks, not sync in the effect body.
  useEffect(() => {
    const gen = ++hydrateGen.current;
    const subtopicId = subtopic.id;
    let cancelled = false;

    void (async () => {
      if (!profile?.id) {
        if (!cancelled && gen === hydrateGen.current) setDbSyncReady(true);
        return;
      }
      try {
        const remote = await fetchDiveHubProgressFromDb(progressScope);
        if (cancelled || gen !== hydrateGen.current) return;
        if (remote) {
          const merged = mergeDiveHubProgress(loadDiveHubProgress(subtopicId), remote);
          saveDiveHubProgress(subtopicId, merged);
          applyProgressState(merged, {
            setCompleted,
            setQuizScore,
            setNumeralScore,
            setOutcomesScore,
            setUndertakingAccepted,
          });
        }
      } catch {
        /* keep local session progress */
      } finally {
        if (!cancelled && gen === hydrateGen.current) setDbSyncReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subtopic.id, profile?.id, progressScope]);

  // Session write always; DB upsert only after hydrate + debounce (204 if unchanged).
  useEffect(() => {
    saveDiveHubProgress(subtopic.id, currentProgress);
    if (!profile?.id || !dbSyncReady) return;
    scheduleDiveHubProgressSave(progressScope, currentProgress);
  }, [dbSyncReady, subtopic.id, currentProgress, profile?.id, progressScope]);

  // Flush pending DB write when leaving this hub / unmounting.
  useEffect(() => {
    return () => {
      if (!profile?.id || !dbSyncReady) return;
      flushDiveHubProgressSave(progressScope, loadDiveHubProgress(subtopic.id));
    };
  }, [profile?.id, dbSyncReady, progressScope, subtopic.id]);

  // Always land at the top of the hub (not the footer / back buttons).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [subtopic.id]);

  const alreadySaved = useMemo(() => {
    return savedUnits.some(
      (u) =>
        u.subject === subject &&
        u.classLevel === classLevel &&
        u.unitName === chapterTitle &&
        u.subtopicName === subtopic.name
    );
  }, [savedUnits, subject, classLevel, chapterTitle, subtopic.name]);

  const cards = useMemo(() => buildDiveActivityCards(), []);

  const completionPct = Math.round(
    (DIVE_TRACKED_ACTIVITY_IDS.filter((id) => completed.has(id)).length /
      DIVE_TRACKED_ACTIVITY_IDS.length) *
      100
  );
  const scores = [quizScore, numeralScore, outcomesScore].filter((s): s is number => s != null);
  const proficiencyPct = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const handleComplete = (
    id: DiveActivityId,
    detail?: { scorePct?: number; correct?: number; total?: number }
  ) => {
    setCompleted((prev) => new Set(prev).add(id));
    if (id === "quiz" && typeof detail?.scorePct === "number") {
      setQuizScore(detail.scorePct);
    }
    if (id === "numerals" && typeof detail?.scorePct === "number") {
      setNumeralScore(detail.scorePct);
    }
    if (id === "outcomes" && typeof detail?.scorePct === "number") {
      setOutcomesScore(detail.scorePct);
    }
  };

  const scoreForCard = (id: DiveActivityId): number | null => {
    if (id === "quiz") return quizScore;
    if (id === "numerals") return numeralScore;
    if (id === "outcomes") return outcomesScore;
    return null;
  };

  const reviseLater = async () => {
    if (!profile?.id) {
      toast({ title: "Sign in to save for revision", variant: "destructive" });
      return;
    }
    if (alreadySaved || reviseAdded) {
      toast({ title: "Already in Revision" });
      return;
    }
    const unit: SavedRevisionUnit = {
      id: `dive-${subject}-${classLevel}-${chapterTitle}-${subtopic.name}`.slice(0, 120),
      board,
      subject,
      classLevel,
      unitName: chapterTitle,
      subtopicName: subtopic.name,
      level: "advanced",
      sectionIndex: 0,
      sectionTitle: subtopic.name,
    };
    saveRevisionUnit(unit);
    setReviseAdded(true);
    await syncAllSavedContent({ immediate: true });
    toast({ title: `Added "${subtopic.name}" to Revision` });
  };

  return (
    <section className={styles.hub}>
      <div className={styles.diveHeader}>
        <div className={styles.diveHeaderMain}>
          <div className={styles.eyebrow}>
            CLASS {displayClassLabel(classLevel)} · {displaySubjectLabel(subject).toUpperCase()} ·{" "}
            {chapterTitle.toUpperCase()}
          </div>
          <h2>{subtopic.name}</h2>
        </div>
        <button
          type="button"
          className={`${styles.reviseBtn} ${reviseAdded || alreadySaved ? styles.reviseAdded : ""}`}
          onClick={() => void reviseLater()}
        >
          {reviseAdded || alreadySaved ? "✓ Added to Revision" : "🔖 Revise Later"}
        </button>
        <div className={styles.subtopicStats}>
          <div className={styles.statBlock}>
            <div className={styles.statBlockTop}>
              <span className={styles.statLabel}>Completion Score</span>
              <span className={styles.statValue}>{completionPct}%</span>
            </div>
            <DiveProgressBar
              valuePct={completionPct}
              variant="completion"
              aria-label="Completion score"
            />
            <div className={styles.statNote}>
              {DIVE_TRACKED_ACTIVITY_IDS.filter((id) => completed.has(id)).length} of{" "}
              {DIVE_TRACKED_ACTIVITY_IDS.length} activities done
            </div>
          </div>
          <div className={styles.statBlock}>
            <div className={styles.statBlockTop}>
              <span className={styles.statLabel}>Proficiency Score</span>
              <span className={styles.statValue}>
                {scores.length ? `${proficiencyPct}%` : "—"}
              </span>
            </div>
            <DiveProgressBar
              valuePct={scores.length ? proficiencyPct : 0}
              variant="proficiency"
              aria-label="Proficiency score"
            />
            <div className={styles.statNote}>
              {scores.length
                ? `based on ${scores.length} of 3 assessments (Quiz${
                    quizScore != null ? ` ${quizScore}%` : ""
                  }${quizScore != null && (numeralScore != null || outcomesScore != null) ? "," : ""}${
                    numeralScore != null ? ` Numerals ${numeralScore}%` : ""
                  }${(quizScore != null || numeralScore != null) && outcomesScore != null ? "," : ""}${
                    outcomesScore != null ? ` Outcomes ${outcomesScore}%` : ""
                  })`
                : "not yet assessed — complete Quiz, Numerals, or Learning Outcomes"}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {cards.map((card) => {
          const done = completed.has(card.id);
          const score = scoreForCard(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`${styles.card} ${done ? styles.cardDone : ""}`}
              onClick={() => setActive(card.id)}
              aria-label={`${card.title}: ${card.cta.replace(/\s*→\s*$/, "")}`}
            >
              <div className={styles.cardTop}>
                <div className={`${styles.cardIcon} ${card.iconClass}`}>{card.icon}</div>
                <div className={styles.cardTopRight}>
                  <span className={`${styles.cardTag} ${done ? styles.cardTagDone : ""}`}>
                    {done ? "Done" : card.tag}
                  </span>
                  {card.rdmTip ? (
                    <span
                      className={styles.rdmInfoWrap}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <span className={styles.rdmInfoIcon} aria-label={card.rdmTip.title}>
                        i
                      </span>
                      <span className={styles.rdmInfoTip} role="tooltip">
                        <span className={styles.rdmInfoTipTitle}>{card.rdmTip.title}</span>
                        <ul className={styles.rdmInfoTipList}>
                          {card.rdmTip.lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles.cardTitle}>
                {done ? <span className={styles.cardDoneCheck}>✓ </span> : null}
                {card.title}
              </div>
              <div className={styles.cardBody}>{card.body}</div>
              {card.id === "references" ? (
                <div className={styles.refRow}>
                  <span className={styles.refPill}>▶ Video</span>
                  <span className={styles.refPill}>🔗 Reading</span>
                </div>
              ) : null}
              <div className={styles.cardFoot}>
                {score != null ? (
                  <span className={styles.cardScoreBadge}>Score {score}%</span>
                ) : done ? (
                  <span className={styles.cardScoreBadge}>Completed</span>
                ) : (
                  <span />
                )}
                <span className={`${styles.cardLink} ${card.linkClass}`}>
                  {done ? (score != null ? "Review →" : "Open →") : card.cta}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.hubFooter}>
        <DiveButton
          type="button"
          variant="outline"
          className={styles.hubFooterBack}
          onClick={onBack}
          aria-label="Back to sub-topics"
        >
          <span className={styles.hubNavBackIcon} aria-hidden>
            <i className="ti ti-arrow-left" />
          </span>
          Back to sub-topics
        </DiveButton>
        <DiveButton
          type="button"
          variant="primary"
          className={styles.hubFooterNew}
          onClick={onNewDive}
          aria-label="Start a new Dive"
        >
          <i className="ti ti-plus text-[15px]" aria-hidden />
          Start a new Dive
        </DiveButton>
      </div>

      <DiveActivityDialogs
        open={active}
        onOpenChange={setActive}
        onActivityComplete={handleComplete}
        onUndertakingAccepted={() => setUndertakingAccepted(true)}
        onProgressSynced={(progress) => {
          applyProgressState(progress, {
            setCompleted,
            setQuizScore,
            setNumeralScore,
            setOutcomesScore,
            setUndertakingAccepted,
          });
          saveDiveHubProgress(subtopic.id, progress);
        }}
        progressScope={progressScope}
        undertakingAccepted={undertakingAccepted}
        classLevel={classLevel}
        subject={subject}
        board={board}
        subtopic={subtopic}
      />
    </section>
  );
}
