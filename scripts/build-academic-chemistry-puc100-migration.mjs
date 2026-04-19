/**
 * Generates supabase/migrations/*_play_academic_chemistry_puc100_jee_neet.sql
 * Run: node scripts/build-academic-chemistry-puc100-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK = "puc_chemistry_jee_neet_100";

/** @type {{ b: string; t: string; s: string; o: [string, string, string, string]; e: string }[]} */
const Q = [];

function add(b, t, s, correct, w1, w2, w3, e) {
  Q.push({ b, t, s, o: [correct, w1, w2, w3], e });
}

// Block 1: Atomic structure & bonding (1–10)
add(
  "atomic_bonding",
  "conceptual",
  "Why does the \\(4s\\) orbital fill before \\(3d\\) in K, yet \\(4s\\) electrons are usually removed before \\(3d\\) when ionizing transition metals?",
  "\\(4s\\) penetrates more in neutral atoms (lower energy first), but once \\(3d\\) fills it shields \\(4s\\), raising \\(4s\\) energy so \\(4s\\) ionizes first.",
  "Because \\(4s\\) always has higher energy than \\(3d\\) in every atom.",
  "Because Hund’s rule forces \\(3d\\) to empty before \\(4s\\).",
  "Because \\(4s\\) is non-bonding in all transition metals.",
  "Neutral-atom filling follows \\((n+l)\\) ordering; after \\(3d\\) occupation, effective nuclear charge and shielding reorder orbital energies for ionization.",
);
add(
  "atomic_bonding",
  "numerical",
  "For a \\(5d\\) hydrogen-like orbital, how many radial and angular nodes are there?",
  "Radial = 2, angular = 2",
  "Radial = 3, angular = 2",
  "Radial = 2, angular = 3",
  "Radial = 1, angular = 2",
  "Radial nodes \\(= n - l - 1 = 5 - 2 - 1 = 2\\); angular nodes \\(= l = 2\\).",
);
add(
  "atomic_bonding",
  "conceptual",
  "According to MOT, why is \\(O_2\\) paramagnetic despite an even electron count?",
  "Two unpaired electrons in degenerate \\(\\pi^*\\) orbitals (Hund’s rule).",
  "Because \\(O_2\\) has a permanent electric dipole only.",
  "Because all electrons are paired in bonding orbitals.",
  "Because oxygen is a liquid at low temperature.",
  "HOMO are \\(\\pi^*_{2p}\\); the last two electrons occupy separate \\(\\pi^*\\) orbitals with parallel spins.",
);
add(
  "atomic_bonding",
  "numerical",
  "Formal charge on the central oxygen in ozone (\\(O_3\\))?",
  "\\(+1\\)",
  "\\(0\\)",
  "\\(-1\\)",
  "\\(+2\\)",
  "FC = valence − lone pairs − bonding/2: \\(6 - 2 - 6/2 = +1\\).",
);
add(
  "atomic_bonding",
  "conceptual",
  "In VSEPR, why do lone pair–lone pair repulsions distort bond angles more than bond pair–bond pair repulsions?",
  "Lone pairs are more diffuse (localized on one nucleus), occupying more angular space and repelling more strongly.",
  "Lone pairs are always smaller than bonding pairs.",
  "Bonding pairs have higher nuclear charge than lone pairs.",
  "Lone pairs only repel other lone pairs, not bond pairs.",
  "Bonding pairs are shared between two nuclei and more compact; lone pairs spread out.",
);
add(
  "atomic_bonding",
  "numerical",
  "Bond order of \\(N_2^+\\)?",
  "\\(2.5\\)",
  "\\(3\\)",
  "\\(2\\)",
  "\\(3.5\\)",
  "\\(N_2\\) BO = 3; remove one electron from a bonding \\(\\sigma_{2pz}\\) orbital → BO decreases by 0.5.",
);
add(
  "atomic_bonding",
  "conceptual",
  "Why is the dipole moment of \\(NH_3\\) (\\(\\sim 1.47\\ \\mathrm{D}\\)) much larger than that of \\(NF_3\\) (\\(\\sim 0.24\\ \\mathrm{D}\\))?",
  "In \\(NH_3\\), bond dipoles add with the lone pair dipole; in \\(NF_3\\), very electronegative F pulls bond dipoles opposite to the lone pair, partly cancelling.",
  "Because \\(NF_3\\) has no lone pair on nitrogen.",
  "Because \\(NH_3\\) is always non-polar.",
  "Because dipole moment depends only on molecular mass.",
  "Vector addition of bond and lone-pair contributions differs in the two pyramids.",
);
add(
  "atomic_bonding",
  "numerical",
  "An electron in hydrogen falls from \\(n = 4\\) to \\(n = 2\\). Wavelength of the emitted photon? (\\(R_H = 109677\\ \\mathrm{cm^{-1}}\\)).",
  "\\(\\approx 486\\ \\mathrm{nm}\\) (Balmer blue-green line)",
  "\\(\\approx 656\\ \\mathrm{nm}\\)",
  "\\(\\approx 122\\ \\mathrm{nm}\\)",
  "\\(\\approx 1000\\ \\mathrm{nm}\\)",
  "\\(1/\\lambda = R_H(1/4 - 1/16) = 3R_H/16\\); invert to get \\(\\lambda\\).",
);
add(
  "atomic_bonding",
  "conceptual",
  "Which has greater covalent character, \\(NaCl\\) or \\(CuCl\\), and why?",
  "\\(CuCl\\) — \\(Cu^+\\) is more polarizing (pseudo-noble \\(3d^{10}\\) etc.), Fajans-type distortion of \\(Cl^-\\).",
  "\\(NaCl\\) — sodium is lighter.",
  "They are identical in every crystal.",
  "\\(NaCl\\) — higher lattice energy always means more covalent character.",
  "Smaller, more polarizing cation pulls electron density from anion into the bond region.",
);
add(
  "atomic_bonding",
  "numerical",
  "Heisenberg: if \\(\\Delta x = \\Delta p\\) for a particle of mass \\(m\\), express \\(\\Delta v\\).",
  "\\(\\Delta v = \\dfrac{1}{2m}\\sqrt{\\dfrac{h}{\\pi}}\\)",
  "\\(\\Delta v = \\dfrac{h}{4\\pi m\\Delta x}\\) only, with \\(\\Delta x\\) arbitrary",
  "\\(\\Delta v = \\sqrt{h/(2\\pi m)}\\)",
  "\\(\\Delta v = 0\\)",
  "\\(\\Delta x\\,\\Delta p \\ge h/(4\\pi)\\); set \\(\\Delta x = \\Delta p\\) and use \\(\\Delta p = m\\Delta v\\).",
);

