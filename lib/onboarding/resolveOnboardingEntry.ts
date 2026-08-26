export type AppOnboardingRole = "student" | "teacher";
export type OnboardingAuthMode = "signin" | "signup" | null;
export type OnboardingStep = "role" | "details";

export type ResolveOnboardingEntryInput = {
  authMode: OnboardingAuthMode;
  urlRole: AppOnboardingRole | null;
  storedIntent: AppOnboardingRole | null;
  profileRole: AppOnboardingRole | null;
  profileTimedOut: boolean;
};

export type ResolveOnboardingEntryResult = {
  role: AppOnboardingRole | null;
  step: OnboardingStep;
};

function isAppRole(value: string | null): value is AppOnboardingRole {
  return value === "student" || value === "teacher";
}

/**
 * Welcome back must not skip to Teacher Profile from leftover whitelist,
 * URL, or sessionStorage. Explicit signup may skip to the chosen form.
 */
export function resolveOnboardingEntry(
  input: ResolveOnboardingEntryInput
): ResolveOnboardingEntryResult {
  if (input.authMode === "signup") {
    const signupRole = input.urlRole ?? input.storedIntent ?? input.profileRole;
    if (isAppRole(signupRole)) {
      return { role: signupRole, step: "details" };
    }
  }

  if (input.profileTimedOut) {
    return { role: "student", step: "details" };
  }

  return { role: null, step: "role" };
}

export function readOnboardingAuthMode(storage: Pick<Storage, "getItem"> | null): OnboardingAuthMode {
  if (!storage) return null;
  try {
    const mode = storage.getItem("auth_mode");
    if (mode === "signin" || mode === "signup") return mode;
  } catch {
    /* ignore */
  }
  return null;
}

export function readStoredOnboardingIntent(
  storage: Pick<Storage, "getItem"> | null
): AppOnboardingRole | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem("auth_intended_role");
    if (stored === "student" || stored === "teacher") return stored;
  } catch {
    /* ignore */
  }
  return null;
}
