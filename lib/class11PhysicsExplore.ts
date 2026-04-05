import type { ClassLevel, Subject } from '@/types';

export function isClass11Physics(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'physics' && classLevel === 11;
}

/** Section order and chapter sequence for investor-approved Class 11 Physics map. */
export const CLASS11_PHYSICS_SECTIONS: {
  heading: string;
  chapters: readonly string[];
}[] = [
  {
    heading: 'UNIT I — FOUNDATIONS OF PHYSICS',
    chapters: ['Physical World', 'Units and Measurements'],
  },
  {
    heading: 'UNIT II — MOTION & KINEMATICS',
    chapters: ['Motion in a Straight Line', 'Motion in a Plane'],
  },
  {
    heading: 'UNIT III — LAWS OF MOTION & ENERGY',
    chapters: ['Laws of Motion', 'Work, Energy and Power', 'Gravitation'],
  },
  {
    heading: 'UNIT IV & IX — ROTATION & KINETIC THEORY',
    chapters: ['System of Particles and Rotational Motion', 'Kinetic Theory'],
  },
  {
    heading: 'UNIT V — PROPERTIES OF MATTER',
    chapters: ['Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter'],
  },
  {
    heading: 'UNIT VI & X — THERMODYNAMICS & WAVES',
    chapters: ['Thermodynamics', 'Oscillations', 'Waves'],
  },
];

/** Chapter blurbs copied to match investor copy tone and scope. */
export const CLASS11_PHYSICS_CHAPTER_BLURB: Record<string, string> = {
  'Physical World':
    'A glimpse into the universe, nature of physical laws, and scientific method in physics.',
  'Units and Measurements':
    'SI units, dimensions, accuracy, precision, and errors in physical measurements.',
  'Motion in a Straight Line':
    'Displacement, velocity, acceleration, and equations of uniformly accelerated motion.',
  'Motion in a Plane':
    'Vector addition, projectile motion, and circular motion in two dimensions.',
  'Laws of Motion':
    "Newton's three laws, inertia, momentum, impulse, and applications of force.",
  'Work, Energy and Power':
    'Work-energy theorem, kinetic and potential energy, conservation of energy, and power.',
  Gravitation:
    "Newton's law of gravitation, g, orbital motion, and satellites in Earth's field.",
  'System of Particles and Rotational Motion':
    'Center of mass, rotational dynamics, torque, and equilibrium of rigid bodies.',
  'Kinetic Theory':
    'Kinetic theory of gases, molecular speeds, and thermal behavior of matter.',
  'Mechanical Properties of Solids':
    'Stress, strain, elasticity, and Young modulus in deformable solids.',
  'Mechanical Properties of Fluids':
    "Fluid pressure, buoyancy, viscosity, and Bernoulli's principle for flow.",
  'Thermal Properties of Matter':
    'Expansion, calorimetry, heat transfer, and temperature dependence of materials.',
  Thermodynamics:
    'Zeroth to first laws, heat, internal energy, and thermodynamic processes.',
  Oscillations:
    'Simple harmonic motion, periodic time, energy in SHM, and damped oscillations.',
  Waves:
    'Wave motion in springs and strings, wave speed, and standing wave patterns.',
};

export const CLASS11_PHYSICS_CHAPTER_ICON: Record<string, string> = {
  'Physical World': '🧭',
  'Units and Measurements': '📏',
  'Motion in a Straight Line': '➡️',
  'Motion in a Plane': '🛫',
  'Laws of Motion': '⚙️',
  'Work, Energy and Power': '⚡',
  Gravitation: '🪐',
  'System of Particles and Rotational Motion': '🌀',
  'Kinetic Theory': '🫧',
  'Mechanical Properties of Solids': '🧱',
  'Mechanical Properties of Fluids': '💧',
  'Thermal Properties of Matter': '🔥',
  Thermodynamics: '♨️',
  Oscillations: '〰️',
  Waves: '🌊',
};

export const CLASS11_PHYSICS_UNIT_COUNT_LABEL = '10 units';
