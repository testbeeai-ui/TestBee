import type { StudentNotification } from "@/core/domain/notifications";
import { getSupabaseClient } from "./client";

export async function fetchMotivationNotifications(userId: string): Promise<StudentNotification[]> {
  let query = getSupabaseClient()
    .from("posts")
    .select("id, title, created_at, classroom_id, content_json")
    .eq("type", "motivation")
    .contains("content_json", { targetStudentIds: [userId] })
    .order("created_at", { ascending: false })
    .limit(60);

  let { data, error } = await query;

  // Fallback if JSON contains filter is unsupported or returns nothing spuriously
  if (error) {
    const fallback = await getSupabaseClient()
      .from("posts")
      .select("id, title, created_at, classroom_id, content_json")
      .eq("type", "motivation")
      .order("created_at", { ascending: false })
      .limit(60);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  const rows =
    (data as Array<{
      id: string;
      title: string | null;
      created_at: string;
      classroom_id: string;
      content_json: unknown;
    }>) ?? [];

  const out: StudentNotification[] = [];

  for (const p of rows) {
    const o =
      p.content_json && typeof p.content_json === "object" && !Array.isArray(p.content_json)
        ? (p.content_json as Record<string, unknown>)
        : null;
    const ids = Array.isArray(o?.targetStudentIds)
      ? o.targetStudentIds.filter((x): x is string => typeof x === "string")
      : [];
    if (!ids.includes(userId)) continue;

    const message =
      typeof o?.message === "string" && o.message.trim()
        ? o.message.trim()
        : (p.title ?? "New message");
    const storedTitle =
      typeof o?.notificationTitle === "string" && o.notificationTitle.trim()
        ? o.notificationTitle.trim()
        : null;
    const recommendActionUrl =
      typeof o?.recommendActionUrl === "string" && o.recommendActionUrl.trim()
        ? o.recommendActionUrl.trim()
        : null;
    const relatedPostId =
      typeof o?.relatedPostId === "string" && o.relatedPostId.trim() ? o.relatedPostId.trim() : null;

    let actionPath: string | null = null;
    if (recommendActionUrl?.startsWith("/")) {
      actionPath = recommendActionUrl;
    } else if (relatedPostId) {
      actionPath = `/classroom/${p.classroom_id}?post=${relatedPostId}`;
    } else if (typeof o?.nudgeGoal === "string" && o.nudgeGoal === "restart_streak") {
      actionPath = "/(tabs)/home";
    }

    out.push({
      id: p.id,
      title: storedTitle ?? (p.title?.trim() || "Teacher message"),
      preview: message.slice(0, 160),
      body: message,
      createdAt: p.created_at,
      actionPath,
      rdmDelta: typeof o?.rdmDelta === "number" ? o.rdmDelta : undefined,
    });
  }

  return out;
}
