export type QuizQuestion = {
  id: string;
  tag: string;
  q: string;
  options: string[];
  /** Preloaded with the paper so option clicks do not wait on the DB. */
  correctIndex?: number;
};

export type EduDecaMockLevelId = 1 | 2 | 3;

export const EDUDECA_MOCK_LEVELS: Array<{
  id: EduDecaMockLevelId;
  name: string;
  meta: string;
  color: string;
  questionCount: number;
}> = [
  { id: 1, name: "Level 1", meta: "Foundation · 10 Qs", color: "#1D9E75", questionCount: 10 },
  { id: 2, name: "Level 2", meta: "Building up · 20 Qs", color: "#378ADD", questionCount: 20 },
  { id: 3, name: "Level 3", meta: "Free zone finale · 30 Qs", color: "#7F77DD", questionCount: 30 },
];

export function questionCountForLevel(level: EduDecaMockLevelId): number {
  const found = EDUDECA_MOCK_LEVELS.find((item) => item.id === level);
  return found?.questionCount ?? 10;
}

export function isEduDecaMockLevel(value: number): value is EduDecaMockLevelId {
  return value === 1 || value === 2 || value === 3;
}
