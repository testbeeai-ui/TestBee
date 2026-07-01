import { Platform } from "react-native";
import { apiJson } from "./client";

export type PushTokenRow = {
  platform: string;
  updatedAt: string;
  tokenSuffix: string;
};

export const pushTokenApi = {
  list: () => apiJson<{ tokens: PushTokenRow[] }>("/api/user/mobile-push-token"),

  register: (token: string) =>
    apiJson<{ ok: boolean }>("/api/user/mobile-push-token", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
      }),
    }),

  unregister: (token: string) =>
    apiJson<{ ok: boolean }>("/api/user/mobile-push-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),
};
