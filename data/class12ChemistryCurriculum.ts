import type { ExamType } from '@/types';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { CurriculumUnit, CurriculumChapter, CurriculumTopic } from '@/data/class12PhysicsCurriculum';

const RAW_CLASS12_CHEMISTRY_CURRICULUM = `
UNIT 1 - SOLUTIONS

Ch: SOLUTIONS

Topic: Molarity (M)
M = moles of solute / volume of solution in litres
Changes with temperature (volume changes); most common in lab
Units: mol L-1 or mol dm-3

Topic: Molality (m)
m = moles of solute / mass of solvent in kg
Independent of temperature (mass does not change)
Used for colligative properties calculations

Topic: Mole Fraction & Other Units
Mole fraction: chi_A = n_A / (n_A + n_B); chi_A + chi_B = 1
Mass percentage (w/w), volume percentage (v/v), mass/volume (w/v)
Parts per million (ppm): used for very dilute solutions and pollutants in water/air

Topic: Solubility of Gases - Henry's Law
Henry's Law: p = K_H x chi (partial pressure of gas proportional to mole fraction in solution)
K_H is Henry's law constant; different for each gas-solvent pair
Higher temperature -> lower solubility of gas (endothermic dissolution); fish need cold water
Applications: deep-sea diving (bends disease), carbonated drinks, oxygen in blood

Topic: Solubility of Solids in Liquids
Generally increases with temperature (endothermic process); exception: Ca(OH)_2
Like dissolves like: polar solutes in polar solvents; non-polar in non-polar

Topic: Raoult's Law
For volatile solute: p_A = chi_A x p degrees _A (partial pressure = mole fraction x vapour pressure of pure)
Total pressure: p_total = p degrees _A chi_A + p degrees _B chi_B (Dalton's law + Raoult's law)
Raoult's law for non-volatile solute: p_solution = chi_solvent x p degrees _solvent

Topic: Ideal vs Non-Ideal Solutions
Ideal solution: DeltaH_mix = 0; DeltaV_mix = 0; obeys Raoult's law at all concentrations; e.g. benzene+toluene
Positive deviation: A-B < A-A and B-B interactions; p > Raoult; DeltaH_mix > 0; e.g. ethanol + water
Negative deviation: A-B > A-A and B-B; p < Raoult; DeltaH_mix < 0; e.g. acetone + chloroform (H-bond)
Azeotropes: constant boiling mixtures; minimum boiling (positive dev.) and maximum boiling (negative dev.)

Topic: Relative Lowering of Vapour Pressure
Deltap/p degrees = chi_solute = n_solute / (n_solute + n_solvent)
Used to find molar mass of solute: M_solute = (w x p degrees ) / (Deltap x W/M_solvent)

Topic: Elevation of Boiling Point
DeltaT_b = K_b x m (K_b = ebullioscopic constant, characteristic of solvent)
K_b for water = 0.52 K kg mol-1; K_b for benzene = 2.53
M = (1000 x K_b x w_solute) / (DeltaT_b x W_solvent) [formula for molar mass]

Topic: Depression of Freezing Point
DeltaT_f = K_f x m (K_f = cryoscopic constant)
K_f for water = 1.86 K kg mol-1; benzene = 5.12; most important for molar mass determination
Application: antifreeze (ethylene glycol in car radiators), salting of roads in winter

Topic: Osmotic Pressure
Osmosis: solvent flows from dilute to concentrated through semi-permeable membrane
pi = CRT = (n/V)RT (Van't Hoff equation for dilute solutions)
Isotonic solutions: same osmotic pressure (e.g. normal saline = 0.9% NaCl)
Reverse osmosis: applied pressure > osmotic pressure -> water flows from concentrated to dilute (RO purifier)

Topic: Van't Hoff Factor (i)
i = observed colligative property / calculated value for non-electrolyte
i = total moles of particles in solution / moles of solute dissolved
Dissociation (i > 1): e.g. NaCl (i -> 2), MgCl_2 (i -> 3), K_2SO_4 (i -> 3)
Association (i < 1): e.g. benzoic acid in benzene dimerises -> i -> 0.5; acetic acid in benzene
Modified colligative property: DeltaT_b = i K_b m; DeltaT_f = i K_f m; pi = iCRT

UNIT 2 - ELECTROCHEMISTRY

Ch: ELECTROCHEMISTRY

Topic: Galvanic Cell
Converts chemical energy to electrical energy; spontaneous redox reaction
Daniel cell: Zn | ZnSO_4 || CuSO_4 | Cu; Zn oxidised (anode -); Cu^2+ reduced (cathode +)
Cell notation: anode | anode electrolyte || cathode electrolyte | cathode
Standard electrode potential: potential measured vs SHE (E degrees = 0 by convention); at 298 K, 1 M, 1 atm
Electrochemical series: metals with lower E degrees (more negative) are stronger reducing agents

Topic: EMF and Gibbs Energy
E degrees _cell = E degrees _cathode - E degrees _anode (reduction potential of cathode minus anode)
DeltaG = -nFE_cell (n = number of electrons transferred; F = 96500 C mol-1)
DeltaG degrees = -nFE degrees _cell; DeltaG degrees = -RT ln K -> log K = nE degrees /0.0592 (at 298 K)

Topic: Equation and Applications
E_cell = E degrees _cell - (RT/nF) ln Q (Q = reaction quotient)
At 298 K: E_cell = E degrees _cell - (0.0592/n) log Q
For Daniel cell: E = E degrees - (0.0592/2) log [Zn^2+]/[Cu^2+]
Concentration cell: both electrodes same material; different concentrations; E driven by concentration difference

Topic: Specific and Molar Conductance
Resistance R = rho(l/A); conductance G = 1/R
Specific conductance = G x l/A = G x cell constant (unit: S cm-1 or S m-1)
Molar conductance Lambda_m = kappa x 1000/C (C in mol L-1; Lambda_m in S cm^2 mol-1)
Strong electrolytes: Lambda_m increases with dilution (Debye-Huckel-Onsager equation: Lambda_m = Lambda degrees _m - b sqrt C)
Weak electrolytes: large increase in Lambda_m at high dilution (degree of dissociation increases)

Topic: Kohlrausch's Law
Lambda degrees _m = Sigma nu+ lambda degrees + + Sigma nu- lambda degrees - (sum of limiting molar conductivities of individual ions)
Use: finding Lambda degrees _m of weak electrolyte (e.g. acetic acid) indirectly
Degree of dissociation alpha = Lambda_m / Lambda degrees _m; K_a = C alpha^2/(1-alpha)

Topic: Faraday's Laws
First law: mass of substance deposited/liberated proportional to quantity of charge Q = It
m = ZIt = Eit/F (Z = electrochemical equivalent; E = equivalent mass; F = 96500 C)
Second law: when same charge passes through different electrolytes, mass proportional to equivalent mass
Products: at cathode (reduction): metal deposited or H_2 evolved; at anode (oxidation): nonmetal evolved or anode dissolves

Topic: Primary and Secondary Cells
Dry cell (Leclanche): Zn anode, MnO_2/C cathode, NH_4Cl paste electrolyte; ~1.5 V; non-rechargeable
Lithium-MnO_2 cell: Li anode, MnO_2 cathode; ~3 V; used in watches, cameras
Lead storage battery: Pb anode, PbO_2 cathode, H_2SO_4 electrolyte; ~2 V/cell (12 V for 6 cells); rechargeable
Nickel-Cadmium cell: rechargeable; used in portable electronics

Topic: Fuel Cells & Corrosion
H_2-O_2 fuel cell: H_2 oxidised at anode (KOH electrolyte); O_2 reduced at cathode; byproduct is water
Advantages of fuel cells: high efficiency; continuous supply of fuel; eco-friendly
Corrosion: electrochemical process; Fe acts as anode (Fe -> Fe^2+ + 2e-); O_2/moisture at cathode
Prevention: painting/coating, galvanising (Zn coating), cathodic protection, alloying (stainless steel)

UNIT 3 - CHEMICAL KINETICS

Ch: CHEMICAL KINETICS

Topic: Expressing Rate
Average rate: Delta[concentration] / Deltat (use stoichiometric coefficients for different species)
Rate = -1/a x d[A]/dt = +1/b x d[B]/dt (for aA -> bB)
Instantaneous rate = slope of tangent on concentration-time graph at that instant
Factors affecting rate: concentration, temperature, catalyst, surface area, light (for some reactions)

Topic: Rate Law Expression
Rate = k[A]^m[B]^n (m, n = partial orders; m+n = overall order)
Order can be 0, 1, 2 or even fractional; determined experimentally (NOT from balanced equation)
Molecularity: number of species colliding in elementary step; always integer; CANNOT be zero or fractional
Units of k: (mol L-1)^(1-n) s-1 where n = overall order

Topic: Zero Order
[A]_t = [A]_0 - kt (linear decrease in concentration with time)
Half-life: t_1/2 = [A]_0/2k (depends on initial concentration)
Graph: [A] vs t -> straight line; slope = -k
Examples: enzyme-catalysed reactions at high substrate concentration; photochemical reactions

Topic: First Order
ln[A]_t = ln[A]_0 - kt OR [A]_t = [A]_0 e^(-kt)
k = (2.303/t) x log([A]_0/[A]_t)
Half-life: t_1/2 = 0.693/k (independent of initial concentration - key property!)
Graph: ln[A] vs t -> straight line; slope = -k; [A] vs t -> exponential decay
Examples: radioactive decay, hydrolysis of cane sugar, decomposition of N_2O_5

Topic: Arrhenius Equation
k = Ae^(-Ea/RT) (A = frequency/pre-exponential factor; Ea = activation energy; R = 8.314 J mol-1 K-1)
ln k = ln A - Ea/RT; log k = log A - Ea/2.303RT (linearised form)
log(k_2/k_1) = Ea/2.303R x (T_2 - T_1)/(T_1T_2) (to compare k at two temperatures)
Effect of catalyst: lowers Ea -> increases k exponentially

Topic: Collision Theory
Rate = p x Z_AB x e^(-Ea/RT) (p = steric factor; Z_AB = collision frequency)
Steric factor p < 1: not all collisions with enough energy lead to products (orientation needed)
Effective collision = collision with energy >= Ea AND correct orientation

UNIT 4 - d AND f BLOCK ELEMENTS

Ch: d AND f BLOCK ELEMENTS

Topic: Electronic Configuration
3d transition series: Sc (Z=21) to Zn (Z=30); configuration: [Ar] 3d^n 4s^2
Exceptions: Cr = [Ar] 3d^5 4s^1 (half-filled d stable); Cu = [Ar] 3d^10 4s^1 (fully-filled d stable)

Topic: Trends in Properties
Metallic character: all transition metals are metals; high melting/boiling points; high density
Ionization enthalpy: higher than s-block; increases across period (not smoothly due to d-electron repulsion)
Multiple oxidation states: 3d electrons available for bonding; Mn shows highest (+7); most common +2
Ionic radii: decrease across period (more nuclear charge); similar to 4d/5d due to lanthanide contraction
Colour: d-d transitions absorb visible light; colour = complementary to absorbed colour; e.g. Cu^2+ blue
Catalytic property: variable OS -> intermediate compounds; large surface area; Fe in Haber, V_2O_5 in contact
Magnetic properties: unpaired d-electrons -> paramagnetism; Mn^2+ (5 unpaired) most paramagnetic in 3d
Interstitial compounds: H, B, C, N fit in voids; increased hardness; e.g. steel (C in Fe)
Alloy formation: similar atomic sizes of transition metals; brass (Cu+Zn), bronze (Cu+Sn)

Topic: Potassium Dichromate (K_2Cr_2O_7)
Preparation: 4FeCr_2O_4 + 8Na_2CO_3 + 7O_2 -> 8Na_2CrO_4 + ...; acidify with H_2SO_4 -> dichromate
Structure: Cr in +6 OS; Cr_2O_7^2- has two tetrahedral CrO_4 sharing one oxygen
Oxidising reactions in acidic medium: Cr_2O_7^2- + 14H+ + 6e- -> 2Cr^3+ + 7H_2O
Oxidises: Fe^2+ -> Fe^3+; I- -> I_2; S^2- -> S; sulphite -> sulphate

Topic: Potassium Permanganate (KMnO_4)
Preparation: from pyrolusite ore MnO_2; electrolytic oxidation of MnO_4^2-
Mn in +7 OS; strong oxidising agent; intensely purple (dark violet)
In acidic medium: MnO_4- + 8H+ + 5e- -> Mn^2+ + 4H_2O (colourless; E degrees = +1.51 V)
In neutral/alkaline medium: MnO_4- + 2H_2O + 3e- -> MnO_2 + 4OH- (brown ppt)
Oxidises: oxalic acid, Fe^2+, I-, H_2O_2, NO_2-; used in volumetric analysis (self-indicator)

Topic: Lanthanides
4f inner transition series: La (Z=57) to Lu (Z=71); general configuration [Xe] 4f^(1-14) 5d^(0-1) 6s^2
Most stable OS = +3 (Ce shows +4; Eu and Yb show +2)
Lanthanide contraction: progressive decrease in atomic/ionic radii across series due to poor shielding by 4f electrons
Consequences of lanthanide contraction: Zr & Hf almost same size; difficult to separate lanthanides from each other

Topic: Actinides
5f inner transition series: Ac (Z=89) to Lr (Z=103); mostly radioactive; obtained synthetically
Higher oxidation states than lanthanides: U shows +3 to +6; most stable varies
Comparison with lanthanides: actinides have wider range of OS; more complex chemistry

UNIT 5 - COORDINATION COMPOUNDS

Ch: COORDINATION COMPOUNDS

Topic: Terminology
Central metal atom/ion: electron-pair acceptor (Lewis acid); e.g. Fe^2+ in [Fe(CN)_6]^4-
Ligands: electron-pair donors (Lewis bases); monodentate (Cl-, NH_3, H_2O, CN-, CO)
Bidentate ligands: en (ethylenediamine), ox^2- (oxalate), bipy (bipyridyl)
Polydentate (chelating): EDTA^4- (hexadentate); forms very stable chelates (chelate effect)
Ambidentate ligands: can bind through two different atoms; e.g. NO_2- (N or O); SCN- (S or N)
Coordination number: number of ligand atoms directly bonded to central metal; common: 2, 4, 6

Topic: Rules
Name cation first, then anion (for ionic complexes)
Within coordination sphere: ligands named first (alphabetical order), then metal
Anionic ligands end in -o: Cl- -> chlorido, CN- -> cyanido, OH- -> hydroxido, O^2- -> oxido
Neutral ligands use their names, exceptions: H_2O -> aqua, NH_3 -> ammine, CO -> carbonyl, NO -> nitrosyl
Number prefixes: di, tri, tetra, penta, hexa (or bis, tris, tetrakis for complex ligands)
Metal OS in Roman numerals in brackets after metal name; complex anion: metal name ends in -ate

Topic: Werner's Theory
Primary valence (oxidation state): ionisable; satisfied by anions
Secondary valence (coordination number): non-ionisable; satisfied by ligands; directional

Topic: Valence Bond Theory (VBT)
Metal ion uses hybrid orbitals to accept lone pairs from ligands
Hybridisation types: sp (linear), sp^3 (tetrahedral), sp^2 (trigonal planar), dsp^2 (square planar)
d^2sp^3 (inner orbital octahedral: uses 3d orbitals); sp^3d^2 (outer orbital octahedral: uses 4d orbitals)
Inner orbital complexes: low spin; more negative Delta_o; [Fe(CN)_6]^4- (d^2sp^3); paramagnetic determined by unpaired electrons
Limitation of VBT: cannot explain colour of complexes or explain spectra

Topic: Crystal Field Theory (CFT)
Ligands treated as point charges/dipoles; electrostatic interaction only
In octahedral field: d-orbitals split into t_2g (lower, d_xy, d_xz, d_yz) and e_g (higher, d_z^2, d_x^2-y^2)
Crystal field splitting energy Delta_o (10Dq); strong field ligands (CN-, CO, NO_2-) -> large Delta_o -> low spin
Weak field ligands (F-, Cl-, H_2O, OH-) -> small Delta_o -> high spin
Colour: Delta_o corresponds to visible light; complex absorbs complementary colour; e.g. [Ti(H_2O)_6]^3+ appears purple
Tetrahedral field: Delta_t = 4/9 Delta_o; usually high spin

Topic: Structural Isomerism
Ionisation isomerism: [Co(Br)(NH_3)_5]SO_4 and [Co(SO_4)(NH_3)_5]Br (different ions in solution)
Linkage isomerism: [Co(NO_2)(NH_3)_5]^2+ and [Co(ONO)(NH_3)_5]^2+ (different ligand atom bonded)
Solvate/hydrate isomerism: [CrCl_2(H_2O)_4]Cl.2H_2O vs [CrCl(H_2O)_5]Cl_2.H_2O

Topic: Stereoisomerism
Geometrical isomerism (cis-trans): in square planar [MA_2B_2] and octahedral [MA_4B_2] complexes
Optical isomerism: non-superimposable mirror images (enantiomers); tris(bidentate) octahedral complexes (fac/mer)
fac (facial): three identical ligands occupy adjacent face of octahedron
mer (meridional): three identical ligands in a plane through metal

Topic: Applications
Qualitative analysis: Ni^2+ with DMG (cherry red ppt); Cu^2+ with NH_3 (deep blue [Cu(NH_3)_4]^2+)
Extraction of metals: Ag and Au extracted using CN- ligand: 4Au + 8NaCN + 2H_2O + O_2 -> 4Na[Au(CN)_2] + 4NaOH
Haemoglobin: Fe^2+ complex in blood; transports O_2 (O_2 replaces H_2O as ligand)
Chlorophyll: Mg^2+ complex; photosynthesis; porphyrin ligand
Vitamin B_12: Co^3+ complex; essential for nerve function
EDTA used in treatment of lead poisoning (chelation therapy)

UNIT 6 - HALOALKANES AND HALOARENES

Ch: HALOALKANES AND HALOARENES

Topic: Classification & Nomenclature
Primary (1 degrees ): halogen on primary C; secondary (2 degrees ): on secondary C; tertiary (3 degrees ): on tertiary C
Allylic halide: halogen on C adjacent to C=C; benzylic: on C adjacent to benzene ring
IUPAC: halogen as prefix (fluoro, chloro, bromo, iodo); longest chain containing the C bearing halogen
Compounds: CH_3Cl (chloromethane), CH_2Cl_2 (dichloromethane), CHCl_3 (trichloromethane/chloroform), CCl_4

Topic: Nature of C-X Bond & Physical Properties
C-X bond is polar covalent (C^delta+-X^delta-); bond polarity decreases F > Cl > Br > I
Bond enthalpy decreases: C-F (485) > C-Cl (327) > C-Br (285) > C-I (213) kJ/mol
Boiling point order: RI > RBr > RCl > RF; increases with chain length and molecular mass
Density: higher than parent alkane; halogen atom is heavier
Insoluble in water; soluble in organic solvents; CCl_4 used as nonpolar solvent

Topic: Reactions of Haloalkanes
SN2 mechanism: bimolecular; backside attack by nucleophile; inversion of configuration (Walden inversion); favoured by 1 degrees alkyl halides
SN1 mechanism: unimolecular; carbocation intermediate; racemisation; favoured by 3 degrees alkyl halides
Optical activity: chirality; chiral carbon; enantiomers; racemic mixture (optically inactive)
Elimination (E2/E1): strong base causes elimination; alkene formed; Saytzeff's rule (more substituted alkene)
Wurtz reaction: 2RX + 2Na -> R-R + 2NaX (for symmetric alkanes)
Grignard reagent: RX + Mg -> RMgX (very important synthetic intermediate)

Topic: Reactions
C-X bond in haloarene has partial double bond character (resonance); C-X bond stronger than in haloalkanes
Electrophilic substitution: halogen is ortho-para director (lone pair donation) despite -I effect
Bromination: Br_2/FeBr_3; mono-substitution gives 1-bromo-2-chlorobenzene and 1-bromo-4-chlorobenzene
Nucleophilic substitution very difficult; requires drastic conditions (Dows process: NaOH 300 degrees C, 300 atm)

Topic: Environmental Impact
DDT: dichlorodiphenyltrichloroethane; persistent organic pollutant; bioaccumulation; banned
Freons (CFCs): CCl_2F_2; deplete ozone layer by releasing Cl radicals; Montreal Protocol (1987)
CHCl_3: used as anaesthetic historically; toxic; now avoided; oxidises to phosgene (COCl_2)

UNIT 7 - ALCOHOLS, PHENOLS AND ETHERS

Ch: ALCOHOLS, PHENOLS AND ETHERS

Topic: Preparation
Acid-catalysed hydration of alkenes: CH_2=CH_2 + H_2O -> C_2H_5OH (Markovnikov's rule for 2 degrees and 3 degrees alcohols)
Hydroboration-oxidation: anti-Markovnikov product; uses B_2H_6 then H_2O_2/OH-
From Grignard reagent + carbonyl compound: RMgX + HCHO -> 1 degrees alcohol; + RCHO -> 2 degrees ; + R_2CO -> 3 degrees
Reduction of aldehydes ( -> 1 degrees alcohol) and ketones ( -> 2 degrees alcohol) by NaBH_4 or LiAlH_4

Topic: Properties & Reactions
H-bonding: higher bp than alkanes/ethers of same MW; miscible with water for lower alcohols
Acidic character: pKa ~16-18; weaker acid than water (pKa 15.7) and phenol (pKa 10)
Reaction with Na: 2ROH + 2Na -> 2RONa + H_2 (sodium alkoxide); confirms -OH group
Lucas test: ZnCl_2/conc. HCl; 3 degrees alcohol -> immediate turbidity; 2 degrees -> slow; 1 degrees -> no reaction (at RT)
Oxidation: 1 degrees -> aldehyde (PCC) -> carboxylic acid (KMnO_4/K_2Cr_2O_7); 2 degrees -> ketone
Dehydration: intramolecular at 443 K (alkene, Saytzeff); intermolecular at 413 K (ether)
Methanol: industrial (CO + 2H_2 -> CH_3OH); used as fuel additive; toxic (causes blindness/death)
Ethanol: fermentation of sugars; denatured spirit (ethanol + methanol/pyridine); physiological depressant

Topic: Preparation & Acidity
From benzene sulphonate: C_6H_5SO_3Na + NaOH(fused) -> C_6H_5ONa; acidify -> phenol
From diazonium salt: C_6H_5N_2+ + H_2O -> C_6H_5OH + N_2 + H+
Cumene process: C_6H_5-CH(CH_3)_2 -> cumene hydroperoxide -> phenol + acetone (industrial)
Acidic character: pKa 10; much more acidic than alcohols (phenoxide ion stabilised by resonance)
Less acidic than carboxylic acids (pKa ~5) because -OH lone pair delocalised into ring

Topic: Reactions
Electrophilic substitution: -OH activates ring strongly (ortho/para director)
Bromination: Br_2(aq) -> 2,4,6-tribromophenol (white ppt; no catalyst needed); used as test for phenol
Nitration: dilute HNO_3 -> mixture of o and p-nitrophenol
Kolbe's reaction: with NaOH + CO_2 under pressure -> sodium salicylate -> aspirin
Reimer-Tiemann reaction: CHCl_3/NaOH -> salicylaldehyde (2-hydroxybenzaldehyde); used in perfumes

Topic: Preparation & Properties
Williamson's synthesis: R-ONa + R'-X -> R-O-R' + NaX (best method for mixed ethers; SN2 mechanism)
Industrial: dehydration of ethanol at 413 K: 2C_2H_5OH -> C_2H_5-O-C_2H_5 + H_2O
Physical: no H-bonding between ether molecules -> lower bp than corresponding alcohol
Soluble in organic solvents; slightly polar; good solvent for organic reactions
Cleavage by HI/HBr: R-O-R' + HI -> RI + R'OH (excess HI -> both become iodides)
Electrophilic substitution in anisole (methoxybenzene): -OCH_3 activates ring; ortho/para products

UNIT 8 - ALDEHYDES, KETONES AND CARBOXYLIC ACIDS

Ch: ALDEHYDES, KETONES AND CARBOXYLIC ACIDS

Topic: Methods
Oxidation of primary alcohol (1 degrees ) -> aldehyde (mild oxidant PCC or acidified K_2Cr_2O_7 with distillation)
Oxidation of secondary alcohol (2 degrees ) -> ketone (K_2Cr_2O_7/H+ or KMnO_4/H+)
Ozonolysis: alkene + O_3 then Zn/H_2O -> aldehyde or ketone depending on substitution
Stephen reaction: RCN + SnCl_2/HCl -> aldimine -> aldehyde (after hydrolysis; primary amines as by-product)
Etard reaction: toluene + CrO_2Cl_2 -> chromyl complex -> benzaldehyde (after hydrolysis)
Gattermann-Koch reaction: benzene + CO + HCl (AlCl_3) -> benzaldehyde
Friedel-Crafts acylation: benzene + R-COCl (AlCl_3) -> aryl ketone (acetophenone from CH_3COCl)

Topic: Nucleophilic Addition
Mechanism: Nu- attacks electrophilic C of C=O -> tetrahedral intermediate -> addition product
Aldehydes more reactive than ketones: less steric hindrance + electronic effect of alkyl groups
Addition of HCN: R-CHO + HCN -> cyanohydrin R-CH(OH)-CN (catalysed by base)
Addition of NaHSO_3: gives crystalline addition product; used to purify aldehydes and methyl ketones
Addition of NH_3 derivatives (H_2N-G): R-CHO + H_2N-G -> R-CH=N-G + H_2O (condensation)

Topic: Reduction
Clemmensen reduction: Zn-Hg amalgam/conc. HCl -> convert C=O to CH_2 (acidic conditions)
Wolff-Kishner reduction: H_2NNH_2/KOH/ethylene glycol -> CH_2 (basic conditions)
Reduction to alcohol: NaBH_4 (mild) or LiAlH_4 -> primary alcohol from aldehyde; secondary from ketone

Topic: Oxidation & Named Reactions
Tollens' test: [Ag(NH_3)_2]+ (Tollens' reagent) + aldehyde -> silver mirror (Ag deposited); ketones do NOT respond
Fehling's test: Cu^2+ (alkaline) + aldehyde -> brick red Cu_2O ppt; ketones do NOT respond
Aldol condensation: base-catalysed; 2CH_3CHO -> CH_3CH(OH)CH_2CHO (beta-hydroxy aldehyde)
Aldol condensation with heat -> dehydration -> alpha,beta-unsaturated carbonyl (crotonaldehyde)
Cannizzaro reaction: aldehydes without alpha-H (HCHO, C_6H_5CHO) undergo disproportionation with NaOH -> salt + alcohol
Cross Cannizzaro: HCHO (acts as reductant) + R-CHO -> R-CH_2OH + HCOONa

Topic: Preparation & Acidity
From primary alcohols/aldehydes: strong oxidation (KMnO_4/H+) -> RCOOH
From Grignard reagent + CO_2: RMgX + CO_2 -> RCOOMgX -> RCOOH (on hydrolysis)
From nitriles: RCN + H_2O (H+ or OH-) -> RCOOH + NH_3 (or NH_4+)
Acidic character: pKa 4-5; resonance stabilisation of RCOO- (carboxylate ion)
Effect of substituents on acidity: EWG (Cl, NO_2) increase acidity; EDG (CH_3) decrease acidity
Formic acid > acetic acid; chloroacetic > acetic > propanoic (inductive effect)

Topic: Chemical Properties
Salt formation: RCOOH + NaOH -> RCOONa + H_2O; with Na -> H_2 evolved
Acyl chloride formation: RCOOH + PCl_3 or SOCl_2 -> RCOCl + HCl (or SO_2+HCl); most reactive derivative
Esterification: RCOOH + R'OH RCOOR' + H_2O (acid catalyst; reversible; Fischer esterification)
Amide formation: RCOOH + NH_3 -> RCOONH_4 -> RCONH_2 + H_2O (heat)
Anhydride formation: 2RCOOH -> (RCO)_2O + H_2O (on strong heating; e.g. acetic anhydride)
Decarboxylation: RCOOH -> RH + CO_2 (for malonic acid derivatives easily; soda lime with NaOH at high T)

UNIT 9 - AMINES

Ch: AMINES

Topic: Types
Primary (1 degrees ): RNH_2 - one R on N; e.g. CH_3NH_2 (methanamine)
Secondary (2 degrees ): R_2NH - two R on N; e.g. (CH_3)_2NH (dimethylamine)
Tertiary (3 degrees ): R_3N - three R on N; e.g. (CH_3)_3N (trimethylamine)
Aliphatic vs aromatic amines (aniline C_6H_5NH_2); quaternary ammonium salt R_4N+X-

Topic: Methods
Reduction of nitro compounds: ArNO_2 + Fe/HCl -> ArNH_2 (or H_2/Pt catalyst; used industrially for aniline)
Reduction of amides: RCONH_2 + 4[H] (LiAlH_4) -> RCH_2NH_2 (primary amine with same C)
Gabriel phthalimide synthesis: phthalimide + KOH -> K-salt + R-X -> N-alkylphthalimide -> RNH_2 (hydrolysis)
Gabriel synthesis gives pure primary amine (no secondary/tertiary amine contamination)
Hoffmann bromamide degradation: RCONH_2 + Br_2/NaOH -> RNH_2 + CO_2 (amine has one less C than amide)

Topic: Physical Properties
Lower members (CH_3NH_2, etc.) are gases; smell like fish/ammonia; highly soluble in water
H-bonding: 1 degrees and 2 degrees amines form H-bonds; boiling points: 1 degrees > 2 degrees > 3 degrees (for same MW)
Basic character: lone pair on N; pKb of aliphatic amines ~3-4 (stronger base than NH_3)

Topic: Basicity Order
Gas phase: 3 degrees > 2 degrees > 1 degrees > NH_3 (more alkyl groups = more electron density on N)
Aqueous solution: 2 degrees > 1 degrees > 3 degrees > NH_3 > ArNH_2 (solvation effects)
Aromatic amines (aniline): lone pair delocalised into ring -> weaker base (pKb 9.4)
Electron withdrawing groups on ring decrease basicity; electron donating increase basicity of aniline

Topic: Chemical Reactions
Alkylation: RNH_2 + R'X -> mixture of 1 degrees , 2 degrees , 3 degrees amines and quaternary salt (not clean)
Acylation: RNH_2 + R'COCl -> R'CONHR + HCl (amide formed; Schotten-Baumann conditions)
Carbylamine reaction: 1 degrees amine + CHCl_3 + KOH -> isocyanide (RNC, carbylamine, foul smell); test for 1 degrees amine only
Reaction with HNO_2 (NaNO_2/HCl, 0-5 degrees C): 1 degrees aliphatic -> alkene/alcohol; 1 degrees aromatic -> diazonium salt
Reaction with HNO_2: 2 degrees amine -> N-nitrosamine (yellow oily liquid); 3 degrees amine -> salt (no reaction with HNO_2)

Topic: Preparation & Reactions
Diazotisation: ArNH_2 + NaNO_2 + HCl at 0-5 degrees C -> ArN_2+Cl- + 2H_2O (keep cold; unstable above 5 degrees C)
Sandmeyer's reaction: ArN_2+ + CuCl -> ArCl + N_2; ArN_2+ + CuBr -> ArBr; ArN_2+ + CuCN -> ArCN
Balz-Schiemann reaction: ArN_2+BF_4- -> ArF + N_2 + BF_3 (method to introduce F into ring)
Replacement by H: ArN_2+ + H_3PO_2 -> ArH + N_2 (hypophosphorous acid; deamination)
Coupling reaction: ArN_2+ + ArOH (or ArNH_2) -> Ar-N=N-Ar' (azo dye; orange-red colour; electrophilic substitution)

UNIT 10 - BIOMOLECULES

Ch: BIOMOLECULES

Topic: Classification & Structure
Monosaccharides: cannot be hydrolysed; glucose (aldohexose), fructose (ketohexose)
Oligosaccharides: 2-10 monosaccharides; disaccharides: sucrose, lactose, maltose
Polysaccharides: many monosaccharides; starch, cellulose, glycogen
Glucose open chain: C_6H_12O_6; polyhydroxyaldehyde; 4 chiral carbons; D(+)-glucose
Glucose cyclic form: haworth projection; alpha-D-glucose (OH on C1 down) and beta-D-glucose (OH up); mutarotation
Fructose open chain: polyhydroxyketone; C_2 is ketonic; forms 5-membered furanose ring

Topic: Important Carbohydrates
Reducing sugars: have free -CHO or -CO group; reduce Tollens' and Fehling's; glucose, fructose, lactose, maltose
Non-reducing sugar: sucrose (no free -CHO; 1,2-glycosidic bond between anomeric C atoms)
Sucrose: glucose(alpha-1) + fructose(beta-2); invertase -> invert sugar (equimolar glucose + fructose)
Lactose: glucose(beta-1,4) + galactose; beta-glycosidic bond; present in milk; fermented by bacteria
Maltose: glucose(alpha-1,4) + glucose; from starch hydrolysis by amylase
Starch: amylose (alpha-1,4; linear; soluble; turns blue-black with I_2) + amylopectin (alpha-1,4 and alpha-1,6; branched)
Cellulose: beta-1,4 glycosidic bonds; structural polysaccharide of plants; not digested by humans
Glycogen: animal starch; stored in liver and muscle; highly branched (alpha-1,4 + alpha-1,6)

Topic: Amino Acids & Peptide Bond
Amino acid structure: H_2N-CHR-COOH; R = side chain; ~20 natural alpha-amino acids
Essential amino acids (8): cannot be synthesized; must be obtained from diet (Val, Leu, Ile, Lys, Met, Phe, Thr, Trp)
Zwitterion: -NH_3+ and -COO- simultaneously (dipolar ion); exists in solid state and aqueous solution
Isoelectric point (pI): pH at which net charge = 0; amino acid least soluble at pI
Peptide bond: -CO-NH- formed between -COOH of one and -NH_2 of next amino acid by condensation (-H_2O)
Dipeptide (2 AA), tripeptide (3 AA) ... polypeptide (>10 AA) ... protein (>50 AA)

Topic: Protein Structure
Primary structure: sequence of amino acids; determined by genes; unique for each protein
Secondary structure: folding stabilised by H-bonds; alpha-helix (coiled; intramolecular H-bonds between CO and NH); beta-pleated sheet (intermolecular)
Tertiary structure: 3D overall folding; stabilised by disulfide bonds (-S-S-), H-bonds, van der Waals, hydrophobic interactions
Quaternary structure: association of two or more polypeptide chains; e.g. haemoglobin (4 chains)
Denaturation: disruption of secondary/tertiary/quaternary structure; primary structure unchanged; caused by heat, extremes of pH, chemicals; e.g. coagulation of egg white
Enzymes: biological catalysts; protein in nature; specificity (lock-and-key theory); active site; e.g. amylase (starch), pepsin (proteins)

Topic: Classification
Fat-soluble vitamins: A, D, E, K; stored in adipose tissue and liver; excess can be toxic
Vitamin A (retinol): vision (retinal is component of rhodopsin); deficiency: night blindness
Vitamin D (calciferol): Ca^2+ absorption; bone formation; deficiency: rickets (children), osteomalacia (adults)
Vitamin E (tocopherol): antioxidant; protects cell membranes
Vitamin K (phylloquinone): blood clotting; cofactor for carboxylation of clotting factors
Water-soluble vitamins: B-complex and C; excreted in urine; regular intake needed
Vitamin B_1 (thiamine): carbohydrate metabolism; deficiency: beriberi (nerve damage)
Vitamin B_2 (riboflavin): FAD precursor; deficiency: ariboflavinosis (sores, inflamed tongue)
Vitamin B_12 (cyanocobalamin): Co-containing vitamin; RBC formation; deficiency: pernicious anaemia
Vitamin C (ascorbic acid): antioxidant; collagen synthesis; deficiency: scurvy (bleeding gums, loose teeth)

Topic: Structure
Nucleotide = nitrogenous base + pentose sugar + phosphate group (linked by phosphodiester bonds)
Purines: adenine (A), guanine (G) - double ring
Pyrimidines: cytosine (C), thymine (T) in DNA; uracil (U) replaces T in RNA - single ring
DNA: deoxyribose (2'-deoxyribose) sugar; double helix; A-T (2 H-bonds), G-C (3 H-bonds)
DNA double helix: Watson-Crick model (1953); antiparallel strands; major and minor grooves
RNA: ribose sugar; single-stranded; bases A, U, G, C
mRNA (messenger): carries genetic info from DNA to ribosome
tRNA (transfer): carries specific amino acid to ribosome; clover-leaf structure; anticodon
rRNA (ribosomal): structural component of ribosome; most abundant RNA
`;

