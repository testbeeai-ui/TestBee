export type AdminAccountState = "active" | "suspended" | "banned" | "soft_deleted";

export type GovernanceMeta = {
  admin_suspended_until?: string | null;
  admin_soft_deleted?: boolean;
  admin_deleted_at?: string | null;
  admin_deleted_by?: string | null;
  admin_delete_scheduled_for?: string | null;
  [k: string]: unknown;
};

export function parseGovernanceMeta(raw: unknown): GovernanceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as GovernanceMeta;
}

export function computeAccountState(input: {
  bannedUntil?: string | null;
  appMetadata?: unknown;
  nowMs?: number;
}): AdminAccountState {
  const now = input.nowMs ?? Date.now();
  const meta = parseGovernanceMeta(input.appMetadata);
  const bannedUntil = input.bannedUntil ?? null;
  const suspendedUntil = meta.admin_suspended_until ?? null;
  const softDeleted = Boolean(meta.admin_soft_deleted);

  const isBanned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > now);
  if (isBanned) return "banned";
  if (softDeleted) return "soft_deleted";
  const isSuspended = Boolean(suspendedUntil && new Date(suspendedUntil).getTime() > now);
  if (isSuspended) return "suspended";
  return "active";
}

export function futureIsoFromDays(days: number): string {
  const ms = Math.max(1, Math.floor(days)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function isProtectedSystemAccount(input: {
  email?: string | null;
  role?: string | null;
}): boolean {
  const email = (input.email ?? "").toLowerCase();
  const role = (input.role ?? "").toLowerCase();
  if (role === "ai") return true;
  if (email.endsWith("@gyanpp.bot")) return true;
  if (email.includes("profpi@")) return true;
  if (email.includes("gyan-bot")) return true;
  return false;
}
