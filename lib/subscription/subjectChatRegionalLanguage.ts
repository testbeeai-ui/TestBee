import { DOUBT_SUPPORTED_LANGUAGES } from "@/lib/gyan/doubtSupportedLanguages";

export type SubjectChatRegionalCode = "hi" | "kn" | "ta" | "te";

export const REGIONAL_SUBJECT_CHAT_CODES: readonly SubjectChatRegionalCode[] = [
  "hi",
  "kn",
  "ta",
  "te",
] as const;

const REGIONAL_SET = new Set<string>(REGIONAL_SUBJECT_CHAT_CODES);

export function isRegionalSubjectChatCode(
  code: string
): code is SubjectChatRegionalCode {
  return REGIONAL_SET.has(code);
}

export function parseSubjectChatRegionalLanguage(
  value: string | null | undefined
): SubjectChatRegionalCode | null {
  if (!value) return null;
  const code = value.trim().toLowerCase();
  return isRegionalSubjectChatCode(code) ? code : null;
}

export function getSubjectChatRegionalLabel(code: SubjectChatRegionalCode): string {
  const row = DOUBT_SUPPORTED_LANGUAGES.find((l) => l.id === code);
  return row?.native ?? code;
}
