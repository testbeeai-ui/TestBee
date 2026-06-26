"use client";

import { cn } from "@/lib/utils";
import {
  siteTourSnapshotBadgeLabel,
  type SiteTourInfoSlideContent,
} from "@/lib/onboarding/siteTourInfoSlideContent";
import styles from "@/components/onboarding/SiteTourCarousel.module.css";

type SiteTourInfoSlideBodyProps = {
  content: SiteTourInfoSlideContent;
  menuBg: string;
  menuBd: string;
  anim?: boolean;
};

const BADGE_CLASS: Record<string, string> = {
  active: styles.bt,
  rdm: styles.ba,
  info: styles.bb,
  module: styles.bp,
};

export function SiteTourInfoSlideBody({
  content,
  menuBg,
  menuBd,
  anim = false,
}: SiteTourInfoSlideBodyProps) {
  return (
    <>
      <div className={cn(styles.featRow, anim && styles.anim)}>
        <div
          className={styles.featIco}
          style={{
            background: menuBg,
            borderColor: menuBd,
          }}
        >
          <i
            className={cn("ti", content.featureIcon)}
            style={{ color: content.featureIconColor }}
            aria-hidden
          />
        </div>
        <div className={styles.featTxt}>
          <div className={styles.featEy}>{content.eyebrow}</div>
          <div className={styles.featTi}>{content.title}</div>
          <div className={styles.featDe}>{content.description}</div>
        </div>
      </div>

      <div className={cn(styles.snap, anim && styles.anim)}>
        <div className={styles.snapLbl}>
          <i className="ti ti-eye" aria-hidden />
          Feature snapshot
        </div>
        <div className={styles.snapRows}>
          {content.snapshots.map((row) => (
            <div key={row.text} className={styles.sr}>
              <i
                className={cn("ti", row.tablerIcon)}
                style={{ color: row.color }}
                aria-hidden
              />
              <span className={styles.srT}>{row.text}</span>
              {row.badge ? (
                <span className={cn(styles.srB, BADGE_CLASS[row.badge])}>
                  {siteTourSnapshotBadgeLabel(row.badge)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
