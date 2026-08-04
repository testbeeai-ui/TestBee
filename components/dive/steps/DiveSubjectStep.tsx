"use client";

import type { Subject } from "@/types";
import { displayClassLabel } from "@/lib/dive/chapterWeightage";
import styles from "../styles";
import DiveButton from "../ui/DiveButton";

type Props = {
  classLevel: 11 | 12;
  onSelect: (subject: Subject) => void;
  onBack: () => void;
};

const SUBJECTS: {
  subject: Subject;
  name: string;
  meta: string;
  icon: string;
  cardClass: string;
}[] = [
  {
    subject: "physics",
    name: "Physics",
    meta: "Mechanics · E&M · Modern Physics",
    icon: "⚛️",
    cardClass: styles.subjPhy,
  },
  {
    subject: "chemistry",
    name: "Chemistry",
    meta: "Physical · Organic · Inorganic",
    icon: "🧪",
    cardClass: styles.subjChem,
  },
  {
    subject: "math",
    name: "Mathematics",
    meta: "Algebra · Calculus · Coordinate Geo",
    icon: "📐",
    cardClass: styles.subjMath,
  },
];

export default function DiveSubjectStep({ classLevel, onSelect, onBack }: Props) {
  return (
    <section>
      <h1 className={styles.title}>
        Choose a subject{" "}
        <span style={{ color: "var(--dive-teal, #1d9e75)" }}>· Class {displayClassLabel(classLevel)}</span>
      </h1>
      <p className={styles.subtitle}>
        Every subject is tuned to JEE / KCET weightage data and your Board syllabus.
      </p>
      <div className={styles.subjectGrid}>
        {SUBJECTS.map((s) => (
          <button
            key={s.subject}
            type="button"
            className={`${styles.subjCard} ${s.cardClass}`}
            onClick={() => onSelect(s.subject)}
          >
            <div className={styles.subjIcon}>{s.icon}</div>
            <div className={styles.subjName}>{s.name}</div>
            <div className={styles.subjMeta}>{s.meta}</div>
          </button>
        ))}
      </div>
      <nav className={styles.hubNav} aria-label="Dive navigation">
        <DiveButton
          type="button"
          variant="outline"
          className={styles.hubNavBack}
          onClick={onBack}
          aria-label="Back"
        >
          <span className={styles.hubNavBackIcon} aria-hidden>
            <i className="ti ti-arrow-left" />
          </span>
          Back
        </DiveButton>
      </nav>
    </section>
  );
}
