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

function parsePreviewRows(data: unknown): ProfilePreviewRow[] {
  if (!Array.isArray(data)) return [];
  const rows: ProfilePreviewRow[] = [];
  for (const item of data) {
    if (!isObjectRecord(item) || typeof item.id !== "string") continue;
    rows.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : null,
      avatar_url: typeof item.avatar_url === "string" ? item.avatar_url : null,
      role: typeof item.role === "string" ? item.role : null,
    });
  }
  return rows;
}

async function loadAuthorPreviews(
  client: object,
  userIds: string[]
): Promise<ProfilePreviewRow[]> {
  const missingIds = [...new Set(userIds.filter(Boolean))].slice(0, 500);
  if (missingIds.length === 0) return [];
  const { data, error } = await asPreviewRpc(client).rpc("profile_public_previews", {
    p_ids: missingIds,
  });
  if (error) return [];
  return parsePreviewRows(data);
}

/** Fill missing author name/avatar via profile_public_previews (own-row RLS bypass). */
export async function attachAuthorProfiles<T extends { user_id: string; profiles?: unknown }>(
  client: object,
  rows: T[]
): Promise<T[]> {
  const unwrapped = rows.map((row) => ({
    ...row,
    profiles: unwrapProfileEmbed(row.profiles),
  })) as T[];
  const missingIds = unwrapped
    .filter((row) => !unwrapProfileEmbed(row.profiles)?.name?.trim())
    .map((row) => row.user_id);
  if (missingIds.length === 0) return unwrapped;
  return mergeAuthorProfiles(unwrapped, await loadAuthorPreviews(client, missingIds)) as T[];
}

type GyanFeedRow = {
  user_id: string;
  profiles?: unknown;
  doubt_answers?: Array<{ user_id: string; profiles?: unknown }>;
};

/** One RPC for Gyan++ askers plus nested answers. */
export async function attachGyanFeedAuthors<T extends GyanFeedRow>(
  client: object,
  rows: readonly T[]
): Promise<T[]> {
  const ids: string[] = [];
  for (const row of rows) {
    if (!unwrapProfileEmbed(row.profiles)?.name?.trim()) ids.push(row.user_id);
    for (const answer of row.doubt_answers ?? []) {
      if (!unwrapProfileEmbed(answer.profiles)?.name?.trim()) ids.push(answer.user_id);
    }
  }
  const previews = await loadAuthorPreviews(client, ids);
  if (previews.length === 0 && ids.length === 0) {
    return rows.map((row) => ({
      ...row,
      profiles: unwrapProfileEmbed(row.profiles),
      doubt_answers: row.doubt_answers
        ? mergeAuthorProfiles(row.doubt_answers, [])
        : row.doubt_answers,
    })) as T[];
  }
  return rows.map((row) => {
    const [hydrated] = mergeAuthorProfiles([row], previews);
    const answers = row.doubt_answers
      ? mergeAuthorProfiles(row.doubt_answers, previews)
      : row.doubt_answers;
    return { ...row, ...hydrated, doubt_answers: answers };
  }) as T[];
}
