import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveClassDeliveryAwardResult } from "@/lib/teacherPortal/liveClassDeliveryRdm";

/** Credit +base + per-student delivery RDM when a live class slot is booked (no attendance tracking). */
export async function awardLiveClassDeliveryOnSchedule(
  admin: SupabaseClient,
  input: {
    sectionId: string;
    occurrenceAtIso: string;
  }
): Promise<LiveClassDeliveryAwardResult> {
  const { data, error } = await admin.rpc("award_teacher_section_schedule_occurrence_rdm", {
    p_section_id: input.sectionId,
    p_occurrence_at: input.occurrenceAtIso,
    p_awarded_by: "schedule",
    p_force_before_end: true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return (data ?? { ok: false, error: "empty_award_response" }) as LiveClassDeliveryAwardResult;
}
