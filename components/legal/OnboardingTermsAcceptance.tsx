"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { TermsAndConditionsDialog } from "@/components/legal/TermsAndConditionsDialog";
import { cn } from "@/lib/utils";

type OnboardingTermsAcceptanceProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  /** Primary action (Continue / Create Profile) — shown only after acceptance. */
  action: React.ReactNode;
  className?: string;
};

/**
 * Terms checkbox + in-page dialog. Gates onboarding completion until the user approves.
 */
export function OnboardingTermsAcceptance({
  accepted,
  onAcceptedChange,
  action,
  className,
}: OnboardingTermsAcceptanceProps) {
  return (
    <div className={cn("space-y-4 border-t border-white/10 pt-4", className)}>
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:px-4">
        <Checkbox
          id="onboarding-terms-accept"
          checked={accepted}
          onCheckedChange={(checked) => onAcceptedChange(checked === true)}
          className="mt-0.5 border-white/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          aria-describedby="onboarding-terms-hint"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-zinc-200 sm:text-[15px]">
            <label htmlFor="onboarding-terms-accept" className="cursor-pointer">
              I approve all the{" "}
            </label>
            <TermsAndConditionsDialog
              trigger={
                <button
                  type="button"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Terms and Conditions
                </button>
              }
            />
          </p>
          <p id="onboarding-terms-hint" className="mt-1.5 text-xs text-zinc-500">
            Open the link above to read the full document in a popup.
          </p>
        </div>
      </div>

      {accepted ? (
        action
      ) : (
        <p className="text-center text-xs text-zinc-500 sm:text-left">
          Tick the box above to show Continue.
        </p>
      )}
    </div>
  );
}
