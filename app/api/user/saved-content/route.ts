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
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionConfig,
} from "@/lib/subscription/subscriptionConfig";
import {
  dedupeRevisionCards,
  normalizeRevisionCardForSave,
} from "@/lib/saved/revisionCardIdentity";
import { hydrateRevisionCardFromSavedItemRow } from "@/lib/saved/revisionCardRowPayload";
import {
  diffRemovedContentIds,
  toSavedItemRow,
  upsertSavedItemRows,
} from "@/lib/saved/userSavedItemsSync";
import {
  filterSavedContentBundle,
  parseSavedContentTypesParam,
  savedContentWeakEtag,
  type SavedContentTypeKey,
} from "@/lib/saved/savedContentEtag";
import { isSupabaseNetworkError } from "@/lib/supabase/supabaseNodeFetch";

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

type ProfilePlanRow = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  payment_card_details?: unknown;
  subscription_started_at?: string | null;
  time_travel_offset_ms?: number | null;
};

type ProfileSavedFallbackRow = {
  saved_bits?: unknown;
  saved_formulas?: unknown;
  saved_revision_cards?: unknown;
  saved_revision_units?: unknown;
  saved_community_posts?: unknown;
};

type CapContext = {
  profile: ProfilePlanRow | null;
  cfg: SubscriptionConfig;
  counts: Map<ItemType, number>;
};

async function createCapContext(
  supabase: ReturnType<typeof createClientWithToken>,
  userId: string
): Promise<CapContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms"
    )
    .eq("id", userId)
    .maybeSingle();
  const cfg = await fetchSubscriptionConfig(supabase as unknown as Parameters<
    typeof fetchSubscriptionConfig
  >[0]);
  return {
    profile: (profile as ProfilePlanRow | null) ?? null,
    cfg,
    counts: new Map(),
  };
}

async function getItemTypeCount(
  supabase: ReturnType<typeof createClientWithToken>,
  ctx: CapContext,
  userId: string,
  itemType: ItemType
): Promise<number> {
  const cached = ctx.counts.get(itemType);
  if (cached !== undefined) return cached;
  const { count } = await supabase
    .from("user_saved_items")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("item_type", itemType);
  const n = count ?? 0;
  ctx.counts.set(itemType, n);
  return n;
}

/** Check plan-based save cap for an item type (one profile read per POST). */
async function checkCap(
  supabase: ReturnType<typeof createClientWithToken>,
  ctx: CapContext,
  userId: string,
  itemType: ItemType,
  newItemCount: number
): Promise<{ error: string | null }> {
  const tier = normalizePlanTier(
    ctx.profile?.plan_tier ?? "free",
    ctx.profile?.free_trial_activated,
    ctx.profile
  );
  const planLimits = getPlanLimits(ctx.cfg, tier);
  const cap =
    itemType === "saved_revision_card"
      ? planLimits.instacueCardLimit
      : itemType === "saved_bit"
        ? planLimits.savedBitLimit
        : itemType === "saved_formula"
          ? planLimits.savedFormulaLimit
          : getSaveCap(tier as PlanTier, itemType);

  if (cap === Infinity || isUnlimited(cap)) return { error: null };

  const currentCount = await getItemTypeCount(supabase, ctx, userId, itemType);
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

/**
 * Incremental sync: upsert changed rows, delete only removed content_ids.
 */
async function syncItemType(
  supabase: ReturnType<typeof createClientWithToken>,
  userId: string,
  itemType: ItemType,
  items: Record<string, unknown>[]
): Promise<{ error: string | null }> {
  const { data: existingRows, error: readErr } = await supabase
    .from("user_saved_items")
    .select("content_id")
    .eq("user_id", userId)
    .eq("item_type", itemType);

  if (readErr) return { error: readErr.message };

  const rows = items.map((item) => toSavedItemRow(userId, itemType, item));
  const upsertResult = await upsertSavedItemRows(supabase, rows);
  if (upsertResult.error) return upsertResult;

  const toDelete = diffRemovedContentIds(
    (existingRows ?? []).map((r) => r.content_id as string),
    items,
    itemType
  );

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("user_saved_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", itemType)
      .in("content_id", toDelete);
    if (delErr) return { error: delErr.message };
  }

  return { error: null };
}

function emptyGrouped() {
  return {
    savedBits: [] as SavedBit[],
    savedFormulas: [] as SavedFormula[],
    savedRevisionCards: [] as SavedRevisionCard[],
    savedRevisionUnits: [] as SavedRevisionUnit[],
    savedCommunityPosts: [] as SavedCommunityPost[],
  };
}

type SavedItemQueryRow = {
  item_type: string;
  data: unknown;
  status?: string | null;
  saved_at?: string | null;
  review_at?: string | null;
};

function groupedFromProfileRow(profile: ProfileSavedFallbackRow | null) {
  const grouped = emptyGrouped();
  if (!profile) return grouped;
  if (Array.isArray(profile.saved_bits)) grouped.savedBits = profile.saved_bits as SavedBit[];
  if (Array.isArray(profile.saved_formulas)) {
    grouped.savedFormulas = profile.saved_formulas as SavedFormula[];
  }
  if (Array.isArray(profile.saved_revision_cards)) {
    grouped.savedRevisionCards = profile.saved_revision_cards as SavedRevisionCard[];
  }
  if (Array.isArray(profile.saved_revision_units)) {
    grouped.savedRevisionUnits = profile.saved_revision_units as SavedRevisionUnit[];
  }
  if (Array.isArray(profile.saved_community_posts)) {
    grouped.savedCommunityPosts = profile.saved_community_posts as SavedCommunityPost[];
  }
  grouped.savedRevisionCards = dedupeRevisionCards(grouped.savedRevisionCards);
  return grouped;
}

