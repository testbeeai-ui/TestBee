import { getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboardDayActivity";
import { dispatchStudyDayBumped } from "@/lib/studyDayBumpEvents";

/**
 * Marks daily checklist (e) after a Refer & Earn “Challenge Yourself” run ends (win or loss).
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
