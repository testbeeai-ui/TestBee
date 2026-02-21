import { Subject, ClassLevel, ExamType } from '@/types';

export interface SubTopic {
  name: string;
}

export interface TopicNode {
  subject: Subject;
  classLevel: ClassLevel;
  topic: string; // matches Question.topic field
  subtopics: SubTopic[];
  examRelevance: ExamType[];
}

export const topicTaxonomy: TopicNode[] = [
  // ========== PHYSICS ==========

  // Class 9
  { subject: 'physics', classLevel: 9, topic: 'Motion', subtopics: [{ name: 'Distance & Displacement' }, { name: 'Uniform & Non-Uniform Motion' }, { name: 'Equations of Motion' }, { name: 'Uniform Circular Motion' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 9, topic: 'Force & Laws of Motion', subtopics: [{ name: "Newton's Three Laws" }, { name: 'Inertia and Mass' }, { name: 'Conservation of Momentum' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 9, topic: 'Gravitation', subtopics: [{ name: 'Universal Law of Gravitation' }, { name: 'Free Fall & g' }, { name: 'Mass vs. Weight' }, { name: "Archimedes' Principle & Buoyancy" }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 9, topic: 'Work & Energy', subtopics: [{ name: 'Work by Constant Force' }, { name: 'Kinetic & Potential Energy' }, { name: 'Conservation of Energy' }, { name: 'Power' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 9, topic: 'Sound', subtopics: [{ name: 'Production & Propagation' }, { name: 'Wavelength, Frequency, Amplitude' }, { name: 'Echo & Sonar' }, { name: 'Human Ear Structure' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },

  // Class 10
  { subject: 'physics', classLevel: 10, topic: 'Light - Reflection & Refraction', subtopics: [{ name: 'Spherical Mirrors & Image Formation' }, { name: 'Mirror Formula & Magnification' }, { name: 'Refraction through Lenses' }, { name: 'Lens Formula & Power' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 10, topic: 'Human Eye & Colorful World', subtopics: [{ name: 'Defects of Vision' }, { name: 'Refraction through Prism' }, { name: 'Dispersion & Scattering' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 10, topic: 'Electricity', subtopics: [{ name: 'Current & Potential Difference' }, { name: "Ohm's Law & Resistance" }, { name: "Joule's Law (Heating Effect)" }, { name: 'Electric Power' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 10, topic: 'Magnetic Effects of Current', subtopics: [{ name: 'Magnetic Field Lines' }, { name: 'Force on Current-Carrying Conductor' }, { name: 'Electric Motor & Generator' }, { name: 'Domestic Electric Circuits' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'physics', classLevel: 10, topic: 'Sources of Energy', subtopics: [{ name: 'Renewable vs Non-renewable' }, { name: 'Solar & Wind Energy' }, { name: 'Nuclear Energy' }], examRelevance: ['KCET', 'other'] },

  // Class 11
  { subject: 'physics', classLevel: 11, topic: 'Units & Measurements', subtopics: [{ name: 'SI Units' }, { name: 'Dimensional Analysis' }, { name: 'Errors in Measurement' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Kinematics', subtopics: [{ name: 'Motion in a Straight Line' }, { name: 'v-t Graphs & Frame of Reference' }, { name: 'Vectors & Projectile Motion' }, { name: 'Uniform Circular Motion' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Laws of Motion', subtopics: [{ name: "Newton's Laws & Impulse" }, { name: 'Friction (Static/Kinetic)' }, { name: 'Circular Banking' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Work, Energy & Power', subtopics: [{ name: 'Work-Energy Theorem' }, { name: 'Elastic & Inelastic Collisions' }, { name: 'Vertical Circular Motion' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Rotational Motion', subtopics: [{ name: 'Centre of Mass' }, { name: 'Torque & Angular Momentum' }, { name: 'Moment of Inertia' }, { name: 'Rolling Motion' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Gravitation', subtopics: [{ name: "Kepler's Laws" }, { name: 'Escape Velocity' }, { name: 'Satellites (Geostationary/Polar)' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Properties of Bulk Matter', subtopics: [{ name: "Stress-Strain & Young's Modulus" }, { name: "Pascal's Law & Bernoulli's Principle" }, { name: 'Viscosity & Surface Tension' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Thermodynamics', subtopics: [{ name: 'Thermal Expansion & Calorimetry' }, { name: 'Laws of Thermodynamics' }, { name: 'Heat Engines & Refrigerators' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Kinetic Theory', subtopics: [{ name: 'Ideal Gas Equation' }, { name: 'Degrees of Freedom' }, { name: 'Specific Heat Capacities' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 11, topic: 'Waves', subtopics: [{ name: 'SHM & Pendulums' }, { name: 'Doppler Effect' }, { name: 'Standing Waves & Beats' }], examRelevance: ['JEE', 'NEET', 'KCET'] },

  // Class 12
  { subject: 'physics', classLevel: 12, topic: 'Electrostatics', subtopics: [{ name: "Coulomb's Law & Electric Field" }, { name: "Gauss's Law & Dipole" }, { name: 'Capacitors & Dielectrics' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Current Electricity', subtopics: [{ name: 'Drift Velocity' }, { name: "Kirchhoff's Laws" }, { name: 'Wheatstone Bridge & Potentiometer' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Magnetism', subtopics: [{ name: "Biot-Savart & Ampere's Law" }, { name: 'Force on Moving Charge (Cyclotron)' }, { name: "Earth's Magnetism & Magnetic Materials" }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Electromagnetic Induction', subtopics: [{ name: "Faraday's & Lenz's Law" }, { name: 'Self/Mutual Inductance' }, { name: 'LCR Circuits & Transformers' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Electromagnetic Waves', subtopics: [{ name: 'EM Spectrum (Radio to Gamma)' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Optics', subtopics: [{ name: 'Total Internal Reflection & Prisms' }, { name: 'Optical Instruments' }, { name: "Huygens Principle & Young's Double Slit" }, { name: 'Diffraction & Polarization' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Modern Physics', subtopics: [{ name: 'Photoelectric Effect' }, { name: 'de Broglie Wavelength' }, { name: 'Bohr Model & Hydrogen Spectrum' }, { name: 'Radioactivity & Mass-Energy' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'physics', classLevel: 12, topic: 'Semiconductors', subtopics: [{ name: 'P-N Junction & Diodes' }, { name: 'Rectifiers' }, { name: 'Logic Gates (AND, OR, NOT, NAND, NOR)' }], examRelevance: ['JEE', 'NEET', 'KCET'] },

  // ========== CHEMISTRY ==========

  // Class 9
  { subject: 'chemistry', classLevel: 9, topic: 'Matter', subtopics: [{ name: 'Physical & Chemical Changes' }, { name: 'States of Matter' }, { name: 'Particle Nature of Matter' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 9, topic: 'Atoms & Molecules', subtopics: [{ name: 'Laws of Chemical Combination' }, { name: "Avogadro's Number" }, { name: 'Mole Concept' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 9, topic: 'Structure of Atom', subtopics: [{ name: 'Protons, Neutrons, Electrons' }, { name: 'Bohr Model & Electron Shells' }, { name: 'Atomic Number & Mass Number' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },

  // Class 10
  { subject: 'chemistry', classLevel: 10, topic: 'Chemical Reactions', subtopics: [{ name: 'Oxidation & Reduction' }, { name: 'Displacement Reactions' }, { name: 'Balancing Equations' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 10, topic: 'Acids, Bases & Salts', subtopics: [{ name: 'pH Scale & Indicators' }, { name: 'Neutralization' }, { name: 'Salts & Their Properties' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 10, topic: 'Metals & Non-metals', subtopics: [{ name: 'Reactivity Series' }, { name: 'Ionic Bonding' }, { name: 'Extraction of Metals' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 10, topic: 'Carbon Compounds', subtopics: [{ name: 'Hydrocarbons' }, { name: 'Functional Groups' }, { name: 'Homologous Series' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'chemistry', classLevel: 10, topic: 'Periodic Table', subtopics: [{ name: 'Modern Periodic Law' }, { name: 'Trends in Properties' }, { name: 'Electron Configuration & Groups' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },

  // Class 11
  { subject: 'chemistry', classLevel: 11, topic: 'Atomic Structure', subtopics: [{ name: 'Quantum Numbers' }, { name: 'Electron Configuration' }, { name: 'Orbital Shapes (s, p, d, f)' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 11, topic: 'Chemical Bonding', subtopics: [{ name: 'Ionic & Covalent Bonds' }, { name: 'VSEPR Theory & Hybridization' }, { name: 'Molecular Geometry' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 11, topic: 'States of Matter', subtopics: [{ name: "Boyle's & Charles's Law" }, { name: 'Ideal Gas Equation' }, { name: 'Van der Waals Equation' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 11, topic: 'Thermodynamics', subtopics: [{ name: 'Enthalpy & Exo/Endothermic' }, { name: "Hess's Law" }, { name: 'Gibbs Free Energy' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 11, topic: 'Equilibrium', subtopics: [{ name: "Le Chatelier's Principle" }, { name: 'Equilibrium Constant' }, { name: 'pH & Buffer Solutions' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 11, topic: 'Organic Chemistry', subtopics: [{ name: 'IUPAC Nomenclature' }, { name: 'Alkanes, Alkenes, Alkynes' }, { name: 'Isomerism' }], examRelevance: ['JEE', 'NEET', 'KCET'] },

  // Class 12
  { subject: 'chemistry', classLevel: 12, topic: 'Solutions', subtopics: [{ name: 'Molarity & Molality' }, { name: "Raoult's Law" }, { name: 'Colligative Properties' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 12, topic: 'Electrochemistry', subtopics: [{ name: 'Galvanic & Electrolytic Cells' }, { name: 'Nernst Equation' }, { name: 'Standard Electrode Potential' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 12, topic: 'Chemical Kinetics', subtopics: [{ name: 'Rate Law & Order' }, { name: 'Half-life' }, { name: 'Activation Energy & Arrhenius' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 12, topic: 'Surface Chemistry', subtopics: [{ name: 'Adsorption vs Absorption' }, { name: 'Catalysis' }, { name: 'Colloids & Emulsions' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 12, topic: 'p-Block Elements', subtopics: [{ name: 'Group 15-18 Elements' }, { name: 'Allotropy (Carbon, Sulphur)' }, { name: 'Interhalogen Compounds' }], examRelevance: ['JEE', 'NEET', 'KCET'] },
  { subject: 'chemistry', classLevel: 12, topic: 'Coordination Compounds', subtopics: [{ name: 'Coordination Number & Ligands' }, { name: 'Crystal Field Theory' }, { name: 'Isomerism in Complexes' }], examRelevance: ['JEE', 'NEET', 'KCET'] },

  // ========== MATH ==========

  // Class 9
  { subject: 'math', classLevel: 9, topic: 'Number Systems', subtopics: [{ name: 'Rational & Irrational Numbers' }, { name: 'Real Number Line' }, { name: 'Decimal Expansions' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 9, topic: 'Polynomials', subtopics: [{ name: 'Degree of Polynomial' }, { name: 'Zeros of Polynomial' }, { name: 'Factor & Remainder Theorem' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 9, topic: 'Coordinate Geometry', subtopics: [{ name: 'Cartesian Plane' }, { name: 'Plotting Points' }, { name: 'Quadrants' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 9, topic: 'Linear Equations', subtopics: [{ name: 'Linear Equations in Two Variables' }, { name: 'Graphical Representation' }, { name: 'Simultaneous Equations' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 9, topic: 'Triangles', subtopics: [{ name: 'Angle Sum Property' }, { name: 'Congruence Rules (SSS, SAS, ASA)' }, { name: 'Pythagorean Theorem' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 9, topic: 'Statistics', subtopics: [{ name: 'Mean, Median, Mode' }, { name: 'Frequency Distribution' }, { name: 'Bar Graphs & Histograms' }], examRelevance: ['KCET', 'other'] },

  // Class 10
  { subject: 'math', classLevel: 10, topic: 'Real Numbers', subtopics: [{ name: 'HCF & LCM' }, { name: 'Fundamental Theorem of Arithmetic' }, { name: 'Irrationality Proofs' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 10, topic: 'Polynomials', subtopics: [{ name: 'Sum & Product of Zeros' }, { name: 'Division Algorithm' }, { name: 'Quadratic Polynomials' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 10, topic: 'Quadratic Equations', subtopics: [{ name: 'Discriminant & Nature of Roots' }, { name: 'Quadratic Formula' }, { name: 'Factorization Method' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 10, topic: 'Arithmetic Progressions', subtopics: [{ name: 'nth Term Formula' }, { name: 'Sum of n Terms' }, { name: 'Common Difference' }], examRelevance: ['JEE', 'KCET', 'other'] },
  { subject: 'math', classLevel: 10, topic: 'Trigonometry', subtopics: [{ name: 'Trigonometric Ratios' }, { name: 'Standard Angles' }, { name: 'Pythagorean Identity' }], examRelevance: ['JEE', 'NEET', 'KCET', 'other'] },
  { subject: 'math', classLevel: 10, topic: 'Coordinate Geometry', subtopics: [{ name: 'Distance Formula' }, { name: 'Section & Midpoint Formula' }, { name: 'Area of Triangle' }], examRelevance: ['JEE', 'KCET', 'other'] },

  // Class 11
  { subject: 'math', classLevel: 11, topic: 'Sets', subtopics: [{ name: 'Union, Intersection, Complement' }, { name: 'Venn Diagrams' }, { name: 'Power Set' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Relations & Functions', subtopics: [{ name: 'Types of Relations' }, { name: 'Injective, Surjective, Bijective' }, { name: 'Composition of Functions' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Trigonometric Functions', subtopics: [{ name: 'Compound Angle Formulas' }, { name: 'Double & Half Angle' }, { name: 'Trigonometric Equations' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Complex Numbers', subtopics: [{ name: 'Imaginary Unit & Powers of i' }, { name: 'Modulus & Argument' }, { name: 'Complex Plane' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Sequences & Series', subtopics: [{ name: 'AP & GP Formulas' }, { name: 'Infinite GP Sum' }, { name: 'Sigma Notation' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Straight Lines', subtopics: [{ name: 'Slope & Forms of Line Equation' }, { name: 'Parallel & Perpendicular Lines' }, { name: 'Distance from a Point' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 11, topic: 'Probability', subtopics: [{ name: 'Sample Space & Events' }, { name: 'Conditional Probability' }, { name: "Bayes' Theorem" }], examRelevance: ['JEE', 'KCET'] },

  // Class 12
  { subject: 'math', classLevel: 12, topic: 'Relations & Functions', subtopics: [{ name: 'Bijective Functions' }, { name: 'Inverse Functions' }, { name: 'Binary Operations' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Inverse Trigonometric Functions', subtopics: [{ name: 'Principal Values' }, { name: 'Properties & Identities' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Matrices', subtopics: [{ name: 'Types of Matrices' }, { name: 'Matrix Operations' }, { name: 'Transpose & Inverse' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Determinants', subtopics: [{ name: 'Properties of Determinants' }, { name: "Cramer's Rule" }, { name: 'Area using Determinants' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Continuity & Differentiability', subtopics: [{ name: 'Limits & Continuity' }, { name: 'Standard Derivatives' }, { name: 'Chain Rule & Implicit Differentiation' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Integrals', subtopics: [{ name: 'Indefinite Integrals' }, { name: 'Definite Integrals' }, { name: 'Area Under Curves' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Vectors', subtopics: [{ name: 'Dot & Cross Product' }, { name: 'Angle Between Vectors' }, { name: 'Projection' }], examRelevance: ['JEE', 'KCET'] },
  { subject: 'math', classLevel: 12, topic: 'Probability', subtopics: [{ name: 'Independent Events' }, { name: "Bayes' Theorem" }, { name: 'Random Variables & Distributions' }], examRelevance: ['JEE', 'NEET', 'KCET'] },

  // ========== BIOLOGY ==========

  // Class 9
  { subject: 'biology', classLevel: 9, topic: 'Cell Biology', subtopics: [{ name: 'Plasma Membrane' }, { name: 'Nucleus & Organelles' }, { name: 'Mitochondria & Plastids' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 9, topic: 'Tissues', subtopics: [{ name: 'Plant Tissues (Meristematic/Permanent)' }, { name: 'Animal Tissues (Epithelial, Connective, Muscular, Nervous)' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 9, topic: 'Diversity in Living Organisms', subtopics: [{ name: 'Five Kingdom Classification' }, { name: 'Binomial Nomenclature' }, { name: 'Monera to Animalia' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 9, topic: 'Disease & Health', subtopics: [{ name: 'Infectious vs Non-infectious' }, { name: 'Immunization' }, { name: 'Pathogens (Bacteria, Virus, Protozoa)' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 9, topic: 'Natural Resources', subtopics: [{ name: 'Water, Air, Soil' }, { name: 'Biogeochemical Cycles (N₂, O₂, C)' }], examRelevance: ['NEET', 'KCET', 'other'] },

  // Class 10
  { subject: 'biology', classLevel: 10, topic: 'Life Processes', subtopics: [{ name: 'Nutrition & Digestive System' }, { name: 'Respiration' }, { name: 'Transportation (Heart/Circulation)' }, { name: 'Excretion (Kidney/Nephron)' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 10, topic: 'Control & Coordination', subtopics: [{ name: 'Nervous System & Reflex Arc' }, { name: 'Brain Structure' }, { name: 'Hormones in Animals & Plants' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 10, topic: 'Reproduction', subtopics: [{ name: 'Fission & Budding' }, { name: 'Vegetative Propagation' }, { name: 'Sexual Reproduction in Plants/Humans' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 10, topic: 'Heredity & Evolution', subtopics: [{ name: "Mendel's Laws" }, { name: 'Sex Determination' }, { name: 'Acquired vs Inherited Traits' }], examRelevance: ['NEET', 'KCET', 'other'] },
  { subject: 'biology', classLevel: 10, topic: 'Environment', subtopics: [{ name: 'Food Chains & Webs' }, { name: '10% Energy Transfer Law' }, { name: 'Ecological Pyramids' }], examRelevance: ['NEET', 'KCET', 'other'] },

  // Class 11
  { subject: 'biology', classLevel: 11, topic: 'Cell Biology', subtopics: [{ name: 'Cell Structure & Functions' }, { name: 'Fluid Mosaic Model' }, { name: 'Cell Cycle & Division' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 11, topic: 'Biomolecules', subtopics: [{ name: 'Proteins & Enzymes' }, { name: 'Lipids & Nucleic Acids' }, { name: 'Carbohydrates' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 11, topic: 'Cell Division', subtopics: [{ name: 'Mitosis (PMAT)' }, { name: 'Meiosis' }, { name: 'Cell Cycle Regulation' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 11, topic: 'Structural Organization', subtopics: [{ name: 'Morphology of Flowering Plants' }, { name: 'Animal Tissues' }, { name: 'Cockroach/Frog Anatomy' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 11, topic: 'Plant Physiology', subtopics: [{ name: 'Photosynthesis (C₃ vs C₄)' }, { name: 'Respiration (Krebs Cycle, ETS)' }, { name: 'Plant Growth Hormones' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 11, topic: 'Human Physiology', subtopics: [{ name: 'Digestion & Breathing' }, { name: 'Blood & Lymph' }, { name: 'Excretory System' }, { name: 'Locomotion & Neural Control' }], examRelevance: ['NEET', 'KCET'] },

  // Class 12
  { subject: 'biology', classLevel: 12, topic: 'Genetics', subtopics: [{ name: 'DNA Replication' }, { name: 'Transcription & Translation' }, { name: 'Dihybrid Crosses' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Molecular Biology', subtopics: [{ name: 'Central Dogma' }, { name: 'Restriction Enzymes' }, { name: 'Recombinant DNA' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Evolution', subtopics: [{ name: 'Darwinism & Natural Selection' }, { name: 'Hardy-Weinberg Principle' }, { name: 'Analogous & Homologous Organs' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Human Health', subtopics: [{ name: 'Immunity & Vaccination' }, { name: 'Malaria, AIDS, Cancer' }, { name: 'Microbes in Industry' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Biotechnology', subtopics: [{ name: 'PCR & Recombinant DNA' }, { name: 'Bt Cotton & Golden Rice' }, { name: 'Gene Therapy' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Ecology', subtopics: [{ name: 'Ecosystem & Energy Flow' }, { name: 'Biodiversity Conservation' }, { name: 'Ozone Layer & Environmental Issues' }], examRelevance: ['NEET', 'KCET'] },
  { subject: 'biology', classLevel: 12, topic: 'Reproduction', subtopics: [{ name: 'Double Fertilization in Plants' }, { name: 'Human Reproductive System' }, { name: 'Reproductive Health & Birth Control' }], examRelevance: ['NEET', 'KCET'] },
];
