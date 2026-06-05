import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

type Body = {
  userId?: string;
  plan?: string;
  subscription_started_at?: string | null;
};

const ALLOWED_PLANS = ["free", "free_trial", "starter", "pro"];

/**
 * POST /api/admin/subscription-override
 * Admin-only: change a student's plan tier and/or subscription start date.
 * Automatically sets subscription_started_at to now() when upgrading to starter/pro,
 * unless an explicit date is provided.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    const json = (await request.json().catch(() => ({}))) as Body;
    const userId = typeof json.userId === "string" ? json.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    // Handle plan change
    if (json.plan !== undefined) {
      const plan = String(json.plan).toLowerCase().trim();
      if (!ALLOWED_PLANS.includes(plan)) {
        return NextResponse.json(
          { error: `Invalid plan. Use one of: ${ALLOWED_PLANS.join(", ")}` },
          { status: 400 }
        );
      }
      updates.plan_tier = plan;

      if (plan === "free_trial") {
        updates.free_trial_activated = true;
        updates.free_trial_activated_at = new Date().toISOString();
        updates.subscription_started_at = null; // trial uses its own date column
      } else if (plan === "starter" || plan === "pro") {
        updates.free_trial_activated = false;
        // Only auto-set start date if not explicitly provided
        if (json.subscription_started_at === undefined) {
          updates.subscription_started_at = new Date().toISOString();
        }
      } else {
        // free
        updates.free_trial_activated = false;
        updates.subscription_started_at = null;
      }
    }

    // Handle explicit date override (null = clear it)
    if (json.subscription_started_at !== undefined && json.plan !== "free_trial") {
      if (json.subscription_started_at === null || json.subscription_started_at === "") {
        updates.subscription_started_at = null;
      } else {
        const parsed = new Date(json.subscription_started_at);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid subscription_started_at date" },
            { status: 400 }
          );
        }
        updates.subscription_started_at = parsed.toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await (admin as any)
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      console.error("[admin/subscription-override POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: updates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
