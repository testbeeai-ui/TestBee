"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Subject } from "@/types";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { DiveSubtopicCandidate } from "@/lib/dive/suggestBatch";
import DiveClassStep from "./steps/DiveClassStep";
import DiveSubjectStep from "./steps/DiveSubjectStep";
import DiveChapterStep from "./steps/DiveChapterStep";
import DiveHub from "./hub/DiveHub";
import type { DiveStep } from "./diveTypes";
import {
  clearDiveWizardState,
  loadDiveWizardState,
  saveDiveWizardState,
  type DiveChapterSession,
} from "@/lib/dive/diveSessionStorage";
import { clearDiveContentCache } from "@/lib/dive/diveContentCache";
import styles from "./styles";

function scrollDiveToTop(anchor: HTMLElement | null) {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const scroller = document.scrollingElement;
  if (scroller) scroller.scrollTop = 0;
  if (anchor) {
    anchor.scrollIntoView({ block: "start", behavior: "auto" });
  }
}

export default function DiveWizard() {
  const { taxonomy, loading, error } = useTopicTaxonomy();
  const topRef = useRef<HTMLDivElement>(null);
  const didRestore = useRef(false);

  const [step, setStep] = useState<DiveStep>(1);
  const [maxReached, setMaxReached] = useState<DiveStep>(1);
  const [classLevel, setClassLevel] = useState<11 | 12>(11);
  const [subject, setSubject] = useState<Subject>("physics");
  const [chapterTitle, setChapterTitle] = useState("");
  const [subtopic, setSubtopic] = useState<DiveSubtopicCandidate | null>(null);
  const [chapterSession, setChapterSession] = useState<DiveChapterSession | null>(null);
  const [ready, setReady] = useState(false);

  // Restore once from sessionStorage (client only)
  useLayoutEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    const saved = loadDiveWizardState();
    if (saved) {
      setStep(saved.step);
      setMaxReached(saved.maxReached);
      setClassLevel(saved.classLevel);
      setSubject(saved.subject);
      setChapterTitle(saved.chapterTitle);
      setSubtopic(saved.subtopic);
      setChapterSession(saved.chapterSession);
    }
    setReady(true);
    // Scroll after restore so Dive In always opens at the top
    requestAnimationFrame(() => scrollDiveToTop(topRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    scrollDiveToTop(topRef.current);
  }, [step, ready]);

  useEffect(() => {
    if (!ready) return;
    saveDiveWizardState({
      step,
      maxReached,
      classLevel,
      subject,
      chapterTitle,
      subtopic,
      chapterSession,
    });
  }, [ready, step, maxReached, classLevel, subject, chapterTitle, subtopic, chapterSession]);

  const goToStep = useCallback((next: DiveStep) => {
    setStep(next);
  }, []);

  const selectClass = (lvl: 11 | 12) => {
    setClassLevel(lvl);
    setChapterTitle("");
    setSubtopic(null);
    setChapterSession(null);
    setMaxReached(2);
    setStep(2);
  };

  const selectSubject = (s: Subject) => {
    setSubject(s);
    setChapterTitle("");
    setSubtopic(null);
    setChapterSession(null);
    setMaxReached(3);
    setStep(3);
  };

  const handleChapterChange = (ch: string) => {
    setChapterTitle(ch);
    setSubtopic(null);
    setChapterSession((prev) => (prev && prev.chapterTitle === ch ? prev : null));
  };

  const diveIn = () => {
    if (!subtopic) return;
    setMaxReached(4);
    setStep(4);
  };

  const newDive = () => {
    clearDiveWizardState();
    clearDiveContentCache();
    setStep(1);
    setMaxReached(1);
    setChapterTitle("");
    setSubtopic(null);
    setChapterSession(null);
  };

  const stepMeta: { n: DiveStep; label: string }[] = [
    { n: 1, label: "Class" },
    { n: 2, label: "Subject" },
    { n: 3, label: "Chapter & Sub-topics" },
    { n: 4, label: "Dive In" },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.wrap} ref={topRef}>
        <div className={styles.stepper}>
          {stepMeta.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            const clickable = s.n <= maxReached;
            return (
              <span key={s.n} style={{ display: "contents" }}>
                {i > 0 ? <span className={styles.sep}>›</span> : null}
                <button
                  type="button"
                  className={`${styles.step} ${active ? styles.stepActive : ""} ${done && !active ? styles.stepDone : ""}`}
                  disabled={!clickable}
                  onClick={() => {
                    if (clickable) goToStep(s.n);
                  }}
                >
                  <span className={styles.stepNum}>{done && !active ? "✓" : s.n}</span>
                  {s.label}
                </button>
              </span>
            );
          })}
          <span className={styles.diveTag} style={{ marginLeft: "auto" }}>
            Dive · Deep-Dive Learning
          </span>
        </div>

        {!ready ? (
          <div className={styles.aiLoading}>
            <div className={styles.dotSpin} /> Loading…
          </div>
        ) : null}

        {ready && loading && step >= 3 ? (
          <div className={styles.aiLoading}>
            <div className={styles.dotSpin} /> Loading syllabus…
          </div>
        ) : null}

        {ready && error && step >= 3 ? <div className={styles.errorBox}>{error}</div> : null}

        {ready && step === 1 ? <DiveClassStep onSelect={selectClass} /> : null}
        {ready && step === 2 ? (
          <DiveSubjectStep
            classLevel={classLevel}
            onSelect={selectSubject}
            onBack={() => goToStep(1)}
          />
        ) : null}
        {ready && step === 3 && !loading ? (
          <DiveChapterStep
            taxonomy={taxonomy}
            classLevel={classLevel}
            subject={subject}
            chapterTitle={chapterTitle}
            onChapterChange={handleChapterChange}
            selectedSubtopic={subtopic}
            onSelectSubtopic={setSubtopic}
            chapterSession={chapterSession}
            onChapterSessionChange={setChapterSession}
            onDiveIn={diveIn}
            onBack={() => goToStep(2)}
          />
        ) : null}
        {ready && step === 4 && subtopic ? (
          <DiveHub
            classLevel={classLevel}
            subject={subject}
            chapterTitle={chapterTitle}
            subtopic={subtopic}
            onBack={() => goToStep(3)}
            onNewDive={newDive}
          />
        ) : null}
      </div>
    </div>
  );
}
