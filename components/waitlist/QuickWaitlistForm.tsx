"use client";

import { useState } from "react";
import {
  Check,
  Eye,
  Heart,
  Info,
  Lock,
  Mail,
  Rocket,
  Smartphone,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WAITLIST_METRICS,
  earlyPreviewSpotsRemaining,
  spotWord,
} from "@/components/waitlist/waitlist-constants";

type Props = {
  email: string;
  phone: string;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSuccess: (waitlistId: string) => void;
  completed: boolean;
  emailInputId?: string;
};

export function QuickWaitlistForm({
  email,
  phone,
  onEmailChange,
  onPhoneChange,
  onSuccess,
  completed,
  emailInputId = "wl-email",
}: Props) {
  const [c3, setC3] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isValid = email.trim() && phone.trim() && c3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || completed) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupTier: "waitlist",
          email,
          phone,
          c3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit. Please try again.");
      }
      onSuccess(data.waitlistId);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to join waitlist. Please check your network connection."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewSpots = earlyPreviewSpotsRemaining();

  if (completed) {
    return (
      <div className="relative overflow-hidden rounded-[14px] border border-[#2A3347]/80 bg-[#161C26] p-4 sm:p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[14px] before:bg-[#1D9E75] before:content-['']">
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#1D9E75] bg-[#0A2A20] px-2.5 py-0.5 text-[11px] font-medium text-[#9FE1CB]">
          <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] text-white">
            ✓
          </span>
          Join the waitlist — done
        </div>
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#1D9E75] bg-[#0A2A20]">
            <Check className="h-6 w-6 text-[#1D9E75]" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-white">You&apos;re on the waitlist!</p>
          <p className="mx-auto mt-2 max-w-[280px] text-xs leading-relaxed text-[#9BA3B8]">
            Confirmation sent to <span className="text-[#1D9E75]">{email}</span>. Complete Step 2 on
            the right to apply as Ambassador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[#2A3347]/80 bg-[#161C26] p-4 sm:p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[14px] before:bg-[#1D9E75] before:content-['']">
      <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#1D9E75] bg-[#0A2A20] px-2.5 py-0.5 text-[11px] font-medium text-[#9FE1CB]">
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[10px] font-medium text-white">
          1
        </span>
        Join the waitlist
      </div>

      <h2 className="mb-1 text-base font-medium text-[#E8EAF0]">
        Get early access — before everyone else
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-[#9BA3B8]">
        Only {previewSpots} early-preview {spotWord(previewSpots)} left. Enter your details now to
        secure your place.
      </p>

      <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-[#1D9E75]/40 bg-gradient-to-r from-[#0A2A20] to-[#0A2A20]/30 px-3 py-[7px] text-xs text-[#9FE1CB] sm:mb-3.5">
        <Users className="h-4 w-4 shrink-0 text-[#1D9E75]" />
        <span>
          <strong className="text-sm text-[#1D9E75]">{WAITLIST_METRICS.waitlistJoined}</strong>{" "}
          students already on the waitlist — spots are filling fast
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="mb-1 flex items-center gap-1 text-[11px] text-[#9BA3B8]">
          <Mail className="h-3.5 w-3.5" />
          Email address <span className="text-[#1D9E75]">*</span>
        </label>
        <div className="relative mb-2.5">
          <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C6480]" />
          <input
            id={emailInputId}
            type="email"
            placeholder="yourname@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-lg border border-[#2A3347]/80 bg-[#1C2333] py-2 pl-9 pr-3 text-[13px] text-[#E8EAF0] outline-none transition focus:border-[#1D9E75] focus:shadow-[0_0_0_2px_rgba(29,158,117,0.15)]"
            required
          />
        </div>

        <label className="mb-1 flex items-center gap-1 text-[11px] text-[#9BA3B8]">
          <Smartphone className="h-3.5 w-3.5" />
          Mobile number <span className="text-[#1D9E75]">*</span>
        </label>
        <div className="relative mb-2.5">
          <Smartphone className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C6480]" />
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full rounded-lg border border-[#2A3347]/80 bg-[#1C2333] py-2 pl-9 pr-3 text-[13px] text-[#E8EAF0] outline-none transition focus:border-[#1D9E75] focus:shadow-[0_0_0_2px_rgba(29,158,117,0.15)]"
            required
          />
        </div>

        <div className="mb-3 flex items-start gap-1.5 rounded-lg border border-[#4a3010] bg-[#281C08] px-2.5 py-2 text-[11px] leading-snug text-[#FAC775]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EF9F27]" />
          <span>
            Please provide accurate email and mobile details so we can reach you for verification
            during ambassador selection. Inaccurate contact details will disqualify your
            application.
          </span>
        </div>

        <div
          role="checkbox"
          aria-checked={c3}
          tabIndex={0}
          onClick={() => setC3(!c3)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setC3(!c3);
            }
          }}
          className={cn(
            "mb-3.5 flex cursor-pointer items-start gap-2 rounded-lg border border-[#2A3347]/80 bg-[#1C2333] px-2.5 py-2 transition-colors",
            c3 && "border-[#1D9E75] bg-[#0A2A20]"
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#344060]",
              c3 && "border-[#1D9E75] bg-[#1D9E75]"
            )}
          >
            {c3 && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
          </div>
          <p className={cn("text-[11px] leading-snug text-[#9BA3B8]", c3 && "text-[#9FE1CB]")}>
            I agree to receive product updates and launch notifications from EduBlast by email and
            SMS. No spam — unsubscribe anytime. <span className="text-[#1D9E75]">*</span>
          </p>
        </div>

        {submitError && (
          <p className="mb-3 rounded-lg border border-rose-900/30 bg-rose-950/20 p-2.5 text-center text-xs text-rose-400">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={!isValid || submitting}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-full border-0 bg-[#1D9E75] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0F6E56] disabled:cursor-default disabled:bg-[#222B3C] disabled:text-[#5C6480]"
        >
          <Rocket className="h-4 w-4" />
          {submitting ? "Saving your spot…" : "Claim my early access spot now"}
        </button>

        <p className="mb-3 flex items-center justify-center gap-1 text-center text-[11px] text-[#5C6480]">
          <Lock className="h-3 w-3" />
          No spam. Your data stays private. Unsubscribe anytime.
        </p>

        <div className="my-3 h-px bg-[#2A3347]/80" />

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: Eye, color: "text-[#1D9E75]", label: "Early preview access" },
            { icon: Heart, color: "text-[#7F77DD]", label: "EduFund grant eligibility" },
            { icon: Star, color: "text-[#EF9F27]", label: "Study rewards" },
          ].map(({ icon: Icon, color, label }) => (
            <div
              key={label}
              className="rounded-lg border border-[#2A3347]/80 bg-[#1C2333] p-2 text-center"
            >
              <Icon className={cn("mx-auto mb-1 h-4 w-4", color)} />
              <div className="text-[10px] leading-snug text-[#9BA3B8]">{label}</div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
