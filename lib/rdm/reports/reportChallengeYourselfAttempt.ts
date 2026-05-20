import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboard/dashboardDayActivity";
import { dispatchStudyDayBumped } from "@/lib/dashboard/studyDayBumpEvents";

/**
 * Marks daily checklist (e) after an Earn & Learn “Challenge Yourself” run ends (win or loss).
 * Idempotent for the day; fire-and-forget on failure.
 */
export async function reportChallengeYourselfAttempt(): Promise<void> {
  try {
    const { today } = localDayBoundsIso();
    const headers = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/daily-checklist", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "challenge_yourself_attempt", today }),
    });
    if (res.ok) {
      dispatchStudyDayBumped({ day: today, deltaMs: 0 });
    } else {
      await res.text().catch(() => "");
    }
  } catch {
    /* non-fatal */
  }
}
