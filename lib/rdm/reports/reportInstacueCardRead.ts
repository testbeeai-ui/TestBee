import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboard/dashboardDayActivity";

/**
 * Credit one InstaCue / revision card id as "read" for today's daily checklist (union with saves).
 * Fire-and-forget; failures are ignored (checklist can refresh on next GET).
 */
export async function reportInstacueCardRead(cardId: string | undefined | null): Promise<void> {
  const id = typeof cardId === "string" ? cardId.trim() : "";
  if (!id) return;
  try {
    const { today } = localDayBoundsIso();
    const headers = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/daily-checklist", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "instacue_read", today, cardId: id }),
    });
    if (!res.ok) {
      await res.text().catch(() => "");
    }
  } catch {
    /* non-fatal */
  }
}

/** Batch credit (e.g. after full subtopic lesson checklist). Capped server-side. */
export async function reportInstacueCardReadBatch(cardIds: string[]): Promise<void> {
  if (!Array.isArray(cardIds) || cardIds.length === 0) return;
  try {
    const { today } = localDayBoundsIso();
    const headers = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/daily-checklist", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "instacue_read_batch", today, cardIds }),
    });
    if (!res.ok) {
      await res.text().catch(() => "");
    }
  } catch {
    /* non-fatal */
  }
}