// Block 2: Thermodynamics & kinetics (11–20)
add(
  "thermo_kinetics",
  "conceptual",
  "Compared to Trouton’s rule \\(\\Delta S_{\\mathrm{vap}} \\approx 85\\ \\mathrm{J\\,K^{-1}\\,mol^{-1}}\\) for many liquids, how does water’s \\(\\Delta S_{\\mathrm{vap}}\\) behave?",
  "Water’s \\(\\Delta S_{\\mathrm{vap}}\\) is typically higher because the liquid is strongly ordered (H-bonds), so vaporization gives an unusually large disorder jump.",
  "Water’s \\(\\Delta S_{\\mathrm{vap}}\\) is always lower because hydrogen bonds make vaporization impossible.",
  "Water follows Trouton exactly because it is molecular.",
  "Trouton’s rule does not apply to any liquids.",
  "Highly ordered liquid → larger entropy gain on forming a disordered gas.",
);
add(
  "thermo_kinetics",
  "numerical",
  "A first-order reaction is 75% complete in 60 min. Half-life \\(t_{1/2}\\)?",
  "\\(30\\ \\mathrm{min}\\)",
  "\\(15\\ \\mathrm{min}\\)",
  "\\(60\\ \\mathrm{min}\\)",
  "\\(45\\ \\mathrm{min}\\)",
  "75% complete ⇒ 25% left ⇒ two half-lives in 60 min ⇒ \\(t_{1/2} = 30\\ \\mathrm{min}\\).",
);
add(
  "thermo_kinetics",
  "conceptual",
  "When is \\(\\Delta G < 0\\) guaranteed at **all** temperatures for a reaction?",
  "\\(\\Delta H < 0\\) and \\(\\Delta S > 0\\)",
  "\\(\\Delta H > 0\\) and \\(\\Delta S < 0\\)",
  "\\(\\Delta H > 0\\) and \\(\\Delta S > 0\\) always",
  "\\(\\Delta S = 0\\) only",
  "\\(\\Delta G = \\Delta H - T\\Delta S\\); both terms favor spontaneity for every \\(T\\).",
);
add(
  "thermo_kinetics",
  "numerical",
  "2 mol ideal gas expands isothermally and reversibly at \\(300\\ \\mathrm{K}\\) from 10 L to 100 L. Work done on the gas? (\\(R \\approx 8.314\\ \\mathrm{J\\,K^{-1}\\,mol^{-1}}\\)).",
  "\\(\\approx -11.5\\ \\mathrm{kJ}\\)",
  "\\(+11.5\\ \\mathrm{kJ}\\)",
  "\\(-2.30\\ \\mathrm{kJ}\\)",
  "\\(0\\ \\mathrm{kJ}\\)",
  "\\(W = -2.303\\,nRT\\log(V_2/V_1)\\).",
);
add(
  "thermo_kinetics",
  "conceptual",
  "Collision theory: why do many exothermic reactions still need activation energy?",
  "Bonds in reactants must be stretched/broken to reach the transition state; repulsion and geometry require a minimum collision energy.",
  "Exothermic reactions have no transition state.",
  "Activation energy only exists for endothermic reactions.",
  "Heat always flows in without a barrier.",
  "\\(E_a\\) is the barrier to forming the activated complex, independent of overall \\(\\Delta H\\).",
);
add(
  "thermo_kinetics",
  "numerical",
  "Temperature coefficient of rate is 2 per \\(10\\ \\mathrm{K}\\). Factor increase from \\(20^\\circ\\mathrm{C}\\) to \\(50^\\circ\\mathrm{C}\\)?",
  "\\(8\\)",
  "\\(4\\)",
  "\\(16\\)",
  "\\(2\\)",
  "\\(2^{\\Delta T/10} = 2^3 = 8\\).",
);
add(
  "thermo_kinetics",
  "conceptual",
  "In thermodynamics, is work a state function or a path function?",
  "Path function — depends on how the system goes from initial to final state.",
  "State function — depends only on endpoints.",
  "Always zero for cycles.",
  "Equal to heat in all processes.",
  "Different paths (reversible vs irreversible expansion) give different \\(W\\).",
);
add(
  "thermo_kinetics",
  "numerical",
  "For \\(N_2 + 3H_2 \\rightarrow 2NH_3\\), if \\(-d[H_2]/dt = 3 \\times 10^{-4}\\ \\mathrm{M\\,s^{-1}}\\), what is \\(+\\,d[NH_3]/dt\\)?",
  "\\(2 \\times 10^{-4}\\ \\mathrm{M\\,s^{-1}}\\)",
  "\\(3 \\times 10^{-4}\\ \\mathrm{M\\,s^{-1}}\\)",
  "\\(1 \\times 10^{-4}\\ \\mathrm{M\\,s^{-1}}\\)",
  "\\(9 \\times 10^{-4}\\ \\mathrm{M\\,s^{-1}}\\)",
  "Stoichiometry: \\(\\frac{1}{3}d[H_2]/dt\\) linked to \\(\\frac{1}{2}d[NH_3]/dt\\).",
);
add(
  "thermo_kinetics",
  "conceptual",
  "Why does a catalyst not change \\(K_{\\mathrm{eq}}\\) for a reversible reaction?",
  "It lowers \\(E_a\\) for forward and reverse by the same factor, speeding both equally; equilibrium composition unchanged.",
  "It shifts equilibrium toward products only.",
  "It changes \\(\\Delta H^\\circ\\) of the reaction.",
  "It consumes one of the reactants permanently.",
  "Equal acceleration of forward and reverse rates leaves \\(K\\) the same.",
);
add(
  "thermo_kinetics",
  "numerical",
  "\\(\\Delta H_f^\\circ\\): \\(CO_2\\) \\(-393.5\\), \\(H_2O(l)\\) \\(-285.8\\), \\(CH_4\\) \\(-74.8\\ \\mathrm{kJ\\,mol^{-1}}\\). Standard enthalpy of combustion of methane?",
  "\\(-890.3\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(-802.1\\ \\mathrm{kJ\\,mol^{-1}}\\) only",
  "\\(+890.3\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(-600.0\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(CH_4 + 2O_2 \\rightarrow CO_2 + 2H_2O\\); use products minus reactants.",
);

