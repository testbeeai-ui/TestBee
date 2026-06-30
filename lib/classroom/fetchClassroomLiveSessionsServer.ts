import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergeClassroomLiveSessions,
  type ClassroomLiveSessionRow,
} from "@/lib/classroom/classroomLiveSessions";
import {
  inferNextOccurrenceFromSectionSchedule,
  type SectionScheduleInferInput,
} from "@/lib/teacherPortal/queries/utils";

function occurrenceKey(sectionId: string | null | undefined, scheduledAt: string): string {
  const t = Date.parse(scheduledAt);
  return `${sectionId ?? ""}:${Number.isFinite(t) ? new Date(t).toISOString() : scheduledAt}`;
}

function appendInferredSectionSessions(
  merged: ClassroomLiveSessionRow[],
  sections: Array<
    SectionScheduleInferInput & {
      id: string;
      name: string;
      google_meet_link?: string | null;
      is_active?: boolean | null;
    }
  >,
  classroomId: string,
  nowMs: number
): ClassroomLiveSessionRow[] {
  const keys = new Set(merged.map((s) => occurrenceKey(s.section_id, s.scheduled_at)));
  const inferred: ClassroomLiveSessionRow[] = [];

  for (const sec of sections) {
    if (sec.is_active === false) continue;
    const hit = inferNextOccurrenceFromSectionSchedule(sec, nowMs);
    if (!hit) continue;
    const key = occurrenceKey(sec.id, hit.iso);
    if (keys.has(key)) continue;
    keys.add(key);
    inferred.push({
      id: `inferred:${sec.id}:${hit.iso}`,
      title: `Live lesson · ${sec.name}`,
      scheduled_at: hit.iso,
      duration_minutes: hit.durationMinutes,
      meet_link: sec.google_meet_link ?? null,
      status: "scheduled",
      section_id: sec.id,
      classroom_id: classroomId,
      fromSectionSchedule: true,
    });
  }

  if (inferred.length === 0) return merged;
  return [...merged, ...inferred].sort(
    (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
  );
}

/** Load merged live_sessions + live_class_slots (+ section schedule inference) for a classroom. */
export async function fetchClassroomLiveSessionsForClassroom(
  admin: SupabaseClient,
  classroomId: string,
  options?: {
    /** When set, include whole-class sessions and this section only. When null, show all. */
    viewerSectionId?: string | null;
  }
): Promise<ClassroomLiveSessionRow[]> {
  const [sessionsRes, slotsRes, sectionsRes] = await Promise.all([
    admin
      .from("live_sessions")
      .select(
        "id, title, scheduled_at, duration_minutes, meet_link, status, section_id, classroom_id"
      )
      .eq("classroom_id", classroomId)
      .order("scheduled_at", { ascending: true }),
    (admin as any)
      .from("live_class_slots")
      .select("id, classroom_id, section_id, slot_at, duration_minutes, meet_link, status")
      .eq("classroom_id", classroomId)
      .neq("status", "cancelled")
      .order("slot_at", { ascending: true }),
    admin
      .from("classroom_sections")
      .select(
        "id, name, schedule_date, schedule_time, duration_minutes, repeat_days, schedule_end_date, is_active, google_meet_link"
      )
      .eq("classroom_id", classroomId),
  ]);

  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (sectionsRes.error) throw new Error(sectionsRes.error.message);

  const slotRows = (slotsRes.data ?? []) as unknown as Array<{
    id: string;
    classroom_id: string;
    section_id: string;
    slot_at: string;
    duration_minutes: number;
    meet_link: string | null;
    status: string;
  }>;

  let merged = mergeClassroomLiveSessions(sessionsRes.data ?? [], slotRows);
  merged = appendInferredSectionSessions(
    merged,
    (sectionsRes.data ?? []) as Array<
      SectionScheduleInferInput & {
        id: string;
        name: string;
        google_meet_link?: string | null;
        is_active?: boolean | null;
      }
    >,
    classroomId,
    Date.now()
  );

  const viewerSectionId = options?.viewerSectionId;
  if (viewerSectionId) {
    merged = merged.filter((s) => !s.section_id || s.section_id === viewerSectionId);
  }

  return merged;
}
