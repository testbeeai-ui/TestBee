import { buildWeeklyRRule } from "@/lib/integrations/googleCalendarRrule";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_EVENTS = "https://www.googleapis.com/calendar/v3/calendars";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Token exchange failed (${res.status})`);
  }
  return json;
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Refresh failed (${res.status})`);
  }
  return json;
}

type ConferenceCreateRequest = {
  createRequest: {
    requestId: string;
    conferenceSolutionKey: { type: string };
  };
};

type CalendarEventBody = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  recurrence?: string[];
  conferenceData?: ConferenceCreateRequest;
};

function meetUriFromEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const cd = (
    event as { conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } }
  ).conferenceData;
  const eps = cd?.entryPoints;
  if (!Array.isArray(eps)) return null;
  const video = eps.find((e) => e.entryPointType === "video");
  return typeof video?.uri === "string" ? video.uri : null;
}

export async function insertCalendarEventWithMeet(input: {
  accessToken: string;
  calendarId: string;
  body: CalendarEventBody;
}): Promise<{ id: string; meetLink: string | null; raw: unknown }> {
  const calId = encodeURIComponent(input.calendarId);
  const url = `${CAL_EVENTS}/${calId}/events?conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (raw as { error?: { message?: string } }).error?.message === "string"
        ? (raw as { error: { message: string } }).error.message
        : `Calendar insert failed (${res.status})`;
    throw new Error(msg);
  }
  const id = typeof (raw as { id?: string }).id === "string" ? (raw as { id: string }).id : "";
  if (!id) throw new Error("Calendar API returned no event id.");
  return { id, meetLink: meetUriFromEvent(raw), raw };
}

export async function getCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<unknown> {
  const calId = encodeURIComponent(input.calendarId);
  const evId = encodeURIComponent(input.eventId);
  const res = await fetch(`${CAL_EVENTS}/${calId}/events/${evId}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (raw as { error?: { message?: string } }).error?.message === "string"
        ? (raw as { error: { message: string } }).error.message
        : `Get event failed (${res.status})`;
    throw new Error(msg);
  }
  return raw;
}

export async function patchCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  body: Record<string, unknown>;
  /** When updating attendees, use `all` so Google emails invites. */
  sendUpdates?: "all" | "externalOnly" | "none";
}): Promise<void> {
  const calId = encodeURIComponent(input.calendarId);
  const evId = encodeURIComponent(input.eventId);
  const qs = input.sendUpdates ? `?sendUpdates=${encodeURIComponent(input.sendUpdates)}` : "";
  const res = await fetch(`${CAL_EVENTS}/${calId}/events/${evId}${qs}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const msg =
      typeof (raw as { error?: { message?: string } }).error?.message === "string"
        ? (raw as { error: { message: string } }).error.message
        : `Patch event failed (${res.status})`;
    throw new Error(msg);
  }
}

export async function deleteCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const calId = encodeURIComponent(input.calendarId);
  const evId = encodeURIComponent(input.eventId);
  const res = await fetch(`${CAL_EVENTS}/${calId}/events/${evId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Delete event failed (${res.status}) ${raw.slice(0, 200)}`);
  }
}

export function buildEventPayload(input: {
  title: string;
  description?: string;
  /** ISO local wall time without offset: YYYY-MM-DDTHH:mm:ss */
  startLocalIso: string;
  durationMinutes: number;
  timeZone: string;
  repeatDays: string[];
  scheduleEndDate?: string | null;
  classCount?: number | null;
}): CalendarEventBody {
  const start = new Date(`${input.startLocalIso}`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start date/time.");
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  const rrule = buildWeeklyRRule({
    repeatDays: input.repeatDays,
    untilDate: input.scheduleEndDate ?? null,
    count: input.classCount ?? null,
  });

  const body: CalendarEventBody = {
    summary: input.title,
    description: input.description,
    start: { dateTime: fmt(start), timeZone: input.timeZone },
    end: { dateTime: fmt(end), timeZone: input.timeZone },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (rrule) body.recurrence = [rrule];
  return body;
}

/** One-off calendar event (no RRULE) for explicit live-class slot booking. */
export function buildSingleEventPayload(input: {
  title: string;
  description?: string;
  /** ISO local wall time without offset: YYYY-MM-DDTHH:mm:ss */
  startLocalIso: string;
  durationMinutes: number;
  timeZone: string;
}): CalendarEventBody {
  const start = new Date(`${input.startLocalIso}`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start date/time.");
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: fmt(start), timeZone: input.timeZone },
    end: { dateTime: fmt(end), timeZone: input.timeZone },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}
