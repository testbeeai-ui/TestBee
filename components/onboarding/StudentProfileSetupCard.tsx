"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, UserCircle2 } from "lucide-react";
import { TermsAndConditionsDialog } from "@/components/legal/TermsAndConditionsDialog";
import type { TargetExamKey } from "@/lib/profile/targetExam";
import { cn } from "@/lib/utils";

const PROFILE_EXAM_TARGETS: {
  key: TargetExamKey;
  label: string;
  title: string;
  subtitle: string;
  locked?: boolean;
}[] = [
  { key: "cbse", label: "CBSE Board", title: "CBSE", subtitle: "Board", locked: true },
  { key: "jee_mains", label: "JEE Main", title: "JEE Main", subtitle: "NTA" },
  { key: "jee_advance", label: "JEE Advanced", title: "JEE Adv.", subtitle: "IIT" },
  { key: "kcet", label: "KCET", title: "KCET", subtitle: "Karnataka" },
  { key: "other", label: "Other", title: "Other", subtitle: "Specify later" },
];

const CORE_SUBJECTS = [
  {
    key: "physics",
    label: "Physics",
    desc: "Mechanics, electrostatics, optics, thermodynamics",
  },
  {
    key: "chemistry",
    label: "Chemistry",
    desc: "Organic, inorganic & physical chemistry",
  },
  {
    key: "math",
    label: "Mathematics",
    desc: "Calculus, algebra, geometry, statistics",
  },
] as const;

export type StudentProfileSetupCardProps = {
  name: string;
  onNameChange: (value: string) => void;
  classLevel: 11 | 12;
  onClassLevelChange: (level: 11 | 12) => void;
  targetExams: TargetExamKey[];
  onToggleExam: (exam: TargetExamKey, locked?: boolean) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSignOut?: () => void;
};

