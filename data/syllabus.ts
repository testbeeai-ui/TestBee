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
  // ========== CLASS 9 ==========
  {
    gradeLevel: 9,
    subjects: [
      {
        id: 'math-9',
        name: 'Mathematics',
        topics: [
          {
            id: 'math-9-ns',
            title: 'Number Systems',
            subTopics: [
              { id: 'math-9-ns-1', title: 'Real Numbers and Their Decimal Expansions', durationMinutes: 15, type: 'video', quiz: { quizId: 'q-ns-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'math-9-ns-2', title: 'Operations on Real Numbers', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-ns-2', totalQuestions: 8, difficulty: 'medium' } },
              { id: 'math-9-ns-3', title: 'Laws of Exponents for Real Numbers', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-ns-3', totalQuestions: 6, difficulty: 'easy' } },
            ],
          },
          {
            id: 'math-9-poly',
            title: 'Polynomials',
            subTopics: [
              { id: 'math-9-poly-1', title: 'Definition and Types of Polynomials', durationMinutes: 12, type: 'article', quiz: { quizId: 'q-poly-1', totalQuestions: 4, difficulty: 'easy' } },
              { id: 'math-9-poly-2', title: 'Zeroes of a Polynomial', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-poly-2', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'math-9-poly-3', title: 'Remainder Theorem and Factor Theorem', durationMinutes: 22, type: 'video', quiz: { quizId: 'q-poly-3', totalQuestions: 6, difficulty: 'hard' } },
            ],
          },
          {
            id: 'math-9-eqd',
            title: 'Linear Equations in Two Variables',
            subTopics: [
              { id: 'math-9-eqd-1', title: 'Introduction and Graphical Representation', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-eqd-1', totalQuestions: 5, difficulty: 'medium' } },
              { id: 'math-9-eqd-2', title: 'Solution of Linear Equations', durationMinutes: 15, type: 'article', quiz: { quizId: 'q-eqd-2', totalQuestions: 6, difficulty: 'easy' } },
            ],
          },
        ],
      },
      {
        id: 'physics-9',
        name: 'Physics',
        topics: [
          {
            id: 'phy-9-motion',
            title: 'Motion',
            subTopics: [
              { id: 'phy-9-motion-1', title: 'Distance and Displacement', durationMinutes: 14, type: 'video', quiz: { quizId: 'q-motion-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'phy-9-motion-2', title: 'Uniform and Non-Uniform Motion', durationMinutes: 16, type: 'article', quiz: { quizId: 'q-motion-2', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'phy-9-motion-3', title: 'Equations of Motion', durationMinutes: 22, type: 'video', quiz: { quizId: 'q-motion-3', totalQuestions: 8, difficulty: 'medium' } },
              { id: 'phy-9-motion-4', title: 'Uniform Circular Motion', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-motion-4', totalQuestions: 5, difficulty: 'hard' } },
            ],
          },
          {
            id: 'phy-9-force',
            title: 'Force and Laws of Motion',
            subTopics: [
              { id: 'phy-9-force-1', title: "Newton's First Law and Inertia", durationMinutes: 15, type: 'video', quiz: { quizId: 'q-force-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'phy-9-force-2', title: "Newton's Second Law and Momentum", durationMinutes: 20, type: 'article', quiz: { quizId: 'q-force-2', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'phy-9-force-3', title: "Newton's Third Law and Conservation of Momentum", durationMinutes: 18, type: 'video', quiz: { quizId: 'q-force-3', totalQuestions: 6, difficulty: 'medium' } },
            ],
          },
          {
            id: 'phy-9-grav',
            title: 'Gravitation',
            subTopics: [
              { id: 'phy-9-grav-1', title: 'Universal Law of Gravitation', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-grav-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'phy-9-grav-2', title: 'Free Fall and Acceleration due to Gravity', durationMinutes: 14, type: 'article', quiz: { quizId: 'q-grav-2', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'phy-9-grav-3', title: 'Mass vs Weight', durationMinutes: 10, type: 'video', quiz: { quizId: 'q-grav-3', totalQuestions: 4, difficulty: 'easy' } },
            ],
          },
        ],
      },
    ],
  },

  // ========== CLASS 10 ==========
  {
    gradeLevel: 10,
    subjects: [
      {
        id: 'math-10',
        name: 'Mathematics',
        topics: [
          {
            id: 'math-10-rn',
            title: 'Real Numbers',
            subTopics: [
              { id: 'math-10-rn-1', title: 'Euclid\'s Division Lemma', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-rn-1', totalQuestions: 5, difficulty: 'medium' } },
              { id: 'math-10-rn-2', title: 'Fundamental Theorem of Arithmetic', durationMinutes: 20, type: 'article', quiz: { quizId: 'q-rn-2', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'math-10-rn-3', title: 'Revisiting Irrational Numbers', durationMinutes: 14, type: 'video', quiz: { quizId: 'q-rn-3', totalQuestions: 5, difficulty: 'hard' } },
            ],
          },
          {
            id: 'math-10-quad',
            title: 'Quadratic Equations',
            subTopics: [
              { id: 'math-10-quad-1', title: 'Standard Form and Solutions by Factorization', durationMinutes: 18, type: 'video', quiz: { quizId: 'q-quad-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'math-10-quad-2', title: 'Completing the Square', durationMinutes: 22, type: 'article', quiz: { quizId: 'q-quad-2', totalQuestions: 8, difficulty: 'hard' } },
              { id: 'math-10-quad-3', title: 'Nature of Roots', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-quad-3', totalQuestions: 5, difficulty: 'medium' } },
            ],
          },
          {
            id: 'math-10-ap',
            title: 'Arithmetic Progressions',
            subTopics: [
              { id: 'math-10-ap-1', title: 'Introduction and nth Term', durationMinutes: 20, type: 'video', quiz: { quizId: 'q-ap-1', totalQuestions: 6, difficulty: 'medium' } },
              { id: 'math-10-ap-2', title: 'Sum of First n Terms', durationMinutes: 18, type: 'article', quiz: { quizId: 'q-ap-2', totalQuestions: 7, difficulty: 'hard' } },
            ],
          },
        ],
      },
      {
        id: 'physics-10',
        name: 'Physics',
        topics: [
          {
            id: 'phy-10-light',
            title: 'Light – Reflection and Refraction',
            subTopics: [
              { id: 'phy-10-light-1', title: 'Spherical Mirrors and Image Formation', durationMinutes: 22, type: 'video', quiz: { quizId: 'q-light-1', totalQuestions: 8, difficulty: 'medium' } },
              { id: 'phy-10-light-2', title: 'Mirror Formula and Magnification', durationMinutes: 18, type: 'article', quiz: { quizId: 'q-light-2', totalQuestions: 6, difficulty: 'hard' } },
              { id: 'phy-10-light-3', title: 'Refraction through Lenses', durationMinutes: 24, type: 'video', quiz: { quizId: 'q-light-3', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'phy-10-light-4', title: 'Lens Formula and Power', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-light-4', totalQuestions: 5, difficulty: 'medium' } },
            ],
          },
          {
            id: 'phy-10-elec',
            title: 'Electricity',
            subTopics: [
              { id: 'phy-10-elec-1', title: 'Electric Current and Potential Difference', durationMinutes: 16, type: 'video', quiz: { quizId: 'q-elec-1', totalQuestions: 5, difficulty: 'easy' } },
              { id: 'phy-10-elec-2', title: "Ohm's Law and Resistance", durationMinutes: 20, type: 'article', quiz: { quizId: 'q-elec-2', totalQuestions: 7, difficulty: 'medium' } },
              { id: 'phy-10-elec-3', title: "Joule's Law and Heating Effect", durationMinutes: 14, type: 'video', quiz: { quizId: 'q-elec-3', totalQuestions: 5, difficulty: 'easy' } },
            ],
          },
        ],
      },
    ],
  },

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
