import type { ExamType } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Target, Trophy, ClipboardList, PenLine } from 'lucide-react';

export type TargetExamKey = 'cbse' | 'jee_mains' | 'jee_advance' | 'kcet' | 'other';

export const TARGET_EXAM_OPTIONS: {
  key: TargetExamKey;
  label: string;
  Icon: LucideIcon;
  iconClass: string;
}[] = [
  { key: 'cbse', label: 'CBSE', Icon: BookOpen, iconClass: 'text-blue-600' },
  { key: 'jee_mains', label: 'JEE Mains', Icon: Target, iconClass: 'text-foreground' },
  { key: 'jee_advance', label: 'JEE Advance', Icon: Trophy, iconClass: 'text-amber-600' },
  { key: 'kcet', label: 'KCET', Icon: ClipboardList, iconClass: 'text-foreground' },
  { key: 'other', label: 'Other', Icon: PenLine, iconClass: 'text-foreground' },
];

export function targetExamLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return TARGET_EXAM_OPTIONS.find((o) => o.key === key)?.label ?? null;
}

/** Maps DB target_exam to Zustand / Explore exam filter (CBSE = no filter). */
export function targetExamToExamType(key: string | null | undefined): ExamType | null {
  switch (key) {
    case 'jee_mains':
      return 'JEE_Mains';
    case 'jee_advance':
      return 'JEE_Advance';
    case 'kcet':
      return 'KCET';
    case 'other':
      return 'other';
    case 'cbse':
    default:
      return null;
  }
}

/** Persist Explore exam chips / modal choice to `profiles.target_exam`. */
export function examTypeToTargetExam(exam: ExamType | null): TargetExamKey {
  if (exam == null) return 'cbse';
  switch (exam) {
    case 'JEE_Mains':
      return 'jee_mains';
    case 'JEE_Advance':
      return 'jee_advance';
    case 'KCET':
      return 'kcet';
    case 'other':
      return 'other';
    default:
      return 'cbse';
  }
}
