import { NextResponse } from "next/server";
import { createClient, createClientWithToken, createAdminClient } from "@/integrations/supabase/server";
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

    const activatedAt = new Date().toISOString();

    // Check if free trial has already been activated before to prevent replayed requests
    // from resetting checklist progress or crediting welcome RDM twice.
    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("free_trial_activated, free_trial_activated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      console.error("activate-trial read error", readErr);
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }

    if (profile?.free_trial_activated) {
      return NextResponse.json({
        ok: true,
        alreadyActivated: true,
        free_trial_activated_at: profile.free_trial_activated_at,
      });
    }

    const schoolNameTrimmed =
      answers.primaryPlatform === TRIAL_PRIMARY_SCHOOL_ONLY ? answers.schoolName.trim().slice(0, 200) : "";

    // 2. Perform database update
    const { data: activatedProfile, error } = await supabase
      .from("profiles")
      .update({
        plan_tier: "free_trial",
        free_trial_activated: true,
        free_trial_activated_at: activatedAt,
        trial_onboarding_answers: answers,
        class_level: classLevel,
        current_class_label: answers.classLevel,
        board: boardName,
        target_exam: targetExam,
        onboarding_complete: true,
        onboarding_reward_progress: {},
        onboarding_reward_claimed_at: null,
        ...(schoolNameTrimmed ? { institution_name: schoolNameTrimmed } : {}),
      })
      .eq("id", user.id)
      .or("free_trial_activated.is.false,free_trial_activated.is.null")
      .select("free_trial_activated_at")
      .maybeSingle();

    if (error) {
      console.error("activate-trial POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!activatedProfile) {
      const { data: currentProfile, error: currentReadErr } = await supabase
        .from("profiles")
        .select("free_trial_activated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (currentReadErr) {
        console.error("activate-trial concurrent read error", currentReadErr);
        return NextResponse.json({ error: currentReadErr.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        alreadyActivated: true,
        free_trial_activated_at: currentProfile?.free_trial_activated_at ?? null,
      });
    }

    // 3. Immediately credit welcome bonus dynamically if first-time activation
    try {
      const rdmConfig = await fetchRdmConfig(supabase);
      const welcomeAmount = rdmConfig.free_trial_welcome_rdm ?? 500;
      const adminClient = createAdminClient();
      if (adminClient) {
        const { error: rpcErr } = await adminClient.rpc("add_rdm", {
          uid: user.id,
          amt: welcomeAmount,
        });
        if (rpcErr) {
          console.error("Failed to credit welcome bonus RDM immediately", rpcErr);
        }
      }
    } catch (welcomeErr) {
      console.error("Error crediting free trial welcome bonus immediately", welcomeErr);
    }

    return NextResponse.json({ ok: true, free_trial_activated_at: activatedAt });
  } catch (e) {
    console.error("activate-trial POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