// Block 3: Equilibrium (21–30)
add(
  "equilibrium",
  "conceptual",
  "Le Chatelier: adding an inert gas to a gaseous equilibrium at **constant volume** — effect?",
  "No shift — partial pressures of reactants/products unchanged.",
  "Shifts toward fewer moles of gas.",
  "Shifts toward more moles of gas.",
  "Always increases \\(K_p\\).",
  "Total pressure rises but mole fractions and partial pressures of reacting gases stay the same.",
);
add(
  "equilibrium",
  "numerical",
  "pH of \\(10^{-8}\\ \\mathrm{M}\\) HCl in water at \\(25^\\circ\\mathrm{C}\\) (include water autoionization).",
  "\\(\\approx 6.96\\)–\\(7.0\\) (often quoted \\(\\approx 6.98\\))",
  "Exactly \\(8.0\\)",
  "Exactly \\(7.0\\) always",
  "\\(8.0\\)",
  "\\([H^+] \\approx 10^{-8} + 10^{-7}\\); \\(\\mathrm{pH} = -\\log[H^+]\\).",
);
add(
  "equilibrium",
  "conceptual",
  "Why does a common ion decrease the solubility of a sparingly soluble salt?",
  "\\(Q_{\\mathrm{sp}}\\) exceeds \\(K_{\\mathrm{sp}}\\); equilibrium shifts to precipitate solid until \\(Q = K\\) again.",
  "It increases \\(K_{\\mathrm{sp}}\\) directly.",
  "It removes water from the solution.",
  "Common ions always increase solubility.",
  "Added ion raises ion product; Le Chatelier reduces dissolved amount.",
);
add(
  "equilibrium",
  "numerical",
  "\\(A(g) + B(g) \\rightleftharpoons C(g)\\), \\(K_c = 10\\) at \\(300\\ \\mathrm{K}\\). \\(K_p\\)? (\\(R = 0.0821\\ \\mathrm{L\\,atm\\,K^{-1}\\,mol^{-1}}\\)).",
  "\\(\\approx 0.406\\)",
  "\\(10\\)",
  "\\(246\\)",
  "\\(0.041\\)",
  "\\(K_p = K_c(RT)^{\\Delta n}\\), \\(\\Delta n = -1\\).",
);
add(
  "equilibrium",
  "conceptual",
  "In an acidic buffer \\(HA / A^-\\), what happens to \\([A^-]/[HA]\\) when a little strong acid is added?",
  "The ratio **decreases** — \\(H^+\\) protonates \\(A^-\\) to \\(HA\\).",
  "The ratio increases.",
  "The ratio stays exactly 1 always.",
  "\\(pH\\) does not change at all.",
  "Added \\(H^+\\) consumes conjugate base.",
);
add(
  "equilibrium",
  "numerical",
  "\\(K_{\\mathrm{sp}}\\) of \\(Ag_2CrO_4\\) is \\(3.2 \\times 10^{-11}\\). Molar solubility \\(s\\) in pure water?",
  "\\(2 \\times 10^{-4}\\ \\mathrm{M}\\)",
  "\\(8 \\times 10^{-4}\\ \\mathrm{M}\\)",
  "\\(10^{-4}\\ \\mathrm{M}\\)",
  "\\(4 \\times 10^{-3}\\ \\mathrm{M}\\)",
  "\\(K_{\\mathrm{sp}} = 4s^3\\) for \\(Ag_2CrO_4 \\rightleftharpoons 2Ag^+ + CrO_4^{2-}\\).",
);
add(
  "equilibrium",
  "conceptual",
  "Stronger Lewis acid: \\(BF_3\\) or \\(BCl_3\\)? Why?",
  "\\(BCl_3\\) — poorer \\(p\\pi\\)-\\(p\\pi\\) back-donation from Cl (larger \\(3p\\)) leaves B more electron-deficient.",
  "\\(BF_3\\) — fluorine is always a stronger donor.",
  "They are identical in Lewis acidity.",
  "\\(BF_3\\) because F is smaller only.",
  "Back-bonding stabilizes \\(BF_3\\) more than \\(BCl_3\\).",
);
add(
  "equilibrium",
  "numerical",
  "Degree of dissociation \\(\\alpha\\) of \\(0.1\\ \\mathrm{M}\\) acetic acid (\\(K_a = 1.8 \\times 10^{-5}\\)).",
  "\\(\\approx 0.013\\) (\\(\\sim 1.3\\%\\))",
  "\\(0.18\\)",
  "\\(0.0018\\)",
  "\\(1.0\\)",
  "\\(\\alpha \\approx \\sqrt{K_a/C}\\) for weak electrolytes.",
);
add(
  "equilibrium",
  "conceptual",
  "Why is aqueous \\(Na_2CO_3\\) basic?",
  "\\(CO_3^{2-}\\) hydrolyzes (salt of strong base + weak acid), producing \\(OH^-\\).",
  "\\(Na^+\\) hydrolyzes strongly.",
  "Carbonate does not react with water.",
  "It is a strong acid salt.",
  "Anion of weak acid accepts protons from water, releasing hydroxide.",
);
add(
  "equilibrium",
  "numerical",
  "Buffer: \\(0.1\\ \\mathrm{M}\\) \\(NH_4OH\\) and \\(0.1\\ \\mathrm{M}\\) \\(NH_4Cl\\), \\(pK_b\\) of ammonia \\(= 4.74\\). pH?",
  "\\(9.26\\)",
  "\\(4.74\\)",
  "\\(7.00\\)",
  "\\(10.74\\)",
  "\\(pOH = pK_b + \\log([\\mathrm{salt}]/[\\mathrm{base}])\\); \\(pH = 14 - pOH\\).",
);

