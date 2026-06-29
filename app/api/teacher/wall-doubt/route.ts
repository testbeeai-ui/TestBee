import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import type { TeacherPortalWallItem } from "@/lib/teacherPortal/types";

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const {
      data: { user },
    } = await supabaseWithToken.auth.getUser();
    return { user: user ?? null };
  }
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  return { user: user ?? null };
}

/** Fetch one doubt card for the teacher Gyan++ Wall (e.g. deep-link highlight). */
export async function GET(request: Request) {
  const { user } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const doubtId = url.searchParams.get("doubtId")?.trim() ?? "";
  if (!doubtId) {
    return NextResponse.json({ error: "doubtId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: doubt, error: doubtErr } = await admin
    .from("doubts")
    .select("id, title, body, subject, created_at, upvotes, user_id")
    .eq("id", doubtId)
    .maybeSingle();
  if (doubtErr || !doubt) {
    return NextResponse.json({ error: "Doubt not found" }, { status: 404 });
  }

  const [{ data: asker }, { data: answers }] = await Promise.all([
    admin.from("profiles").select("id, name, role").eq("id", doubt.user_id).maybeSingle(),
    admin
      .from("doubt_answers")
      .select("id, body, user_id, upvotes, created_at")
      .eq("doubt_id", doubtId)
      .order("created_at", { ascending: false }),
  ]);

  const answerUserIds = [...new Set((answers ?? []).map((a) => a.user_id))];
  const { data: answerAuthors } =
    answerUserIds.length > 0
      ? await admin.from("profiles").select("id, role").in("id", answerUserIds)
      : { data: [] as Array<{ id: string; role: string | null }> };

  const roleByUser = new Map((answerAuthors ?? []).map((p) => [p.id, p.role]));
  const aiAnswer = (answers ?? []).find((a) => roleByUser.get(a.user_id) === "ai") ?? null;
  const teacherAnswers = (answers ?? []).filter((a) => roleByUser.get(a.user_id) === "teacher");
  const myTeacherAnswers = teacherAnswers.filter((a) => a.user_id === user.id);
  const latestMyTeacherAnswer = myTeacherAnswers[0] ?? null;
  const preview =
    typeof latestMyTeacherAnswer?.body === "string"
      ? latestMyTeacherAnswer.body.replace(/\s+/g, " ").trim().slice(0, 180)
      : null;

  const item: TeacherPortalWallItem = {
    doubtId: doubt.id,
    title: doubt.title,
    body: doubt.body ?? "",
    subject: doubt.subject,
    createdAt: doubt.created_at,
    askerName: asker?.name ?? "Student",
    askerRole: asker?.role ?? null,
    upvotes: doubt.upvotes,
    peerCommentsCount: Math.max(0, (answers ?? []).length - (aiAnswer ? 1 : 0)),
    aiAnswerBody: aiAnswer?.body ?? null,
    teacherAnswersCount: teacherAnswers.length,
    hasTeacherAnswer: teacherAnswers.length > 0,
    hasCurrentTeacherAnswer: myTeacherAnswers.length > 0,
    currentTeacherAnswerPreview: preview && preview.length > 0 ? preview : null,
  };

  return NextResponse.json({ item });
}
