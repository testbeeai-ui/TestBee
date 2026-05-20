export type PrepCalendarActivity = "class" | "revision" | "mock" | "doubt";

export type PrepCalendarDayRow = {
  day: string;
  class_count: number;
  revision_count: number;
  mock_count: number;
  doubt_count: number;
};

export type PrepCalendarSummary = {
  streak: number;
  totalActiveDays: number;
};

export function localDayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchPrepCalendarMonth(
  accessToken: string | undefined,
  year: number,
  month: number
): Promise<{ days: PrepCalendarDayRow[]; summary: PrepCalendarSummary | null }> {
  const headers: HeadersInit = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const today = encodeURIComponent(localDayISO());
  const res = await fetch(`/api/prep-calendar?year=${year}&month=${month}&today=${today}`, {
    credentials: "include",
    headers,
  });
  if (!res.ok) return { days: [], summary: null };
  const data = (await res.json()) as {
    days?: PrepCalendarDayRow[];
    summary?: PrepCalendarSummary | null;
  };
  return {
    days: Array.isArray(data.days) ? data.days : [],
    summary: data.summary ?? null,
  };
}

export async function incrementPrepCalendarDay(
  accessToken: string | undefined,
  activity: PrepCalendarActivity,
  day?: string
): Promise<boolean> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch("/api/prep-calendar", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ activity, day: day ?? localDayISO() }),
  });
  return res.ok;
}