// Block 4: Electrochemistry & solid state (31–40)
add(
  "electrochem_solid",
  "conceptual",
  "Why does a galvanic cell’s voltage fall to zero after long operation?",
  "The cell approaches equilibrium (\\(Q \\to K\\)); \\(\\Delta G\\) and \\(E\\) go to zero.",
  "Electrons are used up permanently.",
  "Salt bridge runs out of electrons.",
  "Temperature always drops to absolute zero.",
  "Nernst: reactant depletion drives \\(E\\) toward 0.",
);
add(
  "electrochem_solid",
  "numerical",
  "Deposit \\(1.27\\ \\mathrm{g}\\) Cu from \\(Cu^{2+}\\) at \\(2\\ \\mathrm{A}\\). Time? (\\(M_{\\mathrm{Cu}} = 63.5\\ \\mathrm{g\\,mol^{-1}}\\), \\(F = 96500\\ \\mathrm{C\\,mol^{-1}}\\)).",
  "\\(1930\\ \\mathrm{s}\\)",
  "\\(965\\ \\mathrm{s}\\)",
  "\\(3860\\ \\mathrm{s}\\)",
  "\\(100\\ \\mathrm{s}\\)",
  "\\(n = 2\\) mol e\\(^-\\) per mol Cu; \\(Q = n_e F\\); \\(t = Q/I\\).",
);
add(
  "electrochem_solid",
  "conceptual",
  "What is a Frenkel defect in an ionic crystal?",
  "A cation (usually smaller) leaves its lattice site and occupies an interstitial site, leaving a vacancy.",
  "A pair of cation and anion vacancies only.",
  "Loss of entire crystal to solution.",
  "Schottky defect in metals only.",
  "Vacancy + interstitial of same ion type; density often unchanged.",
);
add(
  "electrochem_solid",
  "numerical",
  "Metal FCC, unit cell edge \\(a\\). Atomic radius \\(r\\)?",
  "\\(r = a/(2\\sqrt{2})\\)",
  "\\(r = a/2\\)",
  "\\(r = a\\sqrt{2}/4\\) written differently only as \\(a/4\\)",
  "\\(r = a/4\\)",
  "Face diagonal \\(= 4r = \\sqrt{2}\\,a\\).",
);
add(
  "electrochem_solid",
  "conceptual",
  "Main role of a salt bridge in a galvanic cell?",
  "Maintains electrical neutrality by ion migration between half-cells.",
  "Generates extra voltage chemically.",
  "Replaces the external wire.",
  "Prevents any redox reaction.",
  "Counters charge buildup from oxidation/reduction.",
);
add(
  "electrochem_solid",
  "numerical",
  "\\(E^\\circ_{Zn^{2+}/Zn} = -0.76\\ \\mathrm{V}\\), \\(E^\\circ_{Cu^{2+}/Cu} = +0.34\\ \\mathrm{V}\\). \\(\\Delta G^\\circ\\) for Daniell cell per reaction as written (2 e\\(^-\\))?",
  "\\(\\approx -212\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(+212\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(-106\\ \\mathrm{kJ\\,mol^{-1}}\\) only",
  "\\(0\\ \\mathrm{kJ\\,mol^{-1}}\\)",
  "\\(E^\\circ_{\\mathrm{cell}} = 1.10\\ \\mathrm{V}\\); \\(\\Delta G^\\circ = -nFE^\\circ\\).",
);
add(
  "electrochem_solid",
  "conceptual",
  "Why does doping Si with group 15 (e.g. P) give **n**-type semiconductor?",
  "Extra valence electron is weakly bound and donates conduction electrons.",
  "Holes are the majority carriers.",
  "Phosphorus removes all electrons.",
  "The lattice becomes insulating.",
  "Pentavalent substituent provides donor levels near the conduction band.",
);
add(
  "electrochem_solid",
  "numerical",
  "Packing efficiency of simple cubic lattice?",
  "\\(\\approx 52.4\\%\\)",
  "\\(74\\%\\)",
  "\\(68\\%\\)",
  "\\(100\\%\\)",
  "One atom per cell; \\(\\pi/6\\) sphere fraction of cube for \\(a = 2r\\).",
);
add(
  "electrochem_solid",
  "conceptual",
  "Why does molar conductivity \\(\\Lambda_m\\) of a **weak** electrolyte rise sharply on dilution toward infinite dilution?",
  "Degree of ionization increases strongly as concentration drops.",
  "It is already fully dissociated like strong electrolytes.",
  "Ion mobility decreases to infinity.",
  "Only viscosity changes.",
  "More ions per mole of solute appear in solution as \\(\\alpha \\to 1\\).",
);
add(
  "electrochem_solid",
  "numerical",
  "\\(E^\\circ(Fe^{3+}/Fe^{2+}) = 0.77\\ \\mathrm{V}\\), \\(E^\\circ(I_2/I^-) = 0.54\\ \\mathrm{V}\\). For \\(2Fe^{3+} + 2I^- \\rightarrow 2Fe^{2+} + I_2\\), \\(E^\\circ_{\\mathrm{cell}}\\)?",
  "\\(+0.23\\ \\mathrm{V}\\) (spontaneous under standard conditions)",
  "\\(-0.23\\ \\mathrm{V}\\)",
  "\\(0\\ \\mathrm{V}\\)",
  "\\(+1.31\\ \\mathrm{V}\\)",
  "\\(E^\\circ_{\\mathrm{cathode}} - E^\\circ_{\\mathrm{anode}}\\).",
);

// Block 5: GOC & stereochemistry (41–50)
add(
  "goc_stereo",
  "conceptual",
  "Why is \\(CF_3COOH\\) a much stronger acid than \\(CH_3COOH\\)?",
  "Strong \\(-I\\) effect of F stabilizes the carboxylate anion.",
  "Fluorine donates electrons to the carbonyl only.",
  "Acid strength does not depend on substituents.",
  "\\(CF_3\\) is larger so acid is weaker.",
  "Electron-withdrawing groups stabilize the conjugate base.",
);
add(
  "goc_stereo",
  "numerical",
  "How many distinct stereoisomers for 2,3-dichlorobutane?",
  "\\(3\\) (one meso + one enantiomeric pair)",
  "\\(4\\)",
  "\\(2\\)",
  "\\(8\\)",
  "Two stereocenters with internal plane of symmetry → meso compound counts once.",
);
add(
  "goc_stereo",
  "conceptual",
  "Compare gas-phase stability: **tert-butyl** carbocation vs **benzyl** carbocation (typical textbook competition).",
  "Benzyl is generally more stable — resonance delocalization over the ring dominates in many comparisons.",
  "Methyl carbocation is always most stable.",
  "Primary carbocations are most stable.",
  "Neither is ever observed.",
  "Benzyl cation is resonance-stabilized; tert-butyl relies on hyperconjugation (exam emphasis varies).",
);
add(
  "goc_stereo",
  "numerical",
  "Hybridization of C atoms left to right: \\(CH_2=C=CH-CH_3\\)?",
  "\\(sp^2,\\ sp,\\ sp^2,\\ sp^3\\)",
  "\\(sp,\\ sp,\\ sp^2,\\ sp^3\\)",
  "\\(sp^3\\) throughout",
  "\\(sp^2\\) throughout",
  "Cumulative double bond at middle carbon is \\(sp\\)-hybridized.",
);
add(
  "goc_stereo",
  "conceptual",
  "Fundamental requirement for optical activity?",
  "Chirality — molecule non-superimposable on its mirror image (no improper symmetry in practice).",
  "Presence of oxygen only.",
  "Must be a polymer.",
  "Must absorb UV light.",
  "Needs asymmetric environment for polarized light interaction.",
);
add(
  "goc_stereo",
  "numerical",
  "Pure enantiomer \\([\\alpha] = +20^\\circ\\). Mixture shows \\([\\alpha] = +5^\\circ\\). Enantiomeric excess (ee) and %(+) enantiomer?",
  "ee \\(\\approx 25\\%\\), \\((+) \\approx 62.5\\%\\)",
  "ee \\(= 75\\%\\), \\((+) = 87.5\\%\\)",
  "ee \\(= 0\\%\\)",
  "ee \\(= 100\\%\\)",
  "ee = observed/specific of pure enantiomer; remainder racemic splits equally.",
);
add(
  "goc_stereo",
  "conceptual",
  "Why does \\(S_N2\\) proceed with inversion at the electrophilic carbon?",
  "Backside nucleophilic attack \\(180^\\circ\\) to the leaving group inverts the tetrahedron.",
  "Front-side attack is mandatory.",
  "Carbocation planarity causes racemization only.",
  "Solvent always forces retention.",
  "Walden inversion from concerted mechanism.",
);
add(
  "goc_stereo",
  "numerical",
  "Naphthalene (\\(C_{10}H_8\\)): count of \\(\\sigma\\) and \\(\\pi\\) bonds?",
  "\\(19\\ \\sigma\\), \\(5\\ \\pi\\)",
  "\\(10\\ \\sigma\\), \\(10\\ \\pi\\)",
  "\\(18\\ \\sigma\\), \\(6\\ \\pi\\)",
  "\\(20\\ \\sigma\\), \\(4\\ \\pi\\)",
  "Fused aromatic framework: 8 C–H \\(\\sigma\\), 11 C–C \\(\\sigma\\), 5 aromatic \\(\\pi\\) bonds.",
);
add(
  "goc_stereo",
  "conceptual",
  "Stronger base: pyrrole or pyridine?",
  "Pyridine — lone pair in \\(sp^2\\) hybrid orbital is localized and available for protonation.",
  "Pyrrole — lone pair is on nitrogen in all cases free.",
  "They are equally basic in water.",
  "Neither accepts protons.",
  "In pyrrole, lone pair participates in \\(6\\pi\\) aromaticity and is less basic.",
);
add(
  "goc_stereo",
  "numerical",
  "Absolute configuration at the chiral center of **D-glyceraldehyde** (Fischer projection, standard assignment)?",
  "\\(R\\)",
  "\\(S\\)",
  "\\(E\\)",
  "\\(Z\\)",
  "Priorities OH > CHO > CH2OH > H; D-configuration with H on horizontal gives \\(R\\) after CIP rules.",
);

