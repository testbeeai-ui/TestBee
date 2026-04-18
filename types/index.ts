export type Subject = 'physics' | 'chemistry' | 'math' | 'biology';
export type Stream = 'science' | 'commerce' | 'arts';
export type SubjectCombo = 'PCM' | 'PCMB';
export type ExamType = 'JEE' | 'JEE_Mains' | 'JEE_Advance' | 'NEET' | 'KCET' | 'other';
export type ClassLevel = 11 | 12;
export type StreakPhase = 'playing' | 'break' | 'recall';

export interface Question {
  id: string;
  subject: Subject;
  topic: string;
  classLevel: ClassLevel;
  examType: ExamType[];
  question: string;
  options: string[];
  correctAnswer: number; // index
  hint: string;
  solution: string;
  reference: {
    theory: string;
    inventor?: string;
    relatedTopics: string[];
    applicationExample: string;
    youtubeUrl?: string;
  };
}

export type RevisionCardType = 'concept' | 'formula' | 'common_mistake' | 'trap';

/** Revision card; topic = unit name, subtopicName = topic (lesson) within that unit */
export interface SavedRevisionCard {
  id: string;
  type: RevisionCardType;
  frontContent: string;
  backContent: string;
  /** ISO time when the learner saved this card (used for daily checklist (d) counts). */
  savedAt?: string;
  /** Topic (lesson) within the unit */
  subtopicName: string;
  /** Unit name */
  topic: string;
  subject: Subject;
  classLevel: ClassLevel;
  status?: 'unsure' | 'tomorrow' | 'know_it' | 'new';
  /** Deep Dive / InstaCue context when saved from a section */
  level?: DifficultyLevel;
  board?: Board;
  sectionIndex?: number;
}

/** Syllabus board, e.g. CBSE. Default for Explore is CBSE. */
export type Board = 'CBSE' | 'ICSE';

/** Difficulty level for topic/Deep Dive. */
export type DifficultyLevel = 'basics' | 'intermediate' | 'advanced';

/** Saved Bits question from Deep Dive (one MCQ). */
export interface SavedBit {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  solution?: string;
  subject: Subject;
  topic: string;
  subtopicName: string;
  classLevel: ClassLevel;
  unitName?: string;
  level?: string;
  board?: Board;
  sectionIndex?: number;
  /** When saved from formula practice – used to show a "Formula" badge. */
  formulaName?: string;
  formulaLatex?: string;
}

/** Saved formula practice from Deep Dive. */
export interface SavedFormula {
  id: string;
  name: string;
  formulaLatex?: string;
  description?: string;
  bitsQuestions: Array<{ question: string; options: string[]; correctAnswer: number; solution?: string }>;
  subject: Subject;
  topic: string;
  subtopicName: string;
  classLevel: ClassLevel;
  unitName?: string;
  level?: string;
  board?: Board;
  sectionIndex?: number;
}

/** Saved Deep Dive section for "Unit Revision" – unit = chapter, subtopic = lesson. */
export interface SavedRevisionUnit {
  id: string;
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  /** Unit/chapter name (e.g. Thermodynamics). */
  unitName: string;
  /** Subtopic name (e.g. First Law). */
  subtopicName: string;
  level: DifficultyLevel;
  sectionIndex: number;
  /** Section title for display (e.g. "State Variables & Thermodynamic Walls"). */
  sectionTitle: string;
}

/** Saved community feed post for revision review. */
export interface SavedCommunityPost {
  id: string;
  postId: string;
  title: string;
  content: string;
  subject: string | null;
  chapterRef?: string | null;
  topicRef?: string | null;
  subtopicRef?: string | null;
  createdAt: string;
  savedAt: string;
}

export interface UserProfile {
  name: string;
  classLevel: ClassLevel;
  stream: Stream;
  subjectCombo: SubjectCombo;
  /** Syllabus board; default CBSE. Editable in Profile. */
  board?: Board;
  /** Exam focus for filtering topics/questions; null = no filter. Editable in Profile. */
  examType?: ExamType | null;
  rdm: number;
  answeredQuestions: string[];
  savedQuestions: string[];
  savedRevisionCards?: SavedRevisionCard[];
  /** Deep Dive sections marked for revision. */
  savedRevisionUnits?: SavedRevisionUnit[];
  /** Saved Bits questions from Deep Dive. */
  savedBits?: SavedBit[];
  /** Saved formula practice from Deep Dive. */
  savedFormulas?: SavedFormula[];
  /** Saved community posts from Lessons feed. */
  savedCommunityPosts?: SavedCommunityPost[];
  likedQuestions: string[];
  streakMinutes: number;
  isOnBreak: boolean;
  isSignedUp: boolean;
}

export interface AnswerResult {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timestamp: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  rdmAmount: number;
  features: string[];
  recommended?: boolean;
}

// Play (adaptive / gamified)
export type PlayDomain = 'academic' | 'funbrain';
export type AcademicCategory = 'physics' | 'chemistry' | 'math' | 'biology' | 'cs';
export type FunbrainCategory = 'puzzles' | 'verbal' | 'quantitative' | 'analytical';
export type PlayCategory = AcademicCategory | FunbrainCategory | 'mixed';

export interface PlayQuestionContent {
  text: string;
  latex?: string;
  imageUrl?: string | null;
}

export interface PlayQuestionRow {
  id: string;
  content: PlayQuestionContent;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
  difficulty_rating: number;
}

export interface UserPlayStatRow {
  user_id: string;
  category: string;
  current_rating: number;
  questions_answered: number;
  win_streak: number;
  updated_at: string;
}

export interface DailyGauntletLeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string | null;
  correct_count: number;
  total_time_ms: number;
  completed_at: string;
}
