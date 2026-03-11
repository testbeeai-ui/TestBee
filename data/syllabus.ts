import type { ClassLevel } from '@/types';

/** Quiz metadata linked to a study nugget (not the questions themselves). */
export interface QuizLink {
  quizId: string;
  totalQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/** Leaf node – the "nugget" a student studies in the Execute phase. */
export interface StudyNugget {
  id: string;
  title: string;
  durationMinutes: number;
  type: 'video' | 'article';
  quiz: QuizLink;
}

/** Chapter / topic level. */
export interface ChapterTopic {
  id: string;
  title: string;
  subTopics: StudyNugget[];
}

/** Subject within a grade (aligns with Subject type for Plan Builder). */
export interface SyllabusSubject {
  id: string;
  name: string;
  topics: ChapterTopic[];
}

/** Root per grade – full curriculum for one class. */
export interface GradeCurriculum {
  gradeLevel: ClassLevel;
  subjects: SyllabusSubject[];
}

export const MOCK_SYLLABUS_DATA: GradeCurriculum[] = [
  // ========== CLASS 11 ==========
  {
    gradeLevel: 11,
    subjects: [
      {
        id: 'math-11',
        name: 'Mathematics',
        topics: [
          {
            id: 'math-11-sets',
            title: 'Sets',
            subTopics: [
              { id: 'math-11-sets-1', title: 'Sets and Their Representations', durationMinutes: 14, type: 'article', quiz: { quizId: 'q-sets-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'math-11-sets-2', title: 'Venn Diagrams and Operations on Sets', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-sets-2', totalQuestions: 8, difficulty: 'medium' } },
              { id: 'math-11-sets-3', title: 'Complement of a Set', durationMinutes: 12, type: 'article', quiz: { quizId: 'q-sets-3', totalQuestions: 4, difficulty: 'easy' } },
            ],
          },
          {
            id: 'math-11-fn',
            title: 'Relations and Functions',
            subTopics: [
              { id: 'math-11-fn-1', title: 'Cartesian Product and Relations', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-fn-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'math-11-fn-2', title: 'Functions and Types of Functions', durationMinutes: 22, type: 'article', quiz: { quizId: 'q-fn-2', totalQuestions: 7, difficulty: 'hard' } },
              { id: 'math-11-fn-3', title: 'Algebra of Real Functions', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-fn-3', totalQuestions: 5, difficulty: 'medium' } },
            ],
          },
          {
            id: 'math-11-trig',
            title: 'Trigonometric Functions',
            subTopics: [
              { id: 'math-11-trig-1', title: 'Angles and Radian Measure', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-trig-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'math-11-trig-2', title: 'Trigonometric Ratios of Specific Angles', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-trig-2', totalQuestions: 8, difficulty: 'medium' } },
              { id: 'math-11-trig-3', title: 'Trigonometric Identities', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-trig-3', totalQuestions: 8, difficulty: 'hard' } },
            ],
          },
        ],
      },
      {
        id: 'physics-11',
        name: 'Physics',
        topics: [
          {
            id: 'phy-11-units',
            title: 'Units and Measurements',
            subTopics: [
              { id: 'phy-11-units-1', title: 'SI Units and Dimensional Analysis', durationMinutes: 18, type: 'article', quiz: { quizId: 'q-units-1', totalQuestions: 6, difficulty: 'easy' } },
              { id: 'phy-11-units-2', title: 'Errors in Measurement', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-units-2', totalQuestions: 5, difficulty: 'medium' } },
            ],
          },
          {
            id: 'phy-11-kin',
            title: 'Kinematics',
            subTopics: [
              { id: 'phy-11-kin-1', title: 'Motion in a Straight Line', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-kin-1', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'phy-11-kin-2', title: 'Vectors and Projectile Motion', durationMinutes: 26, type: 'article', quiz: { quizId: 'q-kin-2', totalQuestions: 9, difficulty: 'hard' } },
              { id: 'phy-11-kin-3', title: 'Uniform Circular Motion', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-kin-3', totalQuestions: 6, difficulty: 'medium' } },
            ],
          },
          {
            id: 'phy-11-laws',
            title: 'Laws of Motion',
            subTopics: [
              { id: 'phy-11-laws-1', title: "Newton's Laws and Impulse", durationMinutes: 22, type: 'video', quiz: { quizId: 'q-laws-1', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'phy-11-laws-2', title: 'Friction – Static and Kinetic', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-laws-2', totalQuestions: 6, difficulty: 'hard' } },
            ],
          },
        ],
      },
    ],
  },

  // ========== CLASS 12 ==========
  {
    gradeLevel: 12,
    subjects: [
      {
        id: 'math-12',
        name: 'Mathematics',
        topics: [
          {
            id: 'math-12-calc',
            title: 'Calculus',
            subTopics: [
              { id: 'math-12-calc-1', title: 'Limits and Continuity', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-calc-1', totalQuestions: 8, difficulty: 'hard' } },
              { id: 'math-12-calc-2', title: 'Derivatives and Rules of Differentiation', durationMinutes: 26, type: 'article', quiz: { quizId: 'q-calc-2', totalQuestions: 9, difficulty: 'hard' } },
              { id: 'math-12-calc-3', title: 'Applications of Derivatives', durationMinutes: 22, type: 'video', quiz: { quizId: 'q-calc-3', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'math-12-calc-4', title: 'Integration and Definite Integrals', durationMinutes: 28, type: 'video', quiz: { quizId: 'q-calc-4', totalQuestions: 8, difficulty: 'hard' } },
            ],
          },
          {
            id: 'math-12-mat',
            title: 'Matrices',
            subTopics: [
              { id: 'math-12-mat-1', title: 'Types of Matrices and Operations', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-mat-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'math-12-mat-2', title: 'Determinants and Properties', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-mat-2', totalQuestions: 8, difficulty: 'hard' } },
              { id: 'math-12-mat-3', title: 'Inverse of a Matrix', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-mat-3', totalQuestions: 6, difficulty: 'medium' } },
            ],
          },
        ],
      },
      {
        id: 'physics-12',
        name: 'Physics',
        topics: [
          {
            id: 'phy-12-elec',
            title: 'Electrostatics',
            subTopics: [
              { id: 'phy-12-elec-1', title: "Coulomb's Law and Electric Field", durationMinutes: 24, type: 'video', quiz: { quizId: 'q-estat-1', totalQuestions: 8, difficulty: 'hard' } },
              { id: 'phy-12-elec-2', title: "Gauss's Law and Applications", durationMinutes: 22, type: 'article', quiz: { quizId: 'q-estat-2', totalQuestions: 7, difficulty: 'hard' } },
              { id: 'phy-12-elec-3', title: 'Electric Dipole', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-estat-3', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'phy-12-elec-4', title: 'Capacitors and Dielectrics', durationMinutes: 26, type: 'video', quiz: { quizId: 'q-estat-4', totalQuestions: 8, difficulty: 'hard' } },
            ],
          },
          {
            id: 'phy-12-cur',
            title: 'Current Electricity',
            subTopics: [
              { id: 'phy-12-cur-1', title: 'Drift Velocity and Ohm\'s Law', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-cur-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'phy-12-cur-2', title: "Kirchhoff's Laws", durationMinutes: 22, type: 'article', quiz: { quizId: 'q-cur-2', totalQuestions: 7, difficulty: 'hard' } },
              { id: 'phy-12-cur-3', title: 'Wheatstone Bridge and Potentiometer', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-cur-3', totalQuestions: 7, difficulty: 'hard' } },
            ],
          },
        ],
      },
      {
        id: 'chemistry-12',
        name: 'Chemistry',
        topics: [
          {
            id: 'chem-12-sol',
            title: 'Solutions',
            subTopics: [
              { id: 'chem-12-sol-1', title: 'Concentration Terms – Molarity and Molality', durationMinutes: 18, type: 'article', quiz: { quizId: 'q-sol-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'chem-12-sol-2', title: "Raoult's Law and Ideal Solutions", durationMinutes: 22, type: 'video', quiz: { quizId: 'q-sol-2', totalQuestions: 7, difficulty: 'hard' } },
              { id: 'chem-12-sol-3', title: 'Colligative Properties', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-sol-3', totalQuestions: 6, difficulty: 'medium' } },
            ],
          },
          {
            id: 'chem-12-elec',
            title: 'Electrochemistry',
            subTopics: [
              { id: 'chem-12-elec-1', title: 'Galvanic and Electrolytic Cells', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-ec-1', totalQuestions: 8, difficulty: 'hard' } },
              { id: 'chem-12-elec-2', title: 'Nernst Equation', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-ec-2', totalQuestions: 6, difficulty: 'hard' } },
              { id: 'chem-12-elec-3', title: 'Standard Electrode Potential', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-ec-3', totalQuestions: 5, difficulty: 'medium' } },
            ],
          },
        ],
      },
    ],
  },
];
