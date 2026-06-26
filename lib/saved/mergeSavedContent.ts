import type {
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedCommunityPost,
} from "@/types";
import { dedupeRevisionCards } from "@/lib/saved/revisionCardIdentity";
import { mergeRevisionCards } from "@/lib/saved/revisionCardRecall";

/**
 * Merge local and server saved arrays by `id`. Server entries win on conflict;
 * local-only entries (not present on server) are appended after server order.
 */
export function mergeSavedById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const serverIds = new Set(server.map((x) => x.id));
  const localOnly = local.filter((x) => !serverIds.has(x.id));
  return [...server, ...localOnly];
}

export function mergeAllSavedContent(
  localBits: SavedBit[],
  localFormulas: SavedFormula[],
  localRevisionCards: SavedRevisionCard[],
  localRevisionUnits: SavedRevisionUnit[],
  localCommunityPosts: SavedCommunityPost[],
  serverBits: SavedBit[],
  serverFormulas: SavedFormula[],
  serverRevisionCards: SavedRevisionCard[],
  serverRevisionUnits: SavedRevisionUnit[],
  serverCommunityPosts: SavedCommunityPost[]
): {
  savedBits: SavedBit[];
  savedFormulas: SavedFormula[];
  savedRevisionCards: SavedRevisionCard[];
  savedRevisionUnits: SavedRevisionUnit[];
  savedCommunityPosts: SavedCommunityPost[];
} {
  return {
    savedBits: mergeSavedById(localBits, serverBits),
    savedFormulas: mergeSavedById(localFormulas, serverFormulas),
    savedRevisionCards: dedupeRevisionCards(
      mergeRevisionCards(localRevisionCards, serverRevisionCards)
    ),
    savedRevisionUnits: mergeSavedById(localRevisionUnits, serverRevisionUnits),
    savedCommunityPosts: mergeSavedById(localCommunityPosts, serverCommunityPosts),
  };
}
