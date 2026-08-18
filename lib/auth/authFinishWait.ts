export type AuthFinishWaitPhase = "redirect" | "wait-profile" | "wait-session";

export function authFinishWaitPhase(input: {
  user: unknown | null | undefined;
  profile: { onboarding_complete?: boolean | null } | null;
}): AuthFinishWaitPhase {
  if (!input.user) return "wait-session";
  if (input.profile === null) return "wait-profile";
  return "redirect";
}

/** Arm the OAuth finish fail timer for both missing session and stuck-null profile. */
export function authFinishShouldArmFailTimer(phase: AuthFinishWaitPhase): boolean {
  switch (phase) {
    case "wait-profile":
    case "wait-session":
      return true;
    case "redirect":
      return false;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
