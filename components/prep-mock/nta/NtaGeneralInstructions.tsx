"use client";

import { useState, type ReactNode } from "react";
import {
  ShapeNotVisited,
  ShapeNotAnswered,
  ShapeAnswered,
  ShapeMarkedOnly,
  ShapeAnsweredMarked,
} from "@/components/prep-mock/nta/ntaPaletteShapes";

export interface NtaInstructionsExamMeta {
  durationMinutes: number;
  questionCount: number;
  markingScheme: string;
  paperTitle: string;
}

interface NtaGeneralInstructionsProps {
  meta: NtaInstructionsExamMeta;
  onBack: () => void;
  onProceed: (declarationAccepted: boolean) => void;
  proceedBusy?: boolean;
}

export function NtaGeneralInstructions({
  meta,
  onBack,
  onProceed,
  proceedBusy,
}: NtaGeneralInstructionsProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [declaration, setDeclaration] = useState(false);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden text-[13px] leading-snug"
      style={{ color: "var(--nta-text)", background: "var(--nta-surface)" }}
    >
      {/* Testbee practice header (no NTA marks) */}
      <header
        className="flex shrink-0 items-center justify-between border-b px-4 py-2"
        style={{ borderColor: "var(--nta-border)", background: "var(--nta-bg)" }}
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-xs font-bold tracking-wide" style={{ color: "var(--nta-muted)" }}>
            Testbee
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "var(--nta-muted)" }}>
            Practice interface — not an official government exam portal
          </div>
        </div>
        <button
          type="button"
          className="text-xs font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--nta-green)" }}
          onClick={onBack}
        >
          Home
        </button>
      </header>

      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2 sm:px-6"
        style={{ background: "var(--nta-bar)", borderColor: "var(--nta-border)" }}
      >
        <h1
          className="text-center text-sm font-bold uppercase sm:flex-1"
          style={{ color: "var(--nta-title-blue)" }}
        >
          General Instructions
        </h1>
        <div className="relative flex items-center gap-2 text-xs">
          <span style={{ color: "var(--nta-muted)" }}>Choose Your Default Language</span>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="rounded border px-2 py-1 font-semibold"
            style={{
              borderColor: "var(--nta-border)",
              background: "var(--nta-bg)",
              color: "var(--nta-text)",
            }}
          >
            English ▾
          </button>
          {langOpen ? (
            <ul
              className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded border py-1 shadow-md"
              style={{ background: "var(--nta-bg)", borderColor: "var(--nta-border)" }}
            >
              <li className="px-3 py-1.5 font-medium">English</li>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: "var(--nta-bg)" }}>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
          <h2 className="mb-4 text-center text-base font-bold" style={{ color: "var(--nta-text)" }}>
            Please read the instructions carefully
          </h2>

          <section className="mb-6 space-y-3">
            <h3 className="font-bold">General Instructions:</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:font-bold">
              <li>
                The total duration of the examination is{" "}
                <strong>{meta.durationMinutes} minutes</strong>.
              </li>
              <li>
                The clock will be set at the server. The countdown timer at the top right corner of
                screen will display the remaining time available to you for the examination. When
                the timer reaches zero, the examination will end by itself.
              </li>
              <li>
                The Question Palette displayed on the right side of screen will show the status of
                each question using one of the following symbols:
              </li>
            </ol>

            <div
              className="my-4 space-y-2 rounded border px-4 py-3"
              style={{ borderColor: "var(--nta-text)", borderStyle: "dashed" }}
            >
              <LegendRow
                shape={<ShapeNotVisited />}
                label={`You have not visited the question yet. (${meta.questionCount} questions in this paper.)`}
              />
              <LegendRow shape={<ShapeNotAnswered />} label="You have not answered the question." />
              <LegendRow shape={<ShapeAnswered />} label="You have answered the question." />
              <LegendRow
                shape={<ShapeMarkedOnly />}
                label="You have NOT answered the question, but have marked the question for review."
              />
              <LegendRow
                shape={<ShapeAnsweredMarked />}
                label="You have answered the question, but marked it for review. The answer will be considered for evaluation unless you change it."
              />
            </div>

            <ol className="list-decimal space-y-2 pl-5 marker:font-bold" start={6}>
              <li>
                You can click on the <strong>&lt;&lt;</strong> and <strong>&gt;&gt;</strong> icons
                to collapse and expand the question palette.
              </li>
            </ol>
          </section>

          <section className="mb-6 space-y-2">
            <h3 className="font-bold">Navigating to a Question:</h3>
            <ol className="list-decimal space-y-2 pl-5" start={7}>
              <li>
                To answer a question, do the following:
                <ol className="mt-2 list-[lower-alpha] space-y-1 pl-5" type="a">
                  <li>
                    Click on the question number in the Question Palette to go to that question
                    directly.
                  </li>
                  <li>
                    Click on <strong>Save &amp; Next</strong> to save your answer for the current
                    question and then go to the next question.
                  </li>
                  <li>
                    Click on <strong>Mark for Review &amp; Next</strong> to save your answer for the
                    current question, mark it for review, and then go to the next question.
                  </li>
                </ol>
              </li>
            </ol>
          </section>

          <section className="mb-6 space-y-2">
            <h3 className="font-bold">Answering a Question:</h3>
            <ol className="list-decimal space-y-2 pl-5" start={8}>
              <li>
                For multiple choice type questions, select the option using the mouse. To change
                your answer, click another option. To save, use <strong>Save &amp; Next</strong>.
              </li>
              <li>
                To clear your answer, use <strong>Clear</strong> for the current question (if
                available).
              </li>
            </ol>
          </section>

          <section className="mb-6 space-y-2">
            <h3 className="font-bold">Navigating through sections:</h3>
            <ol className="list-decimal space-y-2 pl-5" start={10}>
              <li>
                This practice test may present a single section or multiple sections as configured.
              </li>
              <li>Use the question palette to move between questions.</li>
              <li>Submit ends your attempt; you cannot change responses after submitting.</li>
            </ol>
          </section>

          <p className="mb-6 text-sm font-semibold" style={{ color: "var(--nta-red)" }}>
            Please note: question content is shown in your selected language where applicable.
          </p>

          <div
            className="mb-4 rounded border p-4 text-xs"
            style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)" }}
          >
            <p className="mb-1 font-semibold">Paper summary</p>
            <p style={{ color: "var(--nta-muted)" }}>{meta.paperTitle}</p>
            <p className="mt-2" style={{ color: "var(--nta-muted)" }}>
              <strong className="text-[var(--nta-text)]">Duration:</strong> {meta.durationMinutes}{" "}
              min · <strong className="text-[var(--nta-text)]">Questions:</strong>{" "}
              {meta.questionCount} · <strong className="text-[var(--nta-text)]">Marking:</strong>{" "}
              {meta.markingScheme}
            </p>
          </div>

          <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={declaration}
              onChange={(e) => setDeclaration(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span style={{ color: "var(--nta-text)" }}>
              I have read and understood the instructions. I confirm that I am not using
              unauthorised aids. I will follow the timer and submission rules for this practice
              test.
            </span>
          </label>

          <div className="flex justify-center pb-8">
            <button
              type="button"
              disabled={proceedBusy}
              onClick={() => onProceed(declaration)}
              className="min-w-[200px] rounded px-10 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors disabled:opacity-60"
              style={{ background: "var(--nta-green)" }}
            >
              {proceedBusy ? "Please wait…" : "Proceed"}
            </button>
          </div>
        </div>
      </div>

      <footer
        className="shrink-0 py-2 text-center text-xs text-white"
        style={{ background: "var(--nta-footer)" }}
      >
        © Practice mock — Testbee
      </footer>
    </div>
  );
}

function LegendRow({ shape, label }: { shape: ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 pt-0.5">{shape}</span>
      <span style={{ color: "var(--nta-text)" }}>{label}</span>
    </div>
  );
}
