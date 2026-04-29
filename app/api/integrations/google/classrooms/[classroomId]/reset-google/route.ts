import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";
import { deleteCalendarEvent, refreshAccessToken } from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

/**
 * Removes all Google Calendar / Meet linkage for one classroom: deletes recurring events from Google
 * when IDs exist (requires Calendar connected), then clears google_* columns on the classroom and
 * every section. Use when the UI shows stale Meet / “series active” after deletes or sync issues.
 */
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
    return NextResponse.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select(
      "id, teacher_id, google_calendar_list_id, google_recurring_event_id, google_meet_link, google_rrule"
    )
    .eq("id", classroomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }
  if (room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: sectionRows, error: secErr } = await admin
    .from("classroom_sections" as any)
    .select("id, google_calendar_list_id, google_recurring_event_id")
    .eq("classroom_id", classroomId);

  if (secErr) {
    return NextResponse.json({ error: "Could not load sections." }, { status: 500 });
  }

  const sections = (sectionRows ?? []) as unknown as Array<{
    id: string;
    google_calendar_list_id?: string | null;
    google_recurring_event_id?: string | null;
  }>;

  const classEventId =
    typeof room.google_recurring_event_id === "string" ? room.google_recurring_event_id.trim() : "";
  const needsGoogleDelete =
    Boolean(classEventId) ||
    sections.some((s) => typeof s.google_recurring_event_id === "string" && s.google_recurring_event_id.trim());

  let accessToken: string | null = null;
  if (needsGoogleDelete) {
    const { data: tokenRow, error: tokErr } = await admin
      .from("teacher_google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokErr || !tokenRow?.refresh_token) {
      return NextResponse.json(
        {
          error:
            "Google Calendar is not connected. Connect Google Calendar first to delete recurring events from Google, or try again after connecting.",
        },
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
      accessToken = refreshed.access_token;

      await admin
        .from("teacher_google_calendar_tokens")
        .update({
          access_token: refreshed.access_token,
          access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      for (const sec of sections) {
        const eid = typeof sec.google_recurring_event_id === "string" ? sec.google_recurring_event_id.trim() : "";
        if (!eid) continue;
        const calId = sec.google_calendar_list_id?.trim() || "primary";
        await deleteCalendarEvent({
          accessToken,
          calendarId: calId,
          eventId: eid,
        });
      }

      if (classEventId) {
        const calId =
          typeof room.google_calendar_list_id === "string" ? room.google_calendar_list_id.trim() || "primary" : "primary";
        await deleteCalendarEvent({
          accessToken,
          calendarId: calId,
          eventId: classEventId,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Google delete failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const clearedAt = new Date().toISOString();

  await admin
    .from("classroom_sections" as any)
    .update({
      google_recurring_event_id: null,
      google_meet_link: null,
      google_rrule: null,
      google_recurrence_end_date: null,
      updated_at: clearedAt,
    })
    .eq("classroom_id", classroomId);

  await admin
    .from("classrooms")
    .update({
      google_recurring_event_id: null,
      google_meet_link: null,
      google_rrule: null,
      google_recurrence_end_date: null,
      updated_at: clearedAt,
    })
    .eq("id", classroomId)
    .eq("teacher_id", user.id);

  return NextResponse.json({ ok: true });
}
