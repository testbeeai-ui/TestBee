export type SubjectChatQuota = {
  plan: string;
  dailyLimit: number | null;
  unlimited: boolean;
  usedToday: number;
  remaining: number | null;
  multilingual: boolean;
  regionalLanguage: string | null;
  needsRegionalLanguageSelection: boolean;
  canSend: boolean;
  istDate: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type SubjectChatScope = {
  subject: "physics" | "chemistry" | "math";
  topic?: string;
  subtopic?: string;
  gradeLevel?: number;
};