// Block 6: Hydrocarbons & halides (51–60)
add(
  "hydrocarbons",
  "conceptual",
  "Why does hydroboration–oxidation of alkenes give an **anti-Markovnikov** alcohol?",
  "BH\\(_2\\) adds to the less hindered carbon; sterics and partial charges in a cyclic transition state place B on the less substituted C; oxidation replaces B with OH.",
  "B always adds to the more substituted carbon.",
  "Markovnikov rule applies unchanged.",
  "Only terminal alkynes react.",
  "Syn addition followed by retention of stereochemistry at C–B then C–OH.",
);
add(
  "hydrocarbons",
  "numerical",
  "An unknown alkene ozonolysis gives 1 mol acetone and 1 mol acetaldehyde only. IUPAC name?",
  "**2-methylbut-2-ene** (\\(2\\)-methylbut-2-ene)",
  "But-1-ene",
  "2-methylbut-1-ene only",
  "Pent-2-ene",
  "Combine carbonyl fragments to rebuild the double bond.",
);
add(
  "hydrocarbons",
  "conceptual",
  "EAS: halogens are ortho/para directors yet deactivating — why?",
  "+\\(M\\) resonance donation stabilizes \\(\\sigma\\)-complex at ortho/para; \\(-I\\) withdraws overall electron density (deactivating).",
  "Halogens meta-direct only.",
  "Resonance never occurs for halogens.",
  "They are strong activators.",
  "Competition between inductive withdrawal and lone-pair donation.",
);
add(
  "hydrocarbons",
  "numerical",
  "1-bromobutane + bulky \\(t\\)-BuOK — major elimination product?",
  "**1-butene** (Hofmann / less substituted alkene)",
  "2-butene only",
  "Butane",
  "Isobutene from rearrangement always",
  "Bulky base abstracts the least hindered \\(\\beta\\)-H in \\(E2\\).",
);
add(
  "hydrocarbons",
  "conceptual",
  "Why are terminal alkynes weakly acidic toward strong bases (e.g. \\(NaNH_2\\)) but alkenes are not?",
  "The \\(sp\\)-hybridized C–H bond stabilizes the conjugate acetylide (high s-character).",
  "\\(sp^3\\) C–H is more acidic always.",
  "Alkynes have no acidic hydrogens.",
  "Only aromatic C–H is acidic.",
  "Greater electronegativity of \\(sp\\) carbon stabilizes carbanion.",
);
add(
  "hydrocarbons",
  "numerical",
  "Moles of \\(H_2\\) needed to fully hydrogenate 1 mol benzene to cyclohexane?",
  "\\(3\\ \\mathrm{mol}\\)",
  "\\(1\\ \\mathrm{mol}\\)",
  "\\(6\\ \\mathrm{mol}\\)",
  "\\(2\\ \\mathrm{mol}\\)",
  "Three \\(\\pi\\) bonds in the aromatic ring.",
);
add(
  "hydrocarbons",
  "conceptual",
  "Wurtz reaction with two **different** alkyl halides is impractical for odd-carbon alkanes because…",
  "You get a mixture of \\(R-R\\), \\(R'-R'\\), and \\(R-R'\\) that is hard to separate.",
  "Odd alkanes cannot form.",
  "Sodium does not react.",
  "Only aromatic products form.",
  "Statistical coupling gives three products with similar properties.",
);
add(
  "hydrocarbons",
  "numerical",
  "1-butene + HBr in presence of **peroxide** — major product?",
  "**1-bromobutane** (anti-Markovnikov / radical pathway)",
  "2-bromobutane only",
  "Butanol",
  "Butane",
  "Peroxide initiates free-radical addition; Br\\(^\\cdot\\) adds to less substituted carbon first.",
);
add(
  "hydrocarbons",
  "conceptual",
  "Why does \\(S_N1\\) at a chiral center often give racemization (or partial racemization)?",
  "Planar \\(sp^2\\) carbocation allows attack from either face with similar probability.",
  "Inversion is mandatory.",
  "No intermediate forms.",
  "Solvent excludes the nucleophile.",
  "Loss of stereochemical information at the flat cation.",
);
add(
  "hydrocarbons",
  "numerical",
  "Industrial Dow process: chlorobenzene to phenol with aqueous NaOH — typical conditions cited?",
  "\\(\\approx 623\\ \\mathrm{K}\\), \\(\\approx 300\\ \\mathrm{atm}\\) (high \\(T,P\\))",
  "\\(298\\ \\mathrm{K}\\), \\(1\\ \\mathrm{atm}\\)",
  "\\(373\\ \\mathrm{K}\\) only",
  "Room temperature, catalyst only",
  "Strong C–Cl bond + aromatic stabilization require forcing conditions for nucleophilic substitution.",
);

