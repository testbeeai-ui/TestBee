import { createHash } from "crypto";
import type {
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedCommunityPost,
} from "@/types";
import { fingerprintSavedContentSnapshot } from "@/lib/saved/savedContentService";

export type SavedContentTypeKey =
  | "savedBits"
  | "savedFormulas"
  | "savedRevisionCards"
  | "savedRevisionUnits"
  | "savedCommunityPosts";

const TYPE_ALIASES: Record<string, SavedContentTypeKey> = {
  bits: "savedBits",
  saved_bits: "savedBits",
  formulas: "savedFormulas",
  saved_formulas: "savedFormulas",
  revision_cards: "savedRevisionCards",
  saved_revision_cards: "savedRevisionCards",
  revision_units: "savedRevisionUnits",
  saved_revision_units: "savedRevisionUnits",
  community_posts: "savedCommunityPosts",
  saved_community_posts: "savedCommunityPosts",
};

export function parseSavedContentTypesParam(raw: string | null): SavedContentTypeKey[] | null {
  if (!raw?.trim()) return null;
  const keys = new Set<SavedContentTypeKey>();
  for (const part of raw.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const mapped = TYPE_ALIASES[token];
    if (mapped) keys.add(mapped);
  }
  return keys.size > 0 ? [...keys] : null;
}

export function filterSavedContentBundle<
  T extends {
    savedBits: SavedBit[];
    savedFormulas: SavedFormula[];
    savedRevisionCards: SavedRevisionCard[];
    savedRevisionUnits: SavedRevisionUnit[];
    savedCommunityPosts: SavedCommunityPost[];
  },
>(bundle: T, types: SavedContentTypeKey[] | null): T {
  if (!types) return bundle;
  const allow = new Set(types);
  return {
    ...bundle,
    savedBits: allow.has("savedBits") ? bundle.savedBits : [],
    savedFormulas: allow.has("savedFormulas") ? bundle.savedFormulas : [],
    savedRevisionCards: allow.has("savedRevisionCards") ? bundle.savedRevisionCards : [],
    savedRevisionUnits: allow.has("savedRevisionUnits") ? bundle.savedRevisionUnits : [],
    savedCommunityPosts: allow.has("savedCommunityPosts") ? bundle.savedCommunityPosts : [],
  };
}

/** HTTP-safe digest — fingerprint uses unit separators invalid in header values. */
function etagDigest(fingerprint: string): string {
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
}

/** Weak ETag for saved-content GET (If-None-Match / 304). */
export function savedContentWeakEtag(
  bundle: {
    savedBits: SavedBit[];
    savedFormulas: SavedFormula[];
    savedRevisionCards: SavedRevisionCard[];
    savedRevisionUnits: SavedRevisionUnit[];
    savedCommunityPosts: SavedCommunityPost[];
  },
  types: SavedContentTypeKey[] | null
): string {
  const filtered = filterSavedContentBundle(bundle, types);
  const fp = fingerprintSavedContentSnapshot(
    filtered.savedBits,
    filtered.savedFormulas,
    filtered.savedRevisionCards,
    filtered.savedRevisionUnits,
    filtered.savedCommunityPosts
  );
  const scope = types?.join(",") ?? "all";
  return `W/"${scope}-${etagDigest(fp)}"`;
}
