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

const theoryMap: Record<string, SubtopicTheory> = {
  // ---------- Class 11 Physics: Motion ----------
  [key('physics', 11, 'Motion', 'Distance & Displacement')]: {
    theory: `**Distance** is the total length of the path actually travelled by an object. It is a scalar quantity (only magnitude, no direction). For example, if you walk from home to school along a curved road, the distance is the length of that road.

**Displacement** is the shortest straight-line distance between the starting point and the ending point, along with the direction from start to end. It is a vector quantity (has both magnitude and direction). If you go from home to school, displacement is the straight line from home to school, with an arrow pointing toward school.

**Key difference:** If you run one full lap around a circular track, your distance is the length of the track (e.g. 400 m), but your displacement is zero because you ended where you started. Distance is always positive or zero; displacement can be positive, negative, or zero depending on direction.`,
    bits: [
      'Distance = total path length (scalar). Displacement = straight line from start to end with direction (vector).',
      'One lap around a track: distance = track length, displacement = 0.',
      'SI unit for both: metre (m). Displacement can be negative if you choose a positive direction.',
    ],
  },
  [key('physics', 11, 'Motion', 'Uniform & Non-Uniform Motion')]: {
    theory: `**Uniform motion** means the object covers equal distances in equal intervals of time, no matter how small the interval. So the speed (and velocity, if direction is fixed) is constant. Example: a car moving at a steady 60 km/h on a straight highway.

**Non-uniform motion** means the object covers unequal distances in equal intervals of time. So the speed or velocity changes with time. Example: a car speeding up from rest, or slowing down at a traffic light.

**Speed** is how fast something moves (distance per time). **Velocity** is speed in a given direction. For uniform motion along a straight line, speed and velocity magnitude are the same. We use graphs (distance-time or velocity-time) to tell uniform from non-uniform: a straight line on a distance-time graph means uniform motion; a curved line means non-uniform.`,
    bits: [
      'Uniform motion: equal distances in equal times → constant speed/velocity.',
      'Non-uniform motion: unequal distances in equal times → speed or direction changes.',
      'Distance-time graph: straight line = uniform; curved line = non-uniform.',
    ],
  },
  [key('physics', 11, 'Motion', 'Equations of Motion')]: {
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
  [key('physics', 11, 'Motion', 'Uniform Circular Motion')]: {
    theory: `**Uniform circular motion** is when an object moves along a circular path at constant speed. The speed (magnitude of velocity) is constant, but the **velocity is not constant** because the direction of motion keeps changing (tangent to the circle). So the object is **accelerating** even though its speed is constant.

This acceleration is called **centripetal acceleration** and always points **toward the centre** of the circle. The force that keeps the object in the circle (e.g. tension in a string, friction on a turn) is the **centripetal force**, also directed toward the centre. Without it, the object would fly off in a straight line (Newton’s first law). Formulas: centripetal acceleration a = v²/r, centripetal force F = mv²/r, where v = speed, r = radius, m = mass.`,
    bits: [
      'Speed is constant but velocity changes (direction changes) → so there is acceleration.',
      'Centripetal acceleration and force point toward the centre of the circle.',
      'a = v²/r and F = mv²/r; without centripetal force the object would move in a straight line.',
    ],
  },

  // ---------- Class 11 Physics: Electricity ----------
  [key('physics', 11, 'Electricity', "Ohm's Law & Resistance")]: {
    theory: `Ohm's Law states V = IR. Resistance R = V / I. Practice with the formula variations below.`,
    interactiveBlocks: [
      {
        type: 'formula-variations',
        id: 'ohms-law-variations',
        title: "Ohm's Law Practice",
        formula: 'R = V / I',
        content: "Use Ohm's Law to find the resistance (R) when given voltage (V) and current (I). Solve each variation.",
        variations: [
          {
            variables: { Voltage: '60 V', Current: '3 A' },
            question: 'What is the resistance?',
            options: ['20 Ω', '180 Ω', '0.05 Ω', '63 Ω'],
            correctAnswer: 0,
            explanation: 'R = V/I = 60/3 = 20 Ω',
          },
          {
            variables: { Voltage: '120 V', Current: '4 A' },
            question: 'What is the resistance?',
            options: ['30 Ω', '480 Ω', '0.033 Ω', '124 Ω'],
            correctAnswer: 0,
            explanation: 'R = V/I = 120/4 = 30 Ω',
          },
          {
            variables: { Voltage: '24 V', Current: '6 A' },
            question: 'What is the resistance?',
            options: ['4 Ω', '144 Ω', '0.25 Ω', '30 Ω'],
            correctAnswer: 0,
            explanation: 'R = V/I = 24/6 = 4 Ω',
          },
          {
            variables: { Voltage: '90 V', Current: '5 A' },
            question: 'What is the resistance?',
            options: ['18 Ω', '450 Ω', '0.056 Ω', '95 Ω'],
            correctAnswer: 0,
            explanation: 'R = V/I = 90/5 = 18 Ω',
          },
          {
            variables: { Voltage: '48 V', Current: '2 A' },
            question: 'What is the resistance?',
            options: ['24 Ω', '96 Ω', '0.042 Ω', '50 Ω'],
            correctAnswer: 0,
            explanation: 'R = V/I = 48/2 = 24 Ω',
          },
        ],
      },
    ],
    bits: [
      "Ohm's Law: V = IR. Resistance = Voltage / Current.",
      "SI unit of resistance: ohm (Ω). 1 Ω = 1 V/A.",
      'Ohm\'s law is valid only when temperature and physical conditions remain constant.',
    ],
  },

  // ---------- Class 11 Physics: Physical World and Measurement ----------
  [key('physics', 11, 'Physical World and Measurement', 'Scope and excitement of Physics')]: {
    theory: `**1. The Fundamental Definition**
Physics is the study of the basic laws of nature and their manifestation across diverse physical phenomena. It operates on the premise that the physical universe behaves according to predictable, mathematical rules.

**2. The Scope of Physics (The Two Domains)**
The scope of physics encompasses extreme ranges of magnitude. It is strictly categorized into two primary domains that use entirely different frameworks:

* **The Macroscopic Domain (Governed by Classical Physics):** Deals with phenomena at the laboratory, terrestrial, and astronomical scales. It includes:
* *Mechanics:* Based on Newton's laws of motion and the law of gravitation. It governs the behavior of particles, rigid bodies, and deformable bodies (e.g., the orbit of planets, the propulsion of a rocket, the propagation of sound waves).
* *Electrodynamics:* Dictates electric and magnetic phenomena associated with charged and magnetic bodies. It is governed by Maxwell's equations (e.g., the working of an antenna, AC circuits, radio waves).
* *Optics:* Deals with phenomena involving light and its interactions with matter (e.g., telescopes, microscopes, the formation of rainbows).
* *Thermodynamics:* Critically, this branch does *not* deal with the motion of individual particles. It deals exclusively with macroscopic systems in equilibrium and changes in bulk properties like internal energy, temperature, and entropy (e.g., the efficiency of heat engines and refrigerators).

* **The Microscopic Domain (Governed by Quantum Physics):** Deals with the constitution and structure of matter at the atomic and nuclear scales. Classical mechanics universally fails at this level. It involves interactions of electrons, protons, and other elementary particles.
* *(Note: The **Mesoscopic Domain** is the intermediate field dealing with systems of a few tens to hundreds of atoms).*

**3. The Extremes of Scale (Exam Critical Data)**
To understand the scope, you must memorize the quantitative boundaries of the physical universe. Examiners frequently target these orders of magnitude:

* **Scale of Length:** Ranges from the radius of a proton (≈ 10⁻¹⁵ m) to the estimated size of the observable universe (≈ 10²⁶ m). This represents a sheer scale factor of 10⁴¹.
* **Scale of Mass:** Ranges from the mass of an electron (≈ 10⁻³⁰ kg) to the estimated mass of the known universe (≈ 10⁵⁵ kg).
* **Scale of Time:** Ranges from the time it takes light to cross a nuclear distance (≈ 10⁻²² s) to the age of the universe (≈ 10¹⁸ s).

**4. The Excitement of Physics (The Two Principal Thrusts)**
The "excitement" refers to the intellectual thrill of solving complex universe-scale problems. Physicists rely on two distinct philosophical approaches. You must be able to differentiate them:

* **Unification:** The attempt to explain diverse, seemingly unrelated physical phenomena in terms of a few universal concepts and laws.
* *Example:* Newton's universal law of gravitation unified terrestrial mechanics (an apple falling) with celestial mechanics (the moon orbiting Earth). Maxwell unified electricity, magnetism, and optics into a single theory of electromagnetism.

* **Reductionism:** The attempt to derive the properties of a large, complex macroscopic system from the properties and interactions of its simplest, microscopic constituent parts.
* *Example:* Thermodynamics (macroscopic) studies bulk properties like temperature. Reductionism explains this through Kinetic Theory—proving that "temperature" is simply the average kinetic energy of billions of microscopic molecules moving randomly.`,
    theorySectionsWithPractice: [
      {
        title: '1. The Fundamental Definition',
        content: `Physics is the study of the basic laws of nature and their manifestation across diverse physical phenomena. It operates on the premise that the physical universe behaves according to predictable, mathematical rules.`,
        blockIndex: 0,
      },
      {
        title: '2. The Scope of Physics (The Two Domains)',
        content: `The scope of physics encompasses extreme ranges of magnitude. It is strictly categorized into two primary domains that use entirely different frameworks:

* **The Macroscopic Domain (Governed by Classical Physics):** Deals with phenomena at the laboratory, terrestrial, and astronomical scales. It includes:
* *Mechanics:* Based on Newton's laws of motion and the law of gravitation. It governs the behavior of particles, rigid bodies, and deformable bodies (e.g., the orbit of planets, the propulsion of a rocket, the propagation of sound waves).
* *Electrodynamics:* Dictates electric and magnetic phenomena associated with charged and magnetic bodies. It is governed by Maxwell's equations (e.g., the working of an antenna, AC circuits, radio waves).
* *Optics:* Deals with phenomena involving light and its interactions with matter (e.g., telescopes, microscopes, the formation of rainbows).
* *Thermodynamics:* Critically, this branch does *not* deal with the motion of individual particles. It deals exclusively with macroscopic systems in equilibrium and changes in bulk properties like internal energy, temperature, and entropy (e.g., the efficiency of heat engines and refrigerators).

* **The Microscopic Domain (Governed by Quantum Physics):** Deals with the constitution and structure of matter at the atomic and nuclear scales. Classical mechanics universally fails at this level. It involves interactions of electrons, protons, and other elementary particles.
* *(Note: The **Mesoscopic Domain** is the intermediate field dealing with systems of a few tens to hundreds of atoms).*`,
        blockIndex: 1,
      },
      {
        title: '3. The Extremes of Scale (Exam Critical Data)',
        content: `To understand the scope, you must memorize the quantitative boundaries of the physical universe. Examiners frequently target these orders of magnitude:

* **Scale of Length:** Ranges from the radius of a proton (≈ 10⁻¹⁵ m) to the estimated size of the observable universe (≈ 10²⁶ m). This represents a sheer scale factor of 10⁴¹.
* **Scale of Mass:** Ranges from the mass of an electron (≈ 10⁻³⁰ kg) to the estimated mass of the known universe (≈ 10⁵⁵ kg).
* **Scale of Time:** Ranges from the time it takes light to cross a nuclear distance (≈ 10⁻²² s) to the age of the universe (≈ 10¹⁸ s).`,
        blockIndex: 2,
      },
      {
        title: '4. The Excitement of Physics (The Two Principal Thrusts)',
        content: `The "excitement" refers to the intellectual thrill of solving complex universe-scale problems. Physicists rely on two distinct philosophical approaches. You must be able to differentiate them:

* **Unification:** The attempt to explain diverse, seemingly unrelated physical phenomena in terms of a few universal concepts and laws.
* *Example:* Newton's universal law of gravitation unified terrestrial mechanics (an apple falling) with celestial mechanics (the moon orbiting Earth). Maxwell unified electricity, magnetism, and optics into a single theory of electromagnetism.

* **Reductionism:** The attempt to derive the properties of a large, complex macroscopic system from the properties and interactions of its simplest, microscopic constituent parts.
* *Example:* Thermodynamics (macroscopic) studies bulk properties like temperature. Reductionism explains this through Kinetic Theory—proving that "temperature" is simply the average kinetic energy of billions of microscopic molecules moving randomly.`,
        blockIndex: 3,
      },
    ],
    interactiveBlocks: [
      {
        type: 'active-reading',
        id: 'scope-1-fundamental',
        preQuestion: {
          question: 'What is the primary premise of physics?',
          options: [
            'The physical universe behaves according to predictable, mathematical rules',
            'Physics deals only with macroscopic phenomena',
            'Physics is purely experimental',
            'The universe is chaotic',
          ],
          correctAnswer: 0,
          explanation: 'Physics operates on the premise that the physical universe behaves according to predictable, mathematical rules.',
        },
        content: `**1. The Fundamental Definition**
Physics is the study of the basic laws of nature and their manifestation across diverse physical phenomena. It operates on the premise that the physical universe behaves according to predictable, mathematical rules.`,
      },
      {
        type: 'fill-in-blanks',
        id: 'scope-2-domains',
        content: 'The scope of physics encompasses two primary domains that use entirely different frameworks.',
        textWithBlanks: 'The {0} Domain is governed by {1} Physics and deals with laboratory, terrestrial, and astronomical scales. The {2} Domain is governed by {3} Physics and deals with atomic and nuclear scales.',
        blanks: [
          { options: ['Macroscopic', 'Microscopic', 'Mesoscopic'], correctAnswer: 'Macroscopic' },
          { options: ['Classical', 'Quantum', 'Relativistic'], correctAnswer: 'Classical' },
          { options: ['Macroscopic', 'Microscopic', 'Mesoscopic'], correctAnswer: 'Microscopic' },
          { options: ['Classical', 'Quantum', 'Relativistic'], correctAnswer: 'Quantum' },
        ],
      },
      {
        type: 'formula-variations',
        id: 'scope-3-extremes',
        title: 'Extremes of Scale — Revision',
        formula: 'Length: 10⁻¹⁵ m → 10²⁶ m  |  Mass: 10⁻³⁰ kg → 10⁵⁵ kg  |  Time: 10⁻²² s → 10¹⁸ s',
        content: 'Memorize these orders of magnitude. Examiners frequently target them.',
        variations: [
          {
            variables: { 'Proton radius': '≈ 10⁻¹⁵ m', 'Observable universe': '≈ 10²⁶ m' },
            question: 'What is the scale factor of length from proton to universe?',
            options: ['10⁴¹', '10²⁶', '10⁻¹⁵', '10¹¹'],
            correctAnswer: 0,
            explanation: 'Scale factor = 10²⁶ / 10⁻¹⁵ = 10⁴¹.',
          },
          {
            variables: { 'Electron mass': '≈ 10⁻³⁰ kg', 'Known universe mass': '≈ 10⁵⁵ kg' },
            question: 'What is the order of magnitude of the mass of an electron?',
            options: ['10⁻³⁰ kg', '10⁻²⁷ kg', '10⁻³³ kg', '10⁻²⁴ kg'],
            correctAnswer: 0,
            explanation: 'Electron mass ≈ 9.1 × 10⁻³¹ kg, so order is 10⁻³⁰ kg.',
          },
          {
            variables: { 'Light cross nuclear distance': '≈ 10⁻²² s', 'Age of universe': '≈ 10¹⁸ s' },
            question: 'What is the order of magnitude of the age of the universe?',
            options: ['10¹⁸ s', '10¹⁵ s', '10²¹ s', '10¹² s'],
            correctAnswer: 0,
            explanation: 'Age of universe ≈ 4.3 × 10¹⁷ s, so order is 10¹⁸ s.',
          },
          {
            variables: { 'Scale of Length': 'proton 10⁻¹⁵ m to universe 10²⁶ m' },
            question: 'What is the order of magnitude of the radius of a proton?',
            options: ['10⁻¹⁵ m', '10⁻¹² m', '10⁻¹⁸ m', '10⁻⁹ m'],
            correctAnswer: 0,
            explanation: 'Proton radius ≈ 0.8 × 10⁻¹⁵ m, so order is 10⁻¹⁵ m.',
          },
          {
            variables: { 'Scale of Mass': 'electron 10⁻³⁰ kg to universe 10⁵⁵ kg' },
            question: 'What is the order of magnitude of the mass of the known universe?',
            options: ['10⁵⁵ kg', '10⁵² kg', '10⁵⁸ kg', '10⁶⁰ kg'],
            correctAnswer: 0,
            explanation: 'Estimated mass of observable universe ≈ 10⁵⁵ kg.',
          },
        ],
      },
      {
        type: 'text',
        id: 'scope-4-excitement',
        content: `**4. The Excitement of Physics (The Two Principal Thrusts)**

**Unification:** The attempt to explain diverse, seemingly unrelated physical phenomena in terms of a few universal concepts and laws. Newton's gravitation unified terrestrial mechanics (apple falling) with celestial mechanics (moon orbiting). Maxwell unified electricity, magnetism, and optics.

**Reductionism:** The attempt to derive macro properties from micro constituents. Kinetic Theory explains temperature as the average kinetic energy of billions of microscopic molecules.`,
      },
    ],
    bits: [
      'Physics = study of basic laws of nature; universe obeys predictable mathematical rules.',
      'Macroscopic domain (Classical): mechanics, electrodynamics, optics, thermodynamics.',
      'Microscopic domain (Quantum): atomic/nuclear scale; classical mechanics fails here.',
      'Length scale: ~10⁻¹⁵ m (proton) to ~10²⁶ m (universe); scale factor 10⁴¹.',
      'Unification = explaining diverse phenomena via few universal laws (e.g. Newton, Maxwell).',
      'Reductionism = deriving macro properties from micro constituents (e.g. Kinetic Theory).',
    ],
  },

  // ---------- Class 11 Physics: Units & Measurements ----------
  [key('physics', 11, 'Units & Measurements', 'SI Units')]: {
    theory: `**SI Units** (International System of Units) are the standard units used globally in science to ensure consistency. Imagine trying to build a spaceship with engineers in different countries using different rulers—it would be a disaster! That's why we established a universal language of measurement.

There are **7 Base Units** from which all other units are derived:
• **Length:** Metre (m)
• **Mass:** Kilogram (kg)
• **Time:** Second (s)
• **Electric Current:** Ampere (A)
• **Temperature:** Kelvin (K)
• **Amount of Substance:** Mole (mol)
• **Luminous Intensity:** Candela (cd)

**Derived Units** are combinations of these base units. For example, Velocity is Length divided by Time (m/s), and Force is Mass times Acceleration (kg·m/s², also known as Newton). Remembering the 7 base units is the key to mastering all formulas in physics!`,
    bits: [
      'There are 7 fundamental SI units: length (m), mass (kg), time (s), current (A), temp (K), amount (mol), luminous intensity (cd).',
      'Derived units are formed by multiplying or dividing base units (e.g., Area is m², Velocity is m/s).',
      'Plane angle (radian) and solid angle (steradian) are supplementary units.',
    ],
  },
  [key('physics', 11, 'Units & Measurements', 'Dimensional Analysis')]: {
    theory: `**Dimensional Analysis** is like an X-ray for physics equations! It helps you check if an equation makes sense. Every physical quantity can be expressed in terms of fundamental dimensions: **[M]** for Mass, **[L]** for Length, and **[T]** for Time.

For example, Velocity is Distance/Time, so its dimension is **[L][T⁻¹]**.

**Why is it incredibly useful?**
1. **Checking Equations (Principle of Homogeneity):** You can only add, subtract, or equate quantities with the same dimensions. You can't add 5 kilograms to 3 meters! Thus, the left side of an equation must always match the dimensions of the right side.
2. **Converting Units:** It helps you systematically convert a value from one system (like SI) to another (like CGS).
3. **Deriving Formulas:** If you know what factors a physical quantity depends on, you can actually derive the formula using dimensions!

*Fun Fact: Pure numbers (like 2, π) and angles have NO dimensions, they are dimensionless.*`,
    bits: [
      'Base dimensions widely used: Mass [M], Length [L], Time [T].',
      'Principle of Homogeneity: Only quantities with identical dimensions can be added, subtracted, or equated.',
      'Dimensional formulas cannot determine the values of dimensionless constants like π or raw numbers.',
    ],
  },
  [key('physics', 11, 'Units & Measurements', 'Errors in Measurement')]: {
    theory: `No measurement in the real world is 100% perfect! **Errors in Measurement** deal with the tiny imperfections that happen whenever we measure practically anything.

There are two main concepts to understand perfectly:
• **Accuracy:** How close your measured value is to the *true* or accepted value.
• **Precision:** How detailed or incredibly consistent your measurements are, regardless of the true value. (E.g., 2.001 is more precise than 2.0, even if the true value is actually 5.0).

**Types of Errors:**
1. **Systematic Errors:** These happen consistently in one direction (always measuring too high or always too low). Example: A ruler with a broken zero-mark. They can be fixed if you identify the cause!
2. **Random Errors:** These are unpredictable fluctuations that occur seemingly by chance. Example: A sudden breeze while weighing a chemical. Taking multiple readings and finding the average is the best way to mathematically minimize these!

*Golden Rule: When combining measurements (like adding two lengths), their errors always add up to create a larger maximum possible error.*`,
    bits: [
      'Accuracy = closeness to the true value; Precision = resolution or consistency of repeated measurements.',
      'Systematic errors are consistent and directional (e.g. instrumental error, zero error). They can be mathematically corrected.',
      'Random errors are unpredictable. Minimized by taking the arithmetic mean (average) of multiple readings.',
      'Absolute error is the difference between individual measurement and true value. Relative error is Absolute error / True value.',
    ],
  },
  // ---------- Class 11 Physics: Kinematics ----------
  [key('physics', 11, 'Kinematics', 'Motion in a Straight Line')]: {
    theory: `**Motion in a Straight Line** (1D Kinematics) is the foundation of describing how things move! 

Imagine driving a car strictly forward or backward on a completely straight road. To describe this scientifically, we use:
• **Position (x):** Where you are relative to a starting point (origin).
• **Displacement (Δx):** The change in your position. It cares about direction! If you go 5m forward and 5m back, displacement is zero.
• **Velocity (v):** How fast your position changes. Average velocity = Displacement / Time. Instantaneous velocity is your exact speed and direction at a specific microsecond (what the speedometer shows + direction).
• **Acceleration (a):** How fast your *velocity* changes. If you press the gas pedal, you accelerate. If you brake, you decelerate (negative acceleration).

The core of this topic revolves around the **Three Equations of Motion** (for *constant* acceleration):
1. v = u + at
2. s = ut + ½at²
3. v² = u² + 2as

*Pro Tip: Free fall under gravity is the most common example of straight-line motion with constant acceleration (a = -g ≈ -9.8 m/s²).*`,
    bits: [
      'Displacement is the vector difference between final and initial position.',
      'Average velocity = Total displacement / Total time. Average speed = Total distance / Total time.',
      'Acceleration is the rate of change of velocity. Speeding up or slowing down both involve acceleration.',
    ],
  },
  [key('physics', 11, 'Kinematics', 'v-t Graphs & Frame of Reference')]: {
    theory: `**Velocity-Time (v-t) Graphs** are visual cheat sheets for motion! They tell you heavily detailed stories just by looking at lines.

**How to read a v-t graph:**
• **The y-axis** is velocity, the **x-axis** is time.
• **Slope of the line:** Represents **Acceleration**. A steep line means high acceleration. A horizontal line means zero acceleration (constant velocity). A downward slope means slowing down.
• **Area under the curve:** This is the magic trick of v-t graphs! The shaded geometric area between the line and the time axis tells you the exact **Displacement**.

**Frame of Reference:**
Motion is entirely relative! If you are sitting in a moving train at 100 km/h, your velocity relative to the train is zero. Relative to a tree outside, it's 100 km/h. A Frame of Reference is simply the coordinate system (the "point of view") from which you choose to measure motion.

**Relative Velocity formula:**
Velocity of object A relative to object B is: **v_AB = v_A - v_B**`,
    bits: [
      'The slope of a Velocity-Time graph gives Acceleration.',
      'The area under a Velocity-Time graph gives Displacement.',
      'Relative velocity v_AB = v_A - v_B (using vector subtraction).',
    ],
  },
  [key('physics', 11, 'Kinematics', 'Vectors & Projectile Motion')]: {
    theory: `Welcome to 2D Physics! **Vectors** are arrows that have both magnitude (length) and direction. You can't just add them like regular numbers (3 + 4 isn't always 7 with vectors, it could be 5 if they form a right triangle!).

**Resolving Vectors:** The most vital skill is breaking a slanted vector into horizontal (x) and vertical (y) components using trigonometry (soh-cah-toa).
• X-component: V_x = V * cos(θ)
• Y-component: V_y = V * sin(θ)

**Projectile Motion:**
Throw a ball in the air—that parabolic arc is a projectile! The brilliant secret to solving these is **separating the X and Y dimensions**:
1. **Horizontal (X) Motion:** Once thrown, there is NO acceleration pushing it sideways (ignoring air resistance). So explicitly, horizontal velocity remains **constant**.
2. **Vertical (Y) Motion:** Gravity pulls it down. So it accelerates purely vertically at -9.8 m/s².

The two dimensions don't affect each other, but they are linked by **Time**!
*Key formulas to memorize: Time of Flight, Maximum Height, and Horizontal Range.*`,
    bits: [
      'Vectors have magnitude and direction; scalars only have magnitude.',
      'In projectile motion, horizontal velocity is constant (a_x = 0).',
      'Vertical motion is independent of horizontal motion, governed solely by gravity (a_y = -g).',
    ],
  },
  [key('physics', 11, 'Kinematics', 'Uniform Circular Motion')]: {
    theory: `**Uniform Circular Motion (UCM)** happens when an object travels in a circle at a strictly constant speed. 

**Wait, is it accelerating?**
YES! Acceleration is a change in velocity. Since velocity is a vector (speed + direction), and the *direction* is constantly turning, the velocity is constantly changing! Therefore, it is accelerating.

**Centripetal Acceleration:**
This acceleration points strictly towards the **center** of the circle. Without it, the object would fly off straight in a tangent line. 
Formula: **a_c = v² / r** (where v is speed, r is radius).

To cause this acceleration, there must be a net force pulling towards the center—this is the **Centripetal Force** (F_c = m * v² / r). It's not a "new" magical force; it's provided by real things like string tension, gravity (for planets), or road friction (for turning cars).`,
    bits: [
      'In UCM, speed is constant but velocity is continuously changing due to direction.',
      'Centripetal acceleration (v²/r) is directed towards the center of the circular path.',
      'Centripetal force is necessary to maintain circular motion, provided by tension, gravity, friction, etc.',
    ],
  },

  // ---------- Class 11 Physics: Thermodynamics ----------
  [key('physics', 11, 'Thermodynamics', 'Thermal equilibrium and zeroth law')]: {
    theory: `**🏛️ Topic 1: Thermal Equilibrium and Zeroth Law (Basic Level)**

**The Main Topic: The Big Picture**

Thermodynamics is not about memorizing textbook definitions; it is about understanding the ultimate rules of energy and heat. Before you can build engines, analyze complex systems, or calculate energy efficiency, you must accept one absolute rule: the universe hates imbalance.

If you leave a hot slice of pizza in a cold room, the pizza will eventually cool down, and the room gets infinitesimally warmer. They trade heat until they exactly match each other. This entire topic is about defining that exact "balance point" and proving the logical rule that heat will always stop flowing once perfect balance is reached. It sets the ground rules before you do any math.

**Subtopic 1.1: State Variables & Thermodynamic Walls**

*The Concept & Story:* Before you can study heat, you need to know exactly what you are studying. In physics, a "System" is just the specific object you are focusing on—like gas trapped inside a sealed syringe.

You cannot count every single microscopic gas molecule to see what they are doing. Instead, you define the system's "State" (its current physical condition) using big, observable numbers: Pressure ($P$), Volume ($V$), and Temperature ($T$).

How this system behaves depends entirely on the walls of its container. If the gas is inside a perfect, high-end Thermos flask (Adiabatic Wall), absolutely zero heat can get in or out. If it is inside a thin metal can (Diathermic Wall), heat passes through the walls instantly.

**Subtopic 1.2: Thermal Equilibrium**

*The Concept & Story:* Nature absolutely hates imbalance. Imagine placing a burning hot block of iron right next to a freezing cold block of iron so they are touching.

Heat is simply energy in transit, and it will immediately flow from the hot block into the cold block. The exact moment both blocks reach the exact same temperature, the heat stops flowing. They have reached a perfect "balance point." In physics, this state of balance is called Thermal Equilibrium. Once this happens, the system is stable, and its macroscopic properties (like pressure and volume) stop changing.

**Subtopic 1.3: The Zeroth Law & Temperature Measurement**

*The Concept & Story:* Imagine you have two separate cups of hot coffee and a thermometer. You put the thermometer in the first cup, and the liquid expands to the number 80. You take it out and put it in the second cup across the room, and it also reads 80.

Even though those two cups of coffee never touched each other, you know they are the exact same temperature. Why? Because they both matched the exact same thermometer.

This is the Zeroth Law of Thermodynamics. It states that if Object A is balanced with Object C (the thermometer), and Object B is also balanced with Object C, then A and B are perfectly balanced with each other. This logical rule is the entire reason thermometers are allowed to exist in physics.`,
    bits: [
      'System = specific object you study. State = condition defined by P, V, T (macroscopic variables).',
      'Adiabatic wall = insulator (Thermos flask; zero heat in/out). Diathermic wall = conductor (heat passes through).',
      'Thermal equilibrium: heat stops flowing; same temperature; P, V stop changing. The "balance point."',
      'Zeroth Law: A~C and B~C ⇒ A~B. Thermometer (C) measures A and B. Why thermometers exist in physics.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Thermal equilibrium and zeroth law'), 'intermediate')]: {
    theory: `**🏛️ Topic 1: Thermal Equilibrium and Zeroth Law (Intermediate Level)**

**The Main Topic: Moving from "Feeling" to "Formula"**

At the Intermediate level, CBSE does not care about your intuition or "vibes." Physics grades you on mathematical proof. You must translate physical concepts into equations. You cannot simply say a gas is "hot" or "compressed"; you must provide the exact mathematical "receipts" that define its condition. This is where we introduce the strict rules for how a system behaves when confined by different types of walls, and we establish the mathematical justification for why we are allowed to use a number (Temperature) to represent a physical state.

**Subtopic 1.1: State Variables & Thermodynamic Walls**

*The Exam Logic & Formulas:* You cannot solve a thermodynamics problem without defining the "DNA" of the gas first. This is the Equation of State. For an ideal gas, the macroscopic state variables are locked together by the equation:
$$PV = nRT$$
Where $P$ is Pressure, $V$ is Volume, $n$ is the number of moles, $R$ is the Universal Gas Constant, and $T$ is absolute Temperature (always in Kelvin).

In CBSE word problems, the "walls" act as strict mathematical constraints. You must decode them instantly:

* **Adiabatic Wall:** You immediately write down $Q = 0$. Heat transfer is mathematically zero. The systems cannot reach thermal equilibrium with each other.
* **Diathermic Wall:** You immediately write down that heat will exchange until $T_1 = T_2$.

**Subtopic 1.2: Thermal Equilibrium**

*The Exam Logic & Formulas:* CBSE requires the strict, formal definition. If asked to define it, you must write: "Two systems are in thermal equilibrium if their macroscopic variables (Pressure, Volume, Temperature, Mass) cease to change with time."

Mathematically, how do you prove two systems are balanced without measuring them with a thermometer? You use their Equation of State. If System A (with state $P_A, V_A$) and System B (with state $P_B, V_B$) are in thermal equilibrium, then $T_A = T_B$.

Therefore, you can equate them:
$$\\frac{P_A V_A}{n_A R} = \\frac{P_B V_B}{n_B R}$$
Examiners will typically give you three of these variables and ask you to solve for the missing fourth.

**Subtopic 1.3: The Zeroth Law & Temperature Measurement**

*The Exam Logic & Formulas:* This is a guaranteed 1-mark theoretical question. If an exam asks, "Which thermodynamic law leads to the concept of temperature?", your uncompromising answer must be: "The Zeroth Law of Thermodynamics establishes that Temperature is the scalar macroscopic property that determines whether or not a system is in thermal equilibrium with neighboring systems."

To practically measure this, you must build a temperature scale using a physical property that changes linearly with heat (like the volume of mercury). You lock in two fixed reference points—the melting point of ice at 0°C and the boiling point of water at 100°C—and divide the space between them into 100 equal degrees.`,
    bits: [
      'Equation of State: PV = nRT. Adiabatic wall → Q = 0. Diathermic wall → T_1 = T_2.',
      'Thermal equilibrium (formal): P, V, T, Mass cease to change with time. T_A = T_B ⟹ P_A V_A/(n_A R) = P_B V_B/(n_B R).',
      '1-mark answer: Zeroth Law establishes Temperature as the scalar property for thermal equilibrium.',
      'Temperature scale: property linear in heat (e.g. mercury volume); 0°C (ice), 100°C (boiling water); 100 equal degrees.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Thermal equilibrium and zeroth law'), 'advanced')]: {
    theory: `**🏛️ Topic 1: Thermal Equilibrium and Zeroth Law (Advanced Level)**

**The Main Topic: The "Stress Test" of Thermal Equilibrium**

At the highest level of CBSE exams (Higher Order Thinking Skills - HOTS), "knowing" the Zeroth Law or the Ideal Gas Equation is practically useless on its own. Examiners will actively try to break your logic. What if the thermometer is built incorrectly? What if the universe doesn't use Celsius? What happens at a molecular level when things "stop" changing? At this level, you are no longer just observing the system; you are reverse-engineering the tools used to measure it and defending your logic against conceptual traps.

**Subtopic 1.1: State Variables & Thermodynamic Walls**

*CBSE HOTS & Edge Cases:* The Advanced trap here is the classification of variables. CBSE will ask you to split the "DNA" of a system into two categories, and if you mix them up, your macroscopic analysis fails.

**Intensive Variables:** These do not depend on the size or mass of the system. (e.g., Temperature, Pressure, Density). If you cut a room in half, the temperature in both halves remains the same.

**Extensive Variables:** These do depend on the size or mass of the system. (e.g., Volume, Internal Energy, Total Mass). If you cut a room in half, the volume is halved.

*The Exam Trap:* An examiner will give you two identical boxes of gas at pressure $P$ and volume $V$, and ask what happens to $P$ and $V$ if the wall between them is removed.

*Uncompromising Answer:* The new volume is $2V$ (Extensive), but the pressure remains $P$ (Intensive).

**Subtopic 1.2: Thermal Equilibrium**

*CBSE HOTS & Edge Cases:* The Intermediate level tells you that heat "stops flowing" when equilibrium is reached. That is a simplified lie designed for basic calculations.

*The Reality (Dynamic Equilibrium):* Heat never actually stops moving. When two objects are in thermal equilibrium, Object A is still radiating heat to Object B, and Object B is radiating heat back to Object A. The critical, unbreakable fact is that the net rate of heat exchange is absolutely zero.

*The Exam Trap:* If a 3-mark CBSE Assertion-Reason question states, "All molecular heat transfer halts at thermal equilibrium", you must assert that this is **FALSE**. It is a dynamic state of continuous, equal exchange, not a static freeze.

**Subtopic 1.3: The Zeroth Law & Temperature Measurement**

*CBSE HOTS & Edge Cases:* What if a thermometer is built wrong? A standard CBSE HOTS numerical will give you a "faulty thermometer" with incorrect markings.

*The Faulty Thermometer Hack:* Even if the scale is wrong, the ratio of the reading to the fixed points is a universal constant. You must use this equation to hack the true temperature:
$$\\frac{\\text{Faulty Reading} - \\text{Lower Fixed Point}}{\\text{Upper Fixed Point} - \\text{Lower Fixed Point}} = \\frac{C - 0}{100 - 0}$$

*The Absolute Anchor (Triple Point):* Melting ice and boiling water are actually terrible reference points because they shift if atmospheric pressure changes. To define temperature with absolute precision, physicists use the **Triple Point of Water**. This is the singular, exact condition where ice, liquid water, and water vapor coexist perfectly at the same time. It occurs at exactly 273.16 K. This is the unchangeable anchor of the thermodynamic universe.

*Thermometric Properties:* The Zeroth Law applies to any physical property that changes steadily with heat, not just liquid expanding. This includes the pressure of a gas at a constant volume, or the electrical resistance ($R$) of a platinum wire. You calculate the true temperature using interpolation:
$$T = \\frac{R_T - R_0}{R_{100} - R_0} \\times 100$$`,
    bits: [
      'Intensive: independent of size (T, P, density). Extensive: depends on size (V, U, mass). Two boxes: remove wall → volume 2V, pressure still P.',
      'Thermal equilibrium = dynamic equilibrium; net heat exchange zero, not "heat halts." Assertion "molecular heat transfer halts" is FALSE.',
      'Faulty thermometer: (Reading − LFP)/(UFP − LFP) = (C − 0)/(100 − 0). Triple point of water = 273.16 K; ice + liquid + vapor coexist.',
      'Thermometric property: T = (R_T − R_0)/(R_100 − R_0) × 100 for resistance; any property varying with heat works.',
    ],
  },

  [key('physics', 11, 'Thermodynamics', 'Heat, work and internal energy')]: {
    theory: `**🏛️ Topic 2: Heat, Work, and Internal Energy (Basic Level)**

**The Main Topic: The "Energy Bank Account"**

You cannot survive thermodynamics if you treat all energy as the same thing. Energy has strict currencies. To understand how a system operates, you must treat a container of gas exactly like a bank account. You need to know how much money is sitting in the vault, how much is being wired in electronically, and how much physical cash is being spent. This topic strictly separates the energy trapped inside the gas from the energy crossing the borders of the container. If you mix these up, your logic will fail completely.

**Subtopic 2.1: Internal Energy ($U$)**

*The Concept & Story:* Imagine a swarm of millions of angry bees trapped inside a glass jar. Even if the jar itself is sitting perfectly still on a table, there is a massive amount of chaotic energy moving around inside it.

This is Internal Energy. It is the sum of all the microscopic kinetic energy (how fast the molecules are flying around) and potential energy (how tightly they are pulled together) of the gas molecules. For an ideal gas, we ignore the potential energy. The only thing that matters is speed.

If you heat the gas, the molecules fly faster, and the Internal Energy increases. Your thermometer acts as a "speedometer" for these invisible molecules. Higher temperature strictly means higher Internal Energy.

**Subtopic 2.2: Heat ($Q$)**

*The Concept & Story:* People incorrectly use the word "heat" to describe how hot a summer day feels. In physics, heat is not a state of being; it is a verb. Heat is energy in transit.

Think of Heat as a direct wire transfer into your bank account. It is energy that flows across the boundary of your system purely because there is a temperature difference between the inside and the outside. If you place a cold cylinder of gas on a hot stove, energy flows into the gas. The moment you take it off the stove, the "Heat" stops. A gas can contain Internal Energy, but it cannot "contain" Heat. Heat only exists when it is moving.

**Subtopic 2.3: Work ($W$)**

*The Concept & Story:* If Heat is an electronic wire transfer, then Work is physical cash being spent or earned. Work is mechanical effort.

Imagine your gas is trapped inside a cylinder with a heavy, movable metal piston on top. If you wire transfer energy into the gas (Heat), the molecules speed up and smash against the piston harder. If they smash hard enough to physically lift the heavy metal piston upward against gravity, the gas has done Work. It spent some of its energy to move a physical object in the real world. Conversely, if you push the piston down and crush the gas, you are doing Work on the system, forcing energy into it.`,
    bits: [
      'Internal Energy (U): microscopic KE + PE of molecules. Ideal gas: PE ignored. Higher T ⟹ higher U. "Speedometer" for molecules.',
      'Heat (Q): energy in transit across boundary due to temperature difference. A gas contains U, but cannot "contain" Q. Q exists only when moving.',
      'Work (W): mechanical effort. Gas does W when it pushes piston; you do W on gas when you compress it. Like physical cash vs wire transfer.',
    ],
  },

  [key('physics', 11, 'Thermodynamics', 'First law of thermodynamics')]: {
    theory: `**🏛️ Topic 3: First Law of Thermodynamics (Basic Level)**

**The Main Topic: The Cosmic Audit**

If Topic 2 defined the "currencies" of energy (Heat, Work, and Internal Energy), Topic 3 establishes the ultimate law of the cosmic bank: you cannot print free money, and you cannot make money disappear. The First Law of Thermodynamics is simply the Law of Conservation of Energy applied to heat. It states that the universe is a closed system. If a machine does physical work, it absolutely must "pay" for that work by either absorbing heat from its surroundings or draining its own internal energy. There are zero exceptions.

**Subtopic 3.1: The Law of Conservation (The Iron Rule)**

*The Concept & Story:* Imagine a completely sealed vault. Inside the vault, you can exchange gold for cash, or cash for crypto, but the total value inside the vault never changes.

In thermodynamics, energy cannot be created from nothing, and it cannot be destroyed into nothing. It only changes forms. If you pump heat into a gas engine, that energy does not just vanish. The engine is forced to do one of two things with it: it either uses the energy to smash the gas molecules around faster (heating up), or it uses the energy to push a piston outward (doing physical work). It cannot do anything else.

**Subtopic 3.2: The Bank Account Equation**

*The Concept & Story:* We can map this cosmic audit directly to a simple bank transaction.

Imagine you receive a direct deposit of 100 dollars (this is the Heat entering the system). You are forced to split this money. You put 60 dollars into your savings account to increase your wealth (this is the increase in Internal Energy). You spend the remaining 40 dollars to physically buy groceries (this is the Work done by the system).

The math must balance perfectly: **100 (Income) = 60 (Savings) + 40 (Spending)**. If a system tries to do 120 of physical work but only received 100 in heat, it will fail unless it drains its own internal savings to make up the difference.

**Subtopic 3.3: The Blindness of the First Law**

*The Concept & Story:* The First Law is absolutely mathematically true, but it is entirely blind to common sense. It only cares about the numbers balancing.

According to the First Law, it is perfectly legal for a hot cup of coffee to absorb heat from the surrounding air, freezing the room while the coffee boils itself into steam. The energy equation balances perfectly, so the First Law says it can happen. But in the real world, heat never flows from cold to hot spontaneously.

The First Law tracks the "amount" of energy, but it has no idea which "direction" the energy is allowed to flow. This massive failure point is exactly why physics had to invent the Second Law of Thermodynamics.`,
    bits: [
      'First Law = Conservation of Energy for heat. Work must be "paid" by heat absorbed or internal energy drained.',
      'Bank account analogy: Heat = income; ΔU = savings; W = spending. Q = ΔU + W. Math must balance.',
      'First Law is blind to direction: it allows heat cold→hot on paper; Second Law fixes this.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'First law of thermodynamics'), 'intermediate')]: {
    theory: `**🏛️ Topic 3: First Law of Thermodynamics (Intermediate Level)**

**The Main Topic: The Mathematical Audit**

The First Law is the mathematical bedrock of thermodynamics. It is the formal application of the Law of Conservation of Energy to heat and macroscopic work. In CBSE physics, you are tested on your ability to track exactly where every single Joule of energy goes. If your equation does not balance perfectly, your understanding of the system has failed. You must take the three currencies from Topic 2 and lock them into a single, unbreakable formula.

**Subtopic 3.1: The Law of Conservation (The Iron Rule)**

*The Exam Logic & Formulas:*

*The CBSE Definition:* If you are asked to state the First Law, you must write: "The amount of heat supplied to a system is equal to the algebraic sum of the change in its internal energy and the external work done by the system."

*The Master Equation:*
$$\\Delta Q = \\Delta U + \\Delta W$$
Where $\\Delta Q$ is Heat exchanged, $\\Delta U$ is the change in Internal Energy, and $\\Delta W$ is Work done.

*The Fatal Trap:* This equation is useless if you ignore the strict sign conventions from Topic 2. If heat leaves the system, $\\Delta Q$ must be plugged in as a negative number. If work is done on the gas (compression), $\\Delta W$ is negative. A single missed negative sign will ruin the entire calculation.

**Subtopic 3.2: The Bank Account Equation**

*The Exam Logic & Formulas:* Examiners will rarely give you a simple system. They will force the gas through specific constrained processes. You must know exactly how the master equation collapses under these constraints:

* **Isothermal Process (Constant Temperature):** Since temperature does not change ($\\Delta T = 0$), internal energy cannot change ($\\Delta U = 0$). The Equation becomes: $\\Delta Q = \\Delta W$. Every Joule of heat absorbed is immediately spent doing work.
* **Adiabatic Process (Perfect Insulator):** No heat is allowed to enter or leave the system ($\\Delta Q = 0$). The Equation becomes: $\\Delta U = -\\Delta W$. If the gas expands and does work ($+W$), it must drain its own internal energy, meaning its temperature drops ($\\Delta U$ is negative).
* **Isochoric Process (Constant Volume):** If volume cannot change, the gas cannot physically push the piston ($\\Delta W = 0$). The Equation becomes: $\\Delta Q = \\Delta U$. All heat absorbed goes directly into raising the temperature of the gas.

**Subtopic 3.3: The Blindness of the First Law**

*The Exam Logic & Formulas:* This is a high-probability 2-mark theoretical question. Examiners will ask you to state the Limitations of the First Law.

You must provide these two exact, uncompromising facts:

* **It fails to predict the direction of heat flow:** The equation $\\Delta Q = \\Delta U + \\Delta W$ works mathematically even if heat flows from a cold object to a hot object. The First Law has no mechanism to forbid this impossible event.
* **It implies 100% conversion is possible:** The equation suggests you can convert heat into work entirely without any waste. Real-world physics dictates this is impossible; some heat must always be rejected to a cold sink.`,
    bits: [
      'First Law: Q = ΔU + W. CBSE def: heat supplied = ΔU + work done by system. Sign conventions critical.',
      'Isothermal (ΔT=0): ΔU=0 ⟹ Q=W. Adiabatic (Q=0): ΔU=−W. Isochoric (ΔW=0): Q=ΔU.',
      'Limitations: (1) Cannot predict direction of heat flow. (2) Implies 100% conversion possible (false).',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'First law of thermodynamics'), 'advanced')]: {
    theory: `**🏛️ Topic 3: First Law of Thermodynamics (Advanced Level)**

**The Main Topic: The Multi-Process Stress Test**

At the CBSE HOTS level, examiners will no longer give you a single, isolated process. They will chain them together. A gas will expand isothermally, then compress adiabatically, and finally return to its original state isochorically. You must audit the energy across every single step without losing a negative sign. Furthermore, you will be tested on the exact mathematical limits of the First Law, proving exactly why it is an incomplete description of the thermodynamic universe.

**Subtopic 3.1: The Law of Conservation (The Iron Rule)**

*CBSE HOTS & Edge Cases:*

*The Cyclic Energy Trap:* Examiners love testing the First Law on a closed $P$-$V$ loop. You must understand that for a complete cycle, the initial and final states are identical. Therefore, the total change in Internal Energy is absolute zero ($\\Delta U_{\\text{cycle}} = 0$).

*The Mathematical Conclusion:* Because $\\Delta U = 0$, the First Law strictly dictates that the net heat absorbed by the system must exactly equal the net work done by the system:
$$\\Sigma Q = \\Sigma W$$

*The Exam Trap:* Students often calculate the work done (the area inside the loop) and forget that $\\Sigma Q$ is the algebraic sum of heat. You must subtract the heat rejected to the cold sink from the heat absorbed from the hot source ($Q_{\\text{in}} - Q_{\\text{out}} = W_{\\text{net}}$).

**Subtopic 3.2: The Bank Account Equation**

*CBSE HOTS & Edge Cases:*

*The Calculus of Work:* In basic problems, pressure is constant. In HOTS numericals, pressure changes as volume changes. You cannot use simple multiplication; you must use integration.

*The Mathematical Proof:* If the exam states that pressure is directly proportional to volume ($P = kV$), you must substitute this into the work integral to find the energy spent:
$$W = \\int_{V_1}^{V_2} P \\, dV = \\int_{V_1}^{V_2} kV \\, dV = \\frac{k}{2} (V_2^2 - V_1^2)$$
If you attempt to use $W = P \\Delta V$ here, your calculation will instantly fail because $P$ is not a static number.

*Mayer's Relation ($C_p - C_v = R$):* This is a guaranteed 3-mark derivation that relies entirely on the First Law. You must prove that it takes more heat to raise the temperature of a gas at constant pressure ($C_p$) than at constant volume ($C_v$) because at constant pressure, the gas wastes some of that heat doing physical work ($\\Delta W$).

**Subtopic 3.3: The Blindness of the First Law**

*CBSE HOTS & Edge Cases:*

*The Asymmetry of Nature:* The First Law treats work and heat as perfectly interchangeable currencies. CBSE HOTS questions will ask you to explain why this is a physical illusion.

*The Uncompromising Fact:* Work can be 100% converted into heat. For example, if you rub two blocks together, all the mechanical work ($W$) turns into thermal energy ($Q$) due to friction. However, heat cannot be 100% converted into work. A car engine cannot turn all the heat from burning petrol into forward motion; the exhaust pipe must always release waste heat.

*The Bridge to the Second Law:* The First Law says, "Energy is conserved." The Second Law is required to say, "Energy is conserved, but its quality degrades." This exact failure of the First Law is what forces physicists to introduce the concept of Entropy.`,
    bits: [
      'Cyclic process: ΔU_cycle = 0 ⟹ ΣQ = ΣW. Q_in − Q_out = W_net. Subtract heat rejected from heat absorbed.',
      'Variable P: W = ∫ P dV. If P = kV, then W = (k/2)(V₂² − V₁²). Cannot use W = PΔV. Mayer: C_p − C_v = R.',
      'Work→heat: 100% possible (friction). Heat→work: 100% impossible. Second Law: quality degrades; Entropy.',
    ],
  },

  [key('physics', 11, 'Thermodynamics', 'Isothermal and adiabatic processes')]: {
    theory: `**🏛️ Topic 4: Isothermal and Adiabatic Processes (Basic Level)**

**The Main Topic: The Two Extremes of Thermodynamics**

You cannot just compress a gas and expect a single, predictable result. The outcome depends entirely on how you do it. Thermodynamics is dictated by time and insulation. If you compress a gas incredibly slowly in a metal can, it behaves completely differently than if you crush it instantly inside a Thermos flask. This topic covers the two absolute extremes: a process where temperature is perfectly locked (Isothermal), and a process where heat is completely trapped (Adiabatic).

**Subtopic 4.1: The Isothermal Process (Slow and Steady)**

*The Concept & Story:* "Iso" means same; "Thermal" means temperature. In an Isothermal process, the temperature of the gas is strictly forbidden from changing, no matter how much you crush it or let it expand.

How is this physically possible? It requires two strict conditions. First, the gas must be held in a container with perfect conducting walls (Diathermic). Second, the process must happen incredibly slowly.

If you slowly push a piston down, the gas wants to heat up. But because you are moving so slowly, the extra heat has plenty of time to bleed through the metal walls into the surrounding room. The temperature never spikes. It remains perfectly balanced with the room the entire time.

**Subtopic 4.2: The Adiabatic Process (Fast and Isolated)**

*The Concept & Story:* An Adiabatic process is the exact opposite. It is a state of total isolation. Absolutely zero heat is allowed to enter or leave the system.

This happens under two conditions. First, the gas is trapped in a perfect insulator (like a thick foam cooler). Second, the process happens incredibly fast.

If you violently slam a piston down, the gas molecules are crushed together and speed up. Because the walls are insulated (or because the smash happened too fast for the heat to escape), all that energy stays trapped inside. The temperature of the gas immediately skyrockets. Conversely, if a highly pressurized gas suddenly bursts out of a container (like spraying a deodorant can), it expands so fast that it drains its own internal energy, making the can feel freezing cold.

**Subtopic 4.3: The Indicator Diagram (Visualizing the Extremes)**

*The Concept & Story:* If you plot these two processes on a graph of Pressure vs. Volume, they look like two different slides at a waterpark.

The Isothermal curve is a gentle, sweeping slope. As the gas expands, the pressure drops smoothly because the temperature is kept stable by the outside room.

The Adiabatic curve is a massive, steep drop. It is much more aggressive. When an adiabatic gas expands, it doesn't just lose pressure because it's taking up more space; it also loses pressure because it is freezing cold, stripping the gas of its internal kinetic energy simultaneously. It suffers a double penalty.`,
    bits: [
      'Isothermal: T constant. Needs (1) Diathermic walls, (2) very slow process. Heat bleeds out as you compress.',
      'Adiabatic: Q = 0. Needs (1) insulating walls or (2) very fast process. Compress = hot; rapid expansion = cold (deodorant can).',
      'P-V graph: Isothermal = gentle slope; Adiabatic = steeper drop (double penalty—volume + cooling).',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Isothermal and adiabatic processes'), 'intermediate')]: {
    theory: `**🏛️ Topic 4: Isothermal and Adiabatic Processes (Intermediate Level)**

**The Main Topic: The Mathematical Constraints**

In CBSE physics, Isothermal and Adiabatic processes are not just concepts; they are strict mathematical boundaries. When a gas undergoes one of these processes, its standard Equation of State ($PV = nRT$) is overridden by specific constraints. You must memorize the distinct formulas for Work Done and the specific variations of the First Law that apply to each.

**Subtopic 4.1: The Isothermal Process (Slow and Steady)**

*The Exam Logic & Formulas:*

*The Constraint:* Temperature is constant ($T = \\text{constant}$). Therefore, the change in Internal Energy is zero ($\\Delta U = 0$).

*The First Law Application:* Since $\\Delta U = 0$, the master equation $\\Delta Q = \\Delta U + \\Delta W$ collapses to:
$$\\Delta Q = \\Delta W$$
Every Joule of heat added is perfectly converted into Work.

*The Equation of State (Boyle's Law):*
$$P_1 V_1 = P_2 V_2 = \\text{constant}$$

*The Derivation for Work Done:* This is a guaranteed CBSE derivation. You must integrate $P$ with respect to $V$. Do not forget the $2.303$ conversion factor for base-10 logs, or the examiner will cut your marks:
$$W = 2.303 \\, nRT \\log_{10} \\left( \\frac{V_2}{V_1} \\right) = 2.303 \\, nRT \\log_{10} \\left( \\frac{P_1}{P_2} \\right)$$

**Subtopic 4.2: The Adiabatic Process (Fast and Isolated)**

*The Exam Logic & Formulas:*

*The Constraint:* No heat is exchanged ($Q = 0$).

*The First Law Application:* Since $Q = 0$, the master equation collapses to:
$$\\Delta U = -\\Delta W$$
If the gas expands (positive Work), it drains its internal energy, and the temperature strictly decreases.

*The Equations of State (Poisson's Equations):* You cannot use Boyle's Law here. You must use the heat capacity ratio, defined as $\\gamma = \\frac{C_p}{C_v}$. You must memorize all three forms:
$$P V^\\gamma = \\text{constant}$$
$$T V^{\\gamma - 1} = \\text{constant}$$
$$P^{1 - \\gamma} T^\\gamma = \\text{constant}$$

*The Formula for Work Done:*
$$W = \\frac{nR(T_1 - T_2)}{\\gamma - 1}$$
(Note: If $T_2$ is lower than $T_1$, the gas expanded and cooled, making Work positive).

**Subtopic 4.3: The Indicator Diagram (Visualizing the Extremes)**

*The Exam Logic & Formulas:* If an examiner asks you to draw both processes starting from the exact same state on a $P$-$V$ graph, you must prove mathematically why they look different.

*The Mathematical Proof of Slope:* In calculus, the slope of a $P$-$V$ graph is $\\frac{dP}{dV}$.

For an Isothermal curve, the slope is: $-\\frac{P}{V}$

For an Adiabatic curve, the slope is: $-\\gamma \\left( \\frac{P}{V} \\right)$

*The Uncompromising Conclusion:* Because $\\gamma$ is always greater than 1, the Adiabatic curve is always steeper than the Isothermal curve. If you draw them with the same slope or cross them incorrectly, you will score a zero for the graph.`,
    bits: [
      'Isothermal: T constant, ΔU=0 ⟹ Q=W. Boyle: P₁V₁=P₂V₂. W = 2.303 nRT log₁₀(V₂/V₁). Memo 2.303!',
      'Adiabatic: Q=0 ⟹ ΔU=−W. Poisson: PV^γ, TV^(γ−1), P^(1−γ)T^γ = const. W = nR(T₁−T₂)/(γ−1).',
      'P-V slopes: Isothermal = −P/V; Adiabatic = −γ(P/V). γ>1 ⟹ adiabatic steeper. Same slope = zero.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Isothermal and adiabatic processes'), 'advanced')]: {
    theory: `**🏛️ Topic 4: Isothermal and Adiabatic Processes (Advanced Level)**

**The Main Topic: The Real-World Stress Test**

At the CBSE HOTS level, the examiner will stop telling you whether a process is "Isothermal" or "Adiabatic." They will describe a real-world event—like a tire bursting or a gas cylinder leaking—and expect you to deduce the process type from the speed and insulation of the event. You will also be required to use the molecular structure of the gas (Degrees of Freedom) to calculate the exact slope of the curves. If you cannot link chemistry (molecular structure) to physics (graph slopes), you will fail these 5-mark integrated questions.

**Subtopic 4.1: The Isothermal Process (Slow and Steady)**

*CBSE HOTS & Edge Cases:*

*The Perfect Reservoir Trap:* An examiner will describe a gas expanding against a "thermal reservoir" or "heat bath." *The Logic:* This is code for an Isothermal process. A reservoir is so massive that no matter how much heat the gas takes from it, the reservoir's temperature never drops.

*The Calculation:* In these problems, you must assume $\\Delta U = 0$ immediately. If the gas does $500\\text{ J}$ of work, it must have absorbed exactly $500\\text{ J}$ of heat from that reservoir.

*The Phase Change Connection:* CBSE HOTS questions often link this to Phase Changes (like boiling water or melting ice). Since temperature remains constant during a phase change despite adding heat, these are naturally Isothermal events.

**Subtopic 4.2: The Adiabatic Process (Fast and Isolated)**

*CBSE HOTS & Edge Cases:*

*The "Sudden" Rule:* Any process described as "sudden," "instant," or "bursting" is strictly Adiabatic. There is no time for heat to cross the boundary.

*Example:* A cycle tube bursts suddenly. Why does the escaping air feel cold? *Uncompromising Answer:* The air expands so rapidly that $Q = 0$. To do the work of expansion, the gas must drain its own internal energy ($\\Delta U = -W$). This causes a sharp drop in temperature.

*The $\\gamma$ Factor (Molecular Logic):* You cannot solve Advanced Adiabatic problems without knowing the specific heat ratio ($\\gamma = C_p / C_v$) for different gases:

* Monoatomic (He, Ar): $\\gamma = 1.67$ (Steepest curve).
* Diatomic ($O_2$, $N_2$): $\\gamma = 1.40$.
* Polyatomic ($CO_2$, $NH_3$): $\\gamma = 1.33$ (Gentlest adiabatic curve).

*The Exam Trap:* If an examiner asks which gas (Helium or Oxygen) will show a greater pressure drop when compressed adiabatically by the same volume, the answer is **Helium** because its $\\gamma$ is higher.

**Subtopic 4.3: The Indicator Diagram (Visualizing the Extremes)**

*CBSE HOTS & Edge Cases:*

*The Intersection Trap:* If an Isothermal curve and an Adiabatic curve intersect on a $P$-$V$ diagram, you must be able to identify which is which just by looking at them.

*The Slope Ratio:* Mathematically, the ratio of the slopes is:
$$\\frac{\\text{Slope of Adiabatic}}{\\text{Slope of Isothermal}} = \\gamma$$

*The Compression vs. Expansion Paradox:*
* In Expansion: Starting from the same point, the Adiabatic curve ends at a lower pressure and lower volume than the Isothermal curve.
* In Compression: Starting from the same point, the Adiabatic curve ends at a much higher pressure than the Isothermal curve.

*The Logic:* During adiabatic compression, the gas gets "double-pressured"—once because the volume is smaller, and again because the trapped heat makes the molecules smash harder.`,
    bits: [
      'Thermal reservoir = Isothermal. ΔU=0; W done = Q absorbed. Phase change (boiling, melting) = Isothermal (T constant).',
      '"Sudden/instant/bursting" = Adiabatic. γ: monoatomic 1.67, diatomic 1.40, polyatomic 1.33. He vs O₂: He steeper (higher γ).',
      'Slope ratio = γ. Expansion: adiabatic ends lower P,V. Compression: adiabatic ends higher P (double-pressured).',
    ],
  },

  [key('physics', 11, 'Thermodynamics', 'Second law of thermodynamics, Reversible/irreversible processes')]: {
    theory: `**🏛️ Topic 5: Second Law and Reversible Processes (Basic Level)**

**The Main Topic: The Arrow of Time**

The First Law of Thermodynamics is a simple accountant—it only cares if the energy numbers balance. But the Second Law is the judge. It tells us which events are actually allowed to happen in the real world. According to the First Law, a shattered glass could spontaneously jump back together if the energy math worked out. The Second Law steps in and says "No." This topic explains why heat only flows one way, why machines always waste energy, and why time only moves forward.

**Subtopic 5.1: The Direction of Heat (Nature's One-Way Street)**

*The Concept & Story:* Imagine you place a hot cup of tea in a cold room. You already know the tea cools down while the room warms up. But have you ever seen a cup of tea suddenly pull heat out of a cold room and start boiling on its own?

The First Law says this could happen because the energy would still be conserved. But the Second Law says it won't happen. Heat has a natural, stubborn preference: it strictly flows from Hot to Cold. To move heat the other way (like in a refrigerator), you have to "cheat" by plugging it into an external power source and forcing it to happen.

**Subtopic 5.2: Reversible vs. Irreversible (The Ghost of Energy)**

*The Concept & Story:* In a perfect world, you could swing a pendulum, and it would swing forever, perfectly converting potential energy to kinetic energy and back again. This is a Reversible Process. You could film it, play the movie backward, and it would look exactly the same.

But the real world is Irreversible. Every time you move, a tiny bit of energy is "lost" to friction or sound. Once that energy turns into random heat in the air, you can never fully get it back to do useful work. Most things in life—like a balloon popping, an egg frying, or a car engine running—are irreversible. You can't "un-fry" an egg because the energy has become too chaotic to reorganize.

**Subtopic 5.3: The Tax of the Universe (Entropy)**

*The Concept & Story:* Think of the Second Law as a "Universal Tax." Every time you convert energy from one form to another (like burning petrol to move a car), the universe takes a cut.

This tax is paid in Entropy, which is just a fancy word for "disorder" or "chaos." The universe naturally moves from order to disorder. A neat stack of papers (low entropy) eventually becomes a messy pile (high entropy) just by being touched. To clean the pile back into a stack, you have to spend your own energy. The Second Law proves that the total chaos in the universe is always increasing; you can never reach 100% efficiency because the "chaos tax" must always be paid.`,
    bits: [
      'Second Law = judge (what can happen). Heat flows Hot → Cold only; fridge needs external power to reverse.',
      'Reversible = ideal (pendulum forever). Irreversible = real (friction, balloon pop, fried egg). Can\'t un-fry an egg.',
      'Entropy = disorder/chaos. Universe: order → disorder. 100% efficiency impossible; chaos tax always paid.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Second law of thermodynamics, Reversible/irreversible processes'), 'intermediate')]: {
    theory: `**🏛️ Topic 5: Second Law and Reversible Processes (Intermediate Level)**

**The Main Topic: The Law of Limitations**

While the First Law tells us that energy is conserved ($\\Delta Q = \\Delta U + \\Delta W$), the Intermediate level of the Second Law explains why we can never build a "Perfect Machine." In CBSE physics, you are tested on two specific, rigorous statements that define the limits of heat engines and refrigerators. If you can memorize these two sentences, you can solve almost any theoretical question in this module.

**Subtopic 5.1: Two Statements of the Second Law**

*The Exam Logic & Formal Definitions:* You must be able to state both of these precisely. They are two sides of the same coin:

* **Kelvin-Planck Statement (The Engine Rule):** "It is impossible to construct an engine which, operating in a cycle, will produce no effect other than the extraction of heat from a reservoir and the performance of an equivalent amount of work."
* **Translation:** You cannot turn 100% of heat into work. You must reject some waste heat to a cold body (sink).

* **Clausius Statement (The Refrigerator Rule):** "It is impossible to construct a device which, operating in a cycle, will produce no effect other than the transfer of heat from a cooler body to a hotter body."
* **Translation:** Heat will not flow from cold to hot by itself. You must do external work (plug in electricity) to force it to happen.

**Subtopic 5.2: Reversible vs. Irreversible Processes**

*The Exam Logic & Conditions:* CBSE often asks for the "Conditions for Reversibility." A process is only reversible if it meets these two strict mathematical and physical criteria:

* **Quasi-static Nature:** The process must happen so infinitely slowly that the system remains in thermal and chemical equilibrium with its surroundings at every single millisecond.
* **Dissipative Forces must be Zero:** There must be absolutely no friction, viscosity, or electrical resistance.

*The Reality:* Since friction always exists and we cannot wait "infinite time" for a piston to move, all natural processes are Irreversible.

**Subtopic 5.3: The Tax of the Universe (Efficiency Limits)**

*The Exam Logic & Formulas:* Because of the Second Law, the efficiency ($\\eta$) of any heat engine can never be 1 (or 100%).

*The Formula:*
$$\\eta = 1 - \\frac{Q_{\\text{out}}}{Q_{\\text{in}}}$$

*The Rule:* Since $Q_{\\text{out}}$ (the waste heat rejected to the sink) can never be zero according to the Kelvin-Planck statement, $\\eta$ will always be less than 1.

*Exam Hint:* If a numerical asks you to calculate the efficiency of an engine that rejects no heat, the answer is "Physically Impossible according to the Second Law."`,
    bits: [
      'Kelvin-Planck: Cannot convert 100% heat to work; must reject waste to sink. Clausius: Heat won\'t flow cold→hot; needs external work.',
      'Reversible: (1) Quasi-static (infinitely slow), (2) Zero friction/viscosity/resistance. All natural processes irreversible.',
      'η = 1 − Q_out/Q_in. Q_out ≠ 0 always ⟹ η < 1. Engine that rejects no heat = physically impossible.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Second law of thermodynamics, Reversible/irreversible processes'), 'advanced')]: {
    theory: `**🏛️ Topic 5: Second Law and Reversible Processes (Advanced Level)**

**The Main Topic: The Universal Filter**

At the CBSE HOTS level, the Second Law is used as a "Proof of Impossibility." Examiners will present you with a "new invention"—a super-efficient engine or a magical cooling device—and ask you to prove why it can never exist, even if it satisfies the First Law of Energy Conservation. You must move beyond the basic statements and understand the mathematical "currency of chaos" known as Entropy. If the total chaos of a process decreases without external help, that process is a physical fraud.

**Subtopic 5.1: The Two Statements (The Equivalence Proof)**

*CBSE HOTS & Edge Cases:* The Logical Trap: CBSE may ask you to prove that the Kelvin-Planck and Clausius statements are actually the same law.

*The Proof:* If you could build a "Perfect Refrigerator" (violating Clausius) that moves heat from cold to hot with zero work, you could couple it with a normal engine. The result would be a "Perfect Engine" that converts 100% of heat into work with no waste (violating Kelvin-Planck).

*The Uncompromising Conclusion:* Violating one statement automatically violates the other. They are mathematically locked. If a device fails even one, it is physically impossible.

**Subtopic 5.2: Reversible vs. Irreversible (The Quasi-Static Mystery)**

*CBSE HOTS & Edge Cases:* The Illusion of Balance: In Advanced problems, you are introduced to the Quasi-static Process.

*The Logic:* This is a process that happens so infinitely slowly that the system is in thermal equilibrium with its surroundings at every single micro-second.

*The Exam Trap:* Is a quasi-static process always reversible? **No.** The Reality: A process can be slow (quasi-static) but still have friction. If there is friction, the energy is "dissipated" into random heat. You can move the piston back, but you can never "un-rub" the friction. Therefore, for a process to be truly reversible, it must be **both** quasi-static **and** non-dissipative.

**Subtopic 5.3: The Tax of the Universe (Entropy $S$)**

*CBSE HOTS & Edge Cases:* The Mathematical Definition: Entropy is the quantitative measure of the disorder of a system. In a reversible process, the change in entropy ($\\Delta S$) is defined as:

$$\\Delta S = \\frac{\\Delta Q}{T}$$

*The Law of Increase of Entropy:* This is the "Advanced" version of the Second Law. It states that the total entropy of an isolated system (or the entire universe) never decreases. It either stays the same (for a perfect reversible process) or increases (for everything else).

$$\\Delta S_{\\text{total}} \\geq 0$$

*The Exam Numerical:* An examiner might ask you to calculate the entropy change when 500 J of heat flows from a body at 500 K to one at 250 K.

* System 1 loses entropy: $-500/500 = -1\\,\\text{J/K}$
* System 2 gains entropy: $+500/250 = +2\\,\\text{J/K}$
* Total Change: $-1 + 2 = +1\\,\\text{J/K}$. Since the total entropy increased ($+1$), the process is Irreversible and Spontaneous. If the answer was negative, the process would be impossible.`,
    bits: [
      'Equivalence: Violating Clausius ⟹ can build Kelvin-Planck violator. One violation = both violated. Mathematically locked.',
      'Quasi-static ≠ reversible. Must be quasi-static AND non-dissipative. Friction dissipates; can\'t un-rub.',
      'ΔS = ΔQ/T. ΔS_total ≥ 0. 500 J from 500 K to 250 K: −1 + 2 = +1 J/K (irreversible). Negative total = impossible.',
    ],
  },

  [key('physics', 11, 'Thermodynamics', 'Heat engines and refrigerators')]: {
    theory: `**🏛️ Topic 6: Heat Engines, Refrigerators, and Carnot's Cycle (Basic Level)**

**The Main Topic: The Machines of Thermodynamics**

Up until now, we have studied the laws of energy in a vacuum. Topic 6 is where those laws meet engineering. Every machine in the world—from the massive engine in a Boeing 747 to the cooling coils in your kitchen fridge—works by moving heat between two different temperatures to do something useful. This topic covers how we turn fire into movement (Heat Engines) and how we use electricity to fight nature and keep things cold (Refrigerators).

**Subtopic 6.1: Heat Engines (Turning Fire into Motion)**

*The Concept & Story:* Think of a Heat Engine as a "Heat-Eater." It sits between a very hot place (the Source, like a burning furnace) and a cool place (the Sink, like the outside air).

The engine sucks in heat from the furnace. It uses a portion of that energy to physically push a piston (doing Work), and then it spits the leftover, "exhaust" heat out into the cool air. The Second Law tells us that the engine must spit out some waste. A car engine that doesn't have an exhaust pipe is physically impossible; it would eventually melt itself.

**Subtopic 6.2: Refrigerators & Heat Pumps (The Reverse Engine)**

*The Concept & Story:* A refrigerator is just a heat engine running in reverse. Instead of using heat to do work, it uses Work (electricity from your wall) to suck heat out of a cold place (your milk and vegetables) and dump it into a warmer place (your kitchen).

This is why the back of your fridge feels hot. It isn't "creating cold"; it is physically removing heat and throwing it behind the machine. If you leave the fridge door open, the room actually gets warmer because the motor has to work even harder to move that heat around, creating even more waste heat in the process.

**Subtopic 6.3: The Carnot Cycle (The "Perfect" Machine)**

*The Concept & Story:* In 1824, a French engineer named Sadi Carnot wondered: "What is the absolute maximum efficiency any engine can ever reach?" He designed a theoretical machine called the Carnot Engine. It uses a perfectly frictionless piston and moves so slowly (quasi-static) that it never wastes a single drop of energy to chaos. It is the "perfect" engine. Even though we can never build one in real life, the Carnot Engine acts as the ultimate benchmark. No matter how advanced technology becomes, no engine built by humans will ever be more efficient than Carnot's imaginary machine.`,
    bits: [
      'Heat engine: Source (hot) → work + exhaust → Sink (cold). Must reject waste; no exhaust = impossible.',
      'Refrigerator = heat engine in reverse. Uses work (electricity) to move heat cold→hot. Back feels hot = dumping heat.',
      'Carnot Engine (Sadi Carnot, 1824): ideal, frictionless, quasi-static. Maximum efficiency benchmark; cannot be beaten.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Heat engines and refrigerators'), 'intermediate')]: {
    theory: `**🏛️ Topic 6: Heat Engines, Refrigerators, and Carnot's Cycle (Intermediate Level)**

**The Main Topic: Measuring Performance**

In the professional world of physics and engineering, "good" isn't enough; we need a percentage. This level focuses on calculating exactly how much energy a machine wastes versus how much it uses. You will learn the mathematical "scorecards" for engines (Efficiency) and refrigerators (Coefficient of Performance). If you can manipulate these ratios, you can predict the performance of any thermal system.

**Subtopic 6.1: Heat Engine Efficiency ($\\eta$)**

*The Exam Logic & Formulas:* The Goal: To turn as much Heat ($Q_1$) from the source into Work ($W$) as possible.

*The "Scorecard" (Efficiency):* Efficiency is the ratio of what you get (Work) to what you paid (Heat Input).
$$\\eta = \\frac{W}{Q_1} = \\frac{Q_1 - Q_2}{Q_1} = 1 - \\frac{Q_2}{Q_1}$$
(Where $Q_1$ is heat from the hot source and $Q_2$ is heat rejected to the cold sink).

*The Constraint:* Since $Q_2$ can never be zero (Second Law), $\\eta$ is always less than 1 (100%).

**Subtopic 6.2: Refrigerator Performance ($\\beta$ or COP)**

*The Exam Logic & Formulas:* The Goal: To remove as much heat ($Q_2$) from the cold contents as possible using the least amount of electricity ($W$).

*The "Scorecard" (Coefficient of Performance):* Note that we don't call this "efficiency" because the value can be greater than 1.
$$\\beta = \\frac{Q_2}{W} = \\frac{Q_2}{Q_1 - Q_2}$$

*The Relation:* There is a sneaky CBSE relationship between engine efficiency ($\\eta$) and refrigerator performance ($\\beta$) that you should memorize:
$$\\beta = \\frac{1 - \\eta}{\\eta}$$

**Subtopic 6.3: The 4 Steps of the Carnot Cycle**

*The Exam Logic & Formulas:* The Carnot Engine is a theoretical engine that uses an ideal gas. To be "perfect," it must follow these four exact steps in order. You must be able to list these for a 3-mark theory question:

1. **Isothermal Expansion:** Gas absorbs heat ($Q_1$) from the source at $T_1$ while expanding slowly.
2. **Adiabatic Expansion:** Gas continues to expand but is now insulated. Temperature drops from $T_1$ to $T_2$.
3. **Isothermal Compression:** Gas is compressed while rejecting waste heat ($Q_2$) to the sink at $T_2$.
4. **Adiabatic Compression:** Gas is compressed while insulated until it returns to its original temperature $T_1$.

*The "Magic" Formula:* For a Carnot Engine only, the heat ratio equals the temperature ratio:
$$\\frac{Q_2}{Q_1} = \\frac{T_2}{T_1}$$

Therefore, Carnot Efficiency:
$$\\eta_{\\text{carnot}} = 1 - \\frac{T_2}{T_1}$$
(Note: Temperatures $T_1$ and $T_2$ must be in Kelvin).`,
    bits: [
      'η = W/Q₁ = 1 − Q₂/Q₁. Q₂ ≠ 0 (Second Law) ⟹ η < 1 always. COP: β = Q₂/W = (1−η)/η; can be > 1.',
      'Carnot 4 steps: (1) Isothermal expansion (Q₁ in), (2) Adiabatic expansion (T₁→T₂), (3) Isothermal compression (Q₂ out), (4) Adiabatic compression (return to T₁).',
      'Carnot only: Q₂/Q₁ = T₂/T₁. η_carnot = 1 − T₂/T₁. Temperatures in Kelvin!',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Heat engines and refrigerators'), 'advanced')]: {
    theory: `**🏛️ Topic 6: Heat Engines, Refrigerators, and Carnot's Cycle (Advanced Level)**

**The Main Topic: The Limits of Physical Reality**

At the CBSE HOTS (Higher Order Thinking Skills) level, we stop treating the Carnot Engine as a machine and start treating it as a mathematical proof. You will be tested on the "Universality" of Carnot's logic—the fact that the efficiency of a perfect engine has absolutely zero to do with what is inside it (whether it's Helium, Steam, or Air) and everything to do with the temperature of the universe around it. We will also analyze "Cascaded Engines," where the waste of one machine becomes the food for the next.

**Subtopic 6.1: Carnot's Theorem (The Universal Ceiling)**

*CBSE HOTS & Edge Cases:* The Working Substance Trap: An examiner will ask: "If we replace the Ideal Gas in a Carnot engine with a real gas like Nitrogen, does the efficiency change?"

*The Uncompromising Answer:* No. Carnot's Theorem states that the efficiency of a reversible engine depends only on the temperatures of the source and sink. It is independent of the nature of the working substance.

*The Impossibility of 100%:* Mathematically, to reach $\\eta = 1$ (100%), the sink temperature ($T_2$) must be Absolute Zero (0 K). Because the Third Law of Thermodynamics states that Absolute Zero is physically unreachable, a 100% efficient engine is a violation of the laws of the universe.

**Subtopic 6.2: Refrigerators & The "Open Door" Paradox**

*CBSE HOTS & Edge Cases:* The Room Cooling Trap: A classic 3-mark HOTS question asks: "If you leave the door of a refrigerator open in a sealed, insulated room, will the room get cooler?"

*The Logic:* No. The refrigerator is a heat pump. It removes heat $Q_2$ from the front and dumps $Q_1$ out the back. But to do this, it uses electrical work $W$.

*The Proof:* According to the First Law, $Q_1 = Q_2 + W$. This means the heat dumped into the room ($Q_1$) is always greater than the heat removed from the room ($Q_2$). The net result is that the room actually gets warmer.

*Performance Limits:* While an engine's efficiency cannot exceed 1, a refrigerator's Coefficient of Performance ($\\beta$) can be 5, 10, or higher. However, as the temperature difference between the inside and outside grows, $\\beta$ drops drastically, making it harder to keep things cold in a hot environment.

**Subtopic 6.3: The Math of the Carnot Cycle Steps**

*CBSE HOTS & Edge Cases:* You must be able to calculate the Work Done for each individual leg of the 4-step cycle.

* **Isothermal Steps:** Work is $nRT \\ln(V_{\\text{final}}/V_{\\text{initial}})$. Since $\\Delta U = 0$, all heat absorbed/released equals the work done.
* **Adiabatic Steps:** Work is $\\frac{nR(T_1 - T_2)}{\\gamma - 1}$.

*The Net Work Proof:* The most advanced derivation requires you to prove that the total Work for the cycle is the area enclosed by the two isotherms and two adiabats.

*The Temperature-Heat Equivalence:* For a Carnot cycle only, we use the absolute identity:
$$\\frac{Q_1}{T_1} = \\frac{Q_2}{T_2}$$

This allows you to solve "Double Engine" problems. If Engine A's sink is Engine B's source, then:
$$\\eta_{\\text{total}} = 1 - \\frac{T_3}{T_1}$$`,
    bits: [
      'Carnot Theorem: η depends only on T₁ and T₂, not working substance. η = 1 requires T₂ = 0 K (impossible; Third Law).',
      'Open fridge in sealed room: Q₁ = Q₂ + W ⟹ room heats up. COP β can be > 1 but drops as ΔT grows.',
      'Isothermal: W = nRT ln(V_f/V_i). Adiabatic: W = nR(T₁−T₂)/(γ−1). Q₁/T₁ = Q₂/T₂. Cascaded: η_total = 1 − T₃/T₁.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Heat, work and internal energy'), 'intermediate')]: {
    theory: `**🏛️ Topic 2: Heat, Work, and Internal Energy (Intermediate Level)**

**The Main Topic: The Mathematical Currencies**

To solve CBSE thermodynamics problems, you must stop treating energy as a general concept and start tracking it like an auditor. The three variables—Internal Energy ($U$), Heat ($Q$), and Work ($W$)—follow strict mathematical rules. Two of them depend entirely on the "path" you take to get from state A to state B, while one is an absolute physical property of the state itself. If you mess up the sign conventions (positive vs. negative) here, every calculation you do in the rest of the chapter will be fundamentally wrong.

**Subtopic 2.1: Internal Energy ($U$)**

*The Exam Logic & Formulas:* Internal Energy is a **State Function**. This is a critical exam keyword. It means the change in internal energy ($\\Delta U$) depends only on the initial and final temperatures, completely ignoring how the system got there.

For an ideal gas, internal energy is purely kinetic and depends only on absolute temperature ($T$):
$$\\Delta U = n C_v \\Delta T$$
(Where $n$ is moles, $C_v$ is molar heat capacity at constant volume, and $\\Delta T$ is the change in temperature: $T_{\\text{final}} - T_{\\text{initial}}$).

*The Sign Convention:* If temperature increases ($\\Delta T > 0$), then $\\Delta U$ is Positive. If temperature decreases ($\\Delta T < 0$), then $\\Delta U$ is Negative. In any Isothermal process (constant temperature), $\\Delta U$ is absolutely Zero.

**Subtopic 2.2: Heat ($Q$)**

*The Exam Logic & Formulas:* Heat is a **Path Function**. The amount of heat required to get a gas from $30^\\circ\\text{C}$ to $50^\\circ\\text{C}$ changes drastically depending on whether you keep the volume constant or let the gas expand while you heat it.

The formula:
$$Q = n C \\Delta T$$
(Where $C$ is the specific heat capacity, which changes depending on the process path).

*The Strict CBSE Physics Sign Convention:* Heat absorbed by the system is Positive ($+Q$). Heat released/lost by the system is Negative ($-Q$).

**Subtopic 2.3: Work ($W$)**

*The Exam Logic & Formulas:* Work is also a **Path Function**. It is the mechanical energy transferred by the gas expanding or compressing.

Work is calculated by integrating Pressure with respect to Volume:
$$W = \\int_{V_1}^{V_2} P \\, dV$$

*The Indicator Diagram ($P$-$V$ Graph):* In CBSE exams, they will give you a graph of Pressure vs. Volume. The Work done is mathematically equal to the **Area under the $P$-$V$ curve**.

*The Strict CBSE Physics Sign Convention:*

* Gas Expands (Volume increases, $dV > 0$): Work is done by the system. This is Positive ($+W$).
* Gas is Compressed (Volume decreases, $dV < 0$): Work is done on the system. This is Negative ($-W$).`,
    bits: [
      'ΔU is State Function; depends only on T_initial and T_final. ΔU = n C_v ΔT. ΔT > 0 ⟹ ΔU > 0; Isothermal ⟹ ΔU = 0.',
      'Q is Path Function. Q = n C ΔT; C depends on process. +Q = absorbed; −Q = released.',
      'W is Path Function. W = ∫ P dV. P-V graph: area under curve = work. +W = gas expands; −W = gas compressed.',
    ],
  },

  [keyWithLevel(key('physics', 11, 'Thermodynamics', 'Heat, work and internal energy'), 'advanced')]: {
    theory: `**🏛️ Topic 2: Heat, Work, and Internal Energy (Advanced Level)**

**The Main Topic: The "Stress Test" of Energy Currencies**

At the highest level of CBSE exams (Higher Order Thinking Skills - HOTS), examiners will stop giving you straightforward numbers and start giving you shapes. They will force you to analyze gases going through complex, multi-step loops (Cyclic Processes) where the temperature, pressure, and volume are constantly shifting. If you do not have an absolute, geometric understanding of State vs. Path functions, the graphs will deceive you, and your energy accounting will fail.

**Subtopic 2.1: Internal Energy ($U$)**

*CBSE HOTS & Edge Cases:*

*The Cyclic Trap:* An examiner will give you a complex $P$-$V$ graph where a gas expands, cools down, compresses, and heats back up to its exact starting point (a full circle or rectangle on the graph). They will ask for the total change in Internal Energy for the entire trip.

*The Uncompromising Answer:* It is absolutely Zero ($\\Delta U_{\\text{cycle}} = 0$). Because Internal Energy is a State Function, it only cares about the start and end points. If the gas returns to its original state, the temperature is identical to when it started. The math dictates that all the increases and decreases perfectly cancel out.

*Degrees of Freedom ($f$):* Advanced questions will require you to calculate $U$ based on the molecular structure of the gas using the formula:
$$U = \\frac{f}{2}nRT$$
You must know that a monoatomic gas (like Helium) has $f=3$, while a diatomic gas (like $O_2$) has $f=5$.

**Subtopic 2.2: Heat ($Q$)**

*CBSE HOTS & Edge Cases:*

*The Infinite Capacity Trap:* In lower levels, you are taught that Heat Capacity ($C$) is a fixed number (like the specific heat of water). In thermodynamics, this is false. The heat capacity of a gas depends entirely on the path.

*The Reality Check:* CBSE HOTS will ask for the molar heat capacity during an Isothermal process.

*The Logic:* $C = \\frac{Q}{n\\Delta T}$. In an isothermal process, $\\Delta T = 0$. Therefore, dividing by zero means the Heat Capacity is Infinite ($C = \\infty$).
$$C = \\frac{Q}{n\\Delta T} \\quad \\text{(Isothermal: } \\Delta T = 0 \\Rightarrow C = \\infty \\text{)}$$
You can pump endless heat into the gas, and if it expands at the perfect rate, its temperature will never rise.

Conversely, in an Adiabatic process where no heat is exchanged ($Q = 0$), the Heat Capacity is mathematically Zero.

**Subtopic 2.3: Work ($W$)**

*CBSE HOTS & Edge Cases:*

*The Geometry of Work:* You already know Work is the area under the $P$-$V$ curve. But what happens in a Cyclic Process (a closed loop)?

*The Rule:* The net Work done in a cyclic process is exactly equal to the **Area inside the closed loop**. You do not calculate down to the x-axis; you only calculate the area of the shape itself.

*The Clockwise / Anti-Clockwise Hack:* This is where 80% of students lose their sign convention points in 5-mark graph questions. You must memorize this visual rule for CBSE Physics.

* If the loop goes **Clockwise**, the expansion happens at a higher pressure than the compression. The net Work is Positive ($+W$).
* If the loop goes **Anti-Clockwise**, the compression happens at a higher pressure. The net Work is Negative ($-W$).`,
    bits: [
      'Cyclic process: ΔU_cycle = 0 (State Function). Degrees of freedom: monoatomic f=3, diatomic f=5. U = (f/2)nRT.',
      'Isothermal: ΔT = 0 ⟹ C = Q/(nΔT) → infinite. Adiabatic: Q = 0 ⟹ C = 0.',
      'Cyclic work = area inside closed loop. Clockwise loop ⟹ +W; Anti-clockwise loop ⟹ −W.',
    ],
  },

  // ---------- Class 12 Physics: Electrostatics ----------
  [key('physics', 12, 'Electrostatics', "Coulomb's Law & Electric Field")]: {
    theory: `**Electrostatics** is the study of stationary electric charges. The universe is full of charges (electrons and protons), and when they sit still, they create fascinating forces!

**Coulomb's Law:**
This is the fundamental rule of attraction and repulsion: *Like charges repel, opposite charges attract.*
The force between two point charges (q₁ and q₂) is directly proportional to the product of their charges and inversely proportional to the square of the distance (r) between them.
Formula: **F = k * (|q₁| * |q₂|) / r²** (where k is Coulomb's constant, 9×10⁹ N·m²/C²).

**Electric Field (E):**
Think of an electric field as an invisible "aura" or "web" that a charge creates around itself in space. If another charge enters this web, it feels a force!
Formula: **E = F / q** (Electric Field is the Force experienced per unit of positive test charge).
*Key Visual:* Electric field lines always point **away** from positive charges and **towards** negative charges.`,
    bits: [
      'Coulomb force follows the inverse-square law, just like gravity, but can be attractive OR repulsive.',
      'Electric Field (E) is a vector quantity. Its direction is the direction of force on a positive test charge.',
      'Electric field lines never cross each other. If they did, it would mean two different directions of force at one point!',
    ],
  },
  [key('physics', 12, 'Electrostatics', "Gauss's Law & Dipole")]: {
    theory: `**Electric Flux (Φ):**
Imagine a fishing net catching water flowing down a river. Electric flux is similar—it's a measure of how many electric field lines pass perpendicularly through a given surface area.
Formula: **Φ = E * A * cos(θ)**

**Gauss's Law:**
One of the most powerful and elegant laws in physics! It states that the total electric flux out of a *closed* surface (like a sphere or box) is entirely determined by the **total charge enclosed** within that surface.
Formula: **Φ_total = Q_enclosed / ε₀** (ε₀ is the permittivity of free space).
*Why is it useful?* It makes calculating electric fields for symmetrical shapes (like a long wire or a flat sheet) incredibly easy compared to using Coulomb's law!

**Electric Dipole:**
A dipole is simply a pair of equal and opposite charges (+q and -q) separated by a tiny distance (2a). Water molecules (H₂O) are perfect natural examples of electric dipoles!`,
    bits: [
      "Electric flux is maximum when the area is perpendicular to the electric field (normal vector is parallel).",
      "Gauss's Law relates electric flux through a closed surface to the net charge enclosed.",
      "An electric dipole in a uniform electric field experiences a torque (turning force) but ZERO net force.",
    ],
  },
  [key('physics', 12, 'Electrostatics', 'Capacitors & Dielectrics')]: {
    theory: `**Capacitors** are like tiny, lightning-fast batteries! While batteries provide a steady trickle of energy, capacitors store electrical energy and can dump it all at once (like a camera flash).

**Capacitance (C):**
It is the ability of a system to store charge per unit of electric potential difference (voltage).
Formula: **C = Q / V** (Units: Farads, F).
For a parallel-plate capacitor, **C = ε₀ * A / d** (where A is plate area, d is distance between plates). Notice how it purely depends on the *geometry* of the plates, not the charge!

**Dielectrics:**
If you stuff an insulating material (like glass, paper, or plastic) between the plates of a capacitor, it's called a dielectric.
*The Magic Effect:* A dielectric **increases** the capacitance of the capacitor (by a factor 'K', the dielectric constant) because the molecules inside the insulator polarize and partially cancel out the electric field, allowing the plates to store more charge for the same voltage!`,
    bits: [
      'Capacitors store energy in the form of an electric field between their plates.',
      'Inserting a dielectric between capacitor plates always increases its capacitance (C = K * C_0).',
      'Energy stored in a capacitor = ½ C V² = ½ Q V = Q² / 2C.',
    ],
  },

  // ---------- Class 12 Physics: Current Electricity ----------
  [key('physics', 12, 'Current Electricity', 'Drift Velocity')]: {
    theory: `**Electric Current** is simply the flow of electric charge (mostly electrons) through a conductor. But how exactly do they flow?

**The Illusion of Speed:**
When you flip a light switch, the light turns on instantly. You might think electrons zoom from the switch to the bulb at the speed of light. *They don't!*

Inside a wire, electrons are bouncing around wildly in random directions at huge speeds. When a voltage (battery) is applied, they continue bouncing wildly, but they gain a *tiny, incredibly slow* net forward movement. This slow forward marching speed is called **Drift Velocity (v_d)**. It's usually measured in millimeters per second!

**Formula:**
Current **I = n * A * e * v_d** 
(where n = electron density, A = cross-sectional area, e = charge of an electron).

*Why does the light turn on instantly then?* Because pushing one electron at the start of the wire instantly pushes the next one, like water in a fully packed hose—push water in one end, and water instantly comes out the other!`,
    bits: [
      'Drift velocity is the average velocity attained by charged particles (electrons) in a material due to an electric field.',
      'Even though drift velocity is very small (mm/s), the electric signal travels at near the speed of light.',
      'Ohm’s law (V = IR) is valid only when temperature and physical conditions remain constant.',
    ],
  },
  [key('physics', 12, 'Current Electricity', "Kirchhoff's Laws")]: {
    theory: `When circuits get complicated with multiple batteries and branching wires, simple Ohm's Law (V=IR) isn't enough. We need **Kirchhoff's Circuit Laws**!

**1. Kirchhoff's Current Law (KCL - Junction Rule):**
*The Law of Conservation of Charge.* 
At any junction (branch point) in a circuit, the total current entering the junction exactly equals the total current leaving it. 
*Analogy:* Think of a plumbing intersection. The water flowing into the intersection must equal the water flowing out. You can't magically create or destroy water (charge).

**2. Kirchhoff's Voltage Law (KVL - Loop Rule):**
*The Law of Conservation of Energy.*
Around any closed loop in a circuit, the sum of all voltage drops (across resistors) and voltage gains (across batteries) must equal zero.
*Analogy:* If you go for a hike starting and ending at the exact same base camp, the total altitude you gained must exactly equal the total altitude you lost!`,
    bits: [
      'KCL (Junction Rule) is based on the conservation of electric charge: Sum of currents entering = Sum leaving.',
      'KVL (Loop Rule) is based on the conservation of energy: Algebraic sum of changes in potential in a closed loop is zero.',
      'When applying KVL, traversing a battery from - to + is a voltage gain; traversing a resistor in the direction of current is a voltage drop.',
    ],
  },
  [key('physics', 12, 'Current Electricity', 'Wheatstone Bridge & Potentiometer')]: {
    theory: `**Wheatstone Bridge:**
This is a brilliant circuit design used to perfectly measure an unknown electrical resistance. It consists of four resistors arranged in a diamond shape with a galvanometer (current meter) bridging the middle.
*The Balancing Act:* When the ratio of resistances on one side equals the ratio on the other side (R1/R2 = R3/R4), the bridge is "balanced". The voltage across the middle becomes exactly zero, so the galvanometer shows ZERO deflection. This allows incredibly precise calculations!

**Potentiometer:**
A potentiometer is a versatile, highly accurate instrument that essentially acts as an adjustable voltage divider. Why use it instead of a normal voltmeter?
*The Secret:* A normal voltmeter actually steals a tiny bit of current from the circuit to measure it, which slightly alters the reading. A potentiometer measures voltage by finding a "null point" where it draws **zero current** from the circuit. It is the ultimate tool for measuring the true EMF (Electromotive Force) of a cell!`,
    bits: [
      'A Wheatstone Bridge is most sensitive when all four resistances are of the same order of magnitude.',
      'In a balanced Wheatstone Bridge, no current flows through the central galvanometer arm.',
      'A potentiometer does not draw any current from the cell whose EMF is being measured, making it more accurate than a standard voltmeter.',
    ],
  },

  // ---------- Class 11 Chemistry: Some Basic Concepts of Chemistry ----------
  [key('chemistry', 11, 'Some Basic Concepts of Chemistry', 'Importance and scope of chemistry')]: {
    theory: `**1. The Central Science**
Chemistry is the study of the composition, properties, and structure of matter, alongside the changes it undergoes during chemical reactions. It is classified as the "central science" because its principles establish the foundational mechanics for biology, physics, geology, and environmental science. It explains macroscopic observations through microscopic (atomic and molecular) interactions.

**2. Industrial and Economic Scope**
The application of chemical principles is the primary driver of the global manufacturing sector. The scope includes the mass production of:

* **Agrochemicals:** Fertilizers, pesticides, and insecticides required to sustain global food security.
* **Bulk Chemicals:** Acids, alkalis, and salts used as raw materials across all manufacturing.
* **Synthetic Materials:** Polymers, plastics, alloys, and dyes.
* **Consumer Goods:** Soaps, detergents, and preservatives.

**3. Medicinal and Healthcare Interventions**
Chemistry isolates naturally occurring substances and synthesizes artificial molecules to manipulate biological pathways. Specific compounds mandated for study include:

* **Cisplatin and Taxol:** Chemical compounds specifically utilized in cancer therapy.
* **AZT (Azidothymidine):** An antiretroviral medication synthesized for the treatment of AIDS.
* **General Therapeutics:** The continuous development of analgesics, antibiotics, and targeted drug delivery systems.

**4. Environmental Scope and Green Chemistry**
Chemistry provides the analytical tools to detect environmental degradation and the synthetic methods to resolve it.

* **Ozone Mitigation:** Chemical analysis identified Chlorofluorocarbons (CFCs), used historically as refrigerants, as the agents destroying stratospheric ozone.
* **Chemical Replacement:** The discipline subsequently engineered environmentally viable alternatives, such as hydrofluorocarbons (HFCs), which lack ozone-depleting potential.
* **Green Chemistry:** The current operational standard requiring the design of chemical products and processes that eliminate the generation of hazardous waste.

**5. Material Science and Future Technologies**
The frontier of chemistry involves the deliberate manipulation of molecular structures to engineer materials with specific physical properties. This includes the development of:

* Superconducting ceramics for frictionless transport.
* Conducting polymers for advanced electronics.
* Optical fibers for telecommunications.
* Nanomaterials for targeted biochemical applications.`,
    bits: [
      'Chemistry = study of matter, its composition, properties, structure, and changes during reactions.',
      'Central science: principles underpin biology, physics, geology, environmental science.',
      'Industrial scope: agrochemicals, bulk chemicals, synthetic materials, consumer goods.',
      'Medicinal examples: Cisplatin, Taxol (cancer); AZT (AIDS); analgesics, antibiotics.',
      'Green chemistry: design products/processes to eliminate hazardous waste generation.',
      'CFCs destroyed ozone; HFCs are safer alternatives. Nanomaterials enable targeted applications.',
    ],
  },

  // ---------- Class 11 Math: Sets and Functions ----------
  [key('math', 11, 'Sets and Functions', 'Sets and their representations')]: {
    theory: `**1. The Core Concept: What is a Set?**
In mathematics, a **Set** is a *well-defined* collection of distinct objects.

* **The "Well-Defined" Rule:** For a collection to be a set, there must be absolutely no confusion or personal opinion about whether an object belongs to it.
* *Valid Set:* "The vowels in the English alphabet." (Everyone agrees it is exactly a, e, i, o, u).
* *Not a Set:* "The 5 best cricketers in India." (This is an opinion; it is not well-defined).

**2. Mathematical Notation (The Language of Sets)**
To write sets, you must follow strict grammatical rules of mathematics:

* **The Set Name:** Always denoted by Capital Letters (A, B, C, X, Y, Z).
* **The Elements (Members):** The objects inside the set. Denoted by lowercase letters (a, b, c, x, y, z).
* **The "Belongs To" Symbol (∈):** If an element 'a' is inside set A, we write **a ∈ A** (read as "a belongs to A").
* **The "Does Not Belong To" Symbol (∉):** If an element 'b' is not inside set A, we write **b ∉ A**.

**3. Standard Mathematical Sets (Memorize These)**
These specific letters are reserved for universal number sets. You will use these constantly in calculus and algebra:

* **ℕ** : The set of all Natural numbers {1, 2, 3, ...}
* **ℤ** : The set of all Integers {..., -2, -1, 0, 1, 2, ...}
* **ℚ** : The set of all Rational numbers (fractions).
* **ℝ** : The set of all Real numbers.

**4. The Two Ways to Represent a Set**
You can write a set by either *listing its contents* or *describing its rule*.

**Method 1: Roster or Tabular Form (The "List" Method)**
In this form, all the elements of a set are listed, separated by commas, and enclosed within curly braces **{}**.

* *Example:* Let V be the set of all vowels.
* *Written as:* V = {a, e, i, o, u}
* **The Two Golden Rules of Roster Form:**
1. **Order does not matter:** {1, 2, 3} is exactly the same set as {3, 1, 2}.
2. **Never repeat elements:** The set of letters forming the word "SCHOOL" is written as {S, C, H, O, L}. You drop the extra 'O'.

**Method 2: Set-Builder Form (The "Rule" Method)**
Instead of listing elements, you write the common property or "rule" that every element must satisfy to get into the set.

* *Structure:* A = {x : statement about x}
* The colon ":" (or sometimes a vertical line "|") is read as *"such that"*.
* *Example:* Instead of writing V = {a, e, i, o, u}, you write:
* **V = {x : x is a vowel in the English alphabet}**

* *Read as:* "V is the set of all x, such that x is a vowel in the English alphabet."
* *Math Example:* B = {x : x ∈ ℕ and 3 < x < 10} (This simply means {4, 5, 6, 7, 8, 9}).

**5. Exam Trap Warnings**

* **Trap 1: The Bracket Mistake.** Using () or [] instead of {} for sets. Examiners will mark this wrong immediately. Sets *must* use curly braces.
* **Trap 2: Redundant Listing.** If a question asks for the Roster form of "MISSISSIPPI", the answer is {M, I, S, P}. Writing {M, I, S, S, I, S, S, I, P, P, I} is a critical error.
* **Trap 3: Misreading Inequalities.** In Set-Builder form, pay extreme attention to < vs ≤.
* {x ∈ ℕ : x < 5} = {1, 2, 3, 4}
* {x ∈ ℕ : x ≤ 5} = {1, 2, 3, 4, 5}`,
    bits: [
      'Set = well-defined collection of distinct objects. No ambiguity about membership.',
      'a ∈ A means "a belongs to A"; b ∉ A means "b does not belong to A".',
      'Standard sets: ℕ (natural), ℤ (integers), ℚ (rational), ℝ (real).',
      'Roster form: list elements in {}. Order doesn\'t matter; never repeat elements.',
      'Set-builder: {x : statement about x}. Colon reads "such that".',
      'Sets must use {}. < vs ≤: x < 5 excludes 5; x ≤ 5 includes 5.',
    ],
  },
};

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

/** Fallback when no theory is defined: short placeholder so UI always has something. */
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
      theory: `**Content for ${levelLabel} level is not yet available.**

The ${levelLabel} level for **${subtopicName}** will cover deeper concepts, derivations, and exam-focused problems. Check back later or use the Basic tab for the current content.`,
      bits: [`${levelLabel} content coming soon.`, 'Use Basic tab for foundational concepts.'],
    };
  }
  return {
    theory: `This topic covers **${subtopicName}** in the chapter **${topic}** (${subject}, Class ${classLevel}). Study your textbook and notes for a full explanation. Key ideas will appear in the Bits popup once content is added.`,
    bits: ['Read the chapter in your textbook.', 'Note definitions, formulas, and examples.', 'Practice related numericals and concepts.'],
  };
}
