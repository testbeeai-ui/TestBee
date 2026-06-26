import type { Json } from "@/integrations/supabase/types";
import type { ItemType } from "@/lib/saved/savedItemCap";
import type { SavedRevisionCard } from "@/types";
import { slimRevisionCardStorage } from "@/lib/saved/revisionCardRowPayload";

export type SavedItemRowInput = {
  user_id: string;
  item_type: ItemType;
  content_id: string;
  subject: string | null;
  status: string | null;
  saved_at: string | null;
  review_at?: string | null;
  data: Json;
};

export function getSavedItemContentId(
  item: Record<string, unknown>,
  itemType: ItemType
): string {
  if (itemType === "saved_community_post") {
    return (item.postId as string) ?? (item.id as string) ?? "unknown";
  }
  return (item.id as string) ?? "unknown";
}

export function getSavedItemSubject(item: Record<string, unknown>): string | null {
  return (item.subject as string) ?? null;
}

export function getSavedItemStatus(
  item: Record<string, unknown>,
  itemType: ItemType
): string | null {
  if (itemType === "saved_revision_card") {
    return (item.status as string) ?? null;
  }
  return null;
}

export function getSavedItemSavedAt(
  item: Record<string, unknown>,
  itemType: ItemType
): string | null {
  if (itemType === "saved_revision_card" || itemType === "saved_community_post") {
    return (item.savedAt as string) ?? null;
  }
  return null;
}

export function toSavedItemRow(
  userId: string,
  itemType: ItemType,
  item: Record<string, unknown> | object
): SavedItemRowInput {
  const row = item as Record<string, unknown>;
  if (itemType === "saved_revision_card") {
    const slim = slimRevisionCardStorage(item as SavedRevisionCard);
    return {
      user_id: userId,
      item_type: itemType,
      content_id: getSavedItemContentId(row, itemType),
      subject: getSavedItemSubject(row),
      status: slim.status,
      saved_at: slim.saved_at,
      review_at: slim.review_at,
      data: slim.data as unknown as Json,
    };
  }
  return {
    user_id: userId,
    item_type: itemType,
    content_id: getSavedItemContentId(row, itemType),
    subject: getSavedItemSubject(row),
    status: getSavedItemStatus(row, itemType),
    saved_at: getSavedItemSavedAt(row, itemType),
    data: item as unknown as Json,
  };
}

/** Compute content_ids to delete after a client sync. */
export function diffRemovedContentIds(
  existingContentIds: Iterable<string>,
  nextItems: Record<string, unknown>[],
  itemType: ItemType
): string[] {
  const nextIds = new Set(nextItems.map((item) => getSavedItemContentId(item, itemType)));
  return [...existingContentIds].filter((id) => !nextIds.has(id));
}

const UPSERT_CHUNK = 100;

export async function upsertSavedItemRows(
  supabase: unknown,
  rows: SavedItemRowInput[]
): Promise<{ error: string | null }> {
  const client = supabase as {
    from: (table: string) => {
      upsert: (
        chunk: SavedItemRowInput[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await client.from("user_saved_items").upsert(chunk, {
      onConflict: "user_id,item_type,content_id",
    });
    if (error) return { error: error.message };
  }
  return { error: null };
}
