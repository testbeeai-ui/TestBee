import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  buildMagicWallAddLimitError,
  computeMagicWallUsage,
  getRollingMonthlyPeriodBounds,
} from "@/lib/subscription/magicWallQuota";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionPlanKey,
  type SubscriptionPlanLimits,
} from "@/lib/subscription/subscriptionConfig";

type InsertItem = {
  topicKey: string;
  board: string;
  subject: string;
  classLevel: number;
  examType: string | null;
  unitName: string;
  chapterTitle: string;
  topicName: string;
};

function clean(value: unknown, maxLen = 240): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeTopicKey(value: unknown): string {
  return clean(value, 400).toLowerCase();
}

function normalizeInsertItems(raw: unknown): InsertItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InsertItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const topicKey = normalizeTopicKey(o.topicKey);
    if (!topicKey || seen.has(topicKey)) continue;
    const board = clean(o.board, 10).toUpperCase();
    const subject = clean(o.subject, 40).toLowerCase();
    const classLevel = Number(o.classLevel) === 12 ? 12 : 11;
    const examTypeRaw = clean(o.examType, 30);
    const examType =
      examTypeRaw === "JEE" ||
      examTypeRaw === "JEE_Mains" ||
      examTypeRaw === "JEE_Advance" ||
      examTypeRaw === "NEET" ||
      examTypeRaw === "KCET" ||
      examTypeRaw === "other"
        ? examTypeRaw
        : null;
    const unitName = clean(o.unitName, 200);
    const chapterTitle = clean(o.chapterTitle, 200);
    const topicName = clean(o.topicName, 220);
    if (!topicName) continue;
    if (subject !== "physics" && subject !== "chemistry" && subject !== "math") continue;
    out.push({
      topicKey,
      board: board === "ICSE" ? "ICSE" : "CBSE",
      subject,
      classLevel,
      examType,
      unitName,
      chapterTitle,
      topicName,
    });
    seen.add(topicKey);
  }
  return out;
}

function normalizeTopicKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = normalizeTopicKey(item);
    if (!key || seen.has(key)) continue;
    out.push(key);
    seen.add(key);
  }
  return out.slice(0, 500);
}

async function loadMagicWallUsage(
  db: { from: (table: string) => any },
  userId: string,
  plan: SubscriptionPlanKey,
  limits: SubscriptionPlanLimits,
  accountCreatedAt: string | null,
  activeCount: number
) {
  const anchorIso = accountCreatedAt ?? new Date().toISOString();
  const { periodStart, periodEnd } = getRollingMonthlyPeriodBounds(anchorIso);

  let monthlyUsed = 0;
  if (!isUnlimited(limits.magicWallMonthlyAttempts)) {
    const { count: attemptsUsed, error: attemptsErr } = await db
      .from("magic_wall_topic_attempts")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", userId)
      .gte("attempted_at", periodStart.toISOString());
    if (attemptsErr) throw new Error(attemptsErr.message);
    monthlyUsed = attemptsUsed ?? 0;
  }

  return computeMagicWallUsage({
    plan,
    activeCount,
    monthlyUsed,
    maxActive: limits.magicWallMaxActiveTopics,
    monthlyLimit: limits.magicWallMonthlyAttempts,
    periodStart,
    periodEnd,
  });
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const db = supabase as any;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("plan_tier, free_trial_activated, created_at, payment_card_details, subscription_started_at, time_travel_offset_ms")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    const plan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
    const cfg = await fetchSubscriptionConfig(supabase as unknown as any);
    const limits = getPlanLimits(cfg, plan);

    const { data, error } = await db
      .from("magic_wall_basket_items")
      .select(
        "id, topic_key, board, subject, class_level, exam_type, unit_name, chapter_title, topic_name, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      topicKey: row.topic_key,
      board: row.board,
      subject: row.subject,
      classLevel: row.class_level,
      examType: row.exam_type,
      unitName: row.unit_name,
      chapterTitle: row.chapter_title,
      topicName: row.topic_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const usage = await loadMagicWallUsage(
      db,
      user.id,
      plan,
      limits,
      profile?.created_at ?? null,
      items.length
    );

    return NextResponse.json({ items, usage });
  } catch (e) {
    console.error("magic-wall basket GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const db = supabase as any;
    const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
    const items = normalizeInsertItems(body?.items);
    if (items.length === 0) return NextResponse.json({ ok: true, count: 0 });

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("plan_tier, free_trial_activated, created_at, payment_card_details, subscription_started_at, time_travel_offset_ms")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    const plan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
    const cfg = await fetchSubscriptionConfig(supabase as unknown as any);
    const limits = getPlanLimits(cfg, plan);

    const { data: existingRows, error: existingErr } = await db
      .from("magic_wall_basket_items")
      .select("topic_key")
      .eq("user_id", user.id);
    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

    const existing = new Set<string>(
      ((existingRows ?? []) as Array<{ topic_key: string }>).map((r) => String(r.topic_key))
    );
    const toAdd = items.filter((it) => !existing.has(it.topicKey));

    const usage = await loadMagicWallUsage(
      db,
      user.id,
      plan,
      limits,
      profile?.created_at ?? null,
      existing.size
    );

    if (!isUnlimited(limits.magicWallMaxActiveTopics)) {
      const finalSize = existing.size + toAdd.length;
      if (finalSize > limits.magicWallMaxActiveTopics) {
        return NextResponse.json(
          {
            error: `Active topic limit reached (${limits.magicWallMaxActiveTopics}) for ${plan}. Complete a topic to free a slot.`,
          },
          { status: 403 }
        );
      }
    }

    if (toAdd.length > 0) {
      const allowed = usage.newPicksAllowed;
      if (allowed !== null && toAdd.length > allowed) {
        const msg = buildMagicWallAddLimitError(usage, toAdd.length);
        return NextResponse.json({ error: msg || "Topic pick limit reached." }, { status: 403 });
      }
    }

    const nowIso = new Date().toISOString();
    const payload = items.map((item) => ({
      user_id: user.id,
      topic_key: item.topicKey,
      board: item.board,
      subject: item.subject,
      class_level: item.classLevel,
      exam_type: item.examType,
      unit_name: item.unitName || null,
      chapter_title: item.chapterTitle || null,
      topic_name: item.topicName,
      updated_at: nowIso,
    }));
    const { error } = await db
      .from("magic_wall_basket_items")
      .upsert(payload, { onConflict: "user_id,topic_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (toAdd.length > 0) {
      const attemptRows = toAdd.map((item) => ({
        user_id: user.id,
        topic_key: item.topicKey,
      }));
      const { error: attemptsInsertErr } = await db
        .from("magic_wall_topic_attempts")
        .insert(attemptRows);
      if (attemptsInsertErr) {
        return NextResponse.json({ error: attemptsInsertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, count: payload.length });
  } catch (e) {
    console.error("magic-wall basket POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => null)) as { topicKeys?: unknown } | null;
    const topicKeys = normalizeTopicKeys(body?.topicKeys);
    if (topicKeys.length === 0) return NextResponse.json({ ok: true, count: 0 });
    const db = supabase as any;
    const { error } = await db
      .from("magic_wall_basket_items")
      .delete()
      .eq("user_id", user.id)
      .in("topic_key", topicKeys);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: topicKeys.length });
  } catch (e) {
    console.error("magic-wall basket DELETE error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
