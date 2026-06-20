import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type {
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedCommunityPost,
} from "@/types";
import type { PlanTier, ItemType } from "@/lib/saved/savedItemCap";
import { getSaveCap } from "@/lib/saved/savedItemCap";
import type { Json } from "@/integrations/supabase/types";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";

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

/** Map frontend type names to item_type enum values */
const TYPE_MAP: Record<string, ItemType> = {
  savedBits: "saved_bit",
  savedFormulas: "saved_formula",
  savedRevisionCards: "saved_revision_card",
  savedRevisionUnits: "saved_revision_unit",
  savedCommunityPosts: "saved_community_post",
};

/** Extract content_id from a saved item based on its type */
function getContentId(item: Record<string, unknown>, itemType: ItemType): string {
  if (itemType === "saved_community_post") {
    return (item.postId as string) ?? (item.id as string) ?? "unknown";
  }
  return (item.id as string) ?? "unknown";
}

/** Extract subject from a saved item */
function getSubject(item: Record<string, unknown>): string | null {
  return (item.subject as string) ?? null;
}

/** Extract status (only for revision cards) */
function getStatus(item: Record<string, unknown>, itemType: ItemType): string | null {
  if (itemType === "saved_revision_card") {
    return (item.status as string) ?? null;
  }
  return null;
}

/** Extract saved_at timestamp */
function getSavedAt(item: Record<string, unknown>, itemType: ItemType): string | null {
  if (itemType === "saved_revision_card") {
    return (item.savedAt as string) ?? null;
  }
  if (itemType === "saved_community_post") {
    return (item.savedAt as string) ?? null;
  }
  return null;
}

/**
 * Sync one item type to user_saved_items table.
 * Uses delete-then-bulk-insert (same pattern as the old full-array replace).
 */
