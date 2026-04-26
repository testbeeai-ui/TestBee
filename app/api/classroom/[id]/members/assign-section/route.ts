import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";
import {
  getCalendarEvent,
  patchCalendarEvent,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type Body = {
  userId: string;
  sectionId: string | null;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = await ctx.params;

  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

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
  const targetUserId = body.userId?.trim();
  const sectionId = body.sectionId?.trim() || null;
  if (!targetUserId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();
  if (roomErr || !room) return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  if (room.teacher_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (sectionId) {
    const { data: sec, error: secErr } = await admin
      .from("classroom_sections" as any)
      .select("id")
      .eq("id", sectionId)
      .eq("classroom_id", classroomId)
      .maybeSingle();
    if (secErr || !sec) return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const { error: updErr } = await admin
    .from("classroom_members")
    .update({ section_id: sectionId })
    .eq("classroom_id", classroomId)
    .eq("user_id", targetUserId)
    .neq("role", "teacher");
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Best-effort: if section has an active calendar series, sync attendees so the moved student gets emailed.
  if (sectionId) {
    const { data: section, error: sectionErr } = await admin
      .from("classroom_sections" as any)
      .select("google_calendar_list_id, google_recurring_event_id")
      .eq("id", sectionId)
      .eq("classroom_id", classroomId)
      .maybeSingle();

    const sectionRow = section as
      | { google_calendar_list_id?: string | null; google_recurring_event_id?: string | null }
      | null;
    const eventId = sectionRow?.google_recurring_event_id ?? null;
    const calendarId = sectionRow?.google_calendar_list_id?.trim() || "primary";

    if (!sectionErr && eventId) {
      const { data: tokenRow, error: tokErr } = await admin
        .from("teacher_google_calendar_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!tokErr && tokenRow?.refresh_token) {
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

          const { data: members } = await admin
            .from("classroom_members")
            .select("user_id, role, section_id")
            .eq("classroom_id", classroomId);

          const studentIds = (members ?? [])
            .filter((m) => m.role !== "teacher" && m.section_id === sectionId)
            .map((m) => m.user_id);

          const newStudentEmails: string[] = [];
          for (const sid of studentIds) {
            const { data: authData } = await admin.auth.admin.getUserById(sid);
            const em = authData.user?.email?.trim().toLowerCase() || "";
            if (em && EMAIL_RE.test(em)) newStudentEmails.push(em);
          }
          const uniqueNew = [...new Set(newStudentEmails)];

          const rawEvent = await getCalendarEvent({
            accessToken: refreshed.access_token,
            calendarId,
            eventId,
          });
          const ev = rawEvent as { attendees?: Array<{ email?: string }> };
          const merged = new Map<string, { email: string }>();
          for (const a of ev.attendees ?? []) {
            const em = typeof a.email === "string" ? a.email.trim().toLowerCase() : "";
            if (em && EMAIL_RE.test(em)) merged.set(em, { email: em });
          }
          for (const em of uniqueNew) merged.set(em, { email: em });

          await patchCalendarEvent({
            accessToken: refreshed.access_token,
            calendarId,
            eventId,
            body: { attendees: [...merged.values()] },
            sendUpdates: "all",
          });
        } catch {
          // best-effort
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

