import type { SupabaseClient } from "@supabase/supabase-js";
import { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/mobile/expoPush";

type MotivationPushInput = {
  targetStudentIds: string[];
  title: string;
  body: string;
  motivationPostId: string;
};

/** Fire-and-forget Expo push to registered mobile devices for target students. */
export async function sendMotivationPushToStudents(
  admin: SupabaseClient,
  input: MotivationPushInput
): Promise<void> {
  const studentIds = [...new Set(input.targetStudentIds.map((id) => id.trim()).filter(Boolean))];
  if (studentIds.length === 0) return;

  const { data, error } = await admin
    .from("mobile_push_tokens")
    .select("token, user_id")
    .in("user_id", studentIds);

  if (error) {
    console.error("[motivation-push] token lookup", error.message);
    return;
  }

  const rows = (data ?? []) as Array<{ token: string; user_id: string }>;
  if (rows.length === 0) return;

  const title = input.title.trim() || "Teacher message";
  const body = input.body.trim().slice(0, 180) || "Open EduBlast to read your message.";

  const messages: ExpoPushMessage[] = rows
    .filter((row) => typeof row.token === "string" && row.token.startsWith("ExponentPushToken"))
    .map((row) => ({
      to: row.token,
      title,
      body,
      sound: "default",
      channelId: "default",
      data: {
        type: "motivation",
        postId: input.motivationPostId,
        route: "/notifications",
      },
    }));

  await sendExpoPushMessages(messages);
}