async function syncItemType(
  supabase: ReturnType<typeof createClientWithToken>,
  userId: string,
  itemType: ItemType,
  items: Record<string, unknown>[]
): Promise<{ error: string | null }> {
  // Delete all existing rows of this type for the user
  const { error: delErr } = await supabase
    .from("user_saved_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_type", itemType);

  if (delErr) return { error: delErr.message };

  // Insert new rows (if any)
  if (items.length > 0) {
    const rows = items.map((item) => ({
      user_id: userId,
      item_type: itemType,
      content_id: getContentId(item, itemType),
      subject: getSubject(item),
      status: getStatus(item, itemType),
      saved_at: getSavedAt(item, itemType),
      data: item as Json,
    }));

    const { error: insErr } = await supabase.from("user_saved_items").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  return { error: null };
}

/** Check plan-based save cap for an item type */
async function checkCap(
  supabase: ReturnType<typeof createClientWithToken>,
  userId: string,
  itemType: ItemType,
  newItemCount: number
): Promise<{ error: string | null }> {
  // Get user's plan tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms")
    .eq("id", userId)
    .maybeSingle();

  const tier = normalizePlanTier(
    (profile?.plan_tier as string | null | undefined) ?? "free",
    profile?.free_trial_activated,
    profile
  );
  const cfg = await fetchSubscriptionConfig(supabase as unknown as any);
  const planLimits = getPlanLimits(cfg, tier);
  const cap =
    itemType === "saved_revision_card"
      ? planLimits.instacueCardLimit
      : itemType === "saved_bit"
        ? planLimits.savedBitLimit
        : itemType === "saved_formula"
          ? planLimits.savedFormulaLimit
          : getSaveCap(tier as PlanTier, itemType);

  if (cap === Infinity || isUnlimited(cap)) return { error: null }; // unlimited

  // Count existing items of this type
  const { count } = await supabase
    .from("user_saved_items")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("item_type", itemType);

  const currentCount = count ?? 0;
  // Only block growth, not deletions — allows users over cap (pre-migration) to still remove items
  if (newItemCount > cap && newItemCount > currentCount) {
    const label =
      itemType === "saved_revision_card"
        ? `InstaCue revision save limit reached (${cap} card${cap === 1 ? "" : "s"} on your ${tier} plan).`
        : itemType === "saved_bit"
          ? `Quiz save limit reached (${cap} question${cap === 1 ? "" : "s"} on your ${tier} plan).`
          : itemType === "saved_formula"
            ? `Numerals save limit reached (${cap} formula set${cap === 1 ? "" : "s"} on your ${tier} plan).`
            : `Save limit reached: ${cap} items allowed for your ${tier} plan.`;
    return {
      error: `${label} You have ${currentCount} saved. Upgrade to save more.`,
    };
  }

  return { error: null };
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    // Read from user_saved_items table
    const { data: items, error } = await supabase
      .from("user_saved_items")
      .select("item_type, data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("saved-content GET error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by item_type
    const grouped = {
      savedBits: [] as SavedBit[],
      savedFormulas: [] as SavedFormula[],
      savedRevisionCards: [] as SavedRevisionCard[],
      savedRevisionUnits: [] as SavedRevisionUnit[],
      savedCommunityPosts: [] as SavedCommunityPost[],
    };

    for (const row of items ?? []) {
      const data = row.data as unknown;
      switch (row.item_type) {
        case "saved_bit":
          grouped.savedBits.push(data as SavedBit);
          break;
        case "saved_formula":
          grouped.savedFormulas.push(data as SavedFormula);
          break;
        case "saved_revision_card":
          grouped.savedRevisionCards.push(data as SavedRevisionCard);
          break;
        case "saved_revision_unit":
          grouped.savedRevisionUnits.push(data as SavedRevisionUnit);
          break;
        case "saved_community_post":
          grouped.savedCommunityPosts.push(data as SavedCommunityPost);
          break;
      }
    }

    return NextResponse.json(grouped);
  } catch (e) {
    console.error("saved-content GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
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
    const body = await request.json();

    const savedBits = Array.isArray(body?.savedBits) ? body.savedBits : undefined;
    const savedFormulas = Array.isArray(body?.savedFormulas) ? body.savedFormulas : undefined;
    const savedRevisionCards = Array.isArray(body?.savedRevisionCards)
      ? body.savedRevisionCards
      : undefined;
    const savedRevisionUnits = Array.isArray(body?.savedRevisionUnits)
      ? body.savedRevisionUnits
      : undefined;
    const savedCommunityPosts = Array.isArray(body?.savedCommunityPosts)
      ? body.savedCommunityPosts
      : undefined;

    if (
      savedBits === undefined &&
      savedFormulas === undefined &&
      savedRevisionCards === undefined &&
      savedRevisionUnits === undefined &&
      savedCommunityPosts === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "savedBits, savedFormulas, savedRevisionCards, savedRevisionUnits, or savedCommunityPosts required",
        },
        { status: 400 }
      );
    }

    // Check caps before writing
    const capChecks = [
      { key: "savedBits", items: savedBits },
      { key: "savedFormulas", items: savedFormulas },
      { key: "savedRevisionCards", items: savedRevisionCards },
      { key: "savedRevisionUnits", items: savedRevisionUnits },
      { key: "savedCommunityPosts", items: savedCommunityPosts },
    ] as const;

    for (const { key, items } of capChecks) {
      if (items !== undefined) {
        const itemType = TYPE_MAP[key];
        const capErr = await checkCap(supabase, user.id, itemType, items.length);
        if (capErr.error) {
          return NextResponse.json({ error: capErr.error }, { status: 403 });
        }
      }
    }

    // 1. Continue existing write to profiles (backward compat during migration)
    const updates: Record<string, unknown> = {};
    if (savedBits !== undefined) updates.saved_bits = savedBits;
    if (savedFormulas !== undefined) updates.saved_formulas = savedFormulas;
    if (savedRevisionCards !== undefined) updates.saved_revision_cards = savedRevisionCards;
    if (savedRevisionUnits !== undefined) updates.saved_revision_units = savedRevisionUnits;
    if (savedCommunityPosts !== undefined) updates.saved_community_posts = savedCommunityPosts;

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      console.error("saved-content POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Dual-write to user_saved_items table
    const dualWrites = [
      { key: "savedBits" as const, items: savedBits },
      { key: "savedFormulas" as const, items: savedFormulas },
      { key: "savedRevisionCards" as const, items: savedRevisionCards },
      { key: "savedRevisionUnits" as const, items: savedRevisionUnits },
      { key: "savedCommunityPosts" as const, items: savedCommunityPosts },
    ];

    for (const { key, items } of dualWrites) {
      if (items !== undefined) {
        const itemType = TYPE_MAP[key];
        const result = await syncItemType(supabase, user.id, itemType, items);
        if (result.error) {
          console.error(`Dual-write failed for ${itemType}:`, result.error);
          // Don't fail the request — the profiles JSONB write already succeeded
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("saved-content POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
