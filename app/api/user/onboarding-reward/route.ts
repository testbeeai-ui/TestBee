import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { isAdminUser } from "@/lib/admin/admin";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { verifyBuddyOnboardingForInviter } from "@/lib/buddy/buddyOnboardingVerification";
import { fetchRdmConfig } from "@/lib/rdm/rdmConfig";
import {
  ONBOARDING_GYAN_PLUS_SUBSTEP_IDS,
  ONBOARDING_REWARD_TASK_IDS,
} from "@/lib/subscription/onboardingRewardConstants";

function parseProgress(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val === true || val === "true" || val === 1) out[key] = true;
  }
  return out;
}

function isValidTaskId(taskId: string): boolean {
  return (
    (ONBOARDING_REWARD_TASK_IDS as readonly string[]).includes(taskId) ||
    (ONBOARDING_GYAN_PLUS_SUBSTEP_IDS as readonly string[]).includes(taskId) ||
    /^[a-z_]+_step_[0-9]$/.test(taskId)
  );
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const [{ data: profile, error: profileErr }, rdmConfig] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "onboarding_reward_progress, onboarding_reward_claimed_at, free_trial_activated, free_trial_daily_streak"
        )
        .eq("id", user.id)
        .maybeSingle(),
      fetchRdmConfig(supabase),
    ]);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    return NextResponse.json({
      progress: parseProgress(profile?.onboarding_reward_progress),
      claimedAt: profile?.onboarding_reward_claimed_at ?? null,
      checklistRewardRdm: rdmConfig.free_trial_checklist_reward_rdm,
      freeTrialActivated: profile?.free_trial_activated === true,
      dailyStreak: profile?.free_trial_daily_streak ?? {},
    });
  } catch (e) {
    console.error("onboarding-reward GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const body = (await request.json()) as {
      taskId?: string;
      reset?: boolean;
      completed?: boolean;
    };

    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("onboarding_reward_progress, onboarding_reward_claimed_at, free_trial_activated")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const isAdmin = await isAdminUser(supabase, user.id);

    if (!isAdmin && profile.free_trial_activated !== true) {
      return NextResponse.json({ error: "trial_not_activated" }, { status: 403 });
    }

    if (profile.onboarding_reward_claimed_at) {
      return NextResponse.json({ error: "already_claimed" }, { status: 409 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    if (body.reset === true) {
      const { error: resetErr } = await admin
        .from("profiles")
        .update({ onboarding_reward_progress: {} })
        .eq("id", user.id);

      if (resetErr) {
        return NextResponse.json({ error: resetErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, progress: {} });
    }

    const taskId = body.taskId?.trim();
    if (!taskId || !isValidTaskId(taskId)) {
      return NextResponse.json({ error: "invalid_task_id" }, { status: 400 });
    }

    const markComplete = body.completed !== false;
    const isStudentClearableSubstep =
      /^(magic_wall|lessons|gyan_plus|earn_buddy|earn_challenge|news_blog|profile)_step_[0-9]$/.test(
        taskId
      );
    const isStudentClearableVerifiedTask = taskId === "earn_buddy";
    if (
      !markComplete &&
      !isAdmin &&
      !isStudentClearableSubstep &&
      !isStudentClearableVerifiedTask
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (markComplete && !isAdmin && (taskId === "earn_buddy" || taskId === "earn_buddy_step_2")) {
      const buddyStatus = await verifyBuddyOnboardingForInviter(supabase, admin, user.id);
      if (!buddyStatus.hasInvitedBuddyJoined) {
        return NextResponse.json({ error: "buddy_not_joined" }, { status: 403 });
      }
    }

    const progress = parseProgress(profile?.onboarding_reward_progress);
    const alreadyDone = Boolean(progress[taskId]);

    if (markComplete) {
      if (alreadyDone) {
        return NextResponse.json({ ok: true, progress, noop: true });
      }
      progress[taskId] = true;
    } else {
      if (!alreadyDone) {
        return NextResponse.json({ ok: true, progress, noop: true });
      }
      delete progress[taskId];
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ onboarding_reward_progress: progress })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, progress });
  } catch (e) {
    console.error("onboarding-reward PATCH error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
