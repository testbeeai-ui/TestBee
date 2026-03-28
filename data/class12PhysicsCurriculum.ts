import type { ExamType } from '@/types';
import type { TopicNode } from '@/data/topicTaxonomy';

export interface CurriculumTopic {
  title: string;
  subtopics: string[];
}

export interface CurriculumChapter {
  title: string;
  topics: CurriculumTopic[];
}

export interface CurriculumUnit {
  unitLabel: string;
  unitTitle: string;
  chapters: CurriculumChapter[];
}

const RAW_CLASS12_PHYSICS_CURRICULUM = `
UNIT I - ELECTROSTATICS

Ch 1: Electric Charges and Fields

Topic: Electric Charge & Properties
Types of charges: positive and negative; like charges repel, unlike attract
Quantization of charge: Q = ne (n = integer, e = 1.6 x 10^-19 C)
Conservation of charge: total charge in an isolated system is constant
Additivity of charges: charges add algebraically
Methods of charging: friction, conduction (contact), induction (no contact)

Topic: Coulomb's Law
Force F = kq_1q_2/r^2 = q_1q_2/4piepsilon_0r^2 (k = 9 x 10^9 N m^2 C^-2)
Vector form: F_1_2 = kq_1q_2/r^2 r_1_2 (direction along line joining charges)
Superposition principle: net force on a charge = vector sum of individual forces
Continuous charge distribution: linear (lambda C/m), surface (sigma C/m^2), volume (rho C/m^3)

Topic: Electric Field
Electric field E = F/q_0 (force per unit positive test charge)
Field due to a point charge: E = kq/r^2 (radially outward for +q)
Electric field lines: start on +, end on -; never cross; density proportional to field strength
Electric dipole: pair of equal and opposite charges q separated by distance 2a
Field on axial line: E = 2kp/r^3; on equatorial line: E = kp/r^3 (p = 2qa)
Torque on dipole: tau = pE sintheta; tau = p x E; potential energy U = -p.E

Topic: Gauss's Law & Applications
Electric flux Phi = E.A = EA costheta (unit: N m^2 C^-1)
Gauss's Theorem: Phi = q_enclosed / epsilon_0
Application 1 - Infinite straight wire: E = lambda/2piepsilon_0r (perpendicular to wire)
Application 2 - Infinite plane sheet: E = sigma/2epsilon_0 (uniform, perpendicular to sheet)
Application 3 - Charged spherical shell: outside E = kq/r^2; inside E = 0

Ch 2: Electrostatic Potential & Capacitance

Topic: Electric Potential
Potential V = W/q_0 = kq/r (work done per unit positive charge; scalar quantity)
Potential difference V_AB = V_A - V_B = W_AB / q_0
Potential due to dipole: axial V = kp/r^2; equatorial V = 0
Equipotential surface: surface of constant potential; field always perpendicular to it; no work done on it
Relation between E and V: E = -dV/dr (field points from high to low potential)

Topic: Potential Energy
PE of two point charges: U = kq_1q_2/r
PE of a dipole in external field: U = -pE costheta = -p.E
Work done in assembling a system of charges = total potential energy

Topic: Conductors and Dielectrics
Conductor in equilibrium: E = 0 inside; free charges reside on surface; field perpendicular to surface outside
Dielectric: non-conductor; polar molecules (H_2O, HCl) vs non-polar (CO_2, CH_4)
Electric polarization P in dielectric; dielectric constant K = epsilon/epsilon_0

Topic: Capacitors
Capacitance C = Q/V (unit: Farad F = C/V)
Parallel plate capacitor: C = epsilon_0A/d (without dielectric); C = Kepsilon_0A/d (with dielectric)
Series combination: 1/C_eff = 1/C_1 + 1/C_2 + ... (charge same, voltage adds)
Parallel combination: C_eff = C_1 + C_2 + ... (voltage same, charge adds)
Energy stored: U = Q^2/2C = 1/2CV^2 = 1/2QV (no derivation needed)

UNIT II - CURRENT ELECTRICITY

Ch 3: Current Electricity

Topic: Electric Current & Drift Velocity
Current I = dQ/dt (unit: Ampere = C/s); conventional current opposite to electron flow
Drift velocity v_d = eEtau/m (tau = relaxation time; E = electric field)
Relation I = nAev_d (n = number density of electrons; A = cross-section; e = charge)
Mobility mu = v_d/E = etau/m (unit: m^2 V^-1 s^-1)

Topic: Ohm's Law & Resistance
Ohm's Law: V = IR (valid for metallic conductors at constant temperature)
V-I characteristics: linear (ohmic: metal at low field), non-linear (non-ohmic: diode, bulb)
Resistance R = rhol/A; resistivity rho = m/ne^2tau (intrinsic property of material)
Conductance G = 1/R; conductivity sigma = 1/rho
Temperature dependence: R_T = R_0(1 + alphaDeltaT) (alpha = temperature coefficient)

Topic: EMF, Internal Resistance & Combinations
EMF epsilon = work done by source per unit charge; terminal voltage V = epsilon - Ir (during discharge)
Cells in series: epsilon_eff = epsilon_1 + epsilon_2; r_eff = r_1 + r_2 (current same)
Cells in parallel: epsilon_eff = (epsilon_1/r_1 + epsilon_2/r_2)/(1/r_1 + 1/r_2); 1/r_eff = 1/r_1 + 1/r_2

Topic: Kirchhoff's Laws
Junction Rule (KCL): SigmaI at junction = 0 (charge conservation)
Loop Rule (KVL): SigmaV around closed loop = 0 (energy conservation)
Wheatstone Bridge: balanced when P/Q = R/S (no current through galvanometer)
Meter Bridge (slide wire bridge): application of Wheatstone bridge; R = S(100 - l)/l

UNIT III - MAGNETIC EFFECTS OF CURRENT & MAGNETISM

Ch 4: Moving Charges and Magnetism

Topic: Magnetic Force
Lorentz force: F = q(v x B); magnitude F = qvB sintheta
Circular motion in B: radius r = mv/qB; time period T = 2pim/qB (independent of v)
Force on current-carrying conductor: F = I(L x B); F = BIL sintheta

Topic: Biot-Savart Law
dB = mu_0/4pi x I(dl x r)/r^2 (mu_0 = 4pi x 10^-7 T m A^-1)
Field at centre of circular loop: B = mu_0I/2R
Field due to finite straight wire segment

Topic: Ampere's Circuital Law
B.dl = mu_0I_enclosed (line integral around a closed Amperian loop)
Field due to infinitely long straight wire: B = mu_0I/2pir
Field inside a long solenoid: B = mu_0nI (n = turns per unit length; qualitative treatment only)

Topic: Force Between Conductors
Force per unit length between two parallel conductors: F/L = mu_0I_1I_2/2pid
Parallel currents attract; anti-parallel currents repel
Definition of Ampere: 1 A produces F/L = 2 x 10^-7 N/m when d = 1 m

Topic: Torque, Galvanometer & Conversions
Torque on a current loop: tau = nBIA sintheta; vector form tau = m x B (m = nIA)
Current loop as magnetic dipole: magnetic moment m = nIA
Moving coil galvanometer: coil between pole pieces; restoring torque ktheta; current sensitivity I = k/nAB
Conversion to ammeter: low resistance shunt S = Ig.G/(I - Ig) in parallel
Conversion to voltmeter: high series resistance R = (V/Ig) - G in series

Ch 5: Magnetism and Matter

Topic: Magnetic Dipole
Bar magnet as equivalent solenoid: south pole <-> north pole similar to solenoid ends (qualitative)
Field on axial position (tan A position): B = mu_0/4pi x 2M/r^3 (qualitative only)
Field on equatorial position (tan B position): B = mu_0/4pi x M/r^3 (qualitative only)
Torque on bar magnet in uniform B: tau = MB sintheta (qualitative)
Magnetic field lines: closed loops; emerge from N, enter S

Topic: Magnetic Properties of Materials
Diamagnetic: chi slightly negative (-1 <= chi < 0); mur < 1; repelled by magnet; e.g. Bi, Cu, H_2O
Paramagnetic: chi small positive (0 < chi < 1); mur slightly > 1; feebly attracted; e.g. Al, Na, O_2
Ferromagnetic: chi very large positive; mur >> 1; strongly attracted; e.g. Fe, Ni, Co
Curie's law: chi = C/T for paramagnetic substances (susceptibility inversely proportional to T)
Curie temperature: above it, ferromagnetic -> paramagnetic

UNIT IV - EM INDUCTION & ALTERNATING CURRENTS

Ch 6: Electromagnetic Induction

Topic: Magnetic Flux & Faraday's Laws
Magnetic flux Phi = B.A = BA costheta (unit: Weber Wb = T m^2)
Faraday's First Law: whenever magnetic flux through a circuit changes, an EMF is induced
Faraday's Second Law: |epsilon| = dPhi/dt (magnitude of induced EMF = rate of change of flux)
For N-turn coil: epsilon = -N dPhi/dt

Topic: Lenz's Law
Lenz's Law: direction of induced current is such that it opposes the change causing it
Lenz's Law is consequence of conservation of energy
Example: magnet approaching coil -> induced current creates repulsive force

Topic: Self and Mutual Inductance
Self-inductance L: Phi = LI; epsilon = -L dI/dt (unit: Henry H = Wb A^-1 = V s A^-1)
Self-inductance of solenoid: L = mu_0n^2Al (n = turns/length, A = area)
Energy stored in inductor: U = 1/2LI^2
Mutual inductance M: Phi_1_2 = MI_2; epsilon_1 = -M dI_2/dt (unit: Henry)

Ch 7: Alternating Current

Topic: AC Quantities
AC: v = V_0 sin omegat; i = I_0 sin(omegat + phi) (V_0, I_0 = peak values; omega = angular frequency)
RMS value: I_rms = I_0/sqrt2 ~ 0.707 I_0; V_rms = V_0/sqrt2
Average value over full cycle = 0; over half cycle = 2I_0/pi

Topic: AC Circuit Elements
Purely resistive: V and I in phase; apparent power = real power; P = V_rms I_rms
Purely inductive: I lags V by 90 degrees; inductive reactance X_L = omegaL (unit: ohm)
Purely capacitive: I leads V by 90 degrees; capacitive reactance X_C = 1/omegaC (unit: ohm)
LCR series circuit: impedance Z = sqrt[R^2 + (X_L - X_C)^2]; tan phi = (X_L - X_C)/R
Resonance: X_L = X_C -> Z = R (minimum); resonant frequency omega_0 = 1/sqrt(LC)

Topic: Power and AC Devices
Power in AC: P = V_rms I_rms cosphi (cosphi = power factor; phi = phase difference)
Wattless current: I sin phi component; does not consume power
AC Generator: rotation of coil in magnetic field; epsilon = NBAomega sin omegat; slip rings and brushes
Transformer: principle of mutual induction; V_1/V_2 = N_1/N_2 = I_2/I_1
Transformer losses: copper loss (I^2R), iron loss (eddy currents + hysteresis); efficiency eta = P_out/P_in

UNIT V - ELECTROMAGNETIC WAVES

Ch 8: Electromagnetic Waves

Topic: Displacement Current
Need for displacement current: Ampere's law failed for capacitor plates during charging
Displacement current I_d = epsilon_0 dPhi_E/dt (Maxwell's modification to Ampere's law)
Generalised Ampere's law: B.dl = mu_0(I_c + I_d)

Topic: Properties of EM Waves
E and B are perpendicular to each other and to direction of propagation (transverse waves)
Speed in vacuum: c = 1/sqrt(mu_0epsilon_0) = 3 x 10^8 m/s
Speed in medium: v = 1/sqrt(muepsilon) = c/n (n = refractive index)
E_0/B_0 = c; amplitudes of E and B are related
EM waves carry energy (Poynting vector S = E x B/mu_0) and momentum

Topic: Electromagnetic Spectrum
Radio waves (lambda > 0.1 m): AM/FM broadcasting, radar, wireless communication
Microwaves (1 mm - 0.1 m): radar, satellite communication, microwave oven
Infrared (700 nm - 1 mm): heat radiation, IR remote, night-vision, IR photography
Visible (400 - 700 nm): human vision; VIBGYOR; produced by electron transitions
Ultraviolet (1 nm - 400 nm): skin tanning, LASIK surgery, sterilisation, vitamin D
X-rays (0.001 - 1 nm): medical imaging (radiography), crystallography
Gamma rays (< 0.001 nm): nuclear reactions, cancer treatment (radiotherapy)

UNIT VI - OPTICS

Ch 9: Ray Optics & Optical Instruments

Topic: Reflection & Mirrors
Laws of reflection: angle of incidence = angle of reflection; incident ray, normal, reflected ray coplanar
Spherical mirrors: pole P, centre of curvature C, focus F, principal axis; focal length f = R/2
Mirror formula: 1/v + 1/u = 1/f (new Cartesian sign convention must be applied)
Linear magnification: m = -v/u (m < 0 -> inverted image; m > 0 -> erect)
Real image: v negative (for concave mirror); Virtual image: v positive

Topic: Refraction & Total Internal Reflection
Snell's law: n_1 sintheta_1 = n_2 sintheta_2; refractive index n = c/v
Total internal reflection: occurs when light goes from denser to rarer medium and theta_i > theta_c
Critical angle: sin theta_c = n_2/n_1 (n_2 < n_1); sin theta_c = 1/n for air
Applications: optical fibre (theta_i > theta_c at core-cladding interface), diamond, endoscope
Refraction at spherical surface: n_2/v - n_1/u = (n_2 - n_1)/R

Topic: Lenses
Thin lens formula: 1/v - 1/u = 1/f
Lens maker's formula: 1/f = (n - 1)(1/R_1 - 1/R_2) (sign convention carefully)
Magnification by lens: m = v/u (positive -> erect; negative -> inverted)
Power of lens P = 1/f (metre); unit: dioptre D; P_total = P_1 + P_2 + ... (in contact)
Combination of lenses: 1/f_eff = 1/f_1 + 1/f_2

Topic: Prism & Optical Instruments
Refraction through prism: i + e = A + delta (A = prism angle, delta = angle of deviation)
Minimum deviation: i = e; n = sin((A + D_m)/2) / sin(A/2)
Simple microscope: m = 1 + D/f (D = 25 cm; used for D < 25 cm objects)
Compound microscope: m_total = m_e x m_o = L/f_o x (1 + D/f_e) (L = tube length)
Astronomical telescope (refracting): m = -f_o/f_e; tube length = f_o + f_e
Reflecting telescope: large spherical/parabolic mirror as objective; avoids chromatic aberration

Ch 10: Wave Optics

Topic: Huygens' Principle
Every point on a wavefront acts as a new source of secondary spherical wavelets
New wavefront = envelope (tangent) of secondary wavelets at later time
Explanation of reflection using Huygens' principle: angle of incidence = angle of reflection
Explanation of refraction: v_1/v_2 = sintheta_1/sintheta_2 = n_2/n_1 (Snell's law derived)

Topic: Interference
Coherent sources: same frequency, constant phase difference (e.g. two slits illuminated by same source)
Constructive interference: path difference = nlambda -> bright fringe
Destructive interference: path difference = (2n-1)lambda/2 -> dark fringe
Young's Double Slit Experiment (YDSE): fringe width beta = lambdaD/d (D = screen dist, d = slit separation)
Intensity distribution: I = 4I_0 cos^2(phi/2); central bright fringe at path diff = 0

Topic: Diffraction
Single slit diffraction: central maximum width = 2lambdaD/a (a = slit width)
Condition for minima: a sintheta = nlambda (n = 1, 2, ...)
Central maximum is twice as wide as secondary maxima (qualitative treatment only)

UNIT VII - DUAL NATURE OF RADIATION & MATTER

Ch 11: Dual Nature of Radiation and Matter

Topic: Photoelectric Effect
Hertz's observation (1887): UV light falling on metal surface causes electron emission
Lenard's experiment: photoelectric current depends on intensity; KE depends on frequency
Key observations: threshold frequency nu_0; stopping potential V_0; instantaneous emission
Einstein's photoelectric equation: KE_max = hnu - phi = eV_0 (phi = work function = hnu_0)
Photon energy E = hnu = hc/lambda (h = 6.63 x 10^-34 J s); photon momentum p = h/lambda = E/c
Intensity increases -> more photons -> more photoelectrons; KE unchanged

Topic: Wave Nature of Matter
de-Broglie hypothesis: matter also has wave nature; lambda = h/p = h/mv
de-Broglie wavelength for electron accelerated through V volts: lambda = h/sqrt(2meV) = 1.227/sqrtV nm
Davisson-Germer experiment (1927): confirmed wave nature of electrons by diffraction
Heisenberg's uncertainty principle: Deltax.Deltap >= h/4pi (qualitative understanding)

UNIT VIII - ATOMS & NUCLEI

Ch 12: Atoms

Topic: Atomic Models
Thomson's plum-pudding model: electrons embedded in +ve sphere; failed to explain alpha-scattering
Rutherford's alpha-scattering experiment: most alpha-particles pass through; few deflect; very few bounce back
Rutherford's nuclear model: tiny dense positive nucleus; electrons orbit; mostly empty space
Drawback: classical EM theory predicts spiralling electron -> atom should collapse (continuous spectrum problem)

Topic: Bohr's Model of Hydrogen Atom
Postulate 1: Electrons orbit in stationary states without radiating; angular momentum L = nh/2pi
Postulate 2: Energy is emitted/absorbed only when electron jumps between orbits: hnu = E_i - E_f
Radius of nth orbit: r_n = n^2a_0/Z (a_0 = 0.529 A = Bohr radius for H)
Velocity of electron: v_n = e^2Z/2epsilon_0hn = 2.18 x 10^6 Z/n m/s
Total energy: E_n = -13.6 Z^2/n^2 eV (negative = bound; increases towards zero as n -> infinity)
Hydrogen spectral series: Lyman (UV, n_f=1), Balmer (visible, n_f=2), Paschen (IR, n_f=3)
Wavenumber: 1/lambda = R_H Z^2(1/n_1^2 - 1/n_2^2) (R_H = 1.097 x 10^7 m^-1)

Ch 13: Nuclei

Topic: Composition & Nuclear Force
Nucleus composed of protons (Z) and neutrons (N); mass number A = Z + N
Nuclear size: R = R_0A^(1/3) (R_0 = 1.2 fm = 1.2 x 10^-15 m)
Nuclear density 2.3 x 10^17 kg/m^3; same for all nuclei (approximately)
Nuclear force: short-range (~2-3 fm); charge-independent; strongest known fundamental force; saturating

Topic: Mass Defect & Binding Energy
Mass defect: Deltam = [Zmp + Nmn - M_nucleus] (mass of nucleus < sum of constituent masses)
Binding energy: BE = Deltam.c^2 (energy needed to completely disintegrate the nucleus)
Binding energy per nucleon: BE/A (average energy per nucleon)
BE/A curve: rises to peak at ^56Fe (8.8 MeV/nucleon); lower for very light and very heavy nuclei
Implication: energy released in fusion of light nuclei and fission of heavy nuclei

Topic: Nuclear Reactions
Nuclear fission: heavy nucleus (e.g. ^235U) splits into two medium fragments + neutrons + energy
Chain reaction: neutrons from one fission trigger further fissions; critical mass needed
Nuclear fusion: two light nuclei (e.g. D + T -> He + n) combine releasing large energy
Condition for fusion: very high temperature (~10^7 K) to overcome Coulomb repulsion
Stellar energy source: fusion reactions in stars (proton-proton cycle)

UNIT IX - ELECTRONIC DEVICES

Ch 14: Semiconductor Electronics

Topic: Energy Bands
Conductors: overlapping valence and conduction bands; electrons freely move
Insulators: large energy gap E_g > 3 eV; electrons cannot jump to conduction band at room T
Semiconductors: small energy gap E_g ~ 1 eV (Si: 1.1 eV; Ge: 0.7 eV)
Intrinsic semiconductor: pure Si or Ge; thermal energy creates equal holes and electrons
n-type: doped with pentavalent (P, As, Sb); extra electron as majority carrier; holes as minority
p-type: doped with trivalent (B, Al, In); extra hole as majority carrier; electrons as minority

Topic: p-n Junction
Formation: p-type and n-type joined -> diffusion of majority carriers -> depletion layer forms
Depletion region: devoid of free charges; built-in electric field opposes further diffusion
Barrier potential: ~0.7 V for Si; ~0.3 V for Ge
Forward bias: external V opposes barrier -> depletion width reduces -> current flows (order of mA)
Reverse bias: external V adds to barrier -> depletion width increases -> only tiny leakage current (muA)

Topic: Diode Applications
I-V characteristics: forward bias - exponential rise after threshold; reverse bias - almost zero till breakdown
Half-wave rectifier: diode in series with load; only positive half cycles pass; output frequency = input
Full-wave rectifier (centre-tap): two diodes; both half cycles used; output frequency = 2 x input
Bridge rectifier: four diodes; more efficient full-wave rectification; no centre-tap needed
`;

