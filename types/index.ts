export type Subject = 'physics' | 'chemistry' | 'math' | 'biology';
export type Stream = 'science' | 'commerce' | 'arts';
export type SubjectCombo = 'PCM' | 'PCMB';
export type ExamType = 'JEE' | 'NEET' | 'KCET' | 'other';
export type ClassLevel = 9 | 10 | 11 | 12;
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

export interface SavedRevisionCard {
  id: string;
  type: RevisionCardType;
  frontContent: string;
  backContent: string;
  subtopicName: string;
  topic: string;
  subject: Subject;
  classLevel: ClassLevel;
  status?: 'unsure' | 'tomorrow' | 'know_it' | 'new';
}

export interface UserProfile {
  name: string;
  classLevel: ClassLevel;
  stream: Stream;
  subjectCombo: SubjectCombo;
  rdm: number;
  answeredQuestions: string[];
  savedQuestions: string[];
  savedRevisionCards?: SavedRevisionCard[];
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
