import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { sendEmail, isEmailConfigured } from "@/lib/email/emailService";
import { buildStudentLoginNotificationEmail } from "@/lib/email/loginNotificationTemplate";
import { buildNewUserWelcomeEmail } from "@/lib/email/newUserWelcomeTemplate";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";
import { evaluateWhitelistGate } from "@/lib/waitlist/whitelistGate";

/** Only treat sign-in as "fresh" within this window (avoids spam on token refresh / replays). */
const FRESH_SIGN_IN_MS = 2 * 60 * 1000;

/** Welcome letter only for accounts created within this window (covers delayed email OTP). */
const NEW_ACCOUNT_WELCOME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function formatLoginAtIst(now = new Date()): string {
  return now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isFreshSignIn(lastSignInAt: string | undefined): boolean {
  if (!lastSignInAt) return true;
  const lastMs = Date.parse(lastSignInAt);
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs <= FRESH_SIGN_IN_MS;
}

function isEligibleForWelcomeEmail(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= NEW_ACCOUNT_WELCOME_MAX_AGE_MS;
}

function resolveDisplayName(
  profileName: string | null | undefined,
  user: { user_metadata?: Record<string, unknown> }
): string {
  if (profileName?.trim()) return profileName.trim();
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  return "there";
}

/** POST — welcome letter for new accounts; login confirmation for returning students. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req, { enforceWhitelist: false });
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "email_not_configured" },
      { status: 503 }
    );
  }

  const { user, supabase } = auth;

  if (!isFreshSignIn(user.last_sign_in_at)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not_fresh_sign_in",
    });
  }

  const recipient = user.email?.trim();
  if (!recipient) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("name, role, welcome_email_sent_at, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const gate = await evaluateWhitelistGate(supabase, {
    userId: user.id,
    email: user.email,
    onboardingComplete: profile?.onboarding_complete === true,
  });
  if (!gate.allowed) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: gate.reason,
    });
  }

  const role = profile?.role ?? "student";
  const displayName = resolveDisplayName(profile?.name, user);

  const welcomeAlreadySent = Boolean(profile?.welcome_email_sent_at);
  const canSendWelcome =
    !welcomeAlreadySent && isEligibleForWelcomeEmail(user.created_at);

  if (canSendWelcome && (role === "student" || role === "teacher")) {
    const { subject, html, text } = buildNewUserWelcomeEmail({
      displayName,
      role,
      portalName: "Edublast",
      portalBaseUrl: getPortalBaseUrl(),
    });

  const result = await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    log: { kind: "welcome", userId: user.id },
  });

    if (!result.success) {
      console.error("[login-notification] welcome send failed:", result.error);
      return NextResponse.json(
        { ok: false, error: "Failed to send welcome email" },
        { status: 500 }
      );
    }

    const { error: markError } = await supabase
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", user.id);

    if (markError) {
      console.warn("[login-notification] welcome sent but mark failed:", markError.message);
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      kind: "welcome",
      messageId: result.messageId,
    });
  }

  if (role !== "student") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not_student",
    });
  }

  const loginAtLabel = formatLoginAtIst();
  const { subject, html } = buildStudentLoginNotificationEmail({
    studentName: displayName === "there" ? "Student" : displayName,
    loginAtLabel,
    portalName: "Edublast",
  });

  const result = await sendEmail({
    to: recipient,
    subject,
    html,
    log: { kind: "login", userId: user.id },
  });

  if (!result.success) {
    console.error("[login-notification] login send failed:", result.error);
    return NextResponse.json(
      { ok: false, error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    kind: "login",
    messageId: result.messageId,
  });
}
