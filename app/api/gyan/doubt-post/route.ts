import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  parseGyanAssignmentContext,
  tryCompleteGyanEngagementAssignment,
} from "@/lib/classroom/gyanAssignmentCompletion";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  gyanDoubtLimitToastCopy,
  resolveGyanDoubtAccessForUser,
} from "@/lib/subscription/gyanDoubtsLimits";

export async function POST(request: NextRequest) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const body = (await request.json()) as {
      title?: string;
      body?: string;
      subject?: string;
      costRdm?: number;
      bountyRdm?: number;
      assignmentContext?: unknown;
    };

    const title = String(body.title ?? "").trim();
    const doubtBody = String(body.body ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();

    const access = await resolveGyanDoubtAccessForUser(supabase, user.id, profile);
    if (!access.canPost) {
      const copy = gyanDoubtLimitToastCopy(
        access.unlimited ? access.usedToday : access.dailyLimit
      );
      return NextResponse.json(
        {
          ok: false,
          error: copy.description,
          limitReached: true,
          access,
        },
        { status: 403 }
      );
    }

    const costRdm = Math.max(0, Math.round(Number(body.costRdm ?? 0)));
    const bountyRdm = Math.max(0, Math.round(Number(body.bountyRdm ?? 0)));

    const { data, error } = await supabase.rpc("create_doubt_with_escrow", {
      p_title: title,
      p_body: doubtBody,
      p_subject: subject,
      p_cost_rdm: costRdm,
      p_bounty_rdm: bountyRdm,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const res = data as {
      ok?: boolean;
      id?: unknown;
      error?: string;
      daily_rdm?: { awarded?: boolean; amount?: number };
    };

    if (!res?.ok) {
      return NextResponse.json(
        { ok: false, error: res?.error ?? "Could not post doubt" },
        { status: 400 }
      );
    }

    const doubtId =
      typeof res.id === "string"
        ? res.id.trim()
        : res.id != null
          ? String(res.id).trim()
          : "";
    const assignmentContext = parseGyanAssignmentContext(body.assignmentContext);
    let assignmentCompleted = false;
    let assignmentCompletionSkippedReason: string | undefined;

    if (assignmentContext && doubtId) {
      const admin = createAdminClient();
      const completion = await tryCompleteGyanEngagementAssignment(supabase, admin, {
        userId: user.id,
        doubtId,
        title,
        body: doubtBody,
        context: assignmentContext,
      });
      if (completion.ok && completion.completed) {
        assignmentCompleted = true;
      } else if (completion.ok && !completion.completed && completion.skipped) {
        assignmentCompletionSkippedReason = completion.reason;
      }
    }

    return NextResponse.json({
      ok: true,
      id: res.id ?? null,
      daily_rdm: res.daily_rdm ?? null,
      assignmentCompleted,
      assignmentCompletionSkippedReason,
      assignmentContext: assignmentCompleted ? assignmentContext : null,
      access: {
        ...access,
        usedToday: access.usedToday + 1,
        remaining:
          access.remaining === null ? null : Math.max(0, access.remaining - 1),
        canPost:
          access.unlimited ||
          access.usedToday + 1 < access.dailyLimit,
      },
    });
  } catch (e) {
    console.error("[gyan/doubt-post]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
