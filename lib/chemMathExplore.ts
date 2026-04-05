import type { ClassLevel, Subject } from '@/types';

export function isClass11Chemistry(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'chemistry' && classLevel === 11;
}

export function isClass12Chemistry(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'chemistry' && classLevel === 12;
}

export function isClass11Math(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'math' && classLevel === 11;
}

export function isClass12Math(subject: Subject, classLevel: ClassLevel): boolean {
  return subject === 'math' && classLevel === 12;
}

export const CLASS11_CHEMISTRY_SECTIONS: {
  heading: string;
  chapters: readonly string[];
}[] = [
  {
    heading: 'UNITS 1 — 3 — ATOMIC STRUCTURE & PERIODIC PROPERTIES',
    chapters: [
      'Some Basic Concepts of Chemistry',
      'Structure of Atom',
      'Classification of Elements and Periodicity in Properties',
    ],
  },
  {
    heading: 'UNITS 4 — 6 — BONDING, THERMODYNAMICS & EQUILIBRIUM',
    chapters: ['Chemical Bonding and Molecular Structure', 'Chemical Thermodynamics', 'Equilibrium'],
  },
  {
    heading: 'UNITS 7 — 9 — REDOX REACTIONS & ORGANIC CHEMISTRY',
    chapters: ['Redox Reactions', 'Organic Chemistry — Basic Principles and Techniques', 'Hydrocarbons'],
  },
];

export const CLASS12_CHEMISTRY_SECTIONS: {
  heading: string;
  chapters: readonly string[];
}[] = [
  {
    heading: 'UNITS 1 — 3 — PHYSICAL CHEMISTRY',
    chapters: ['Solutions', 'Electrochemistry', 'Chemical Kinetics'],
  },
  {
    heading: 'UNITS 4 — 6 — INORGANIC & COORDINATION CHEMISTRY',
    chapters: ['d and f Block Elements', 'Coordination Compounds', 'Haloalkanes and Haloarenes'],
  },
  {
    heading: 'UNITS 7 — 9 — ORGANIC FUNCTIONAL GROUPS',
    chapters: ['Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines'],
  },
  {
    heading: 'UNIT 10 — BIOMOLECULES',
    chapters: ['Biomolecules'],
  },
];

export const CLASS11_MATH_SECTIONS: {
  heading: string;
  chapters: readonly string[];
}[] = [
  {
    heading: 'UNIT I — SETS, RELATIONS & TRIGONOMETRY',
    chapters: ['Sets', 'Relations and Functions', 'Trigonometric Functions'],
  },
  {
    heading: 'UNIT II — ALGEBRA',
    chapters: [
      'Complex Numbers and Quadratic Equations',
      'Linear Inequalities',
      'Permutations and Combinations',
      'Binomial Theorem',
      'Sequences and Series',
    ],
  },
  {
    heading: 'UNIT III — COORDINATE GEOMETRY',
    chapters: ['Straight Lines', 'Conic Sections', 'Introduction to Three-dimensional Geometry'],
  },
  {
    heading: 'UNIT IV — CALCULUS',
    chapters: ['Limits and Derivatives'],
  },
  {
    heading: 'UNIT V — STATISTICS & PROBABILITY',
    chapters: ['Statistics', 'Probability'],
  },
];

export const CLASS12_MATH_SECTIONS: {
  heading: string;
  chapters: readonly string[];
}[] = [
  {
    heading: 'UNIT I — RELATIONS, FUNCTIONS & INVERSE TRIGONOMETRY',
    chapters: ['Relations and Functions', 'Inverse Trigonometric Functions'],
  },
  {
    heading: 'UNIT II — ALGEBRA: MATRICES & DETERMINANTS',
    chapters: ['Matrices', 'Determinants'],
  },
  {
    heading: 'UNIT III — CALCULUS',
    chapters: [
      'Continuity and Differentiability',
      'Applications of Derivatives',
      'Integrals',
      'Differential Equations',
    ],
  },
  {
    heading: 'UNIT IV — VECTORS & THREE-DIMENSIONAL GEOMETRY',
    chapters: ['Vectors', 'Three-Dimensional Geometry'],
  },
  {
    heading: 'UNIT V — LINEAR PROGRAMMING',
    chapters: ['Linear Programming'],
  },
  {
    heading: 'UNIT VI — PROBABILITY',
    chapters: ['Probability'],
  },
];

