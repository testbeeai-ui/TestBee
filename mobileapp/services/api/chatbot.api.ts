import type { SubjectChatQuota, SubjectChatScope } from "@/core/domain/chatbot";
import { apiJson } from "./client";

export type SubjectChatResponse = {
  reply: string;
  language?: string;
  quota?: Partial<SubjectChatQuota>;
  error?: string;
  code?: string;
  usedToday?: number;
};

export const chatbotApi = {
  getQuota: () => apiJson<SubjectChatQuota>("/api/user/subject-chat-quota"),

  sendMessage: (payload: SubjectChatScope & { message: string; language?: string }) =>
    apiJson<SubjectChatResponse>("/api/subject-chat", {
      method: "POST",
      body: JSON.stringify({
        message: payload.message,
        subject: payload.subject,
        topic: payload.topic ?? "general",
        subtopic: payload.subtopic ?? "",
        gradeLevel: payload.gradeLevel ?? 12,
        language: payload.language ?? "en",
      }),
    }),
};
