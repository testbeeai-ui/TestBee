import { NextResponse } from "next/server";
import {
  createClient,
  createClientWithToken,
  createAdminClient,
} from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { TargetExamKey } from "@/lib/profile/targetExam";
import { validateTrialOnboardingForActivate } from "@/lib/subscription/trialOnboardingAnswers";
import { TRIAL_PRIMARY_SCHOOL_ONLY } from "@/components/dashboard/free-trial-onboarding/types";
import { fetchRdmConfig } from "@/lib/rdm/rdmConfig";

async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: u },
      } = await cookieClient.auth.getUser(token);
      user = u ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const body = (await request.json()) as { answers?: unknown };

    if (body?.answers == null) {
      return NextResponse.json({ error: "Onboarding answers are required" }, { status: 400 });
    }

    const { answers, error: validationError } = validateTrialOnboardingForActivate(body.answers);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // 1. Process and map answers to standard profile fields
    let classLevel: number | null = null;
    if (answers.classLevel) {
      if (answers.classLevel.includes("11")) {
        classLevel = 11;
      } else if (answers.classLevel.includes("12")) {
        classLevel = 12;
      }
    }

    let boardName: string | null = answers.board;
    if (boardName === "Other state board") {
      boardName = answers.boardCustom || "Other state board";
    }

    let targetExam: TargetExamKey = "other";
    if (answers.objective === "Clear Board Exams") {
      targetExam = "cbse";
    } else if (answers.objective === "Engineering entrance") {
      if (answers.engExams.includes("JEE Main")) {
        targetExam = "jee_mains";
      } else if (answers.engExams.includes("JEE Advanced")) {
        targetExam = "jee_advance";
      } else if (answers.engExams.includes("KCET")) {
        targetExam = "kcet";
      } else {
        targetExam = "jee_mains"; // default engineering entrance
      }
    }

    const schoolNameTrimmed =
      answers.primaryPlatform === TRIAL_PRIMARY_SCHOOL_ONLY
        ? answers.schoolName.trim().slice(0, 200)
        : "";

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const activatedAt = new Date().toISOString();
    const profileUpdates = {
      trial_onboarding_answers: answers,
      class_level: classLevel,
      current_class_label: answers.classLevel,
      board: boardName,
      target_exam: targetExam,
      onboarding_complete: true,
      ...(schoolNameTrimmed ? { institution_name: schoolNameTrimmed } : {}),
    };

    // 2. Perform database update. The trial clock and welcome credit are
    // first-activation-only so concurrent requests cannot double-credit or
    // reset the trial start.
    const { data: activatedRows, error } = await adminClient
      .from("profiles")
      .update({
        ...profileUpdates,
        plan_tier: "free_trial",
        free_trial_activated: true,
        free_trial_activated_at: activatedAt,
        onboarding_reward_progress: {},
        onboarding_reward_claimed_at: null,
        trial_end_bonus_activated: false,
        trial_second_round_activated: false,
        trial_original_ended_at: null,
        trial_streak_at_day_14: null,
        card_added_at: null,
        payment_card_details: null,
      })
      .eq("id", user.id)
      .or("free_trial_activated.is.false,free_trial_activated.is.null")
      .select("id");

    if (error) {
      console.error("activate-trial POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shouldCreditWelcome = Boolean(activatedRows?.length);

    if (!shouldCreditWelcome) {
      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);

      if (profileUpdateError) {
        console.error("activate-trial profile update error", profileUpdateError);
        return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
      }
    }

    // 3. Immediately credit welcome bonus dynamically if first-time activation
    if (shouldCreditWelcome) {
      try {
        const rdmConfig = await fetchRdmConfig(supabase);
        const welcomeAmount = rdmConfig.free_trial_welcome_rdm ?? 500;
        const { error: rpcErr } = await adminClient.rpc("add_rdm", {
          uid: user.id,
          amt: welcomeAmount,
        });
        if (rpcErr) {
          console.error("Failed to credit welcome bonus RDM immediately", rpcErr);
        }
      } catch (welcomeErr) {
        console.error("Error crediting free trial welcome bonus immediately", welcomeErr);
      }
    }

    return NextResponse.json({ ok: true, free_trial_activated_at: activatedAt });
  } catch (e) {
    console.error("activate-trial POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
