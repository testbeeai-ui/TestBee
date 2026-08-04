"use client";

import { Lock } from "lucide-react";
import type { DeepDiveReference } from "@/data/deepDiveContent";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";
import styles from "../styles";
import DiveButton from "../ui/DiveButton";

type ReferencesPanelProps = {
  plan: SubscriptionPlanKey;
  hasAccess: boolean;
  references: DeepDiveReference[];
  onUpgrade: () => void;
  onDone: () => void;
};

export default function ReferencesPanel({
  plan,
  hasAccess,
  references,
  onUpgrade,
  onDone,
}: ReferencesPanelProps) {
  if (!hasAccess) {
    const planLabel =
      plan === "free_trial" ? "Free Trial" : plan === "free" ? "Free" : plan;
    return (
      <div className={styles.refsPanel}>
        <div className={styles.premiumGate} role="status">
          <div className={styles.premiumGateInner}>
            <div className={styles.premiumGateTopRow}>
              <div className={styles.premiumGateIcon} aria-hidden>
                <Lock className="h-5 w-5" />
              </div>
              <span className={styles.premiumGatePlanBadge}>
                Current: <strong>{planLabel}</strong>
              </span>
            </div>

            <div className={styles.premiumGateHeadline}>
              <strong className={styles.premiumGateTitle}>
                References unlock on Starter &amp; Pro
              </strong>
              <p className={styles.premiumGateCopy}>
                Curated videos and reading links for this sub-topic appear automatically — no extra
                unlock click needed.
              </p>
            </div>

            <div className={styles.premiumGateDivider} />

            <ul className={styles.premiumGateList}>
              <li>
                <span className={styles.premiumGateCheck}>✓</span>
                <span>Video references for this exact sub-topic</span>
              </li>
              <li>
                <span className={styles.premiumGateCheck}>✓</span>
                <span>Curated reading &amp; article links</span>
              </li>
              <li>
                <span className={styles.premiumGateCheck}>✓</span>
                <span>Same access as premium quiz sets 2–6</span>
              </li>
            </ul>

            <button type="button" className={styles.premiumGateCta} onClick={onUpgrade}>
              <Lock className="h-4 w-4" aria-hidden />
              View Starter &amp; Pro plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!references.length) {
    return (
      <div className={styles.refsPanel}>
        <div className={styles.refsEmpty}>
          <strong>No references yet</strong>
          <p>
            You have Starter/Pro access. Curated videos and readings will appear here when available
            for this sub-topic.
          </p>
        </div>
        <div className={styles.refsFooter}>
          <DiveButton variant="primary" onClick={onDone}>
            Done
          </DiveButton>
        </div>
      </div>
    );
  }

  const planName = plan === "pro" ? "Pro" : "Starter";

  return (
    <div className={styles.refsPanel}>
      <div className={styles.refsScroll}>
        <p className={styles.refsPlanNote}>Included with your {planName} plan</p>
        <ul className={styles.refsList}>
          {references.map((r, i) => {
            const isVideo = r.type === "video";
            return (
              <li key={`${r.url}-${i}`} className={styles.refsCard}>
                <div className={styles.refsCardTop}>
                  <span
                    className={
                      isVideo ? styles.refsTypeVideo : styles.refsTypeReading
                    }
                  >
                    {isVideo ? "Video" : "Reading"}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.refsOpenLink}
                  >
                    Open
                    <i className="ti ti-external-link text-[12px]" aria-hidden />
                  </a>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.refsTitle}
                >
                  {r.title}
                </a>
                {r.description ? (
                  <p className={styles.refsDesc}>{r.description}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.refsFooter}>
        <DiveButton variant="primary" onClick={onDone}>
          Done
        </DiveButton>
      </div>
    </div>
  );
}
