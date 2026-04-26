import { NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";
import {
  getCalendarEvent,
  patchCalendarEvent,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function POST(_request: Request, ctx: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await ctx.params;

  const headerAuth = _request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  let sectionId: string | null = null;
  try {
    const parsed = (await _request.json()) as { sectionId?: string | null };
    sectionId = typeof parsed.sectionId === "string" ? parsed.sectionId.trim() : null;
  } catch {
    sectionId = null;
  }

  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select("id, teacher_id, google_calendar_list_id, google_recurring_event_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }
  if (room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const sectionRes = sectionId
    ? await admin
        .from("classroom_sections" as any)
        .select("id, classroom_id, google_calendar_list_id, google_recurring_event_id")
        .eq("id", sectionId)
        .eq("classroom_id", classroomId)
        .maybeSingle()
    : null;

  if (sectionId && (!sectionRes || sectionRes.error || !sectionRes.data)) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const sectionRow = (sectionRes?.data ?? null) as
    | { google_calendar_list_id?: string | null; google_recurring_event_id?: string | null }
    | null;
  const eventId = sectionId ? sectionRow?.google_recurring_event_id ?? null : room.google_recurring_event_id;
  const calId = sectionId
    ? sectionRow?.google_calendar_list_id?.trim() || "primary"
    : room.google_calendar_list_id?.trim() || "primary";
  if (!eventId) {
    return NextResponse.json(
      { error: "No Google Calendar series linked yet. Create the schedule first." },
      { status: 409 }
    );
  }

  const { data: tokenRow, error: tokErr } = await admin
    .from("teacher_google_calendar_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokErr || !tokenRow?.refresh_token) {
    return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 409 });
  }

  const { data: members, error: memErr } = await admin
    .from("classroom_members")
    .select("user_id, role, section_id")
    .eq("classroom_id", classroomId);

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const studentIds = (members ?? [])
    .filter((m) => m.role !== "teacher" && (!sectionId || m.section_id === sectionId))
    .map((m) => m.user_id);

  const newStudentEmails: string[] = [];
  let studentsWithoutEmail = 0;

  for (const sid of studentIds) {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(sid);
    if (authErr || !authData.user?.email) {
      studentsWithoutEmail += 1;
      continue;
    }
    const e = authData.user.email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      studentsWithoutEmail += 1;
      continue;
    }
    newStudentEmails.push(e);
  }

  const uniqueNew = [...new Set(newStudentEmails)];

  try {
    const { clientId, clientSecret } = getGoogleOAuthEnv();
    const refreshed = await refreshAccessToken({
      refreshToken: tokenRow.refresh_token,
      clientId,
      clientSecret,
    });

    await admin
      .from("teacher_google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    const rawEvent = await getCalendarEvent({
      accessToken: refreshed.access_token,
      calendarId: calId,
      eventId,
    });
    const ev = rawEvent as {
      attendees?: Array<{ email?: string; optional?: boolean; responseStatus?: string }>;
    };
    const existing = ev.attendees ?? [];
    const merged = new Map<string, { email: string }>();
    for (const a of existing) {
      const em = typeof a.email === "string" ? a.email.trim().toLowerCase() : "";
      if (em && EMAIL_RE.test(em)) merged.set(em, { email: em });
    }
    for (const em of uniqueNew) merged.set(em, { email: em });

    const attendees = [...merged.values()];

    await patchCalendarEvent({
      accessToken: refreshed.access_token,
      calendarId: calId,
      eventId,
      body: { attendees },
      sendUpdates: "all",
    });

    return NextResponse.json({
      ok: true,
      addedStudentEmails: uniqueNew.length,
      totalAttendees: attendees.length,
      studentsWithoutEmail,
      enrolledStudents: studentIds.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Attendee sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
