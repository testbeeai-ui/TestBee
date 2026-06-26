import { NextResponse, after } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { parseBulkInviteEmails } from "@/lib/classroom/parseBulkInviteEmails";
import { sendClassroomInviteEmails } from "@/lib/email/sendClassroomInviteEmails";
import { assertClassroomHasStudentCapacity } from "@/lib/teacherPortal/teacherPlanServer";

export const runtime = "nodejs";

const MAX_EMAILS = 200;

type BulkInviteResult = {
  ok?: boolean;
  error?: string;
  batch_id?: string;
  invited_count?: number;
  skipped?: number;
  flat_reward_rdm?: number;
  balance?: number;
};

type Body = {
  emails?: string[];
  text?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId } = await context.params;
  if (!classroomId?.trim()) {
    return NextResponse.json({ error: "Invalid classroom" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromArray = Array.isArray(body.emails)
    ? body.emails.filter((e): e is string => typeof e === "string")
    : [];
  const fromText =
    typeof body.text === "string" ? parseBulkInviteEmails(body.text, MAX_EMAILS) : [];
  const emails = [...new Set([...fromArray.map((e) => e.trim().toLowerCase()), ...fromText])].slice(
    0,
    MAX_EMAILS
  );

  const { supabase, user } = ctx;

  if (emails.length === 0) {
    return NextResponse.json({ error: "No valid emails" }, { status: 400 });
  }

  const { data: existingInviteRows, error: existingInviteError } = await supabase
    .from("classroom_invite_recipients")
    .select("email")
    .eq("classroom_id", classroomId)
    .in("email", emails);

  if (existingInviteError) {
    return NextResponse.json({ error: existingInviteError.message }, { status: 500 });
  }

  const alreadyInvitedEmails = new Set(
    ((existingInviteRows ?? []) as Array<{ email: string | null }>)
      .map((row) => row.email)
      .filter((email): email is string => typeof email === "string")
  );
  const newInviteCount = emails.filter((email) => !alreadyInvitedEmails.has(email)).length;

  const capCheck = await assertClassroomHasStudentCapacity(user.id, classroomId, newInviteCount);
  if (!capCheck.ok) {
    return NextResponse.json({ error: capCheck.error, code: capCheck.code }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("create_classroom_bulk_invite", {
    p_classroom_id: classroomId,
    p_emails: emails,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as BulkInviteResult | null;
  if (!result || typeof result !== "object") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  if (!result.ok) {
    const err = result.error ?? "unknown";
    const status =
      err === "unauthorized"
        ? 401
        : err === "forbidden"
          ? 403
          : err === "no_emails" || err === "invalid_classroom"
            ? 400
            : 400;
    return NextResponse.json({ ok: false, error: err }, { status });
  }

  const batchId = result.batch_id ?? null;
  const invitedCount = result.invited_count ?? 0;

  let emailSummary: Awaited<ReturnType<typeof sendClassroomInviteEmails>> | null = null;
  if (batchId && invitedCount > 0) {
    const sendInput = {
      classroomId,
      batchId,
      teacherUserId: user.id,
    };

    if (invitedCount <= 25) {
      try {
        emailSummary = await sendClassroomInviteEmails(sendInput);
      } catch (emailError) {
        console.error("classroom bulk invite emails failed", emailError);
      }
    } else {
      after(async () => {
        try {
          await sendClassroomInviteEmails(sendInput);
        } catch (emailError) {
          console.error("classroom bulk invite emails failed", emailError);
        }
      });
    }
  }

  return NextResponse.json({
    ok: true,
    batchId,
    invitedCount,
    skipped: result.skipped ?? 0,
    flatRewardRdm: result.flat_reward_rdm ?? 0,
    balance: result.balance ?? null,
    emailsSent: emailSummary?.sent ?? null,
    emailsSkippedAlreadyJoined: emailSummary?.skippedAlreadyJoined ?? null,
    emailsFailed: emailSummary?.failed ?? null,
    emailsQueued: invitedCount > 25,
  });
}
