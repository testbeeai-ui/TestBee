"use client";

import { CheckCircle2, FileText, Trophy } from "lucide-react";
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
import { cn } from "@/lib/utils";

function RegistrationSuccess() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex max-w-md flex-col items-center gap-7 text-center"
    >
      <div className="flex size-[7.5rem] items-center justify-center rounded-full border border-[#1D9E75]/20 motion-safe:animate-[pulse_3s_ease-in-out_infinite]">
        <div className="flex size-[5.75rem] items-center justify-center rounded-full border border-[#1D9E75]/35">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#1D9E75]/15 shadow-[0_0_32px_rgba(29,158,117,0.35)]">
            <CheckCircle2 className="size-9 text-[#1D9E75]" strokeWidth={2} aria-hidden />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-[#EAEFF5] sm:text-3xl">
          {EDUDECA_REGISTRATION_SUCCESS_TITLE}
        </h1>
        <p className="mx-auto max-w-[22rem] text-sm leading-[1.65] text-[#8B96A5] sm:text-base">
          {EDUDECA_REGISTRATION_SUCCESS_MESSAGE}
        </p>
      </div>
    </div>
  );
}

export function EduDecaRegistrationPanel({
  onSubmitted,
  submitted,
}: {
  onSubmitted?: () => void;
  submitted?: boolean;
}) {
  const [classLevel, setClassLevel] = useState<SignupClassLevel | null>(null);
  const [email, setEmail] = useState("");
  const [college, setCollege] = useState("");
  const [institutionAck, setInstitutionAck] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitted = Boolean(submitted);

  const cities = getCitiesForState(state);
  const profileReady = isSignupProfileReady({
    classLevel,
    college,
    institutionAck,
    state,
    city,
  });

  const trimmedEmail = email.trim();
  const gmailEmailValid = /^[^\s@]+@gmail\.com$/i.test(trimmedEmail);
  const showEmailError = trimmedEmail.length > 0 && !gmailEmailValid;
  const canRegister = profileReady && gmailEmailValid;

  const selectClass = (level: SignupClassLevel) => {
    setClassLevel(level);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!gmailEmailValid) {
      setError("Please enter a valid @gmail.com email");
      return;
    }

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

    try {
      const res = await fetch("/api/edudeca/register-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          class_level: classLevel,
          institution: college,
          state,
          city,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save registration. Please try again.");
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    onSubmitted?.();
  };

  if (isSubmitted) {
    return <RegistrationSuccess />;
  }

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-7">
      <p className="flex items-center gap-2.5 text-left text-sm sm:text-base">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-400/80 bg-amber-500/10">
          <Trophy className="size-3.5 text-amber-400" strokeWidth={2} aria-hidden />
        </span>
        <span className="leading-snug text-amber-400">
          Continue your journey to become a chosen{" "}
          <span className="font-bold text-[#EAEFF5]">Whiz360</span>
        </span>
      </p>

      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-left">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-[#EAEFF5] md:text-3xl">
              Start Today …
            </h1>
            <a
              href="https://drive.google.com/file/d/1SsfvvrY-o5LhSp627YJ5Uz6x1NTrNntg/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-amber-400 underline-offset-4 transition-colors hover:text-amber-300 hover:underline"
            >
              <FileText className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Brochure
            </a>
          </div>
          <p className="max-w-[28rem] text-sm leading-relaxed text-[#8B96A5] sm:text-base">
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
            <label htmlFor="edudeca-email" className="text-sm font-medium text-[#EAEFF5]">
              Email
            </label>
            <Input
              id="edudeca-email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              aria-invalid={showEmailError}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="h-12 rounded-2xl border-[#262E3A] bg-[#0E1117]/80 px-4 text-base text-[#EAEFF5] placeholder:text-[#8B96A5] focus-visible:border-[#1D9E75] focus-visible:ring-[#1D9E75]/20"
            />
            {showEmailError ? (
              <p className="mt-1 text-xs text-red-300">Please enter a valid @gmail.com email</p>
            ) : null}
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
          disabled={!canRegister || submitting}
          className="h-14 w-full rounded-2xl bg-[#1D9E75] text-base font-semibold text-white shadow-[0_4px_14px_rgba(29,158,117,0.35)] transition-colors hover:bg-[#178d68] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Register interest"}
        </button>

        {!canRegister && !submitting ? (
          <p className="text-xs text-[#8B96A5]">Enter your Gmail and complete the remaining profile fields.</p>
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
