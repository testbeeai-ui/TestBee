import type { Subject } from '@/types';
import type { ClassLevel } from '@/types';

export type InteractiveBlock =
  | {
      type: 'active-reading';
      id: string;
      preQuestion: { question: string; options: string[]; correctAnswer: number; explanation: string };
      content: string;
    }
  | {
      type: 'formula-variations';
      id: string;
      title: string;
      formula: string;
      content: string;
      variations: {
        variables: Record<string, string>;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
      }[];
    }
  | {
      type: 'fill-in-blanks';
      id: string;
      content: string;
      textWithBlanks: string;
      blanks: { options: string[]; correctAnswer: string }[];
    }
  | {
      type: 'text';
      id: string;
      content: string;
    };

export interface TheorySectionWithPractice {
  title: string;
  content: string;
  blockIndex: number;
}

export interface SubtopicTheory {
  theory: string;
  bits: string[];
  interactiveBlocks?: InteractiveBlock[];
  /** When set, theory is shown as sections; each section has a Practice button that opens a popup. */
  theorySectionsWithPractice?: TheorySectionWithPractice[];
}

export type DifficultyLevel = 'basics' | 'intermediate' | 'advanced';

function key(subject: Subject, classLevel: ClassLevel, topic: string, subtopicName: string): string {
  return `${subject}|${classLevel}|${topic}|${subtopicName}`;
}

function keyWithLevel(base: string, level: DifficultyLevel): string {
  return `${base}|${level}`;
}

/**
 * In-repo theory copy was removed; published content should come from Supabase (or another CMS).
 * Optional entries can be added here temporarily during migration — the app treats missing keys as placeholders.
 */
const theoryMap: Record<string, SubtopicTheory> = {};

export function getTheoryForSubtopic(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string,
  level?: DifficultyLevel
): SubtopicTheory | null {
  const baseKey = key(subject, classLevel, topic, subtopicName);
  if (level) {
    const levelKey = keyWithLevel(baseKey, level);
    const levelContent = theoryMap[levelKey];
    if (levelContent) return levelContent;
    if (level === 'intermediate' || level === 'advanced') {
      return null;
    }
  }
  return theoryMap[baseKey] ?? null;
}

/** Topic-level intro (not a specific subtopic). Shown on /.../topic/overview/... before opening a subtopic page. */
export function getTopicOverviewOrPlaceholder(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicTitles: string[],
  level?: DifficultyLevel
): SubtopicTheory {
  const list =
    subtopicTitles.length > 0
      ? subtopicTitles.map((t, i) => `* **${i + 1}.** ${t}`).join('\n')
      : '* Subtopics will appear here once the syllabus loads.';

  const levelNote =
    level === 'intermediate'
      ? '\n\n**Intermediate** adds derivations and exam-style problems on top of the basics.'
      : level === 'advanced'
        ? '\n\n**Advanced** covers deeper theory and competition-level ideas.'
        : '';

  return {
    theory: `**${topic}** — topic overview

This lesson is organised into **${subtopicTitles.length}** subtopic${subtopicTitles.length === 1 ? '' : 's'}. Use the numbered links in the sidebar to open each subtopic on its **own page** with full theory and practice.

**What you will cover**
${list}
${levelNote}

Published lesson text will be loaded from **Supabase** when your team adds it. Until then, use your textbook and class notes.

*Tip: Start with subtopic 1, or jump to any number when you are ready.*`,
    bits: [],
  };
}

/** When no row exists in Supabase yet: neutral placeholder (no in-repo mock lessons). */
export function getTheoryOrPlaceholder(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string,
  level?: DifficultyLevel
): SubtopicTheory {
  const baseKey = key(subject, classLevel, topic, subtopicName);
  const baseContent = theoryMap[baseKey];
  const levelContent = level ? theoryMap[keyWithLevel(baseKey, level)] : null;

  if (levelContent) return levelContent;
  if (baseContent && (level === 'basics' || !level)) return baseContent;
  if (baseContent && (level === 'intermediate' || level === 'advanced')) {
    const levelLabel = level === 'intermediate' ? 'Intermediate' : 'Advanced';
    return {
      theory: `**${levelLabel}** content for **${subtopicName}** is not in the database yet.

It will be delivered from **Supabase** when published. Study your textbook and notes in the meantime, or switch level if another depth is available.`,
      bits: [],
    };
  }

  const levelLabel =
    level === 'intermediate' ? 'Intermediate' : level === 'advanced' ? 'Advanced' : 'Basic';

  return {
    theory: `**${subtopicName}** (${topic} · ${subject}, Class ${classLevel} · ${levelLabel})

Full theory for this subtopic will load from **Supabase** once it is published. Study your textbook and notes until then. Bits and practice items will appear when they are added for this subtopic and level.`,
    bits: [],
  };
}