export const CLASS11_CHEMISTRY_CHAPTER_BLURB: Record<string, string> = {
  'Some Basic Concepts of Chemistry':
    'Matter, atoms and molecules, mole concept, stoichiometry, limiting reagent, concentration expressions.',
  'Structure of Atom':
    'Bohr model, quantum numbers, orbitals, electronic configuration, dual nature, and uncertainty principle.',
  'Classification of Elements and Periodicity in Properties':
    'Modern periodic law, s/p/d/f blocks, periodic trends in ionization energy, electron affinity, and electronegativity.',
  'Chemical Bonding and Molecular Structure':
    'Ionic, covalent and coordinate bonds, VSEPR theory, hybridisation, and molecular orbital ideas.',
  'Chemical Thermodynamics':
    "System and surroundings, internal energy, enthalpy, Hess's law, entropy, Gibbs free energy, spontaneity.",
  Equilibrium:
    "Law of mass action, Kc and Kp, Le Chatelier's principle, ionic equilibrium, pH, and buffer solutions.",
  'Redox Reactions':
    'Oxidation and reduction, oxidation number, balancing redox equations, half-reaction and ion-electron methods.',
  'Organic Chemistry — Basic Principles and Techniques':
    'Tetravalency of carbon, functional groups, IUPAC nomenclature, isomerism, and purification techniques.',
  Hydrocarbons:
    'Alkanes, alkenes and alkynes: preparation, properties and reactions; aromatic hydrocarbons and basic orientation.',
};

export const CLASS12_CHEMISTRY_CHAPTER_BLURB: Record<string, string> = {
  Solutions:
    "Types of solutions, concentration terms, Raoult's law, colligative properties, and elevation/depression effects.",
  Electrochemistry:
    "Galvanic cells, EMF, Nernst equation, electrolysis, conductivity, and Faraday's laws in redox systems.",
  'Chemical Kinetics':
    'Rate of reaction, rate law, order and molecularity, integrated equations, Arrhenius relation, and catalysts.',
  'd and f Block Elements':
    'Transition and inner-transition elements, oxidation states, magnetic behavior, and characteristic chemistry.',
  'Coordination Compounds':
    "Werner's theory, IUPAC naming, ligand field ideas, isomerism, and coordination compounds in applications.",
  'Haloalkanes and Haloarenes':
    'Classification, nomenclature, preparation, substitution and elimination reactions, and environmental aspects.',
  'Alcohols, Phenols and Ethers':
    'Classification, nomenclature, physical properties, acidity/basicity trends, and key reactions.',
  'Aldehydes, Ketones and Carboxylic Acids':
    'Structure and nomenclature, nucleophilic addition, oxidation/reduction routes, and carboxylic derivatives.',
  Amines:
    'Classification, nomenclature, structure, basic character, preparation methods, and coupling reactions.',
  Biomolecules:
    'Carbohydrates, proteins, enzymes, nucleic acids, vitamins, and biomolecular structure-function links.',
};

export const CLASS11_MATH_CHAPTER_BLURB: Record<string, string> = {
  Sets: 'Set notation, types of sets, subsets, Venn diagrams, operations on sets, and basic set identities.',
  'Relations and Functions':
    'Ordered pairs, relations, domain and range, function types, and composition/inverse concepts.',
  'Trigonometric Functions':
    'Radian measure, trigonometric identities, transformations, and equations in standard forms.',
  'Complex Numbers and Quadratic Equations':
    'Imaginary unit, Argand plane, modulus-argument form, and roots of quadratic equations.',
  'Linear Inequalities':
    'Inequalities in one/two variables, interval notation, and graphical interpretation of feasible regions.',
  'Permutations and Combinations':
    'Counting principles, factorial methods, arrangements, selections, and combinatorial reasoning.',
  'Binomial Theorem':
    'Expansion of binomials, general and middle terms, and coefficient-based applications.',
  'Sequences and Series':
    'Arithmetic and geometric progressions, means, nth-term formulas, and sums to n terms.',
  'Straight Lines':
    'Slope-intercept and point forms, angle between lines, and distance of a point from a line.',
  'Conic Sections':
    'Parabola, ellipse and hyperbola in standard form, key parameters, and geometric properties.',
  'Introduction to Three-dimensional Geometry':
    'Coordinates in space, section formula basics, and distance relations in 3D.',
  'Limits and Derivatives':
    'Intuitive limits, continuity ideas, and derivative as the rate of change and slope.',
  Statistics:
    'Frequency distributions, mean/median/mode, dispersion measures, and graphical summaries.',
  Probability:
    'Random experiments, sample space, events, axiomatic probability, and conditional probability basics.',
};