// Block 7: O-, N-containing organics (61–70)
add(
  "orgo_on",
  "conceptual",
  "Why are phenols more acidic than simple aliphatic alcohols?",
  "Phenoxide is resonance-stabilized by delocalization into the aromatic ring.",
  "Phenols have stronger O–H bonds only numerically.",
  "Aliphatic alkoxides are more resonance-stabilized.",
  "pH is unrelated to structure.",
  "Charge delocalization lowers energy of the conjugate base.",
);
add(
  "orgo_on",
  "numerical",
  "Acetaldehyde + dilute NaOH, then heat — final major product?",
  "**Crotonaldehyde** (but-2-enal, \\(\\alpha,\\beta\\)-unsaturated aldehyde)",
  "Ethanol only",
  "Acetic acid only",
  "3-hydroxybutanal only with no dehydration",
  "Aldol then dehydration on heating.",
);
add(
  "orgo_on",
  "conceptual",
  "Gabriel synthesis: why is it unsuitable for preparing **primary aromatic** amines from aryl halides?",
  "Aryl halides do not undergo facile \\(S_N2\\) backside attack on the ring carbon.",
  "Aromatic amines are too basic for Gabriel.",
  "Phthalimide only reacts with tertiary halides.",
  "It only makes quaternary salts.",
  "Need aliphatic \\(S_N2\\)-active substrate.",
);
add(
  "orgo_on",
  "numerical",
  "Phenol + \\(CHCl_3\\) + aqueous NaOH at \\(\\sim 340\\ \\mathrm{K}\\) (Reimer–Tiemann) — major product?",
  "**Salicylaldehyde** (2-hydroxybenzaldehyde)",
  "Benzoic acid",
  "Anisole",
  "p-Hydroxybenzaldehyde only",
  "Dichlorocarbene ortho-formylation of phenoxide.",
);
add(
  "orgo_on",
  "conceptual",
  "Why do carboxylic acids often **not** show simple carbonyl addition reactions like some aldehydes/ketones (e.g. typical DNP test behavior)?",
  "Resonance with OH reduces electrophilicity of the carbonyl carbon.",
  "The carbonyl is non-planar always.",
  "Carboxylic acids lack a carbonyl group.",
  "DNP only reacts with acids.",
  "Acyl carbon is less electrophilic due to \\(RC(OH)=O\\leftrightarrow RC(O^-)=OH^+\\) type resonance.",
);
add(
  "orgo_on",
  "numerical",
  "\\(C_3H_9N\\) + benzenesulfonyl chloride → solid **insoluble in alkali**. Classification?",
  "**Secondary amine** (e.g. \\(N\\)-methylethanamine pattern)",
  "Primary amine",
  "Tertiary amine",
  "Quaternary ammonium salt",
  "Hinsberg: secondary sulfonamide has no acidic N–H on sulfonamide to deprotonate in base.",
);
add(
  "orgo_on",
  "conceptual",
  "Esterification RCOOH + R'OH: which oxygen of the **water** formed comes from the acid?",
  "The acid’s hydroxyl is lost as water; the alcohol oxygen stays in the ester (classic mechanism).",
  "Always from the alcohol OH.",
  "Half from each randomly.",
  "From the catalyst only.",
  "Nucleophilic acyl substitution pathway.",
);
add(
  "orgo_on",
  "numerical",
  "Benzamide + \\(Br_2\\) + conc. aqueous KOH — product?",
  "**Aniline** (Hofmann bromamide degradation)",
  "Benzoic acid",
  "Bromobenzene",
  "Phenyl isocyanate only",
  "Loses the carbonyl carbon as \\(CO_2/\\)carbonate; chain shortened by one to \\(ArNH_2\\).",
);
add(
  "orgo_on",
  "conceptual",
  "Why is \\(Cl_3CCOOH\\) stronger than \\(CH_3COOH\\) but weaker than \\(CF_3COOH\\)?",
  "Inductive order: F withdraws electron density more strongly than Cl, better stabilizing the carboxylate.",
  "Chlorine is more electronegative than fluorine.",
  "Size alone decides; no inductive effect.",
  "All trihalomethyl acids have identical \\(pK_a\\).",
  "\\(-I\\) effect scales with electronegativity.",
);
add(
  "orgo_on",
  "numerical",
  "Acetone + \\(CH_3MgBr\\), then \\(H_3O^+\\) — product IUPAC?",
  "**2-methylpropan-2-ol** (tert-butyl alcohol)",
  "Propan-2-ol only",
  "Butanal",
  "2-methylbutan-2-ol",
  "Grignard adds to ketone → tertiary alcohol after workup.",
);

// Block 8: Coordination & metallurgy (71–80)
add(
  "coordination",
  "conceptual",
  "CFT: why do strong-field ligands like \\(CN^-\\) favor **low-spin** in many \\(d^4\\)–\\(d^7\\) octahedral complexes?",
  "Large \\(\\Delta_o\\) makes pairing in \\(t_{2g}\\) cheaper than promoting electrons to \\(e_g\\) when \\(\\Delta_o > P\\).",
  "They always shrink the metal ion radius only.",
  "They remove all \\(d\\) electrons.",
  "Low spin only occurs in tetrahedral complexes.",
  "Crystal-field splitting exceeds electron pairing energy.",
);
add(
  "coordination",
  "numerical",
  "Spin-only magnetic moment of \\([Fe(CN)_6]^{3-}\\) (strong field, low spin \\(d^5\\))?",
  "\\(\\approx 1.73\\ \\mathrm{BM}\\)",
  "\\(5.92\\ \\mathrm{BM}\\)",
  "\\(0\\ \\mathrm{BM}\\)",
  "\\(4.90\\ \\mathrm{BM}\\)",
  "One unpaired electron: \\(\\mu = \\sqrt{n(n+2)}\\ \\mathrm{BM}\\).",
);
add(
  "coordination",
  "conceptual",
  "Hall–Héroult: why add cryolite (\\(Na_3AlF_6\\)) to alumina?",
  "Lowers melting point and improves melt conductivity for practical electrolysis.",
  "Removes iron impurities only.",
  "Prevents aluminum from conducting.",
  "Increases melting point above \\(2000^\\circ\\mathrm{C}\\).",
  "Solvent flux for \\(Al_2O_3\\) dissolution at \\(\\sim 950^\\circ\\mathrm{C}\\).",
);
add(
  "coordination",
  "numerical",
  "EAN of Co in \\([Co(NH_3)_6]^{3+}\\) (\\(Z_{\\mathrm{Co}} = 27\\)) using \\(Z - \\mathrm{OS} + 2 \\times \\mathrm{CN}\\)?",
  "\\(36\\) (Kr-like count)",
  "\\(33\\)",
  "\\(30\\)",
  "\\(27\\)",
  "\\(27 - 3 + 12 = 36\\).",
);
add(
  "coordination",
  "conceptual",
  "Linkage isomerism requires what kind of ligand?",
  "**Ambidentate** ligand (two different donor atoms possible, e.g. \\(SCN^-\\) vs \\(NCS^-\\)).",
  "Only monodentate halides",
  "Only water",
  "Only chelating diamines",
  "Same formula but different atom bound to metal.",
);
add(
  "coordination",
  "numerical",
  "IUPAC name of \\(K_3[Fe(C_2O_4)_3]\\)?",
  "**Potassium trioxalatoferrate(III)**",
  "Potassium iron(III) oxalate without charge balance",
  "Iron(II) trioxalate",
  "Potassium hexacyanoferrate(III)",
  "Oxalate is bidentate; anionic complex uses -ate suffix; oxidation state +3.",
);
add(
  "coordination",
  "conceptual",
  "Mond process: why is volatile \\(Ni(CO)_4\\) formation useful?",
  "Separates Ni as vapor from solid impurities, then thermal decomposition gives pure Ni and regenerates CO.",
  "It increases Ni melting point.",
  "It only removes sulfur.",
  "CO is consumed irreversibly only.",
  "Volatility enables purification cycle.",
);
add(
  "coordination",
  "numerical",
  "\\([NiCl_4]^{2-}\\) (\\(Ni^{2+}\\), weak-field \\(Cl^-\\)): central-atom hybridization and geometry?",
  "\\(sp^3\\), tetrahedral",
  "\\(dsp^2\\), square planar",
  "\\(sp^2\\), trigonal",
  "\\(d^2sp^3\\), octahedral",
  "\\(Ni^{2+}\\) \\(3d^8\\) with weak field: tetrahedral \\(sp^3\\) common for four chloride ligands.",
);
add(
  "coordination",
  "conceptual",
  "Why do many \\(d\\)-block complexes have intense colours?",
  "\\(d\\)-\\(d\\) transitions (and sometimes CT) absorb visible wavelengths; complementary colour transmitted.",
  "They reflect all wavelengths equally.",
  "Colour arises only from \\(f\\)-electrons.",
  "Ligands never absorb light.",
  "Crystal-field / Laporte-related transitions in visible region.",
);
add(
  "coordination",
  "numerical",
  "Roasting galena: balanced conversion of \\(PbS\\) to \\(PbO\\) with \\(O_2\\)?",
  "\\(2PbS + 3O_2 \\rightarrow 2PbO + 2SO_2\\)",
  "\\(PbS + O_2 \\rightarrow Pb + SO_2\\)",
  "\\(PbS + 2O_2 \\rightarrow PbSO_4\\) only",
  "\\(PbS \\rightarrow Pb + S\\)",
  "Sulfide roasted to oxide with \\(SO_2\\) release.",
);

