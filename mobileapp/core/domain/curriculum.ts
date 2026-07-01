export type Subject = "physics" | "chemistry" | "math";
export type ClassLevel = 11 | 12;
export type DifficultyLevel = "basics" | "intermediate" | "advanced";

export type TopicNode = {
  subject: Subject;
  classLevel: ClassLevel;
  topic: string;
  chapterTitle?: string;
  unitTitle?: string;
  unitLabel?: string;
  subtopics: { name: string }[];
};