function countGroupedItems(grouped: ReturnType<typeof emptyGrouped>): number {
  return (
    grouped.savedBits.length +
    grouped.savedFormulas.length +
    grouped.savedRevisionCards.length +
    grouped.savedRevisionUnits.length +
    grouped.savedCommunityPosts.length
  );
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const { searchParams } = new URL(request.url);
    const types = parseSavedContentTypesParam(searchParams.get("types"));
    const itemTypes = types
      ? types.map((key) => TYPE_MAP[key])
      : (Object.values(TYPE_MAP) as ItemType[]);

    let query = supabase
      .from("user_saved_items")
      .select("item_type, data, status, saved_at, review_at")
      .eq("user_id", user.id)
      .in("item_type", itemTypes)
      .order("created_at", { ascending: false });

    const primary = await query;
    let items = primary.data as SavedItemQueryRow[] | null;
    let error = primary.error;

    if (error?.message?.includes("review_at")) {
      const fallback = await supabase
        .from("user_saved_items")
        .select("item_type, data, status, saved_at")
        .eq("user_id", user.id)
        .in("item_type", itemTypes)
        .order("created_at", { ascending: false });
      items = fallback.data as SavedItemQueryRow[] | null;
      error = fallback.error;
    }

    if (error) {
      console.error("saved-content GET error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const grouped = emptyGrouped();

    for (const row of items ?? []) {
      switch (row.item_type) {
        case "saved_bit":
          grouped.savedBits.push(row.data as SavedBit);
          break;
        case "saved_formula":
          grouped.savedFormulas.push(row.data as SavedFormula);
          break;
        case "saved_revision_card":
          grouped.savedRevisionCards.push(
            hydrateRevisionCardFromSavedItemRow({
              data: row.data,
              status: row.status,
              saved_at: row.saved_at,
              review_at: row.review_at ?? null,
            })
          );
          break;
        case "saved_revision_unit":
          grouped.savedRevisionUnits.push(row.data as SavedRevisionUnit);
          break;
        case "saved_community_post":
          grouped.savedCommunityPosts.push(row.data as SavedCommunityPost);
          break;
      }
    }

    grouped.savedRevisionCards = dedupeRevisionCards(grouped.savedRevisionCards);

    if (countGroupedItems(grouped) === 0 && !types) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select(
          "saved_bits, saved_formulas, saved_revision_cards, saved_revision_units, saved_community_posts"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (profileErr) {
        console.error("saved-content GET profile fallback error", profileErr);
      } else if (profile) {
        Object.assign(grouped, groupedFromProfileRow(profile as ProfileSavedFallbackRow));
      }
    }

    const payload = filterSavedContentBundle(grouped, types);
    const etag = savedContentWeakEtag(payload, types);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "private, no-cache" },
      });
    }

    return NextResponse.json(payload, {
      headers: { ETag: etag, "Cache-Control": "private, no-cache" },
    });
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    console.error("saved-content GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startedMs = Date.now();
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
    const savedRevisionCardsRaw = Array.isArray(body?.savedRevisionCards)
      ? body.savedRevisionCards
      : undefined;
    const savedRevisionCards = savedRevisionCardsRaw
      ? dedupeRevisionCards(
          savedRevisionCardsRaw.map((raw: SavedRevisionCard) =>
            normalizeRevisionCardForSave(raw)
          )
        )
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

    const capCtx = await createCapContext(supabase, user.id);

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
        const capErr = await checkCap(supabase, capCtx, user.id, itemType, items.length);
        if (capErr.error) {
          return NextResponse.json({ error: capErr.error }, { status: 403 });
        }
      }
    }

    const writes = [
      { key: "savedBits" as const, items: savedBits },
      { key: "savedFormulas" as const, items: savedFormulas },
      { key: "savedRevisionCards" as const, items: savedRevisionCards },
      { key: "savedRevisionUnits" as const, items: savedRevisionUnits },
      { key: "savedCommunityPosts" as const, items: savedCommunityPosts },
    ];

    for (const { key, items } of writes) {
      if (items === undefined) continue;
      const itemType = TYPE_MAP[key];
      const result = await syncItemType(supabase, user.id, itemType, items);
      if (result.error) {
        console.error(`saved-content sync failed for ${itemType}:`, result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    }

    const elapsedMs = Date.now() - startedMs;
    const rowCounts = {
      bits: savedBits?.length,
      formulas: savedFormulas?.length,
      revisionCards: savedRevisionCards?.length,
      revisionUnits: savedRevisionUnits?.length,
      communityPosts: savedCommunityPosts?.length,
    };
    if (elapsedMs > 2000) {
      console.warn("[saved-content] slow POST", { userId: user.id, elapsedMs, rowCounts });
    }

    return NextResponse.json({ ok: true, elapsedMs });
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    console.error("saved-content POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
