"use client";

import { NtaRichTextBlock } from "@/components/prep-mock/nta/ntaExamParts";
import {
  parsePyqCoachFormulas,
  parsePyqCoachTips,
  type PyqCoachFormula,
  type PyqCoachTipStep,
} from "@/lib/chapter-pyq/pyqCoach";
import { wrapDisplayTex } from "@/lib/chapter-pyq/pyqWorkedSolution";

const FORMULA_TONES = ["cyan", "indigo", "emerald"] as const;
type FormulaTone = (typeof FORMULA_TONES)[number];

function formulaTone(index: number): FormulaTone {
  return FORMULA_TONES[index % FORMULA_TONES.length] ?? "cyan";
}

function formulaRef(index: number): string {
  return `REF. ${String(index + 1).padStart(2, "0")}`;
}

function TipTimeline({ steps }: { steps: PyqCoachTipStep[] }) {
  return (
    <div className="nta-coach-timeline">
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className="nta-coach-step">
          <span className="nta-coach-node" aria-hidden />
          <div className="nta-coach-card">
            <div className="nta-coach-tag">Move {index + 1}</div>
            <div className="nta-coach-heading">
              <NtaRichTextBlock text={step.title} variant="solution" />
            </div>
            {step.body ? (
              <div className="nta-coach-copy">
                <NtaRichTextBlock text={step.body} variant="solution" />
              </div>
            ) : null}
            {step.callout ? (
              <div className="nta-coach-callout">
                <NtaRichTextBlock text={step.callout} variant="solution" />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function FormulaCodexCards({ items }: { items: PyqCoachFormula[] }) {
  return (
    <div className="nta-codex-stack">
      {items.map((item, index) => (
        <section
          key={`${item.name}-${index}`}
          className="nta-codex-card"
          data-tone={formulaTone(index)}
        >
          <div className="nta-codex-card-meta">
            <div className="nta-codex-card-label">
              <span className="nta-codex-dot" aria-hidden />
              <span className="nta-codex-card-name">
                <NtaRichTextBlock text={item.name} variant="solution" />
              </span>
            </div>
            <span className="nta-codex-ref">{formulaRef(index)}</span>
          </div>
          <div className="nta-codex-sanctuary">
            <div className="nta-codex-sanctuary-glow" aria-hidden />
            <div className="nta-codex-math">
              <NtaRichTextBlock text={wrapDisplayTex(item.tex)} variant="solution" />
            </div>
          </div>
          {item.note ? (
            <div className="nta-codex-note">
              <span className="nta-codex-bullet" aria-hidden>
                •
              </span>
              <div>
                <NtaRichTextBlock text={item.note} variant="solution" />
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function ClosePill({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="nta-codex-close">
      <span className="nta-codex-close-dot" aria-hidden />
      Close
    </button>
  );
}

function TipsBlueprint({
  steps,
  onClose,
}: {
  steps: PyqCoachTipStep[];
  onClose: () => void;
}) {
  return (
    <div
      className="nta-coach-blueprint flex h-auto max-h-[86dvh] w-full flex-col overflow-hidden p-7 shadow-2xl sm:max-h-[min(82vh,44rem)] sm:p-8"
      onClick={(event) => event.stopPropagation()}
    >
      <header className="nta-coach-header flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 id="nta-solution-title" className="nta-coach-title">
            Derivation Path
          </h2>
          <p className="nta-coach-kicker">Step-by-step resolution protocol</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300"
        >
          Close
        </button>
      </header>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain pr-1">
        <TipTimeline steps={steps} />
      </div>
    </div>
  );
}

function FormulaCodex({
  items,
  onClose,
}: {
  items: PyqCoachFormula[];
  onClose: () => void;
}) {
  return (
    <div
      className="nta-formula-codex flex h-auto max-h-[86dvh] w-full flex-col overflow-hidden p-5 sm:max-h-[min(82vh,44rem)] sm:p-7 md:p-9"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="nta-codex-ribbon" aria-hidden />
      <header className="nta-codex-header shrink-0">
        <div className="nta-codex-brand">
          <div className="nta-codex-emblem" aria-hidden>
            f
          </div>
          <div>
            <div className="nta-codex-title-row">
              <h2 id="nta-solution-title" className="nta-codex-title">
                Formula&apos;s
              </h2>
              <span className="nta-codex-badge">Core</span>
            </div>
            <p className="nta-codex-kicker">
              NCERT / JEE Main • Identities from this solution
            </p>
          </div>
        </div>
        <ClosePill onClose={onClose} />
      </header>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain pr-1">
        <FormulaCodexCards items={items} />
      </div>
      <footer className="nta-codex-footer shrink-0">
        <div className="nta-codex-footer-live">
          <span className="nta-codex-pulse" aria-hidden />
          <span>JEE MAIN • METHOD CARDS</span>
        </div>
        <div className="nta-codex-footer-mark">FORMULA CODEX • INVARIANT SYSTEM</div>
      </footer>
    </div>
  );
}

export function NtaCoachSheet({
  kind,
  text,
  onClose,
}: {
  kind: "tips" | "formulas";
  text: string;
  title?: string;
  onClose: () => void;
}) {
  switch (kind) {
    case "tips": {
      const tips = parsePyqCoachTips(text);
      return tips ? <TipsBlueprint steps={tips} onClose={onClose} /> : null;
    }
    case "formulas": {
      const formulas = parsePyqCoachFormulas(text);
      return formulas ? <FormulaCodex items={formulas} onClose={onClose} /> : null;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function coachSheetKind(
  panel: "solution" | "tips" | "formulas" | null,
  text: string
): "tips" | "formulas" | null {
  if (panel === "tips" && parsePyqCoachTips(text)) return "tips";
  if (panel === "formulas" && parsePyqCoachFormulas(text)) return "formulas";
  return null;
}
