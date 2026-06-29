import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/server";

const JOIN_FROM_MINUTES_BEFORE = 30;

function getRoomNameFromMeetLink(meetLink: string): string {
  try {
    const path = new URL(meetLink).pathname.replace(/^\/+|\/+$/g, "") || "EduBlast";
    return path;
  } catch {
    return meetLink.replace(/^https?:\/\/[^/]+\/?/, "").replace(/\/+$/, "") || "EduBlast";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId ?? body?.session_id;
    const slotId = body?.slotId ?? body?.slot_id;

    const supabase = await createClient();
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    let user = (await supabase.auth.getUser()).data?.user ?? null;
    if (!user && token) {
      const {
        data: { user: u },
      } = await supabase.auth.getUser(token);
      user = u ?? null;
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (slotId && typeof slotId === "string") {
      const { data: slot, error: slotError } = await (admin as any)
        .from("live_class_slots")
        .select("id, meet_link, classroom_id, slot_at, duration_minutes, status")
        .eq("id", slotId)
        .maybeSingle();

      if (slotError || !slot) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const st = String((slot as { status?: string }).status ?? "")
        .trim()
        .toLowerCase();
      if (st === "cancelled" || st === "canceled") {
        return NextResponse.json({ error: "This class was cancelled" }, { status: 400 });
      }

      const scheduledAt = String((slot as { slot_at: string }).slot_at);
      const durationMinutes = Number((slot as { duration_minutes: number }).duration_minutes) || 60;
      const classroomId = String((slot as { classroom_id: string }).classroom_id);
      const meetLink = (slot as { meet_link?: string | null }).meet_link;

      const { data: member } = await admin
        .from("classroom_members")
        .select("user_id")
        .eq("classroom_id", classroomId)
        .eq("user_id", user.id)
        .maybeSingle();

      const startMs = new Date(scheduledAt).getTime();
      const joinFromMs = startMs - JOIN_FROM_MINUTES_BEFORE * 60 * 1000;
      const joinUntilMs = startMs + (durationMinutes + 15) * 60 * 1000;
      const now = Date.now();
      if (now < joinFromMs) {
        return NextResponse.json(
          { error: "You can only join from 30 minutes before the class starts" },
          { status: 400 }
        );
      }
      if (now > joinUntilMs) {
        return NextResponse.json({ error: "This class has ended" }, { status: 400 });
      }

      if (!meetLink) {
        return NextResponse.json({ error: "No meeting link for this session" }, { status: 404 });
      }

      if (!member) {
        const { data: exploration } = await admin
          .from("class_exploration_sessions")
          .select("started_at")
          .eq("user_id", user.id)
          .eq("classroom_id", classroomId)
          .maybeSingle();

        if (!exploration?.started_at) {
          return NextResponse.json({ error: "Not a member of this class" }, { status: 403 });
        }
      }

      return NextResponse.json({ roomName: getRoomNameFromMeetLink(meetLink) });
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    // Load session with admin so RLS doesn't hide it from students (we verify membership below)
    const { data: session, error: sessionError } = await admin
      .from("live_sessions")
      .select("id, meet_link, classroom_id, teacher_id, scheduled_at, duration_minutes")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: member } = await admin
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", session.classroom_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const startMs = new Date(session.scheduled_at).getTime();
    const joinFromMs = startMs - JOIN_FROM_MINUTES_BEFORE * 60 * 1000;
    const joinUntilMs = startMs + (session.duration_minutes + 15) * 60 * 1000;
    const now = Date.now();
    if (now < joinFromMs) {
      return NextResponse.json(
        { error: "You can only join from 30 minutes before the class starts" },
        { status: 400 }
      );
    }
    if (now > joinUntilMs) {
      return NextResponse.json({ error: "This class has ended" }, { status: 400 });
    }

    if (!session.meet_link) {
      return NextResponse.json({ error: "No meeting link for this session" }, { status: 404 });
    }

    const roomName = getRoomNameFromMeetLink(session.meet_link);

    if (member) {
      const { data: existingJoin } = await admin
        .from("live_session_joins")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingJoin) {
        await admin.from("live_session_joins").insert({
          session_id: sessionId,
          user_id: user.id,
          credits_deducted: 0,
        });
      }
      return NextResponse.json({ roomName });
    }

    const { data: exploration } = await admin
      .from("class_exploration_sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .eq("classroom_id", session.classroom_id)
      .maybeSingle();

    if (!exploration?.started_at) {
      return NextResponse.json({ error: "Not a member of this class" }, { status: 403 });
    }

    const { data: existingExplorerJoin } = await admin
      .from("explorer_live_joins")
      .select("joined_at")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingExplorerJoin) {
      await admin.from("explorer_live_joins").insert({
        session_id: sessionId,
        user_id: user.id,
      });
    }

    return NextResponse.json({
      roomName,
    });
  } catch (e) {
    console.error("live join error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
