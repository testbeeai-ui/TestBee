const DISMISS_KEY_PREFIX = "teacherPortal.teacherWizardDismissedUntil.v1:";

export function teacherWizardDismissStorageKey(teacherId: string): string {
  return `${DISMISS_KEY_PREFIX}${teacherId}`;
}

/** Snooze auto-open Teacher Wizard until `ms` from now (default 1 hour). */
export function dismissTeacherWizardForMs(teacherId: string, ms = 60 * 60 * 1000): void {
  if (typeof window === "undefined" || !teacherId.trim()) return;
  try {
    window.localStorage.setItem(
      teacherWizardDismissStorageKey(teacherId),
      String(Date.now() + Math.max(0, ms))
    );
  } catch {
    // ignore quota / private mode
  }
}

export function isTeacherWizardDismissed(teacherId: string): boolean {
  if (typeof window === "undefined" || !teacherId.trim()) return false;
  try {
    const raw = window.localStorage.getItem(teacherWizardDismissStorageKey(teacherId));
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) {
      window.localStorage.removeItem(teacherWizardDismissStorageKey(teacherId));
      return false;
    }
    if (Date.now() < until) return true;
    window.localStorage.removeItem(teacherWizardDismissStorageKey(teacherId));
    return false;
  } catch {
    return false;
  }
}

export function clearTeacherWizardDismiss(teacherId: string): void {
  if (typeof window === "undefined" || !teacherId.trim()) return;
  try {
    window.localStorage.removeItem(teacherWizardDismissStorageKey(teacherId));
  } catch {
    // ignore
  }
}
