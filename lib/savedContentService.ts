import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import type { SavedBit, SavedFormula, SavedRevisionCard, SavedRevisionUnit } from "@/types";

const API = "/api/user/saved-content";

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

export async function fetchSavedContent(): Promise<{
  savedBits: SavedBit[];
  savedFormulas: SavedFormula[];
  savedRevisionCards: SavedRevisionCard[];
  savedRevisionUnits: SavedRevisionUnit[];
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(API, { headers });
  if (!res.ok) {
    if (res.status === 401) {
      return { savedBits: [], savedFormulas: [], savedRevisionCards: [], savedRevisionUnits: [] };
    }
    throw new Error("Failed to fetch saved content");
  }
  const data = await res.json();
  return {
    savedBits: Array.isArray(data.savedBits) ? data.savedBits : [],
    savedFormulas: Array.isArray(data.savedFormulas) ? data.savedFormulas : [],
    savedRevisionCards: Array.isArray(data.savedRevisionCards) ? data.savedRevisionCards : [],
    savedRevisionUnits: Array.isArray(data.savedRevisionUnits) ? data.savedRevisionUnits : [],
  };
}

export async function syncSavedContent(
  savedBits: SavedBit[],
  savedFormulas: SavedFormula[],
  savedRevisionCards: SavedRevisionCard[],
  savedRevisionUnits: SavedRevisionUnit[]
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ savedBits, savedFormulas, savedRevisionCards, savedRevisionUnits }),
  });
  if (!res.ok && res.status !== 401) {
    throw new Error("Failed to sync saved content");
  }
}

/** POST current store snapshot (bits, formulas, revision cards, revision units) for the signed-in user. */
export async function syncAllSavedContent(): Promise<void> {
  const user = useUserStore.getState().user;
  if (!user) return;
  await syncSavedContent(
    user.savedBits ?? [],
    user.savedFormulas ?? [],
    user.savedRevisionCards ?? [],
    user.savedRevisionUnits ?? []
  );
}
