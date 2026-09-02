export type MockPaperLevel = 1 | 2 | 3;

export const MOCK_LINEUP_SIZE = 10;

export const MOCK_DISCIPLINE_IDS = [
  "phy",
  "che",
  "mat",
  "bio",
  "amat",
  "biotech",
  "ent",
  "eng",
  "eco",
  "log",
  "gk",
  "fin",
] as const;

export type MockDisciplineId = (typeof MOCK_DISCIPLINE_IDS)[number];

export const MOCK_DISCIPLINE_NAMES: Record<MockDisciplineId, string> = {
  phy: "Physics",
  che: "Chemistry",
  mat: "Mathematics",
  bio: "Biology",
  amat: "Applied Mathematics",
  biotech: "Biotechnology",
  ent: "Entrepreneurship",
  eng: "Verbal Ability",
  eco: "Quantitative Ability",
  log: "Analytical Ability",
  gk: "General Knowledge",
  fin: "Financial Literacy",
};

const DISCIPLINE_SET = new Set<string>(MOCK_DISCIPLINE_IDS);

export type MockQuestionRow = {
  id: string;
  level: number;
  set_number: number;
  discipline_id: string;
  sort_order: number;
  stem: string;
  options: string[];
  correct_index: number;
};

export type FilterPaperFailure = {
  ok: false;
  reason: "incomplete_lineup" | "missing_discipline" | "wrong_count";
};

export type FilterPaperSuccess = {
  ok: true;
  questions: MockQuestionRow[];
};

export type FilterPaperResult = FilterPaperSuccess | FilterPaperFailure;

export function isMockPaperLevel(value: number): value is MockPaperLevel {
  return value === 1 || value === 2 || value === 3;
}

export function expectedPaperSize(level: MockPaperLevel): number {
  switch (level) {
    case 1:
      return 10;
    case 2:
      return 20;
    case 3:
      return 30;
    default: {
      const _never: never = level;
      return _never;
    }
  }
}

export function questionsPerDiscipline(level: MockPaperLevel): number {
  switch (level) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    default: {
      const _never: never = level;
      return _never;
    }
  }
}

export function parseCompleteLineup(raw: unknown): MockDisciplineId[] | null {
  if (!Array.isArray(raw) || raw.length !== MOCK_LINEUP_SIZE) return null;
  const ids: MockDisciplineId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !DISCIPLINE_SET.has(item) || seen.has(item)) {
      return null;
    }
    seen.add(item);
    ids.push(item as MockDisciplineId);
  }
  return ids;
}

export function filterMockPaper(params: {
  lineup: unknown;
  questions: MockQuestionRow[];
  level: MockPaperLevel;
}): FilterPaperResult {
  const lineup = parseCompleteLineup(params.lineup);
  if (!lineup) {
    return { ok: false, reason: "incomplete_lineup" };
  }

  const perDisc = questionsPerDiscipline(params.level);
  const byDiscipline = new Map<string, MockQuestionRow[]>();
  for (const question of params.questions) {
    const list = byDiscipline.get(question.discipline_id) ?? [];
    list.push(question);
    byDiscipline.set(question.discipline_id, list);
  }

  const selected: MockQuestionRow[] = [];
  for (const disc of lineup) {
    const rows = (byDiscipline.get(disc) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const taken = rows.filter((row) => row.sort_order >= 1 && row.sort_order <= perDisc);
    if (taken.length < perDisc) {
      return { ok: false, reason: "missing_discipline" };
    }
    selected.push(...taken.slice(0, perDisc));
  }

  if (selected.length !== expectedPaperSize(params.level)) {
    return { ok: false, reason: "wrong_count" };
  }

  return { ok: true, questions: selected };
}

export function disciplineTag(disciplineId: string): string {
  if (DISCIPLINE_SET.has(disciplineId)) {
    return MOCK_DISCIPLINE_NAMES[disciplineId as MockDisciplineId];
  }
  return disciplineId;
}
