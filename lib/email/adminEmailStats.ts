import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdminEmailOverview, EmailDayStats } from "@/lib/email/adminEmailTypes";
import { getEmailDailySendCap } from "@/lib/email/transactionalEmailLog";
import { getIstCalendarDateIso } from "@/lib/subscription/subjectChatLimits";

export type { AdminEmailOverview, EmailDayStats };

type LogRow = {
  ist_date: string;
  kind: string;
  status: string;
};

function shiftIstDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(utc));
}

function dayLabel(istDate: string, todayKey: string): string {
  const yesterdayKey = shiftIstDate(todayKey, -1);
  if (istDate === todayKey) return "Today";
  if (istDate === yesterdayKey) return "Yesterday";
  return new Date(`${istDate}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function emptyDay(istDate: string, todayKey: string): EmailDayStats {
  return {
    istDate,
    label: dayLabel(istDate, todayKey),
    sent: 0,
    failed: 0,
    blockedCap: 0,
    welcome: 0,
    login: 0,
  };
}

function aggregateRows(rows: LogRow[], todayKey: string): Map<string, EmailDayStats> {
  const map = new Map<string, EmailDayStats>();
  for (const row of rows) {
    const key = row.ist_date;
    let day = map.get(key);
    if (!day) {
      day = emptyDay(key, todayKey);
      map.set(key, day);
    }
    if (row.status === "sent") {
      day.sent += 1;
      if (row.kind === "welcome") day.welcome += 1;
      if (row.kind === "login") day.login += 1;
    } else if (row.status === "failed") {
      day.failed += 1;
    } else if (row.status === "blocked_cap") {
      day.blockedCap += 1;
    }
  }
  return map;
}

export async function buildAdminEmailOverview(
  admin: SupabaseClient<Database>
): Promise<AdminEmailOverview> {
  const todayKey = getIstCalendarDateIso();
  const startKey = shiftIstDate(todayKey, -13);

  const { data, error } = await admin
    .from("transactional_email_logs")
    .select("ist_date, kind, status")
    .gte("ist_date", startKey)
    .lte("ist_date", todayKey);

  if (error) throw new Error(error.message);

  const byDay = aggregateRows((data ?? []) as LogRow[], todayKey);
  const yesterdayKey = shiftIstDate(todayKey, -1);

  const last7Days: EmailDayStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftIstDate(todayKey, -i);
    last7Days.push(byDay.get(key) ?? emptyDay(key, todayKey));
  }

  const allDays = [...byDay.values()];
  const totals = allDays.reduce(
    (acc, d) => ({
      sent: acc.sent + d.sent,
      failed: acc.failed + d.failed,
      blockedCap: acc.blockedCap + d.blockedCap,
    }),
    { sent: 0, failed: 0, blockedCap: 0 }
  );

  return {
    cap: getEmailDailySendCap(),
    today: byDay.get(todayKey) ?? emptyDay(todayKey, todayKey),
    yesterday: byDay.get(yesterdayKey) ?? emptyDay(yesterdayKey, todayKey),
    last7Days,
    totals,
    welcomeFlow: {
      enabled: true,
      note:
        "New students/teachers (account under 14 days, first fresh sign-in) receive the welcome letter once. Returning students get login confirmation. Counts use IST calendar days.",
    },
  };
}
