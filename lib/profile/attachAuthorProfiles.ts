import {
  chunkIds,
  parseHoverPreviewRows,
  uniqueUserIds,
  HOVER_PREVIEW_MAX_PAGE_IDS,
  type HoverPreviewRow,
} from "@/lib/profile/hoverPreview";
import { primeHoverPreviews, peekPublicProfile } from "@/lib/profile/publicProfileClientCache";

export type ProfilePreviewRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

export type ProfileNameAvatar = {
  name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

type PreviewRpcClient = {
  rpc: (fn: string, args: { p_ids: string[] }) => PromiseLike<{ data: unknown; error: unknown }>;
};

function asPreviewRpc(client: object): PreviewRpcClient {
  return client as PreviewRpcClient;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function unwrapProfileEmbed(value: unknown): ProfileNameAvatar | null {
  if (Array.isArray(value)) {
    return unwrapProfileEmbed(value[0] ?? null);
  }
  if (!isObjectRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name : null;
  const avatar_url = typeof value.avatar_url === "string" ? value.avatar_url : null;
  const role = typeof value.role === "string" ? value.role : null;
  if (
    name === null &&
    avatar_url === null &&
    role === null &&
    value.name === undefined &&
    value.avatar_url === undefined &&
    value.role === undefined
  ) {
    return null;
  }
  return role ? { name, avatar_url, role } : { name, avatar_url };
}

function mergedProfile(
  embed: ProfileNameAvatar | null,
  preview: ProfilePreviewRow | undefined
): ProfileNameAvatar | null {
  const name = embed?.name?.trim() || preview?.name || null;
  const avatar_url = embed?.avatar_url || preview?.avatar_url || null;
  const role = embed?.role || preview?.role || null;
  if (!name && !avatar_url && !role) return embed;
  return role ? { name, avatar_url, role } : { name, avatar_url };
}

export function mergeAuthorProfiles<T extends { user_id: string; profiles?: unknown }>(
  rows: T[],
  previews: ProfilePreviewRow[]
): T[] {
  const byId = new Map(previews.map((p) => [p.id, p]));
  return rows.map((row) => ({
    ...row,
    profiles: mergedProfile(unwrapProfileEmbed(row.profiles), byId.get(row.user_id)),
  }));
}

async function loadAuthorPreviews(client: object, userIds: string[]): Promise<HoverPreviewRow[]> {
  const uniqueIds = uniqueUserIds(userIds).slice(0, HOVER_PREVIEW_MAX_PAGE_IDS);
  if (uniqueIds.length === 0) return [];

  const cached: HoverPreviewRow[] = [];
  const toFetch: string[] = [];
  for (const id of uniqueIds) {
    const peeked = peekPublicProfile(id);
    if (peeked === undefined) {
      toFetch.push(id);
      continue;
    }
    if (peeked) {
      cached.push({
        id: peeked.id,
        name: peeked.name,
        avatar_url: peeked.avatarUrl,
        rdm: peeked.rdm,
        created_at: null,
        questions_asked: peeked.questionsAsked,
        answers_given: peeked.answersGiven,
      });
    }
  }

  const fetched =
    toFetch.length === 0
      ? []
      : (
          await Promise.all(
            chunkIds(toFetch).map(async (chunk) => {
              const { data, error } = await asPreviewRpc(client).rpc("profile_public_previews", {
                p_ids: chunk,
              });
              if (error) return [] as HoverPreviewRow[];
              return parseHoverPreviewRows(data);
            })
          )
        ).flat();

  primeHoverPreviews(fetched);
  return [...cached, ...fetched];
}

/** Fill author chips and warm hover cache via one batched profile_public_previews RPC. */
export async function attachAuthorProfiles<T extends { user_id: string; profiles?: unknown }>(
  client: object,
  rows: T[]
): Promise<T[]> {
  const unwrapped = rows.map((row) => ({
    ...row,
    profiles: unwrapProfileEmbed(row.profiles),
  })) as T[];
  const ids = unwrapped.map((row) => row.user_id);
  const previews = await loadAuthorPreviews(client, ids);
  if (previews.length === 0) return unwrapped;
  return mergeAuthorProfiles(unwrapped, previews) as T[];
}

type GyanFeedRow = {
  user_id: string;
  profiles?: unknown;
  doubt_answers?: Array<{ user_id: string; profiles?: unknown }>;
};

/** One (chunked) RPC for Gyan++ askers plus nested answers; also warms hover cache. */
export async function attachGyanFeedAuthors<T extends GyanFeedRow>(
  client: object,
  rows: readonly T[]
): Promise<T[]> {
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.user_id);
    for (const answer of row.doubt_answers ?? []) {
      ids.push(answer.user_id);
    }
  }
  const previews = await loadAuthorPreviews(client, ids);
  return rows.map((row) => {
    const [hydrated] = mergeAuthorProfiles([row], previews);
    const answers = row.doubt_answers
      ? mergeAuthorProfiles(row.doubt_answers, previews)
      : row.doubt_answers;
    return { ...row, ...hydrated, doubt_answers: answers };
  }) as T[];
}
