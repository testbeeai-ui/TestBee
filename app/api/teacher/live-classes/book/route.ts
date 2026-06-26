import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  buildSingleEventPayload,
  insertCalendarEventWithMeet,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";
import { wallClockInTimeZoneToUtc } from "@/lib/datetime/wallClockInTimeZone";
import { assertTeacherCanBookSlot } from "@/lib/teacherPortal/teacherPlanServer";

export const runtime = "nodejs";

type Body = {
  classroomId?: string;
  sectionId?: string;
  slotDate?: string;
  slotTime?: string;
  timeZone?: string;
  durationMinutes?: number;
};

function normalizeDate(raw: string): string {
  const v = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return v;
}

export async function POST(request: Request) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = ctx;
  const body = (await request.json().catch(() => ({}))) as Body;

  const classroomId = String(body.classroomId ?? "").trim();
  const sectionId = String(body.sectionId ?? "").trim();
  const slotDate = body.slotDate ? normalizeDate(body.slotDate) : "";
  const slotTime = String(body.slotTime ?? "").trim();
  const timeZone = String(body.timeZone ?? "Asia/Kolkata").trim();
  const durationMinutes = Math.max(15, Math.min(180, Number(body.durationMinutes ?? 60)));

  if (!classroomId || !sectionId || !slotDate || !slotTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teachers only" }, { status: 403 });
  }

  const { data: room } = await admin
    .from("classrooms")
    .select("id, name, description, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();
  if (!room || room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  const { data: section } = await admin
    .from("classroom_sections")
    .select("id, name, classroom_id, is_active")
    .eq("id", sectionId)
    .eq("classroom_id", classroomId)
    .maybeSingle();
  if (!section || section.is_active === false) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const startLocalIso = `${slotDate}T${slotTime}:00`;
  let slotAt: Date;
  try {
    slotAt = wallClockInTimeZoneToUtc(slotDate, slotTime, timeZone);
  } catch {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (slotAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Slot must be in the future" }, { status: 400 });
  }

  const quotaCheck = await assertTeacherCanBookSlot(user.id, slotAt);
  if (!quotaCheck.ok) {
    return NextResponse.json(
      { error: quotaCheck.error, code: quotaCheck.code },
      { status: 403 }
    );
  }

  const { data: tokenRow } = await admin
    .from("teacher_google_calendar_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenRow?.refresh_token) {
    return NextResponse.json(
      { error: "Connect Google Calendar before booking live classes." },
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

    const eventBody = buildSingleEventPayload({
      title: `${room.name} · ${section.name}`,
      description: room.description ?? undefined,
      startLocalIso,
      durationMinutes,
      timeZone,
    });

    const calendarListId = "primary";
    const { id: eventId, meetLink } = await insertCalendarEventWithMeet({
      accessToken: refreshed.access_token,
      calendarId: calendarListId,
      body: eventBody,
    });

    const slotAtIso = slotAt.toISOString();
    const { data: slotRow, error: slotErr } = await (admin as any)
      .from("live_class_slots")
      .insert({
        teacher_id: user.id,
        classroom_id: classroomId,
        section_id: sectionId,
        slot_at: slotAtIso,
        duration_minutes: durationMinutes,
        google_event_id: eventId,
        meet_link: meetLink,
        status: "scheduled",
      })
      .select("id, slot_at, meet_link, duration_minutes")
      .single();

    if (slotErr) {
      if (slotErr.code === "23505") {
        return NextResponse.json({ error: "This slot is already booked" }, { status: 409 });
      }
      return NextResponse.json({ error: slotErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      slot: slotRow,
      remainingThisMonth: quotaCheck.remaining,
      meetLink,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Booking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
