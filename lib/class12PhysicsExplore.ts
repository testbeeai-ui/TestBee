import type { ClassLevel, Subject } from '@/types';

export function isClass12Physics(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'physics' && classLevel === 12;
}

/** Section headings + chapter order to match the investor unit-map reference (light layout). */
export const CLASS12_PHYSICS_SECTIONS: {
  heading: string;
  chapters: readonly string[];
  /** Third slot “More coming soon” after listed chapters */
  trailingPlaceholder?: boolean;
}[] = [
  {
    heading: 'UNIT I — ELECTROSTATICS',
    chapters: ['Electric Charges and Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity'],
  },
  {
    heading: 'UNIT III & IV — MAGNETISM',
    chapters: ['Magnetism and Matter', 'Moving Charges and Magnetism', 'Alternating Current'],
  },
  {
    heading: 'UNIT IV & V & IX — ELECTROMAGNETIC',
    chapters: ['Electromagnetic Induction', 'Semiconductor Electronics', 'Electromagnetic Waves'],
  },
  {
    heading: 'UNIT VI — OPTICS',
    chapters: ['Ray Optics & Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter'],
  },
  {
    heading: 'UNIT VIII — MODERN PHYSICS',
    chapters: ['Atoms', 'Nuclei'],
    trailingPlaceholder: true,
  },
];

/** Subtitle copy under each chapter title (NCERT-style scope lines). */
export const CLASS12_PHYSICS_CHAPTER_BLURB: Record<string, string> = {
  'Electric Charges and Fields':
    "Coulomb's law, electric field lines, Gauss's theorem and its applications.",
  'Electrostatic Potential & Capacitance':
    'Potential due to point charge, dielectrics, capacitors in series and parallel.',
  'Current Electricity':
    "Ohm's law, resistivity, Kirchhoff's laws, Wheatstone bridge, potentiometer.",
  'Magnetism and Matter':
    "Bar magnets, Earth's magnetic field, diamagnetism, paramagnetism, ferromagnetism.",
  'Moving Charges and Magnetism':
    "Biot-Savart law, Ampere's circuital law, force between conductors, cyclotron.",
  'Alternating Current': 'AC circuits, LCR resonance, power factor, transformers, impedance.',
  'Electromagnetic Induction':
    "Faraday's law, Lenz's law, eddy currents, self and mutual inductance.",
  'Semiconductor Electronics':
    'p-n junction, diodes, transistors, logic gates, and digital circuits.',
  'Electromagnetic Waves':
    "EM spectrum, Maxwell's equations, displacement current, properties of EM waves.",
  'Ray Optics & Optical Instruments':
    'Reflection, refraction, lenses, prisms, microscope, telescope, optical fibres.',
  'Wave Optics':
    "Huygens' principle, interference, diffraction, polarisation, Young's double slit.",
  'Dual Nature of Radiation and Matter':
    'Photoelectric effect, de Broglie hypothesis, Davisson-Germer experiment.',
  Atoms: 'Rutherford model, Bohr model, atomic spectra, hydrogen spectrum series.',
  Nuclei: 'Nuclear binding energy, radioactivity, alpha/beta/gamma decay, fission, fusion.',
};

export const CLASS12_PHYSICS_CHAPTER_ICON: Record<string, string> = {
  'Electric Charges and Fields': '⚡',
  'Electrostatic Potential & Capacitance': '🔋',
  'Current Electricity': '🔌',
  'Magnetism and Matter': '🧲',
  'Moving Charges and Magnetism': '🌀',
  'Alternating Current': '〰️',
  'Electromagnetic Induction': '✨',
  'Semiconductor Electronics': '💠',
  'Electromagnetic Waves': '📡',
  'Ray Optics & Optical Instruments': '🔭',
  'Wave Optics': '🌈',
  'Dual Nature of Radiation and Matter': '🔬',
  Atoms: '⚛️',
  Nuclei: '☢️',
};

export const CLASS12_PHYSICS_UNIT_COUNT_LABEL = '14 units';
