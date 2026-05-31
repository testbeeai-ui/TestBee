import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { TargetExamKey } from "@/lib/profile/targetExam";
import { validateTrialOnboardingForActivate } from "@/lib/subscription/trialOnboardingAnswers";

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

    // 2. Perform database update
    const { error } = await supabase
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
      })
      .eq("id", user.id);

    if (error) {
      console.error("activate-trial POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, free_trial_activated_at: activatedAt });
  } catch (e) {
    console.error("activate-trial POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
