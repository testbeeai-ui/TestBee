import type { Subject } from '@/types';
import type { ClassLevel } from '@/types';

export interface SubtopicTheory {
  theory: string;
  bits: string[];
}

function key(subject: Subject, classLevel: ClassLevel, topic: string, subtopicName: string): string {
  return `${subject}|${classLevel}|${topic}|${subtopicName}`;
}

const theoryMap: Record<string, SubtopicTheory> = {
  // ---------- Class 9 Physics: Motion ----------
  [key('physics', 9, 'Motion', 'Distance & Displacement')]: {
    theory: `**Distance** is the total length of the path actually travelled by an object. It is a scalar quantity (only magnitude, no direction). For example, if you walk from home to school along a curved road, the distance is the length of that road.

**Displacement** is the shortest straight-line distance between the starting point and the ending point, along with the direction from start to end. It is a vector quantity (has both magnitude and direction). If you go from home to school, displacement is the straight line from home to school, with an arrow pointing toward school.

**Key difference:** If you run one full lap around a circular track, your distance is the length of the track (e.g. 400 m), but your displacement is zero because you ended where you started. Distance is always positive or zero; displacement can be positive, negative, or zero depending on direction.`,
    bits: [
      'Distance = total path length (scalar). Displacement = straight line from start to end with direction (vector).',
      'One lap around a track: distance = track length, displacement = 0.',
      'SI unit for both: metre (m). Displacement can be negative if you choose a positive direction.',
    ],
  },
  [key('physics', 9, 'Motion', 'Uniform & Non-Uniform Motion')]: {
    theory: `**Uniform motion** means the object covers equal distances in equal intervals of time, no matter how small the interval. So the speed (and velocity, if direction is fixed) is constant. Example: a car moving at a steady 60 km/h on a straight highway.

**Non-uniform motion** means the object covers unequal distances in equal intervals of time. So the speed or velocity changes with time. Example: a car speeding up from rest, or slowing down at a traffic light.

**Speed** is how fast something moves (distance per time). **Velocity** is speed in a given direction. For uniform motion along a straight line, speed and velocity magnitude are the same. We use graphs (distance-time or velocity-time) to tell uniform from non-uniform: a straight line on a distance-time graph means uniform motion; a curved line means non-uniform.`,
    bits: [
      'Uniform motion: equal distances in equal times → constant speed/velocity.',
      'Non-uniform motion: unequal distances in equal times → speed or direction changes.',
      'Distance-time graph: straight line = uniform; curved line = non-uniform.',
    ],
  },
  [key('physics', 9, 'Motion', 'Equations of Motion')]: {
    theory: `For an object moving in a straight line with **constant acceleration**, we use three main equations (often called the equations of motion or SUVAT):

**1. v = u + at** — Final velocity (v) = initial velocity (u) + acceleration (a) × time (t).

**2. s = ut + ½at²** — Distance (s) = (initial velocity × time) + (half × acceleration × time²).

**3. v² = u² + 2as** — Final velocity squared = initial velocity squared + (2 × acceleration × distance).

Here, **u** = initial velocity, **v** = final velocity, **a** = acceleration (constant), **t** = time, **s** = distance/displacement. These only work when acceleration is constant (e.g. free fall under gravity, or a car moving with constant acceleration). If you know any three of u, v, a, t, s, you can find the other two using these equations.`,
    bits: [
      'v = u + at — relates velocity, acceleration, and time.',
      's = ut + ½at² — relates distance, initial velocity, acceleration, and time.',
      'v² = u² + 2as — relates velocities, acceleration, and distance (no time).',
    ],
  },
  [key('physics', 9, 'Motion', 'Uniform Circular Motion')]: {
    theory: `**Uniform circular motion** is when an object moves along a circular path at constant speed. The speed (magnitude of velocity) is constant, but the **velocity is not constant** because the direction of motion keeps changing (tangent to the circle). So the object is **accelerating** even though its speed is constant.

This acceleration is called **centripetal acceleration** and always points **toward the centre** of the circle. The force that keeps the object in the circle (e.g. tension in a string, friction on a turn) is the **centripetal force**, also directed toward the centre. Without it, the object would fly off in a straight line (Newton’s first law). Formulas: centripetal acceleration a = v²/r, centripetal force F = mv²/r, where v = speed, r = radius, m = mass.`,
    bits: [
      'Speed is constant but velocity changes (direction changes) → so there is acceleration.',
      'Centripetal acceleration and force point toward the centre of the circle.',
      'a = v²/r and F = mv²/r; without centripetal force the object would move in a straight line.',
    ],
  },
};

export function getTheoryForSubtopic(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string
): SubtopicTheory | null {
  return theoryMap[key(subject, classLevel, topic, subtopicName)] ?? null;
}

/** Fallback when no theory is defined: short placeholder so UI always has something. */
export function getTheoryOrPlaceholder(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string
): SubtopicTheory {
  const found = getTheoryForSubtopic(subject, classLevel, topic, subtopicName);
  if (found) return found;
  return {
    theory: `This subtopic covers **${subtopicName}** in the chapter **${topic}** (${subject}, Class ${classLevel}). Study your textbook and notes for a full explanation. Key ideas will appear in the Bits popup once content is added.`,
    bits: ['Read the chapter in your textbook.', 'Note definitions, formulas, and examples.', 'Practice related numericals and concepts.'],
  };
}