// Block 9: p-, d-, f-block (81–90)
add(
  "p_d_f_block",
  "conceptual",
  "Why is \\(I_1(\\mathrm{N}) > I_1(\\mathrm{O})\\) despite lower \\(Z\\) for N?",
  "Half-filled \\(2p^3\\) subshell on N is unusually stable; removing an electron from O gives a half-filled \\(p^3\\) configuration (easier).",
  "Oxygen has smaller atomic radius always in every table.",
  "Ionization energy increases down a group only.",
  "N has more protons than O.",
  "Extra stability of exactly half-filled \\(p\\) shell for N.",
);
add(
  "p_d_f_block",
  "numerical",
  "Oxidation state of P in hypophosphorous acid \\(H_3PO_2\\)?",
  "\\(+1\\)",
  "\\(+3\\)",
  "\\(+5\\)",
  "\\(-3\\)",
  "One P=O, two P–H, one P–OH style counting: \\(3 + x - 4 = 0 \\Rightarrow x = +1\\).",
);
add(
  "p_d_f_block",
  "conceptual",
  "Why are many \\(Ln^{2+}\\) ions strong **reducing** agents?",
  "They tend to lose an electron to reach the very stable \\(+3\\) lanthanide state.",
  "They want to gain electrons to \\(+4\\) always.",
  "\\(+2\\) is always the most stable for all lanthanides.",
  "They oxidize water to \\(O_2\\) instantly only.",
  "Thermodynamic drive toward dominant +3 oxidation state.",
);
add(
  "p_d_f_block",
  "numerical",
  "\\(XeF_4\\): molecular geometry and lone pairs on Xe?",
  "**Square planar**, **2** lone pairs on Xe",
  "Tetrahedral, 0 lone pairs",
  "Octahedral, 0 lone pairs",
  "T-shaped, 1 lone pair",
  "\\(AX_4E_2\\); lone pairs axial on octahedral electron geometry → square planar molecular shape.",
);
add(
  "p_d_f_block",
  "conceptual",
  "Why is \\(PCl_5\\) known but \\(NCl_5\\) is not a stable analogue?",
  "N (period 2) lacks low-energy \\(d\\) orbitals for octet expansion; P uses \\(3d\\) to accommodate five bonds.",
  "Nitrogen is less electronegative.",
  "\\(NCl_5\\) is more stable than \\(PCl_5\\).",
  "Chlorine does not bond to group 15.",
  "Valence shell expansion for third period and below.",
);
add(
  "p_d_f_block",
  "numerical",
  "Oleum (fuming sulfuric acid) formula from \\(SO_3\\) in concentrated \\(H_2SO_4\\)?",
  "\\(H_2S_2O_7\\)",
  "\\(H_2SO_5\\) only",
  "\\(SO_3\\) alone",
  "\\(H_2S_3O_{10}\\) only",
  "\\(H_2SO_4 + SO_3 \\rightarrow H_2S_2O_7\\).",
);
add(
  "p_d_f_block",
  "conceptual",
  "Why do transition metals show many oxidation states but alkali metals almost never do?",
  "\\(ns\\) and \\((n-1)d\\) energies are close, so variable \\(d\\) electron loss/participation is possible.",
  "\\(d\\)-block has lower nuclear charge always.",
  "s-block has more \\(d\\) electrons.",
  "Only f-block shows variable oxidation states.",
  "Similar energies of valence \\(s\\) and penultimate \\(d\\) subshells.",
);
add(
  "p_d_f_block",
  "numerical",
  "Unpaired electrons in free \\(Mn^{2+}\\) ion (ground state)?",
  "\\(5\\)",
  "\\(3\\)",
  "\\(0\\)",
  "\\(2\\)",
  "\\([Ar]\\,3d^5\\) after losing \\(4s^2\\); Hund’s rule → five parallel spins.",
);
add(
  "p_d_f_block",
  "conceptual",
  "Why is \\(HI\\) a stronger acid than \\(HF\\) in water (despite F being most electronegative)?",
  "Weaker H–X bond (HI) ionizes more readily; bond enthalpy dominates over charge density arguments here.",
  "\\(HF\\) has weaker bond than \\(HI\\).",
  "Electronegativity is irrelevant for any acid strength.",
  "\\(HF\\) never donates protons.",
  "Bond strength trend in hydrogen halides.",
);
add(
  "p_d_f_block",
  "numerical",
  "Basicity of orthophosphoric acid \\(H_3PO_4\\) (donatable protons on oxygens)?",
  "**Tribasic** (3)",
  "Monobasic",
  "Dibasic",
  "Tetrabasic",
  "Three acidic –OH protons on tetrahedral phosphorus oxoacid.",
);

