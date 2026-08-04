"use client";

import styles from "../styles";

type Props = {
  onSelect: (classLevel: 11 | 12) => void;
};

export default function DiveClassStep({ onSelect }: Props) {
  return (
    <section>
      <h1 className={styles.title}>Which class are you diving from?</h1>
      <p className={styles.subtitle}>
        Pick your class to personalise chapters, weightage and difficulty for JEE / KCET / Boards.
      </p>
      <div className={styles.classGrid}>
        <button type="button" className={styles.classCard} onClick={() => onSelect(11)}>
          <div className={`${styles.glow} ${styles.glowXi}`} />
          <div className={`${styles.classBig} ${styles.classBigXi}`}>XI</div>
          <div className={styles.classSub}>Class 11 · Foundation Year</div>
        </button>
        <button type="button" className={styles.classCard} onClick={() => onSelect(12)}>
          <div className={`${styles.glow} ${styles.glowXii}`} />
          <div className={`${styles.classBig} ${styles.classBigXii}`}>XII</div>
          <div className={styles.classSub}>Class 12 · Board + JEE/KCET Year</div>
        </button>
      </div>
    </section>
  );
}
