import type { Subject } from '@/types';
import type { ClassLevel } from '@/types';

export type InstaCueCardType = 'concept' | 'formula' | 'common_mistake' | 'trap';

export interface InstaCueCard {
  id: string;
  type: InstaCueCardType;
  frontContent: string;
  backContent: string;
  subtopicName: string;
  topic: string;
  subject: Subject;
  classLevel: ClassLevel;
}

function key(subject: Subject, classLevel: ClassLevel, topic: string, subtopicName: string): string {
  return `${subject}|${classLevel}|${topic}|${subtopicName}`;
}

const cardsMap: Record<string, InstaCueCard[]> = {
  [key('physics', 9, 'Motion', 'Distance & Displacement')]: [
    {
      id: 'dd-1',
      type: 'concept',
      frontContent: 'What is the key difference between Distance and Displacement?',
      backContent: 'Distance is scalar (total path covered). Displacement is vector (shortest straight line from start to end, with direction).',
      subtopicName: 'Distance & Displacement',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'dd-2',
      type: 'concept',
      frontContent: 'One lap around a circular track: what is distance vs displacement?',
      backContent: 'Distance = track length (e.g. 400 m). Displacement = 0 (start and end points are the same).',
      subtopicName: 'Distance & Displacement',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'dd-3',
      type: 'formula',
      frontContent: 'SI unit for both distance and displacement?',
      backContent: 'Metre (m). Both are measured in metres.',
      subtopicName: 'Distance & Displacement',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'dd-4',
      type: 'common_mistake',
      frontContent: 'Can displacement ever be negative?',
      backContent: 'Yes! Displacement can be positive, negative, or zero depending on the direction you choose as positive.',
      subtopicName: 'Distance & Displacement',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'dd-5',
      type: 'trap',
      frontContent: "Distance is always greater than or equal to displacement. Why?",
      backContent: "The shortest path (displacement) can never be longer than the actual path (distance). They're equal only for straight-line motion.",
      subtopicName: 'Distance & Displacement',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
  ],
  [key('physics', 9, 'Motion', 'Uniform & Non-Uniform Motion')]: [
    {
      id: 'unif-1',
      type: 'concept',
      frontContent: 'What is uniform motion?',
      backContent: 'Equal distances covered in equal intervals of time. Speed (and velocity, if direction fixed) is constant.',
      subtopicName: 'Uniform & Non-Uniform Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'unif-2',
      type: 'formula',
      frontContent: 'Distance-time graph: straight line vs curved line?',
      backContent: 'Straight line = uniform motion. Curved line = non-uniform motion.',
      subtopicName: 'Uniform & Non-Uniform Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'unif-3',
      type: 'common_mistake',
      frontContent: 'Is average velocity always (initial + final) / 2?',
      backContent: "No! That formula only works for constant acceleration. Otherwise it's Total Displacement / Total Time.",
      subtopicName: 'Uniform & Non-Uniform Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
  ],
  [key('physics', 9, 'Motion', 'Equations of Motion')]: [
    {
      id: 'eom-1',
      type: 'formula',
      frontContent: 'v = u + at — what does this relate?',
      backContent: 'Final velocity (v) = initial velocity (u) + acceleration (a) × time (t).',
      subtopicName: 'Equations of Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'eom-2',
      type: 'formula',
      frontContent: 's = ut + ½at² — when is this valid?',
      backContent: 'Only when acceleration is constant (e.g. free fall, car with constant acceleration).',
      subtopicName: 'Equations of Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'eom-3',
      type: 'trap',
      frontContent: 'Which equation has no time (t)?',
      backContent: 'v² = u² + 2as — relates velocities, acceleration, and distance only.',
      subtopicName: 'Equations of Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
  ],
  [key('physics', 9, 'Motion', 'Uniform Circular Motion')]: [
    {
      id: 'ucm-1',
      type: 'concept',
      frontContent: 'In uniform circular motion, is velocity constant?',
      backContent: 'No! Speed is constant but velocity changes because direction keeps changing. So the object is accelerating.',
      subtopicName: 'Uniform Circular Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
    {
      id: 'ucm-2',
      type: 'formula',
      frontContent: 'Centripetal acceleration formula?',
      backContent: 'a = v²/r — acceleration points toward the centre of the circle.',
      subtopicName: 'Uniform Circular Motion',
      topic: 'Motion',
      subject: 'physics',
      classLevel: 9,
    },
  ],
};

export function getInstaCueCards(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicNames: string[]
): InstaCueCard[] {
  const all: InstaCueCard[] = [];
  for (const st of subtopicNames) {
    const k = key(subject, classLevel, topic, st);
    all.push(...(cardsMap[k] ?? []));
  }
  return all;
}
