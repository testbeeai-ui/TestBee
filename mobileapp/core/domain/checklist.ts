export type DailyChecklistApiResponse = {
  today: string;
  dailyDoseDone: boolean;
  subtopicRoutineDone: boolean;
  gyanPlusDone: boolean;
  instacueSessionDone: boolean;
  challengeYourselfDone: boolean;
  gyanPlusProgress: {
    focusMs: number;
    savesToday: number;
    communityActionsToday: number;
  };
  instacueCombinedCount: number;
  savedRevisionCardCount: number;
  instacueReadCount: number;
  savedRevisionCardsDeckTotal: number;
};

export type ChecklistItem = {
  id: string;
  shortLabel: string;
  done: boolean;
  route?: string | null;
};

export function buildChecklistItems(data: DailyChecklistApiResponse | null): ChecklistItem[] {
  if (!data) return [];
  return [
    {
      id: "a",
      shortLabel: "Daily Routine (DailyDose + Funbrain)",
      done: data.dailyDoseDone,
      route: null,
    },
    {
      id: "b",
      shortLabel: "Lessons progress (PCM subtopics)",
      done: data.subtopicRoutineDone,
      route: "/(tabs)/learn",
    },
    {
      id: "c",
      shortLabel: "Gyan++ engagement (5 min + save + interact)",
      done: data.gyanPlusDone,
      route: "/(tabs)/gyan",
    },
    {
      id: "d",
      shortLabel: "Instacue (32 cards)",
      done: data.instacueSessionDone,
      route: null,
    },
    {
      id: "e",
      shortLabel: "Challenge Yourself",
      done: data.challengeYourselfDone,
      route: "/(tabs)/earn",
    },
  ];
}

export function checklistDoneCount(data: DailyChecklistApiResponse | null): number {
  return buildChecklistItems(data).filter((i) => i.done).length;
}