function parseClass12PhysicsCurriculum(raw: string): CurriculumUnit[] {
  const units: CurriculumUnit[] = [];
  let currentUnit: CurriculumUnit | null = null;
  let currentChapter: CurriculumChapter | null = null;
  let currentTopic: CurriculumTopic | null = null;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const unitMatch = line.match(/^UNIT\s+([IVXLC]+)\s*-\s*(.+)$/i);
    if (unitMatch) {
      currentUnit = {
        unitLabel: `Unit ${unitMatch[1].toUpperCase()}`,
        unitTitle: unitMatch[2].trim(),
        chapters: [],
      };
      units.push(currentUnit);
      currentChapter = null;
      currentTopic = null;
      continue;
    }

    const chapterMatch = line.match(/^Ch\s*\d+\s*:\s*(.+)$/i);
    if (chapterMatch) {
      if (!currentUnit) continue;
      currentChapter = { title: chapterMatch[1].trim(), topics: [] };
      currentUnit.chapters.push(currentChapter);
      currentTopic = null;
      continue;
    }

    const topicMatch = line.match(/^Topic\s*:\s*(.+)$/i);
    if (topicMatch) {
      if (!currentChapter) continue;
      currentTopic = { title: topicMatch[1].trim(), subtopics: [] };
      currentChapter.topics.push(currentTopic);
      continue;
    }

    if (currentTopic) currentTopic.subtopics.push(line);
  }

  return units;
}

export const class12PhysicsUnits: CurriculumUnit[] = parseClass12PhysicsCurriculum(
  RAW_CLASS12_PHYSICS_CURRICULUM
);

const CLASS_12_PHYSICS_EXAMS: ExamType[] = ['JEE', 'NEET', 'KCET'];

export const physics12DetailedTopicTaxonomy: TopicNode[] = class12PhysicsUnits.flatMap((unit) =>
  unit.chapters.flatMap((chapter) =>
    chapter.topics.map((topic) => ({
      subject: 'physics',
      classLevel: 12,
      topic: topic.title,
      chapterTitle: chapter.title,
      unitLabel: unit.unitLabel,
      unitTitle: unit.unitTitle,
      subtopics: topic.subtopics.map((name) => ({ name })),
      examRelevance: CLASS_12_PHYSICS_EXAMS,
    }))
  )
);
