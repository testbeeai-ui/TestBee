/** Unified live session row for classroom Home / Live tab (live_sessions + live_class_slots). */

export type ClassroomLiveSessionRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string | null;
  status: string;
  section_id?: string | null;
  classroom_id?: string;
  /** When true, id refers to live_class_slots and join API expects slotId. */
  fromLiveClassSlot?: boolean;
  /** Inferred from section Google Calendar / repeat schedule (not a DB row). */
  fromSectionSchedule?: boolean;
};

type LiveSessionSource = {
  id: string;
  title?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meet_link?: string | null;
  status?: string | null;
  section_id?: string | null;
  classroom_id?: string;
};

type LiveClassSlotSource = {
  id: string;
  classroom_id: string;
  section_id: string;
  slot_at: string;
  duration_minutes: number;
  meet_link?: string | null;
  status?: string | null;
};

function isCancelledStatus(status: unknown): boolean {
  const st = typeof status === "string" ? status.trim().toLowerCase() : "";
  return st === "cancelled" || st === "canceled";
}

function occurrenceKey(sectionId: string | null | undefined, scheduledAt: string): string {
  const t = Date.parse(scheduledAt);
  return `${sectionId ?? ""}:${Number.isFinite(t) ? new Date(t).toISOString() : scheduledAt}`;
}

/** Merge legacy live_sessions with booked live_class_slots; slots win on duplicate occurrence. */
export function mergeClassroomLiveSessions(
  sessions: LiveSessionSource[] | null | undefined,
  slots: LiveClassSlotSource[] | null | undefined
): ClassroomLiveSessionRow[] {
  const slotRows: ClassroomLiveSessionRow[] = (slots ?? [])
    .filter((s) => !isCancelledStatus(s.status))
    .map((s) => ({
      id: s.id,
      title: "Live lesson",
      scheduled_at: s.slot_at,
      duration_minutes: s.duration_minutes,
      meet_link: s.meet_link ?? null,
      status: s.status ?? "scheduled",
      section_id: s.section_id,
      classroom_id: s.classroom_id,
      fromLiveClassSlot: true,
    }));

  const slotKeys = new Set(
    slotRows.map((s) => occurrenceKey(s.section_id, s.scheduled_at))
  );

  const sessionRows: ClassroomLiveSessionRow[] = (sessions ?? [])
    .filter((s) => !isCancelledStatus(s.status))
    .filter((s) => !slotKeys.has(occurrenceKey(s.section_id, s.scheduled_at)))
    .map((s) => ({
      id: s.id,
      title: (s.title ?? "").trim() || "Live lesson",
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes,
      meet_link: s.meet_link ?? null,
      status: s.status ?? "scheduled",
      section_id: s.section_id ?? null,
      classroom_id: s.classroom_id,
      fromLiveClassSlot: false,
    }));

  return [...sessionRows, ...slotRows].sort(
    (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
  );
}

/** Upcoming / in-progress sessions (not ended per join window). */
export function upcomingClassroomLiveSessions(
  rows: ClassroomLiveSessionRow[],
  nowMs: number = Date.now()
): ClassroomLiveSessionRow[] {
  return rows.filter((s) => {
    const start = Date.parse(s.scheduled_at);
    if (!Number.isFinite(start)) return false;
    const joinUntil = start + (s.duration_minutes + 15) * 60 * 1000;
    return nowMs <= joinUntil;
  });
}

export function nearestUpcomingClassroomLiveSession(
  rows: ClassroomLiveSessionRow[],
  classroomId?: string
): ClassroomLiveSessionRow | null {
  const scoped = classroomId
    ? rows.filter((r) => r.classroom_id === classroomId)
    : rows;
  const upcoming = upcomingClassroomLiveSessions(scoped);
  return upcoming[0] ?? null;
}