export const CLASS12_MATH_CHAPTER_BLURB: Record<string, string> = {
  'Relations and Functions':
    'Types of relations/functions, one-one and onto mapping, inverse functions, and composition.',
  'Inverse Trigonometric Functions':
    'Principal values, domains and ranges, identities, and equation solving.',
  Matrices:
    'Matrix operations, transpose, inverse, and applications in linear equation systems.',
  Determinants:
    'Expansion and properties, minors/cofactors, and determinant-based solution methods.',
  'Continuity and Differentiability':
    'Continuity checks, derivative rules, chain rule, and differentiability behavior.',
  'Applications of Derivatives':
    'Increasing/decreasing tests, maxima/minima, tangents/normals, and monotonicity.',
  Integrals:
    'Indefinite/definite integrals, substitution and parts, and fundamental theorem applications.',
  'Differential Equations':
    'Order and degree, variable separable forms, and formation/solution of basic equations.',
  Vectors:
    'Vector algebra, scalar and vector products, and geometric interpretation in space.',
  'Three-Dimensional Geometry':
    'Direction cosines/ratios, lines and planes, angles, and shortest distance concepts.',
  'Linear Programming':
    'Objective function, linear constraints, feasible region, and optimization using corner points.',
  Probability:
    'Conditional probability, Bayes theorem, random variables, and Bernoulli/binomial settings.',
};

export const CLASS11_CHEMISTRY_CHAPTER_ICON: Record<string, string> = {
  'Some Basic Concepts of Chemistry': '🧪',
  'Structure of Atom': '⚛️',
  'Classification of Elements and Periodicity in Properties': '🧾',
  'Chemical Bonding and Molecular Structure': '🧬',
  'Chemical Thermodynamics': '♨️',
  Equilibrium: '⚖️',
  'Redox Reactions': '🧪',
  'Organic Chemistry — Basic Principles and Techniques': '🧷',
  Hydrocarbons: '🛢️',
};

export const CLASS12_CHEMISTRY_CHAPTER_ICON: Record<string, string> = {
  Solutions: '💧',
  Electrochemistry: '⚡',
  'Chemical Kinetics': '🕒',
  'd and f Block Elements': '🧱',
  'Coordination Compounds': '🧬',
  'Haloalkanes and Haloarenes': '🧪',
  'Alcohols, Phenols and Ethers': '🔥',
  'Aldehydes, Ketones and Carboxylic Acids': '🧫',
  Amines: '🧠',
  Biomolecules: '🧬',
};

export const CLASS11_MATH_CHAPTER_ICON: Record<string, string> = {
  Sets: '🧩',
  'Relations and Functions': '🔗',
  'Trigonometric Functions': '∿',
  'Complex Numbers and Quadratic Equations': '✳️',
  'Linear Inequalities': '📏',
  'Permutations and Combinations': '🔢',
  'Binomial Theorem': '∑',
  'Sequences and Series': '⚡',
  'Straight Lines': '📈',
  'Conic Sections': '⭕',
  'Introduction to Three-dimensional Geometry': '🧊',
  'Limits and Derivatives': '⛰️',
  Statistics: '📊',
  Probability: '🎲',
};

export const CLASS12_MATH_CHAPTER_ICON: Record<string, string> = {
  'Relations and Functions': '🔗',
  'Inverse Trigonometric Functions': '∿',
  Matrices: '🧮',
  Determinants: '🧾',
  'Continuity and Differentiability': '⛰️',
  'Applications of Derivatives': '📈',
  Integrals: '∫',
  'Differential Equations': '🧠',
  Vectors: '↗️',
  'Three-Dimensional Geometry': '🧊',
  'Linear Programming': '📋',
  Probability: '🎲',
};

export const CLASS11_CHEMISTRY_UNIT_COUNT_LABEL = '9 units';
export const CLASS12_CHEMISTRY_UNIT_COUNT_LABEL = '10 units';
export const CLASS11_MATH_UNIT_COUNT_LABEL = '5 units';
export const CLASS12_MATH_UNIT_COUNT_LABEL = '6 units';
