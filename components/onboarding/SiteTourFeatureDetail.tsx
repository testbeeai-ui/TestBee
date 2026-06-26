"use client";

import { cn } from "@/lib/utils";
import {
  snapshotBadgeLabel,
  type SiteTourSubFeature,
} from "@/lib/onboarding/siteTourCarouselData";
import styles from "@/components/onboarding/SiteTourCarousel.module.css";

type SiteTourFeatureDetailProps = {
  sub: SiteTourSubFeature;
  menuBg: string;
  menuBd: string;
  globalIndex: number;
  globalTotal: number;
  anim?: boolean;
};

export function SiteTourFeatureDetail({
  sub,
  menuBg,
  menuBd,
  globalIndex,
  globalTotal,
  anim = false,
}: SiteTourFeatureDetailProps) {
  return (
    <>
      <div className={cn(styles.featRow, anim && styles.anim)}>
        <div
          className={styles.featIco}
          style={{ background: menuBg, borderColor: menuBd }}
        >
          <i className={cn("ti", sub.ico)} style={{ color: sub.c }} aria-hidden />
        </div>
        <div className={styles.featTxt}>
          <div className={styles.featEy}>
            {sub.ey} · {globalIndex + 1} of {globalTotal}
          </div>
          <div className={styles.featTi}>{sub.ti}</div>
          <div className={styles.featDe}>{sub.de}</div>
        </div>
      </div>

      <div className={cn(styles.snap, anim && styles.anim)}>
        <div className={styles.snapLbl}>
          <i className="ti ti-eye" aria-hidden />
          Feature snapshot
        </div>
        <div className={styles.snapRows}>
          {sub.rows.map((row) => (
            <div key={row.t} className={styles.sr}>
              <i className={cn("ti", row.i)} style={{ color: row.c }} aria-hidden />
              <span className={styles.srT}>{row.t}</span>
              {row.b ? (
                <span
                  className={cn(
                    styles.srB,
                    row.b === "bt" && styles.bt,
                    row.b === "ba" && styles.ba,
                    row.b === "bb" && styles.bb,
                    row.b === "bp" && styles.bp
                  )}
                >
                  {snapshotBadgeLabel(row.b)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
