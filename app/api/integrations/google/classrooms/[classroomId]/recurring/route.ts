import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import {
  buildEventPayload,
  insertCalendarEventWithMeet,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

type Body = {
  sectionId?: string | null;
  timeZone: string;
  scheduleDate: string;
  scheduleTime: string;
  durationMinutes: number;
  repeatDays: string[];
  scheduleEndDate?: string | null;
  classCount?: number | null;
};

function normalizeScheduleDate(raw: string): string {
  const v = raw.trim();
  // Accept YYYY-MM-DD (native date input) or DD-MM-YYYY (custom masked input).
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return v; // best-effort; downstream will validate/throw if invalid
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ classroomId: string }> }
) {
  const { classroomId } = await ctx.params;
  const headerAuth = request.headers.get("authorization") || "";
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
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !body.timeZone?.trim() ||
    !body.scheduleDate?.trim() ||
    !body.scheduleTime?.trim() ||
    typeof body.durationMinutes !== "number"
  ) {
    return NextResponse.json(
      { error: "timeZone, scheduleDate, scheduleTime, and durationMinutes are required." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.repeatDays)) {
    return NextResponse.json({ error: "repeatDays must be an array." }, { status: 400 });
  }

  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select("id, teacher_id, name, description, google_recurring_event_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }
  if (room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const sectionId = body.sectionId?.trim() || null;
  if (!sectionId) {
    // Legacy: one series per classroom
    if (room.google_recurring_event_id) {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_linked" });
    }
  } else {
    const { data: section, error: secErr } = await admin
      .from("classroom_sections" as any)
      .select("id, classroom_id, name, google_recurring_event_id")
      .eq("id", sectionId)
      .eq("classroom_id", classroomId)
      .maybeSingle();
    const sectionRow = section as {
      id: string;
      classroom_id: string;
      name: string;
      google_recurring_event_id?: string | null;
    } | null;
    if (secErr || !sectionRow) {
      return NextResponse.json({ error: "Section not found." }, { status: 404 });
    }
    if (sectionRow.google_recurring_event_id) {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_linked" });
    }
  }

  const { data: tokenRow, error: tokErr } = await admin
    .from("teacher_google_calendar_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokErr || !tokenRow?.refresh_token) {
    return NextResponse.json(
      { error: "Google Calendar is not connected. Use Connect Google Calendar first." },
      { status: 409 }
    );
  }

  try {
    const { clientId, clientSecret } = getGoogleOAuthEnv();
    const refreshed = await refreshAccessToken({
      refreshToken: tokenRow.refresh_token,
      clientId,
      clientSecret,
    });

    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from("teacher_google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    const normalizedDate = normalizeScheduleDate(body.scheduleDate);
    const normalizedTime = body.scheduleTime.trim();
    const startLocalIso = `${normalizedDate}T${normalizedTime}:00`;
    const sectionForTitle = sectionId
      ? await admin
          .from("classroom_sections" as any)
          .select("id, name")
          .eq("id", sectionId)
          .eq("classroom_id", classroomId)
          .maybeSingle()
      : null;
    const sectionName =
      sectionForTitle && sectionForTitle.data
        ? ((sectionForTitle.data as { name?: string | null } | null)?.name ?? null)
        : null;
    const eventBody = buildEventPayload({
      title: sectionName ? `${room.name} · ${sectionName}` : room.name,
      description: room.description ?? undefined,
      startLocalIso,
      durationMinutes: body.durationMinutes,
      timeZone: body.timeZone.trim(),
      repeatDays: body.repeatDays,
      scheduleEndDate: body.scheduleEndDate ?? null,
      classCount: body.classCount ?? null,
    });

    const calendarListId = "primary";
    const { id: eventId, meetLink } = await insertCalendarEventWithMeet({
      accessToken: refreshed.access_token,
      calendarId: calendarListId,
      body: eventBody,
    });

    const rrule = eventBody.recurrence?.[0] ?? null;

    if (sectionId) {
      const { error: upSecErr } = await admin
        .from("classroom_sections" as any)
        .update({
          google_calendar_list_id: calendarListId,
          google_recurring_event_id: eventId,
          google_meet_link: meetLink,
          google_rrule: rrule,
          google_time_zone: body.timeZone.trim(),
          google_recurrence_end_date: body.scheduleEndDate?.trim() || null,
          schedule_date: normalizedDate,
          schedule_time: normalizedTime,
          duration_minutes: body.durationMinutes,
          repeat_days: body.repeatDays,
          schedule_end_date: body.scheduleEndDate?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sectionId)
        .eq("classroom_id", classroomId);
      if (upSecErr) throw upSecErr;
    } else {
      const { error: upRoomErr } = await admin
        .from("classrooms")
        .update({
          google_calendar_list_id: calendarListId,
          google_recurring_event_id: eventId,
          google_meet_link: meetLink,
          google_rrule: rrule,
          google_time_zone: body.timeZone.trim(),
          google_recurrence_end_date: body.scheduleEndDate?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", classroomId)
        .eq("teacher_id", user.id);
      if (upRoomErr) throw upRoomErr;
    }

    return NextResponse.json({ ok: true, eventId, meetLink });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
