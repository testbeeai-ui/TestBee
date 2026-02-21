import { Question, Subject } from '@/types';
import { physicsQuestions } from './physicsQuestions';
import { chemistryQuestions } from './chemistryQuestions';
import { mathQuestions } from './mathQuestions';
import { biologyQuestions } from './biologyQuestions';

export const questions: Question[] = [
  ...physicsQuestions,
  ...chemistryQuestions,
  ...mathQuestions,
  ...biologyQuestions,
];

export const getQuestionsBySubject = (subject: Subject): Question[] =>
  questions.filter((q) => q.subject === subject);

export const getQuestionsByClass = (classLevel: number): Question[] =>
  questions.filter((q) => q.classLevel <= classLevel);

export const getQuestionsByExam = (examType: string): Question[] =>
  questions.filter((q) => q.examType.includes(examType as any));

export const getRandomQuestions = (
  subjects: Subject[],
  classLevel: number,
  count: number = 5
): Question[] => {
  const eligible = questions.filter(
    (q) => subjects.includes(q.subject) && q.classLevel <= classLevel
  );
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  
  // Try to get balanced distribution across subjects
  const result: Question[] = [];
  const perSubject = Math.ceil(count / subjects.length);
  
  for (const subject of subjects) {
    const subjectQs = shuffled.filter((q) => q.subject === subject);
    result.push(...subjectQs.slice(0, perSubject));
  }
  
  return result.slice(0, count);
};

/** For long-format mock tests: ~2–3 min per question. Returns mixed subjects/chapters. */
export const getMockQuestions = (
  subjects: Subject[],
  classLevel: number,
  durationMinutes: number
): Question[] => {
  const count = Math.min(
    Math.ceil(durationMinutes / 2.5),
    questions.filter((q) => subjects.includes(q.subject) && q.classLevel <= classLevel).length
  );
  return getRandomQuestions(subjects, classLevel, count);
};