export function StudentProfileSetupCard({
  name,
  onNameChange,
  classLevel,
  onClassLevelChange,
  targetExams,
  onToggleExam,
  termsAccepted,
  onTermsAcceptedChange,
  saving,
  onBack,
  onContinue,
  onSignOut,
}: StudentProfileSetupCardProps) {
  return (
    <div className="w-full max-w-[680px] rounded-[20px] border border-[#2A3347] bg-[#161B25] p-7 sm:px-8 flex flex-col gap-6">
      <div className="h-1 overflow-hidden rounded-full bg-[#2A3347]">
        <div
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#7F77DD] to-[#1D9E75]"
          aria-hidden
        />
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#7F77DD] bg-[#171425]">
          <UserCircle2 className="h-5 w-5 text-[#7F77DD]" aria-hidden />
        </div>
        <div>
          <h2 className="text-[22px] font-medium leading-snug text-[#E8EAF0]">
            Set up your profile
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5C6480]">
            Personalises your learning journey and verifies you for EduFund scholarships, awards
            and RDM rewards
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-full-name" className="text-[13px] font-medium text-[#E8EAF0]">
          Full name <span className="text-[#1D9E75]">*</span>
        </label>
        <p className="mb-1.5 text-[11px] text-[#5C6480]">
          As per government ID (Aadhaar / PAN) — required for EduFund grant applications
        </p>
        <input
          id="profile-full-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter your full name"
          className="w-full rounded-lg border border-[#2A3347] bg-[#1C2333] px-3.5 py-2.5 text-[13px] text-[#E8EAF0] outline-none transition-colors placeholder:text-[#5C6480] focus:border-[#7F77DD] focus:shadow-[0_0_0_2px_rgba(127,119,221,0.15)]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#5C6480]">
            Class
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { value: 11 as const, subtitle: "First year" },
                { value: 12 as const, subtitle: "Second year" },
              ] as const
            ).map((cl) => {
              const selected = classLevel === cl.value;
              return (
                <button
                  key={cl.value}
                  type="button"
                  aria-label={`Class ${cl.value}, ${cl.subtitle}`}
                  onClick={() => onClassLevelChange(cl.value)}
                  className={cn(
                    "rounded-xl border px-4 py-3.5 text-left transition-all",
                    selected
                      ? "border-[1.5px] border-[#7F77DD] bg-[#171425]"
                      : "border border-[#2A3347] bg-[#1C2333] hover:border-[#334060] hover:bg-[#222A3A]"
                  )}
                >
                  <div
                    className={cn(
                      "text-[30px] font-bold leading-none",
                      selected ? "text-[#AFA9EC]" : "text-[#E8EAF0]"
                    )}
                  >
                    {cl.value}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-[11px]",
                      selected ? "text-[#AFA9EC]/75" : "text-[#5C6480]"
                    )}
                  >
                    {cl.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#5C6480]">
            Exam targets
          </p>
          <p className="mb-2.5 text-[10px] leading-snug text-[#5C6480]/90">
            Multi-select · CBSE is always included
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PROFILE_EXAM_TARGETS.map((exam) => {
              const selected = targetExams.includes(exam.key);
              return (
                <button
                  key={exam.key}
                  type="button"
                  aria-label={exam.label}
                  aria-pressed={selected}
                  onClick={() => onToggleExam(exam.key, exam.locked)}
                  className={cn(
                    "group flex min-h-[44px] items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left transition-all duration-150",
                    selected
                      ? "border-[#378ADD]/90 bg-[#0D1E30] shadow-[inset_0_1px_0_rgba(133,183,235,0.08)]"
                      : "border-[#2A3347] bg-[#1C2333] hover:border-[#3D4D6A] hover:bg-[#222A3A]",
                    exam.locked && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      selected
                        ? "border-[#378ADD] bg-[#378ADD]"
                        : "border-[#3D4D6A] bg-[#161B25] group-hover:border-[#4A5875]"
                    )}
                  >
                    {selected ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1 leading-none">
                    <span
                      className={cn(
                        "block truncate text-[12px] font-semibold tracking-tight",
                        selected ? "text-[#85B7EB]" : "text-[#E8EAF0]"
                      )}
                    >
                      {exam.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[10px] font-medium",
                        selected ? "text-[#85B7EB]/65" : "text-[#5C6480]"
                      )}
                    >
                      {exam.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#5C6480]">
          Subjects — pick what you study
        </p>
        <div className="flex flex-col gap-2">
          {CORE_SUBJECTS.map((subj) => (
            <div
              key={subj.key}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-[#1D9E75] bg-[#0A2A20] px-4 py-3"
            >
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-[#1D9E75] bg-[#1D9E75]">
                <Check className="h-3.5 w-3.5 text-white" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#9FE1CB]">{subj.label}</p>
                <p className="text-[11px] text-[#9FE1CB]/65">{subj.desc}</p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full border border-[#1D9E75] bg-[#0A2A20] px-2 py-0.5 text-[9px] font-semibold tracking-[0.05em] text-[#9FE1CB]">
                CORE
              </span>
            </div>
          ))}
          <div
            className="pointer-events-none flex items-center gap-3 rounded-xl border border-[#2A3347] bg-[#1C2333] px-4 py-3 opacity-45"
            aria-label="Other subject — coming soon"
          >
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-[#334060]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#5C6480]">Other</p>
              <p className="text-[11px] text-[#5C6480]">Specify when available</p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#2A3347] bg-[#222A3A] px-2 py-0.5 text-[9px] font-semibold tracking-[0.05em] text-[#5C6480]">
              Soon
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors",
          termsAccepted
            ? "border-[#1D9E75] bg-[#1C2333]"
            : "border-[#2A3347] bg-[#1C2333] hover:border-[#334060]"
        )}
      >
        <button
          type="button"
          aria-pressed={termsAccepted}
          aria-label={
            termsAccepted
              ? "Terms and conditions accepted"
              : "Accept terms and conditions"
          }
          onClick={() => onTermsAcceptedChange(!termsAccepted)}
          className={cn(
            "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
            termsAccepted
              ? "border-[#1D9E75] bg-[#1D9E75]"
              : "border-[#334060] bg-transparent"
          )}
        >
          {termsAccepted ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
        </button>
        <div>
          <p className="text-xs leading-relaxed text-[#9BA3B8]">
            <button
              type="button"
              className="text-left text-[#9BA3B8] hover:text-[#E8EAF0]"
              onClick={() => onTermsAcceptedChange(!termsAccepted)}
            >
              I approve all the{" "}
            </button>
            <TermsAndConditionsDialog
              trigger={
                <button
                  type="button"
                  className="font-medium text-[#7F77DD] hover:underline"
                >
                  Terms and Conditions
                </button>
              }
            />{" "}
            and the{" "}
            <Link
              href="/terms-conditions/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#7F77DD] hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
          <p className="mt-1 text-[11px] text-[#5C6480]">
            Click the links above to read the full documents in a popup
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-[20px] border border-[#2A3347] bg-transparent px-5 py-2.5 text-[13px] font-medium text-[#9BA3B8] transition-colors hover:border-[#334060] hover:text-[#E8EAF0]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        <button
          type="button"
          disabled={!termsAccepted || saving}
          onClick={onContinue}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[20px] border-none bg-gradient-to-r from-[#7F77DD] to-[#378ADD] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      <p className="-mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] text-[#5C6480]">
        <Link href="/" className="hover:text-[#9BA3B8] hover:underline">
          Exit to home
        </Link>
        {onSignOut ? (
          <>
            <span className="text-[#334060]">·</span>
            <button
              type="button"
              className="hover:text-[#9BA3B8] hover:underline"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