// Block 10: Biomolecules, polymers, practical (91–100)
add(
  "bio_polymers",
  "conceptual",
  "Protein denaturation: why is the **primary** structure (sequence) usually unchanged?",
  "Peptide (amide) bonds are strong covalent links; denaturation disrupts non-covalent folding and some labile bridges, not the sequence.",
  "Heat always hydrolyzes all peptide bonds instantly.",
  "Primary structure means only disulfide bonds.",
  "Denaturation always cleaves the chain randomly.",
  "1° structure = amino acid order via covalent peptide bonds.",
);
add(
  "bio_polymers",
  "numerical",
  "Sucrose is built from which two monosaccharide units (specific anomeric linkage partners)?",
  "\\(\\alpha\\)-D-glucose and \\(\\beta\\)-D-fructose (\\(1\\leftrightarrow2\\) glycosidic bond)",
  "Two glucose only",
  "Galactose and glucose only",
  "Fructose and fructose",
  "Non-reducing disaccharide: glucose + fructose at anomeric carbons.",
);
add(
  "bio_polymers",
  "conceptual",
  "Fundamental difference: thermoplastic vs thermosetting polymer?",
  "Thermosets have a cross-linked 3D covalent network; thermoplastics are largely linear/branched chains that can flow when heated.",
  "Thermoplastics always have more cross-links.",
  "Thermosets melt before flowing always.",
  "Only molecular mass differs.",
  "Reversibility of melting vs permanent network.",
);
add(
  "bio_polymers",
  "numerical",
  "Nylon-6,6: how many **carbon atoms per monomer** in adipic acid and in hexamethylenediamine?",
  "**6** carbons in adipic acid and **6** carbons in hexamethylenediamine (the ‘6,6’)",
  "4 and 8",
  "6 and 8",
  "10 and 6",
  "Adipic: \\(\\mathrm{HOOC}(CH_2)_4\\mathrm{COOH}\\); diamine: \\(\\mathrm{H_2N}(CH_2)_6\\mathrm{NH_2}\\) — each contributes six carbons in standard monomer counting for the name.",
);
add(
  "bio_polymers",
  "conceptual",
  "Vitamin C vs Vitamin D regarding **dietary necessity** (typical human biology)?",
  "Vitamin C must be ingested regularly (water-soluble, not stored well); vitamin D can be synthesized in skin with UV exposure (fat-soluble storage also helps).",
  "Both are synthesized in large amounts in the liver daily.",
  "Neither is ever required from food.",
  "Vitamin D is water-soluble and excreted daily.",
  "Solubility, storage, and endogenous synthesis differ.",
);
add(
  "bio_polymers",
  "numerical",
  "Isoelectric point \\(pI\\) for a simple amino acid with \\(pK_{a1}(COOH) = 2.3\\) and \\(pK_{a2}(NH_3^+) = 9.7\\)?",
  "\\(6.0\\)",
  "\\(4.0\\)",
  "\\(12.0\\)",
  "\\(7.4\\)",
  "\\(pI = (pK_{a1} + pK_{a2})/2\\) for neutral side chain.",
);
add(
  "bio_polymers",
  "conceptual",
  "DNA: why A pairs with T and G with C (beyond ‘complementarity’)?",
  "Purine–pyrimidine pairing keeps helix diameter constant; A–T forms two H-bonds, G–C forms three, matching geometric constraints.",
  "Any base can pair with any base equally well.",
  "Size matching is irrelevant.",
  "Only ionic bonds matter.",
  "Hydrogen-bond pattern + steric fit in the double helix.",
);
add(
  "bio_polymers",
  "numerical",
  "Ziegler–Natta HDPE catalyst: two classic components?",
  "\\(TiCl_4\\) and triethylaluminum (e.g. \\(Al(C_2H_5)_3\\))",
  "\\(Ni(CO)_4\\) and \\(H_2SO_4\\)",
  "\\(Pt\\) and \\(H_2\\)",
  "\\(Fe\\) and \\(CuSO_4\\)",
  "Organometallic co-catalyst + transition-metal halide for coordinated polymerization.",
);
add(
  "bio_polymers",
  "conceptual",
  "What is an **analgesic**, and how do non-narcotic vs narcotic types differ in broad terms?",
  "Analgesics reduce pain; non-narcotics (e.g. NSAIDs) often act peripherally/anti-inflammatory, narcotics (e.g. morphine) act centrally with addiction risk.",
  "Analgesics cause unconsciousness always.",
  "Only antibiotics are analgesics.",
  "Narcotic and non-narcotic are identical mechanisms.",
  "Pain relief without general anesthesia by definition for simple analgesia.",
);
add(
  "bio_polymers",
  "numerical",
  "Saccharin: identity / common description as artificial sweetener?",
  "**Ortho-sulphobenzimide** derivative; \\(\\sim\\) hundreds-fold sweeter than sucrose; essentially non-caloric (poorly metabolized)",
  "A disaccharide of glucose",
  "Identical to sucrose",
  "A protein sweetener only",
  "Sulfonamide aromatic sweetener discovered in coal-tar chemistry era.",
);

if (Q.length !== 100) {
  console.error("Expected 100 questions, got", Q.length);
  process.exit(1);
}

const lines = [];
lines.push(`-- PUC 1/2 Chemistry (JEE/NEET style): 100 items, alternating conceptual / numerical.`);
lines.push(`-- academic / chemistry; pack: ${PACK}`);
lines.push(`-- Generated by scripts/build-academic-chemistry-puc100-migration.mjs`);
lines.push("");
lines.push("BEGIN;");
lines.push("");
lines.push("DELETE FROM public.play_questions");
lines.push("WHERE domain = 'academic'");
lines.push("  AND category = 'chemistry'");
lines.push(`  AND (content->>'pack') = '${PACK}';`);
lines.push("");
lines.push(
  "INSERT INTO public.play_questions (domain, category, difficulty_rating, content, options, correct_answer_index, explanation)",
);
lines.push("VALUES");

const values = Q.map((q, idx) => {
  const rating = 1380 + Math.floor((idx * 62) / 10);
  const content = JSON.stringify({
    text: q.s,
    pack: PACK,
    qtype: q.t,
    block: q.b,
  });
  const options = JSON.stringify(q.o);
  const tag = `k${String(idx + 1).padStart(3, "0")}`;
  return `  ('academic', 'chemistry', ${rating}, $${tag}c$${content}$${tag}c$::jsonb, $${tag}o$${options}$${tag}o$::jsonb, 0, $${tag}e$${q.e}$${tag}e$)`;
});

lines.push(values.join(",\n") + ";");
lines.push("");
lines.push("COMMIT;");
lines.push("");

const out = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260430342000_play_academic_chemistry_puc100_jee_neet.sql",
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);
