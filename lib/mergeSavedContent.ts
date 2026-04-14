import type { SavedBit, SavedFormula, SavedRevisionCard, SavedRevisionUnit } from "@/types";

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
  serverBits: SavedBit[],
  serverFormulas: SavedFormula[],
  serverRevisionCards: SavedRevisionCard[],
  serverRevisionUnits: SavedRevisionUnit[]
): {
  savedBits: SavedBit[];
  savedFormulas: SavedFormula[];
  savedRevisionCards: SavedRevisionCard[];
  savedRevisionUnits: SavedRevisionUnit[];
} {
  return {
    savedBits: mergeSavedById(localBits, serverBits),
    savedFormulas: mergeSavedById(localFormulas, serverFormulas),
    savedRevisionCards: mergeSavedById(localRevisionCards, serverRevisionCards),
    savedRevisionUnits: mergeSavedById(localRevisionUnits, serverRevisionUnits),
  };
}
