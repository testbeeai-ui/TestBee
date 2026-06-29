import { supabase } from "@/integrations/supabase/client";
import { mergeClassroomLiveSessions } from "@/lib/classroom/classroomLiveSessions";
import { safeGetSession } from "@/lib/auth/safeSession";

/** Client-safe live session shape (classroom Home / Live tab). */
export type LiveSession = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string | null;
  status: string;
  section_id?: string | null;
  fromLiveClassSlot?: boolean;
  fromSectionSchedule?: boolean;
};

async function fetchClassroomLiveSessionsClientFallback(
  classroomId: string
): Promise<LiveSession[]> {
  const [{ data: sessions }, { data: slots }] = await Promise.all([
    supabase
      .from("live_sessions")
      .select("id, title, scheduled_at, duration_minutes, meet_link, status, section_id")
      .eq("classroom_id", classroomId)
      .order("scheduled_at", { ascending: true }),
    (supabase as any)
      .from("live_class_slots")
      .select("id, classroom_id, section_id, slot_at, duration_minutes, meet_link, status")
      .eq("classroom_id", classroomId)
      .neq("status", "cancelled")
      .order("slot_at", { ascending: true }),
  ]);
  return mergeClassroomLiveSessions(
    (sessions as LiveSession[]) ?? [],
    slots ?? []
  ) as LiveSession[];
}

/** Fetch merged live sessions for a classroom (server API + client fallback). */
export async function fetchClassroomLiveSessionsClient(
  classroomId: string
): Promise<LiveSession[]> {
  const headers: HeadersInit = {};
  const currentSession = (await safeGetSession()).session;
  if (currentSession?.access_token) {
    headers.Authorization = `Bearer ${currentSession.access_token}`;
  }
  try {
    const res = await fetch(`/api/classroom/${classroomId}/live-sessions`, {
      credentials: "include",
      headers,
    });
    if (res.ok) {
      const data = (await res.json()) as { liveSessions?: LiveSession[] };
      return data.liveSessions ?? [];
    }
  } catch {
    // fall through
  }
  return fetchClassroomLiveSessionsClientFallback(classroomId);
}