function parseClass12ChemistryCurriculum(raw: string): CurriculumUnit[] {
  const units: CurriculumUnit[] = [];
  let currentUnit: CurriculumUnit | null = null;
  let currentChapter: CurriculumChapter | null = null;
  let currentTopic: CurriculumTopic | null = null;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const unitMatch = line.match(/^UNIT\s+([IVXLC0-9]+)\s*-\s*(.+)$/i);
    if (unitMatch) {
      currentUnit = {
        unitLabel: `Unit ${unitMatch[1]}`,
        unitTitle: unitMatch[2].trim(),
        chapters: [],
      };
      units.push(currentUnit);
      currentChapter = null;
      currentTopic = null;
      continue;
    }

    const chapterMatch = line.match(/^Ch\s*\d*\s*:\s*(.+)$/i);
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

export const class12ChemistryUnits: CurriculumUnit[] =
  parseClass12ChemistryCurriculum(RAW_CLASS12_CHEMISTRY_CURRICULUM);

const CLASS_12_CHEMISTRY_EXAMS: ExamType[] = ['JEE', 'NEET', 'KCET'];

export const chemistry12DetailedTopicTaxonomy: TopicNode[] =
  class12ChemistryUnits.flatMap((unit) =>
    unit.chapters.flatMap((chapter) =>
      chapter.topics.map((topic) => ({
        subject: 'chemistry',
        classLevel: 12,
        topic: topic.title,
        chapterTitle: chapter.title,
        unitLabel: unit.unitLabel,
        unitTitle: unit.unitTitle,
        subtopics: topic.subtopics.map((name) => ({ name })),
        examRelevance: CLASS_12_CHEMISTRY_EXAMS,
      }))
    )
  );
