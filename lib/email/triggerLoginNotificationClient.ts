import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";

/** Fire-and-forget login notification — does not block the caller. */
export function triggerLoginNotificationEmail(): void {
  void (async () => {
    try {
      const headers = await getClientApiAuthHeaders();
      await fetch("/api/user/login-notification", {
        method: "POST",
        credentials: "include",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.warn("[login-notification] client trigger failed:", err);
    }
  })();
}
