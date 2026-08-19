"use client";

import { CheckCircle2, Trophy } from "lucide-react";
import { useState } from "react";

import { LocationSelect } from "@/components/edudeca/LocationSelect";
import { Input } from "@/components/ui/input";
import { getCitiesForState, INDIAN_STATES_AND_UTS } from "@/lib/edudeca/india-geo";
import {
  EDUDECA_REGISTRATION_SUCCESS_MESSAGE,
  EDUDECA_REGISTRATION_SUCCESS_TITLE,
  isSignupProfileReady,
  type SignupClassLevel,
} from "@/lib/edudeca/signup-profile";
import {
  EDUDECA_SIGN_IN_STEP,
  EDUDECA_WALKTHROUGH_STEPS,
  type EduDecaWalkthroughAccent,
} from "@/lib/edudeca/walkthrough-steps";
import { cn } from "@/lib/utils";

const ACCENT_CLASSES: Record<EduDecaWalkthroughAccent, string> = {
  teal: "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#9FE1CB]",
  blue: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function StepPill({
  label,
  accent,
  active,
}: {
  label: string;
  accent: EduDecaWalkthroughAccent;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap",
        active ? ACCENT_CLASSES[accent] : "border-[#262E3A] bg-[#0E1117]/50 text-[#8B96A5]",
      )}
    >
      {label}
    </span>
  );
}

function RegistrationSuccess() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-[#1D9E75]/15">
        <CheckCircle2 className="size-7 text-[#1D9E75]" aria-hidden />
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-[#EAEFF5]">{EDUDECA_REGISTRATION_SUCCESS_TITLE}</h2>
        <p className="text-sm leading-relaxed text-[#8B96A5] sm:text-base">
          {EDUDECA_REGISTRATION_SUCCESS_MESSAGE}
        </p>
      </div>
    </div>
  );
}

export function EduDecaRegistrationPanel() {
  const signInStep = EDUDECA_WALKTHROUGH_STEPS[EDUDECA_SIGN_IN_STEP - 1];
  const [classLevel, setClassLevel] = useState<SignupClassLevel | null>(null);
  const [college, setCollege] = useState("");
  const [institutionAck, setInstitutionAck] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cities = getCitiesForState(state);
  const profileReady = isSignupProfileReady({
    classLevel,
    college,
    institutionAck,
    state,
    city,
  });

  const selectClass = (level: SignupClassLevel) => {
    setClassLevel(level);
    setError(null);
  };

  const handleSubmit = async () => {
    if (
      !isSignupProfileReady({
        classLevel,
        college,
        institutionAck,
        state,
        city,
      })
    ) {
      setError("Choose class, college, tick the Level-4 note, and pick state and city to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // UI-only for now — DB wiring comes in a follow-up.
    await new Promise((resolve) => window.setTimeout(resolve, 450));

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return <RegistrationSuccess />;
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6 sm:gap-7">
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-max max-w-full flex-nowrap items-center justify-center gap-2 px-1">
          {EDUDECA_WALKTHROUGH_STEPS.map((step) => (
            <StepPill
              key={step.id}
              label={step.pillLabel}
              accent={step.accent}
              active={step.id <= EDUDECA_SIGN_IN_STEP}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <span className="inline-flex items-center rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#9FE1CB]">
          {signInStep.stepLabel}
        </span>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-sm sm:text-base">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-400/80 bg-amber-500/10">
          <Trophy className="size-3.5 text-amber-400" strokeWidth={2} aria-hidden />
        </span>
        <span className="leading-snug text-amber-400">
          Continue your journey to become a chosen{" "}
          <span className="font-bold text-[#EAEFF5]">Whiz360</span>
        </span>
      </p>

      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-[#EAEFF5] md:text-3xl">Start Today …</h1>
          <p className="text-sm text-[#8B96A5] sm:text-base">
            Register your interest to join the EduDeca competition on EduBlast.
          </p>
        </div>

        <div className="space-y-4 text-left">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#EAEFF5]">Which class are you in?</p>
            <div className="grid grid-cols-2 gap-2">
              {([11, 12] as const).map((level) => {
                const selected = classLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => selectClass(level)}
                    className={cn(
                      "h-12 rounded-2xl border text-sm font-semibold transition-colors",
                      selected
                        ? "border-[#1D9E75] bg-[#1D9E75]/15 text-[#EAEFF5]"
                        : "border-[#262E3A] bg-[#0E1117]/40 text-[#8B96A5] hover:bg-[#0E1117]/70",
                    )}
                    aria-pressed={selected}
                  >
                    Class {level}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edudeca-college" className="text-sm font-medium text-[#EAEFF5]">
              Which college are you from?
            </label>
            <Input
              id="edudeca-college"
              type="text"
              autoComplete="organization"
              placeholder="Your school or college name"
              value={college}
              onChange={(e) => {
                setCollege(e.target.value);
                setError(null);
              }}
              className="h-12 rounded-2xl border-[#262E3A] bg-[#0E1117]/80 px-4 text-base text-[#EAEFF5] placeholder:text-[#8B96A5] focus-visible:border-[#1D9E75] focus-visible:ring-[#1D9E75]/20"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#262E3A] bg-[#0E1117]/40 px-4 py-3">
            <input
              type="checkbox"
              checked={institutionAck}
              onChange={(e) => {
                setInstitutionAck(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 size-4 shrink-0 rounded border-[#262E3A] accent-[#1D9E75]"
            />
            <span className="text-sm leading-snug text-[#8B96A5]">
              I understand that I need approval and support from my Educational Institution from{" "}
              <span className="font-bold text-[#EAEFF5]">Level-4</span> onwards.
            </span>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#EAEFF5]">Your Location (within India)</p>
            <div className="grid grid-cols-2 gap-2">
              <LocationSelect
                label="State"
                placeholder="State"
                value={state}
                options={INDIAN_STATES_AND_UTS}
                onChange={(nextState) => {
                  setState(nextState);
                  setCity("");
                  setError(null);
                }}
              />
              <LocationSelect
                label="City"
                placeholder="City"
                value={city}
                options={cities}
                disabled={!state}
                onChange={(nextCity) => {
                  setCity(nextCity);
                  setError(null);
                }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!profileReady || submitting}
          className="h-14 w-full rounded-2xl bg-[#1D9E75] text-base font-semibold text-white shadow-[0_4px_14px_rgba(29,158,117,0.35)] transition-colors hover:bg-[#178d68] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Register interest"}
        </button>

        {!profileReady && !submitting ? (
          <p className="text-center text-xs text-[#8B96A5]">
            Tick the Level-4 note and select state and city to continue.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
