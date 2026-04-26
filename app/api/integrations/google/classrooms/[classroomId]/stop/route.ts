import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";
import {
  deleteCalendarEvent,
  getCalendarEvent,
  patchCalendarEvent,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

type Body = {
  /** `until_today` — patch RRULE with UNTIL=now. `delete_series` — remove entire series from Google. */
  mode: "until_today" | "delete_series";
  sectionId?: string | null;
};

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.mode !== "until_today" && body.mode !== "delete_series") {
    return NextResponse.json({ error: "mode must be until_today or delete_series." }, { status: 400 });
  }

  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select("id, teacher_id, google_calendar_list_id, google_recurring_event_id, google_rrule")
    .eq("id", classroomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  }
  if (room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const sectionId = body.sectionId?.trim() || null;
  const sectionRes = sectionId
    ? await admin
        .from("classroom_sections" as any)
        .select("id, classroom_id, google_calendar_list_id, google_recurring_event_id, google_rrule")
        .eq("id", sectionId)
        .eq("classroom_id", classroomId)
        .maybeSingle()
    : null;
  if (sectionId && (!sectionRes || sectionRes.error || !sectionRes.data)) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const sectionRow = (sectionRes?.data ?? null) as
    | {
        google_calendar_list_id?: string | null;
        google_recurring_event_id?: string | null;
        google_rrule?: string | null;
      }
    | null;
  const eventId = sectionId ? sectionRow?.google_recurring_event_id ?? null : room.google_recurring_event_id;
  const calId = sectionId
    ? sectionRow?.google_calendar_list_id?.trim() || "primary"
    : room.google_calendar_list_id?.trim() || "primary";
  if (!eventId) {
    return NextResponse.json(
      { error: "No Google Calendar series linked." },
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

    if (body.mode === "delete_series") {
      await deleteCalendarEvent({
        accessToken: refreshed.access_token,
        calendarId: calId,
        eventId,
      });
    } else {
      const ev = await getCalendarEvent({
        accessToken: refreshed.access_token,
        calendarId: calId,
        eventId,
      }) as { recurrence?: string[] };
      const current = ev.recurrence?.[0];
      if (!current || !current.startsWith("RRULE:")) {
        await deleteCalendarEvent({
          accessToken: refreshed.access_token,
          calendarId: calId,
          eventId,
        });
      } else {
        const now = new Date();
        const fmtUtc = (d: Date) => {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
          const day = String(d.getUTCDate()).padStart(2, "0");
          const h = String(d.getUTCHours()).padStart(2, "0");
          const min = String(d.getUTCMinutes()).padStart(2, "0");
          const s = String(d.getUTCSeconds()).padStart(2, "0");
          return `${y}${m}${day}T${h}${min}${s}Z`;
        };
        let base = current.replace(/^RRULE:/, "");
        const parts = base.split(";").filter((p) => !p.startsWith("UNTIL=") && !p.startsWith("COUNT="));
        base = parts.join(";");
        const nextRrule = `RRULE:${base};UNTIL=${fmtUtc(now)}`;
        await patchCalendarEvent({
          accessToken: refreshed.access_token,
          calendarId: calId,
          eventId,
          body: { recurrence: [nextRrule] },
          sendUpdates: "none",
        });
      }
    }

    if (sectionId) {
      await admin
        .from("classroom_sections" as any)
        .update({
          google_recurring_event_id: null,
          google_meet_link: null,
          google_rrule: null,
          google_recurrence_end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sectionId)
        .eq("classroom_id", classroomId);
    } else {
      await admin
        .from("classrooms")
        .update({
          google_recurring_event_id: null,
          google_meet_link: null,
          google_rrule: null,
          google_recurrence_end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", classroomId)
        .eq("teacher_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stop series failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
