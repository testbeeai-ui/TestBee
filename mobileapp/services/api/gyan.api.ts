import { apiFetch, apiJson } from "./client";

export type GyanDoubtAccess = {
  canPost: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number | null;
  unlimited: boolean;
};

export type PostDoubtPayload = {
  title: string;
  body?: string;
  subject: string;
  costRdm?: number;
  bountyRdm?: number;
};

export type PostDoubtResponse = {
  ok: boolean;
  id?: string | null;
  error?: string;
  limitReached?: boolean;
};

export const gyanApi = {
  getAccess: () => apiJson<GyanDoubtAccess>("/api/gyan/doubt-access"),

  postDoubt: (payload: PostDoubtPayload) =>
    apiJson<PostDoubtResponse>("/api/gyan/doubt-post", {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        body: payload.body ?? "",
        subject: payload.subject,
        costRdm: payload.costRdm ?? 0,
        bountyRdm: payload.bountyRdm ?? 0,
      }),
    }),

  triggerProfPiAnswer: (doubtId: string) =>
    apiFetch("/api/gyan-bot-answer", {
      method: "POST",
      body: JSON.stringify({ doubtId }),
    }),
};
