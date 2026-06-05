const DEFAULT_DAILY_CAP = 500;

export function getEmailDailySendCap(): number {
  const raw = process.env.EMAIL_DAILY_SEND_CAP?.trim();
  if (!raw) return DEFAULT_DAILY_CAP;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_CAP;
  return Math.floor(n);
}
