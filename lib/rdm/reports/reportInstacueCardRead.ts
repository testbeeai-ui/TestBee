import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboard/dashboardDayActivity";

const BATCH_FLUSH_MS = 5_000;
const MAX_BATCH_SIZE = 10;

const pendingCardIds = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function sendInstacueReadBatch(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  try {
    const { today } = localDayBoundsIso();
    const headers = await getClientApiAuthHeaders();
    const body =
      cardIds.length === 1
        ? { action: "instacue_read", today, cardId: cardIds[0] }
        : { action: "instacue_read_batch", today, cardIds };
    const res = await fetch("/api/user/daily-checklist", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await res.text().catch(() => "");
    }
  } catch {
    /* non-fatal */
  }
}

function flushPendingReads(): void {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  if (pendingCardIds.size === 0) return;
  const batch = [...pendingCardIds].slice(0, MAX_BATCH_SIZE);
  for (const id of batch) pendingCardIds.delete(id);
  void sendInstacueReadBatch(batch);
  if (pendingCardIds.size > 0) {
    batchTimer = setTimeout(flushPendingReads, 0);
  }
}

function scheduleBatchFlush(): void {
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    batchTimer = null;
    flushPendingReads();
  }, BATCH_FLUSH_MS);
}

/**
 * Credit InstaCue / revision card ids as "read" for today's daily checklist.
 * Batches up to 10 ids over 5s to reduce PATCH volume during revision sessions.
 */
export function reportInstacueCardRead(cardId: string | undefined | null): void {
  const id = typeof cardId === "string" ? cardId.trim() : "";
  if (!id) return;
  pendingCardIds.add(id);
  if (pendingCardIds.size >= MAX_BATCH_SIZE) {
    flushPendingReads();
    return;
  }
  scheduleBatchFlush();
}

/** Batch credit immediately (e.g. after full subtopic lesson checklist). Capped server-side. */
export async function reportInstacueCardReadBatch(cardIds: string[]): Promise<void> {
  if (!Array.isArray(cardIds) || cardIds.length === 0) return;
  const ids = cardIds.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean);
  if (ids.length === 0) return;
  await sendInstacueReadBatch(ids);
}
