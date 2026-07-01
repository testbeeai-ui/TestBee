import type { DifficultyLevel } from "@/core/domain/curriculum";
import { apiJson } from "./client";

export type TopicContentResponse = {
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  subtopicPreviews: { subtopicName: string; preview: string }[];
  exists: boolean;
};

export const lessonsApi = {
  getTopicContent(params: {
    board?: string;
    subject: string;
    classLevel: number;
    topic: string;
    level?: DifficultyLevel;
  }) {
    const q = new URLSearchParams({
      board: params.board ?? "cbse",
      subject: params.subject,
      classLevel: String(params.classLevel),
      topic: params.topic,
      level: params.level ?? "basics",
      hubScope: "topic",
    });
    return apiJson<TopicContentResponse>(`/api/topic-content?${q.toString()}`);
  },
};
