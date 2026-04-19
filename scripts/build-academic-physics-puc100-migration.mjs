/**
 * Generates supabase/migrations/*_play_academic_physics_puc100_jee_neet.sql
 * Run: node scripts/build-academic-physics-puc100-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK = "puc_physics_jee_neet_100";

/** @type {{ b: string; t: string; s: string; o: [string,string,string,string]; e: string }[]} */
const Q = [];

function add(b, t, s, correct, w1, w2, w3, e) {
  Q.push({ b, t, s, o: [correct, w1, w2, w3], e });
}

// --- Block 1: Kinematics and Laws of Motion (1–10) ---
add(
  "kinematics",
  "conceptual",
  "Why does a particle dropped from a satellite orbiting the Earth not fall straight down to the Earth's surface?",
  "It keeps the satellite’s tangential orbital speed (inertia) and continues in orbit alongside the satellite.",
  "Gravity stops acting on it the instant it is released.",
  "It has zero horizontal velocity, so it falls straight toward Earth’s centre.",
  "The satellite’s cabin air pushes it back into the satellite.",
  "The particle retains tangential orbital velocity; it shares the satellite’s orbit rather than falling radially.",
);
add(
  "kinematics",
  "numerical",
  "A block of mass \\(m\\) rests on a smooth wedge of mass \\(M\\) with inclination \\(\\theta\\). What horizontal force \\(F\\) on the wedge keeps the block stationary relative to the wedge?",
  "\\(F = (M+m)g\\tan\\theta\\)",
  "\\(F = Mg\\sin\\theta\\)",
  "\\(F = (M+m)g\\sin\\theta\\)",
  "\\(F = mg\\cos\\theta\\)",
  "Pseudo-force \\(ma\\) along the incline balances \\(mg\\sin\\theta\\) with \\(a = g\\tan\\theta\\); total mass \\((M+m)\\).",
);
add(
  "kinematics",
  "conceptual",
  "In a conical pendulum, is the string tension greater than, equal to, or strictly less than the weight of the bob?",
  "Strictly greater than \\(mg\\).",
  "Equal to \\(mg\\).",
  "Strictly less than \\(mg\\).",
  "Zero when the bob moves fastest.",
  "\\(T\\cos\\theta = mg\\) gives \\(T = mg/\\cos\\theta > mg\\) for \\(\\theta > 0\\).",
);
add(
  "kinematics",
  "numerical",
  "A block takes \\(n\\) times longer to slide down a rough incline (angle \\(\\theta\\), kinetic friction \\(\\mu\\)) than down a smooth incline of the same angle and length. Find \\(\\mu\\).",
  "\\(\\mu = \\tan\\theta\\,(1 - 1/n^2)\\)",
  "\\(\\mu = \\tan\\theta\\,(1 - 1/n)\\)",
  "\\(\\mu = \\cot\\theta\\,(1 - 1/n^2)\\)",
  "\\(\\mu = \\tan\\theta / n^2\\)",
  "\\(t \\propto 1/\\sqrt{a}\\); \\(a_{\\text{smooth}} = g\\sin\\theta\\), \\(a_{\\text{rough}} = g(\\sin\\theta - \\mu\\cos\\theta)\\); ratio yields the result.",
);
add(
  "kinematics",
  "conceptual",
  "Can a body be in translational equilibrium while not in rotational equilibrium?",
  "Yes — net force can be zero while net torque is non-zero (e.g. a couple).",
  "No — equilibrium always requires both translational and rotational balance.",
  "Only if the body is a single point mass.",
  "Only in non-inertial frames.",
  "Two equal and opposite parallel forces give zero net force but non-zero torque.",
);
add(
  "kinematics",
  "numerical",
  "A variable force \\(F = kx^2\\) acts on a particle. Total work from \\(x=0\\) to \\(x=A\\)?",
  "\\(kA^3/3\\)",
  "\\(kA^2/2\\)",
  "\\(kA^3\\)",
  "\\(kA/3\\)",
  "\\(W = \\int_0^A kx^2\\,dx = kA^3/3\\).",
);
add(
  "kinematics",
  "conceptual",
  "Does the coefficient of static friction depend on the macroscopic contact area between two rigid bodies (standard model)?",
  "No — it depends on materials and normal force, not apparent area.",
  "Yes — larger area always increases \\(\\mu_s\\).",
  "Yes — it is inversely proportional to contact area.",
  "Only for rolling, not sliding.",
  "Amontons’ model: \\(\\mu_s\\) is material/normal-force dependent, not nominal area.",
);
add(
  "kinematics",
  "numerical",
  "Rain falls vertically at \\(4\\ \\mathrm{m/s}\\). A man runs horizontally at \\(3\\ \\mathrm{m/s}\\). At what angle from the vertical should he tilt the umbrella to block drops (relative to him)?",
  "\\(\\tan^{-1}(3/4)\\) (about \\(36.9^\\circ\\))",
  "\\(\\tan^{-1}(4/3)\\)",
  "\\(\\sin^{-1}(3/5)\\) from the horizontal only",
  "\\(45^\\circ\\) always",
  "Relative velocity of rain w.r.t. man has horizontal \\(3\\) and downward \\(4\\); \\(\\tan\\phi = 3/4\\) from vertical.",
);
add(
  "kinematics",
  "conceptual",
  "For a projectile launched at angle \\(\\theta\\), where along the trajectory is its speed an absolute minimum?",
  "At the highest point (apex).",
  "At the launch point.",
  "At impact with the ground.",
  "Midway horizontally only.",
  "Vertical component is zero at apex; horizontal \\(v\\cos\\theta\\) remains — minimum speed.",
);
add(
  "kinematics",
  "numerical",
  "Two masses \\(m_1 > m_2\\) on a massless string over a smooth pulley (Atwood machine). Downward acceleration of the centre of mass?",
  "\\(\\bigl(\\frac{m_1-m_2}{m_1+m_2}\\bigr)^2 g\\)",
  "\\(\\frac{m_1-m_2}{m_1+m_2}\\,g\\)",
  "\\(\\frac{m_1+m_2}{m_1-m_2}\\,g\\)",
  "\\(g/2\\) always",
  "Each mass accelerates at \\(a = g(m_1-m_2)/(m_1+m_2)\\); \\(a_{\\mathrm{cm}} = (m_1 a - m_2 a)/(m_1+m_2)\\).",
);

// --- Block 2: Work, Energy, Power & Circular Motion (11–20) ---
add(
  "work_energy",
  "conceptual",
  "If the net kinetic energy of a multi-particle system is exactly zero, is the total momentum necessarily zero?",
  "Yes — every particle has zero speed, so total momentum is zero.",
  "No — momentum can be non-zero while \\(K=0\\).",
  "Only for two particles.",
  "Only in the centre-of-mass frame.",
  "\\(K\\) is a sum of non-negative terms; \\(K=0\\) implies each \\(v_i=0\\).",
);
add(
  "work_energy",
  "numerical",
  "A particle on a rigid string of length \\(L\\): minimum horizontal speed at the lowest point to complete a vertical circle without the string going slack?",
  "\\(\\sqrt{5gL}\\)",
  "\\(\\sqrt{gL}\\)",
  "\\(\\sqrt{2gL}\\)",
  "\\(\\sqrt{3gL}\\)",
  "Top requires \\(v_{\\mathrm{top}} \\ge \\sqrt{gL}\\); energy from bottom gives \\(\\sqrt{5gL}\\).",
);
add(
  "work_energy",
  "conceptual",
  "Does kinetic friction always decrease the kinetic energy of the body it acts on?",
  "No — friction opposes relative motion; on an accelerating belt it can increase the block’s kinetic energy.",
  "Yes — friction always removes mechanical energy.",
  "Yes — unless the surface is frictionless.",
  "Only for static friction, never kinetic.",
  "Example: friction forward on a block on an accelerating truck increases its \\(K\\).",
);
add(
  "work_energy",
  "numerical",
  "A car of mass \\(m\\) starts from rest with engine delivering constant power \\(P\\). Velocity as a function of time \\(t\\)?",
  "\\(v = \\sqrt{2Pt/m}\\)",
  "\\(v = Pt/m\\)",
  "\\(v = \\sqrt{Pt/(2m)}\\)",
  "\\(v = P^2 t^2/m\\)",
  "\\(W = Pt = \\tfrac12 mv^2\\) from rest.",
);
add(
  "work_energy",
  "conceptual",
  "In uniform circular motion, work done by the centripetal force over half a revolution?",
  "Zero.",
  "\\(\\pi r F\\).",
  "\\(2\\pi r F\\).",
  "\\(Fr\\).",
  "Centripetal force is perpendicular to each displacement element; \\(W=0\\).",
);
add(
  "work_energy",
  "numerical",
  "A spring constant \\(k\\) is cut into three equal pieces. Spring constant of one piece?",
  "\\(3k\\)",
  "\\(k/3\\)",
  "\\(k\\)",
  "\\(9k\\)",
  "\\(k \\propto 1/L\\); length \\(\\to L/3\\) gives stiffness \\(\\times 3\\).",
);
add(
  "work_energy",
  "conceptual",
  "Why are mountain roads banked inward on sharp curves?",
  "The normal force’s horizontal component helps provide centripetal acceleration, reducing reliance on friction alone.",
  "Banking increases weight along the slope only.",
  "To increase rolling friction deliberately.",
  "To make vehicles accelerate uphill.",
  "Banked turn: \\(N\\sin\\theta\\) contributes to \\(mv^2/r\\).",
);
add(
  "work_energy",
  "numerical",
  "A ball dropped from height \\(h\\); coefficient of restitution \\(e\\). Total vertical distance travelled before rest?",
  "\\(h\\,(1+e^2)/(1-e^2)\\)",
  "\\(h/(1-e)\\)",
  "\\(h(1+e)/(1-e)\\)",
  "\\(2h/(1-e^2)\\)",
  "Sum of bounce heights forms a geometric series.",
);
add(
  "work_energy",
  "conceptual",
  "Can gravitational or electrostatic potential energy of a bound system be negative?",
  "Yes — potential energy is defined up to a constant; attractive forces often use negative values.",
  "No — energy cannot be negative.",
  "Only for unbound systems.",
  "Only at absolute zero.",
  "Negative \\(U\\) means energy must be supplied to separate the parts to infinity.",
);
add(
  "work_energy",
  "numerical",
  "Particle in a circle of radius \\(R\\) with constant tangential acceleration \\(a_t = k\\). Time when \\(|a_c| = |a_t|\\) (\\(a_c\\) centripetal)?",
  "\\(t = \\sqrt{R/k}\\)",
  "\\(t = R/k\\)",
  "\\(t = \\sqrt{k/R}\\)",
  "\\(t = kR\\)",
  "\\(v = kt\\), \\(a_c = v^2/R = k^2 t^2/R\\); set equal to \\(k\\).",
);

// --- Block 3: COM & Rotation (21–30) ---
add(
  "rotation",
  "conceptual",
  "Two solid spheres, same mass, same \\(\\omega\\): one aluminum, one lead. Which has higher rotational kinetic energy?",
  "Aluminum — lower density ⇒ larger radius for same \\(m\\) ⇒ larger \\(I\\) ⇒ larger \\(K_{\\mathrm{rot}}\\).",
  "Lead — denser means higher \\(K_{\\mathrm{rot}}\\).",
  "They are always equal if \\(m,\\omega\\) match.",
  "Depends only on colour of paint.",
  "\\(I = \\frac{2}{5}mR^2\\); larger \\(R\\) for Al at fixed \\(m\\).",
);
add(
  "rotation",
  "numerical",
  "Moment of inertia of a solid cylinder (mass \\(M\\), radius \\(R\\), length \\(L\\)) about an axis through the centre, perpendicular to the symmetry axis?",
  "\\(M(R^2/4 + L^2/12)\\)",
  "\\(\\tfrac12 MR^2\\) only",
  "\\(ML^2/12\\) only",
  "\\(M(R^2 + L^2)\\)",
  "Perpendicular-axis / parallel-axis composition for a solid cylinder.",
);
add(
  "rotation",
  "conceptual",
  "An ice skater pulls arms inward while spinning on ice. What quantity stays conserved (ideal, no external torque)?",
  "Angular momentum \\(L\\).",
  "Rotational kinetic energy.",
  "Moment of inertia alone.",
  "Linear momentum only.",
  "\\(L = I\\omega\\); \\(I\\) decreases ⇒ \\(\\omega\\) increases.",
);
add(
  "rotation",
  "numerical",
  "Solid sphere vs hollow spherical shell, same \\(m,R\\), roll without slipping down the same incline. Ratio of linear accelerations \\(a_{\\mathrm{solid}}/a_{\\mathrm{hollow}}\\)?",
  "\\(25/21\\)",
  "\\(21/25\\)",
  "\\(5/7\\)",
  "\\(1\\)",
  "\\(a = g\\sin\\theta/(1+k^2/R^2)\\); \\(2/5\\) vs \\(2/3\\) for \\(k^2/R^2\\).",
);
add(
  "rotation",
  "conceptual",
  "Physical meaning of radius of gyration \\(k\\)?",
  "Distance from axis at which the entire mass could be concentrated to give the same \\(I\\).",
  "The radius of the trajectory in circular motion.",
  "The distance from CM to the geometric centre always.",
  "The lever arm of friction only.",
  "\\(I = Mk^2\\) defines \\(k\\).",
);
add(
  "rotation",
  "numerical",
  "Uniform rod length \\(L\\), mass \\(M\\), pivoted at one end, released horizontally. Initial angular acceleration?",
  "\\(3g/(2L)\\)",
  "\\(g/L\\)",
  "\\(2g/L\\)",
  "\\(g/(2L)\\)",
  "\\(\\tau = MgL/2\\), \\(I = ML^2/3\\), \\(\\alpha = \\tau/I\\).",
);
add(
  "rotation",
  "conceptual",
  "Does the angular velocity vector point along the direction the rim is moving?",
  "No — it lies along the rotation axis (right-hand rule), not along tangential motion.",
  "Yes — it is tangent to the circle.",
  "Yes — it points toward the centre.",
  "Only for clockwise rotation.",
  "\\(\\vec\\omega\\) is axial; velocity is tangential.",
);
add(
  "rotation",
  "numerical",
  "Uniform solid disc rolls without slipping. Ratio \\(K_{\\mathrm{rot}}/K_{\\mathrm{total}}\\)?",
  "\\(1/3\\)",
  "\\(1/2\\)",
  "\\(2/5\\)",
  "\\(1/4\\)",
  "\\(K_{\\mathrm{rot}} = \\tfrac14 Mv^2\\), \\(K_{\\mathrm{tot}} = \\tfrac34 Mv^2\\).",
);
add(
  "rotation",
  "conceptual",
  "Can the centre of mass of a rigid body lie outside the material of the body?",
  "Yes — e.g. uniform ring or horseshoe: CM in the hollow region.",
  "Never — CM must always be inside the bulk.",
  "Only for gases, not solids.",
  "Only if the body is charged.",
  "CM is a mass-weighted average; geometry can enclose empty space.",
);
add(
  "rotation",
  "numerical",
  "\\(\\vec\\tau = \\vec r \\times \\vec F\\). Given \\(\\vec r = 2\\hat i + \\hat j\\), \\(\\vec F = \\hat i - \\hat k\\), find \\(\\vec\\tau\\).",
  "\\(-\\hat i + 2\\hat j - \\hat k\\)",
  "\\(\\hat i + 2\\hat j + \\hat k\\)",
  "\\(2\\hat i - \\hat j + \\hat k\\)",
  "\\(\\vec 0\\)",
  "Expand the determinant for the cross product.",
);

// --- Block 4: Gravitation & SHM (31–40) ---
add(
  "gravitation_shm",
  "conceptual",
  "According to the shell theorem, what is gravitational field at the exact centre of a uniform spherical Earth model?",
  "Exactly zero by symmetry.",
  "Infinite.",
  "Same as at the surface.",
  "Maximum in magnitude.",
  "Interior shells contribute cancelling fields at the centre.",
);
add(
  "gravitation_shm",
  "numerical",
  "Escape speed from Earth is \\(v_e\\). Escape speed from a planet with twice Earth’s mass and twice Earth’s radius?",
  "\\(v_e\\) (unchanged)",
  "\\(\\sqrt{2}\\,v_e\\)",
  "\\(v_e/\\sqrt{2}\\)",
  "\\(2v_e\\)",
  "\\(v \\propto \\sqrt{M/R}\\); doubling both leaves \\(\\sqrt{M/R}\\) the same.",
);
add(
  "gravitation_shm",
  "conceptual",
  "Kepler’s second law (constant areal velocity) follows from conservation of which quantity for a planet in a central gravitational field?",
  "Angular momentum.",
  "Linear momentum.",
  "Mechanical energy alone.",
  "Areal velocity itself as a fundamental quantity.",
  "Zero torque from central force ⇒ \\(L\\) constant.",
);
add(
  "gravitation_shm",
  "numerical",
  "SHM amplitude \\(A\\). Distance from mean position where \\(K = U\\)?",
  "\\(A/\\sqrt{2}\\)",
  "\\(A/2\\)",
  "\\(A/\\sqrt{3}\\)",
  "\\(A\\)",
  "Equate \\(\\tfrac12 k(A^2-x^2) = \\tfrac12 kx^2\\).",
);
add(
  "gravitation_shm",
  "conceptual",
  "In damped harmonic motion, what happens to amplitude as \\(t \\to \\infty\\)?",
  "It decays (typically exponentially) toward zero.",
  "It grows without bound.",
  "It stays exactly constant.",
  "It oscillates between 0 and \\(2A\\).",
  "Dissipation removes energy from the oscillator.",
);
add(
  "gravitation_shm",
  "numerical",
  "Point masses \\(m\\) and \\(4m\\) separated by \\(r\\). Distance from the smaller mass \\(m\\) where net gravitational field is zero?",
  "\\(r/3\\)",
  "\\(r/5\\)",
  "\\(r/2\\)",
  "\\(2r/5\\)",
  "Set \\(Gm/x^2 = G(4m)/(r-x)^2\\) ⇒ \\(x = r/3\\) between them.",
);
add(
  "gravitation_shm",
  "conceptual",
  "Why is apparent weight slightly less at the equator than at the poles (same altitude model)?",
  "Centrifugal (inertial) effect of Earth’s rotation and larger equatorial radius (bulge).",
  "Gravity is weaker because the equator is colder.",
  "Air is thinner at the equator only.",
  "Coriolis force directly reduces scale reading at rest.",
  "Smaller effective \\(g\\) at equator: rotation and distance from centre.",
);
add(
  "gravitation_shm",
  "numerical",
  "In SHM, \\(v_{\\max}\\) and \\(a_{\\max}\\) are given. Amplitude \\(A\\)?",
  "\\(v_{\\max}^2/a_{\\max}\\)",
  "\\(a_{\\max}/v_{\\max}\\)",
  "\\(v_{\\max}/a_{\\max}\\)",
  "\\(a_{\\max} v_{\\max}\\)",
  "\\(v_{\\max} = A\\omega\\), \\(a_{\\max} = A\\omega^2\\) ⇒ \\(A = v_{\\max}^2/a_{\\max}\\).",
);
add(
  "gravitation_shm",
  "conceptual",
  "Does the period of a simple pendulum (small oscillations) depend on the bob’s mass?",
  "No — \\(T = 2\\pi\\sqrt{L/g}\\) for ideal simple pendulum.",
  "Yes — heavier bobs swing slower.",
  "Yes — period is proportional to mass.",
  "Only if the string has mass.",
  "Mass cancels in the equation of motion for point bob.",
);
add(
  "gravitation_shm",
  "numerical",
  "Low circular orbit skimming Earth’s surface (ignore drag). Orbital period in terms of \\(R\\) and \\(g\\)?",
  "\\(2\\pi\\sqrt{R/g}\\) (≈ 84.6 min for Earth)",
  "\\(2\\pi\\sqrt{g/R}\\)",
  "\\(\\pi\\sqrt{R/g}\\)",
  "\\(2\\pi R/g\\)",
  "\\(v = \\sqrt{gR}\\), circumference \\(2\\pi R\\).",
);

// --- Block 5: Fluids & properties of matter (41–50) ---
add(
  "fluids",
  "conceptual",
  "Why do raindrops approach a constant terminal speed instead of accelerating at \\(g\\) indefinitely?",
  "Drag (viscous/air resistance) balances weight at terminal velocity.",
  "Gravity switches off after a few seconds.",
  "Raindrops lose mass as they fall.",
  "Buoyancy exactly cancels gravity for all drops.",
  "Net force goes to zero when drag equals weight.",
);
add(
  "fluids",
  "numerical",
  "Two soap bubbles radii \\(R_1, R_2\\) coalesce isothermally in vacuum. Radius of new bubble?",
  "\\(\\sqrt{R_1^2 + R_2^2}\\)",
  "\\(R_1 + R_2\\)",
  "\\(\\sqrt[3]{R_1^3 + R_2^3}\\) only (pressure ignored)",
  "\\(\\sqrt{R_1 R_2}\\)",
  "For isothermal coalescence with \\(PV \\propto R^2\\) for bubbles, \\(R^2 = R_1^2 + R_2^2\\).",
);
add(
  "fluids",
  "conceptual",
  "Bernoulli along a horizontal streamline: if speed increases, what happens to pressure?",
  "Pressure decreases.",
  "Pressure increases.",
  "Pressure is unchanged.",
  "Pressure oscillates sinusoidally.",
  "Higher kinetic energy density ⇒ lower pressure for fixed height.",
);
add(
  "fluids",
  "numerical",
  "Water in a horizontal pipe: ratio of cross-sectional areas at two points is \\(1:2\\). Ratio of speeds \\(v_1:v_2\\)?",
  "\\(2:1\\)",
  "\\(1:2\\)",
  "\\(1:1\\)",
  "\\(4:1\\)",
  "Continuity: \\(A_1 v_1 = A_2 v_2\\).",
);
add(
  "fluids",
  "conceptual",
  "What defines a perfectly elastic body in elasticity theory?",
  "It fully recovers its original shape and size immediately when the load is removed.",
  "It never returns to original shape.",
  "It flows like a liquid.",
  "It only stretches, never compresses.",
  "Perfect elasticity: no permanent set.",
);
add(
  "fluids",
  "numerical",
  "Wire length \\(L\\), radius \\(r\\), extends by \\(l\\) under a force. Same material: length \\(2L\\), radius \\(2r\\), same force. Extension?",
  "\\(l/2\\)",
  "\\(l\\)",
  "\\(2l\\)",
  "\\(l/4\\)",
  "\\(\\Delta L \\propto L/A \\propto L/r^2\\); doubling \\(L\\) and \\(r\\) gives factor \\(2/4\\).",
);
add(
  "fluids",
  "conceptual",
  "Why is mercury preferred over water in a simple barometer for atmospheric pressure?",
  "Much higher density — shorter column for the same pressure.",
  "Mercury is cheaper than water.",
  "Water cannot support vacuum above it.",
  "Mercury is non-toxic (opposite is true — still practical column height).",
  "\\(h \\propto 1/\\rho\\); Hg column ~760 mm vs ~10 m water.",
);
add(
  "fluids",
  "numerical",
  "Wood floats in water with \\(2/3\\) of its volume submerged. Density of wood if \\(\\rho_{\\text{water}} = 1000\\ \\mathrm{kg/m^3}\\)?",
  "About \\(667\\ \\mathrm{kg/m^3}\\)",
  "\\(1500\\ \\mathrm{kg/m^3}\\)",
  "\\(333\\ \\mathrm{kg/m^3}\\)",
  "\\(1000\\ \\mathrm{kg/m^3}\\)",
  "\\(\\rho_{\\text{wood}} V g = \\rho_w (2V/3) g\\).",
);
add(
  "fluids",
  "conceptual",
  "Effect of increasing temperature on surface tension of a typical pure liquid?",
  "Surface tension decreases.",
  "Surface tension increases linearly without bound.",
  "Surface tension is unchanged.",
  "It always becomes zero at \\(100^\\circ\\mathrm{C}\\).",
  "Higher \\(T\\) weakens cohesive forces.",
);
add(
  "fluids",
  "numerical",
  "Small sphere terminal speed \\(v\\) in a viscous fluid (Stokes regime). Same material, radius doubled to \\(2r\\). New terminal speed?",
  "\\(4v\\)",
  "\\(2v\\)",
  "\\(v\\)",
  "\\(8v\\)",
  "For Stokes-type scaling, \\(v_t \\propto r^2\\) for given density difference.",
);

// --- Block 6: Thermodynamics (51–60) ---
add(
  "thermo",
  "conceptual",
  "Can a system absorb heat without its temperature changing?",
  "Yes — during phase change or in an isothermal process where energy goes to work/internal rearrangement.",
  "Never — \\(Q\\) always raises \\(T\\).",
  "Only for insulators.",
  "Only if volume is zero.",
  "Latent heat and isothermal ideal gas are standard examples.",
);
add(
  "thermo",
  "numerical",
  "Carnot engine: hot reservoir \\(400\\ \\mathrm{K}\\), cold sink \\(300\\ \\mathrm{K}\\). Maximum efficiency?",
  "\\(25\\%\\)",
  "\\(75\\%\\)",
  "\\(33\\%\\)",
  "\\(12.5\\%\\)",
  "\\(\\eta = 1 - T_C/T_H = 1 - 3/4\\).",
);
add(
  "thermo",
  "conceptual",
  "Why is \\(C_p > C_v\\) for an ideal gas?",
  "At constant pressure the gas can expand and do work, so more heat is needed for the same \\(\\Delta T\\).",
  "Because pressure is always larger than volume.",
  "Because \\(C_p\\) counts rotational modes only.",
  "They are always equal for ideal gases.",
  "\\(C_p = C_v + R\\) for ideal gas.",
);
add(
  "thermo",
  "numerical",
  "Reversible adiabatic ideal gas: \\(PV^\\gamma = \\text{const}\\). Relation between \\(T\\) and \\(V\\)?",
  "\\(T V^{\\gamma-1} = \\text{constant}\\)",
  "\\(T V^{\\gamma} = \\text{constant}\\)",
  "\\(T/V = \\text{constant}\\)",
  "\\(TV = \\text{constant}\\)",
  "Eliminate \\(P\\) using \\(PV = nRT\\).",
);
add(
  "thermo",
  "conceptual",
  "In kinetic theory, absolute temperature of an ideal gas is proportional to what microscopic quantity?",
  "Average translational kinetic energy of molecules (\\(\\propto T\\)).",
  "Total volume only.",
  "Total number of collisions per second only.",
  "Molecular diameter cubed.",
  "\\(\\langle \\tfrac12 m v^2 \\rangle_{\\text{trans}} = \\tfrac32 kT\\) per molecule.",
);
add(
  "thermo",
  "numerical",
  "Rigid diatomic ideal gas at room temperature: \\(\\gamma = C_p/C_v\\)?",
  "\\(7/5 = 1.4\\)",
  "\\(5/3\\)",
  "\\(9/7\\)",
  "\\(4/3\\)",
  "5 active degrees of freedom at room \\(T\\) (3 trans + 2 rot).",
);
add(
  "thermo",
  "conceptual",
  "Can total entropy of an isolated system decrease over time?",
  "No — second law: \\(\\Delta S \\ge 0\\) for isolated systems.",
  "Yes — always in biological systems.",
  "Yes — for any cyclic process.",
  "Only if heat leaves the system.",
  "Entropy of isolated system never decreases.",
);
add(
  "thermo",
  "numerical",
  "Heat \\(Q\\) supplied to a monatomic ideal gas at constant volume. \\(\\Delta T\\)?",
  "\\(2Q/(3nR)\\)",
  "\\(Q/(nR)\\)",
  "\\(3Q/(2nR)\\)",
  "\\(Q/(2nR)\\)",
  "\\(Q = n C_v \\Delta T\\), \\(C_v = 3R/2\\).",
);
add(
  "thermo",
  "conceptual",
  "Net change in internal energy \\(\\Delta U\\) for one complete cycle of a closed thermodynamic system returning to the same state?",
  "\\(\\Delta U = 0\\).",
  "\\(\\Delta U > 0\\) always.",
  "Depends on path area only, not zero.",
  "\\(\\Delta U = Q\\) always.",
  "\\(U\\) is a state function.",
);
add(
  "thermo",
  "numerical",
  "Blackbody radiates power \\(P\\) at temperature \\(T\\). If temperature becomes \\(2T\\), new power?",
  "\\(16P\\)",
  "\\(2P\\)",
  "\\(8P\\)",
  "\\(4P\\)",
  "Stefan–Boltzmann: \\(P \\propto T^4\\).",
);

// --- Block 7: Electrostatics & capacitance (61–70) ---
add(
  "electrostatics",
  "conceptual",
  "Why can two distinct electric field lines of a static field not cross in vacuum?",
  "The tangent gives unique \\(\\vec E\\) direction; crossing would imply two directions at one point.",
  "They can cross where charge density is zero.",
  "Field lines are scalar quantities.",
  "Coulomb’s law forbids straight lines only.",
  "Uniqueness of the static field direction.",
);
add(
  "electrostatics",
  "numerical",
  "Dipole \\(+q\\) and \\(-q\\) separated by \\(2a\\). Magnitude of \\(\\vec E\\) at the midpoint?",
  "\\(2kq/a^2\\)",
  "\\(0\\)",
  "\\(kq/a^2\\)",
  "\\(kq/(4a^2)\\)",
  "Fields from both charges add along the dipole axis.",
);
add(
  "electrostatics",
  "conceptual",
  "Magnitude of \\(\\vec E\\) everywhere inside an empty cavity of a charged perfect conductor in electrostatic equilibrium?",
  "Zero.",
  "Uniform and non-zero.",
  "Infinite at the cavity centre.",
  "Same as just outside the surface.",
  "Conductors in electrostatic equilibrium: \\(E=0\\) in metal and cavity.",
);
add(
  "electrostatics",
  "numerical",
  "Three identical capacitors \\(C\\) in series. Equivalent capacitance?",
  "\\(C/3\\)",
  "\\(3C\\)",
  "\\(C\\)",
  "\\(C^3\\)",
  "\\(1/C_{\\mathrm{eq}} = 3/C\\).",
);
add(
  "electrostatics",
  "conceptual",
  "A charged isolated capacitor is disconnected, then a dielectric fills the gap. What happens to the potential difference?",
  "It decreases (\\(Q\\) fixed, \\(C\\) increases, \\(V=Q/C\\)).",
  "It increases.",
  "It stays exactly the same.",
  "It becomes zero instantly.",
  "Charge trapped; capacitance rises with \\(\\kappa\\).",
);
add(
  "electrostatics",
  "numerical",
  "Coulomb force between two point charges in vacuum is \\(F\\). If separation is halved, new force?",
  "\\(4F\\)",
  "\\(2F\\)",
  "\\(F/2\\)",
  "\\(F/4\\)",
  "\\(F \\propto 1/r^2\\).",
);
add(
  "electrostatics",
  "conceptual",
  "Gauss’s law: net electric flux through a closed surface depends on what?",
  "Only the total charge enclosed (divided by \\(\\varepsilon_0\\)).",
  "Charges outside the surface dominate.",
  "The surface shape only.",
  "The potential at each point on the surface.",
  "\\(\\oint \\vec E \\cdot d\\vec A = Q_{\\mathrm{enc}}/\\varepsilon_0\\).",
);
add(
  "electrostatics",
  "numerical",
  "Electron accelerated from rest through \\(100\\ \\mathrm{V}\\). Kinetic energy in eV?",
  "\\(100\\ \\mathrm{eV}\\)",
  "\\(1\\ \\mathrm{eV}\\)",
  "\\(200\\ \\mathrm{eV}\\)",
  "\\(50\\ \\mathrm{eV}\\)",
  "By definition \\(1\\ \\mathrm{eV}\\) per volt per elementary charge.",
);
add(
  "electrostatics",
  "conceptual",
  "Shape of equipotential surfaces in the field of an isolated point charge in free space?",
  "Concentric spheres.",
  "Parallel planes.",
  "Cylinders about an off-centre axis.",
  "Hyperboloids only.",
  "\\(V \\propto 1/r\\) ⇒ constant \\(V\\) on spheres.",
);
add(
  "electrostatics",
  "numerical",
  "Energy stored in a capacitor is \\(U\\). Charge doubled, capacitance unchanged. New energy?",
  "\\(4U\\)",
  "\\(2U\\)",
  "\\(U/2\\)",
  "\\(U\\)",
  "\\(U = Q^2/(2C)\\).",
);

// --- Block 8: Current & magnetism (71–80) ---
add(
  "magnetism",
  "conceptual",
  "Why does semiconductor resistance usually decrease as temperature increases (unlike metals)?",
  "More charge carriers are thermally generated across/near the gap.",
  "Electrons become heavier.",
  "Lattice vibrations decrease with \\(T\\).",
  "Ohm’s law breaks entirely.",
  "Carrier concentration rises strongly with \\(T\\).",
);
add(
  "magnetism",
  "numerical",
  "Cylindrical wire resistance \\(R\\). Stretched uniformly to twice its length (volume conserved). New resistance?",
  "\\(4R\\)",
  "\\(2R\\)",
  "\\(R/2\\)",
  "\\(R\\)",
  "\\(R \\propto L/A\\); \\(L\\to 2L\\), \\(A\\to A/2\\).",
);
add(
  "magnetism",
  "conceptual",
  "Kirchhoff’s voltage law for a lumped loop states that the algebraic sum of potential drops around a closed loop is?",
  "Zero.",
  "Equal to the total current.",
  "Equal to the number of branches.",
  "Infinite for AC only.",
  "Conservation of energy in circuits.",
);
add(
  "magnetism",
  "numerical",
  "\\(R_1 = 3\\ \\Omega\\) and \\(R_2 = 6\\ \\Omega\\) in parallel. Equivalent resistance?",
  "\\(2\\ \\Omega\\)",
  "\\(9\\ \\Omega\\)",
  "\\(3\\ \\Omega\\)",
  "\\(4.5\\ \\Omega\\)",
  "\\(1/R = 1/3 + 1/6\\).",
);
add(
  "magnetism",
  "conceptual",
  "Does a uniform magnetic field exert a magnetic force on a point charge at rest?",
  "No — \\(\\vec F = q\\,\\vec v \\times \\vec B\\) is zero if \\(\\vec v = 0\\).",
  "Yes — always toward north.",
  "Yes — proportional to \\(B\\) only.",
  "Only inside a ferromagnet.",
  "Magnetic force requires motion across field lines.",
);
add(
  "magnetism",
  "numerical",
  "Magnetic field magnitude at the centre of a circular coil of radius \\(r\\) carrying current \\(I\\) (\\(N=1\\))?",
  "\\(\\mu_0 I/(2r)\\)",
  "\\(\\mu_0 I/(2\\pi r)\\)",
  "\\(\\mu_0 I r\\)",
  "\\(\\mu_0 I / r^2\\)",
  "Standard result from Biot–Savart integration.",
);
add(
  "magnetism",
  "conceptual",
  "Lorentz force on a point charge in electromagnetic fields?",
  "\\(\\vec F = q(\\vec E + \\vec v \\times \\vec B)\\).",
  "\\(\\vec F = q\\vec B\\) only.",
  "\\(\\vec F = m\\vec a\\) only.",
  "\\(\\vec F = q\\vec E/\\varepsilon_0\\).",
  "Electric + magnetic parts combined.",
);
add(
  "magnetism",
  "numerical",
  "Proton speed \\(v\\) perpendicular to uniform \\(B\\). Radius of circular path?",
  "\\(r = mv/(qB)\\)",
  "\\(r = qB/(mv)\\)",
  "\\(r = mvB/q\\)",
  "\\(r = qvB/m\\)",
  "Balance \\(qvB = mv^2/r\\).",
);
add(
  "magnetism",
  "conceptual",
  "What are eddy currents?",
  "Induced circulating currents in bulk conductors due to changing magnetic flux.",
  "Currents in vacuum only.",
  "Displacement currents in capacitors only.",
  "Superconducting surface modes only.",
  "Lenz’s law tends to oppose flux change; energy often dissipated as heat.",
);
add(
  "magnetism",
  "numerical",
  "Magnetic dipole moment magnitude for \\(N\\) tightly wound planar turns, area \\(A\\), current \\(I\\)?",
  "\\(NIA\\)",
  "\\(IA/N\\)",
  "\\(N^2 IA\\)",
  "\\(IA^2\\)",
  "Moments add for stacked turns.",
);

// --- Block 9: EMI, AC & waves (81–90) ---
add(
  "emi_ac",
  "conceptual",
  "Lenz’s law describes the direction of induced EMF/current as opposing what?",
  "The change in magnetic flux that produced it.",
  "The original magnetic field always, unchanged.",
  "The battery voltage in the circuit.",
  "Thermal expansion of the coil.",
  "Consistent with energy conservation.",
);
add(
  "emi_ac",
  "numerical",
  "Ideal inductor \\(L\\): current changing at rate \\(di/dt\\). Magnitude of self-induced EMF (Faraday)?",
  "\\(|\\varepsilon| = L\\,|di/dt|\\)",
  "\\(|\\varepsilon| = L/i\\)",
  "\\(|\\varepsilon| = i/L\\)",
  "\\(|\\varepsilon| = L^2 di/dt\\)",
  "\\(\\varepsilon = -L\\,di/dt\\).",
);
add(
  "emi_ac",
  "conceptual",
  "Purely inductive AC circuit: phase of voltage relative to current?",
  "Voltage leads current by \\(90^\\circ\\).",
  "Current leads voltage by \\(90^\\circ\\).",
  "In phase.",
  "Opposite phase (\\(180^\\circ\\)).",
  "\\(V \\propto di/dt\\) for inductor.",
);
add(
  "emi_ac",
  "numerical",
  "Sinusoidal AC: peak voltage \\(V_0 = 311\\ \\mathrm{V}\\). RMS voltage?",
  "About \\(220\\ \\mathrm{V}\\)",
  "\\(311\\ \\mathrm{V}\\)",
  "\\(155\\ \\mathrm{V}\\)",
  "\\(440\\ \\mathrm{V}\\)",
  "\\(V_{\\mathrm{rms}} = V_0/\\sqrt{2}\\).",
);
add(
  "emi_ac",
  "conceptual",
  "Transformers step AC voltages up or down primarily via which phenomenon?",
  "Mutual induction between coupled coils.",
  "Self-induction only in one coil.",
  "Hall effect in the core.",
  "Photoelectric effect in the windings.",
  "Time-varying flux links secondary.",
);
add(
  "emi_ac",
  "numerical",
  "Series \\(LCR\\) resonance: resonant frequency \\(f\\) in Hz?",
  "\\(f = 1/(2\\pi\\sqrt{LC})\\)",
  "\\(f = \\sqrt{LC}/(2\\pi)\\)",
  "\\(f = 2\\pi\\sqrt{LC}\\)",
  "\\(f = 1/(\\sqrt{LC})\\)",
  "\\(\\omega_0 = 1/\\sqrt{LC}\\).",
);
add(
  "emi_ac",
  "conceptual",
  "Which EM spectrum region has the highest typical photon energy / frequency among these?",
  "Gamma rays.",
  "FM radio.",
  "Microwaves.",
  "Infrared.",
  "Shortest \\(\\lambda\\), highest \\(f\\), \\(E=hf\\).",
);
add(
  "emi_ac",
  "numerical",
  "Plane EM wave in vacuum along \\(+z\\). If \\(\\vec E\\) oscillates along \\(+x\\), along which axis does \\(\\vec B\\) oscillate?",
  "\\(+y\\) (so \\(\\vec E \\times \\vec B \\parallel +\\hat z\\))",
  "\\(+z\\)",
  "\\(-x\\)",
  "\\(+x\\)",
  "\\(\\vec E \\times \\vec B\\) gives propagation direction.",
);
add(
  "emi_ac",
  "conceptual",
  "Maxwell’s displacement current bridges what conceptual gap in Ampère’s law?",
  "Changing electric field through a surface acts like a current for continuity of magnetic circulation.",
  "It measures static friction in dielectrics.",
  "It replaces conduction current in metals always.",
  "It is real charge flow in vacuum.",
  "Needed for capacitor gaps and wave solutions.",
);
add(
  "emi_ac",
  "numerical",
  "In vacuum EM wave, relation between electric amplitude \\(E_0\\) and magnetic amplitude \\(B_0\\)?",
  "\\(B_0 = E_0/c\\)",
  "\\(B_0 = E_0 c\\)",
  "\\(B_0 = E_0/c^2\\)",
  "\\(B_0 = c E_0\\)",
  "Maxwell relations in vacuum: \\(|E|/|B| = c\\).",
);

// --- Block 10: Optics & modern physics (91–100) ---
add(
  "optics_modern",
  "conceptual",
  "Conditions for total internal reflection of light at an interface?",
  "Travel from optically denser to rarer medium and incidence angle exceeds the critical angle.",
  "Any angle from rarer to denser medium.",
  "Normal incidence only.",
  "Requires metallic coating.",
  "\\(n_i \\sin\\theta_i = n_t \\sin\\theta_t\\); beyond critical, no transmitted ray.",
);
add(
  "optics_modern",
  "numerical",
  "Young’s double slit: fringe width \\(\\beta = \\lambda D/d\\). If \\(d\\) is halved and \\(D\\) doubled, \\(\\beta\\) changes by factor?",
  "\\(4\\)",
  "\\(1\\)",
  "\\(2\\)",
  "\\(1/4\\)",
  "\\(\\beta \\propto D/d\\).",
);
add(
  "optics_modern",
  "conceptual",
  "Photoelectric effect: does maximum kinetic energy of emitted electrons depend on incident light intensity (fixed frequency)?",
  "No — \\(K_{\\max}\\) depends on frequency; intensity changes only photoelectron rate.",
  "Yes — brighter light always gives higher \\(K_{\\max}\\).",
  "Yes — linearly with intensity.",
  "Only below threshold frequency.",
  "Einstein’s \\(K_{\\max} = hf - \\phi\\).",
);
add(
  "optics_modern",
  "numerical",
  "Metal work function \\(2.0\\ \\mathrm{eV}\\). Approximate threshold wavelength \\(\\lambda\\) (nm) using \\(1240/(\\phi\\ \\text{eV})\\)?",
  "About \\(620\\ \\mathrm{nm}\\)",
  "\\(310\\ \\mathrm{nm}\\)",
  "\\(1240\\ \\mathrm{nm}\\)",
  "\\(200\\ \\mathrm{nm}\\)",
  "\\(\\lambda(\\mathrm{nm}) \\approx 1240 / E(\\mathrm{eV})\\).",
);
add(
  "optics_modern",
  "conceptual",
  "Classical failure of Rutherford’s nuclear model that Bohr’s postulates addressed for hydrogen?",
  "Accelerating charges radiate; classical orbiting electrons would spiral in.",
  "Nucleus should be positively charged (that part matched experiment).",
  "Atoms should be cubic.",
  "Electron mass was unknown.",
  "Radiation loss from orbiting charge.",
);
add(
  "optics_modern",
  "numerical",
  "Half-life \\(T\\). Fraction of nuclei remaining after time \\(3T\\)?",
  "\\(1/8\\)",
  "\\(1/3\\)",
  "\\(1/4\\)",
  "\\(3/4\\)",
  "\\(N = N_0 (1/2)^{t/T}\\).",
);
add(
  "optics_modern",
  "conceptual",
  "In two-beam interference, what primarily determines constructive vs destructive superposition at a point?",
  "Path difference (equivalently phase difference) modulo wavelength.",
  "Only the colour of the sources.",
  "Only total intensity of each beam separately.",
  "Polarization must match exactly always.",
  "Phase relationship sets fringe type.",
);
add(
  "optics_modern",
  "numerical",
  "De Broglie wavelength of a non-relativistic particle of mass \\(m\\) and kinetic energy \\(K\\)?",
  "\\(\\lambda = h/\\sqrt{2mK}\\)",
  "\\(\\lambda = h/(mK)\\)",
  "\\(\\lambda = \\sqrt{2mK}/h\\)",
  "\\(\\lambda = hK/m\\)",
  "\\(p = \\sqrt{2mK}\\), \\(\\lambda = h/p\\).",
);
add(
  "optics_modern",
  "conceptual",
  "Role of a moderator (e.g. heavy water, graphite) in a thermal fission reactor?",
  "Slow (thermalize) fast neutrons to increase fission probability in fuel.",
  "Speed neutrons up for fusion.",
  "Absorb all neutrons completely.",
  "Generate electrical power directly.",
  "U-235 fission cross-section is much larger for thermal neutrons.",
);
add(
  "optics_modern",
  "numerical",
  "Convex lens \\(f_1 = +20\\ \\mathrm{cm}\\) in contact with concave lens \\(f_2 = -10\\ \\mathrm{cm}\\). Power of combination in diopters?",
  "\\(-5\\ \\mathrm{D}\\)",
  "\\(+5\\ \\mathrm{D}\\)",
  "\\(-15\\ \\mathrm{D}\\)",
  "\\(+15\\ \\mathrm{D}\\)",
  "\\(P = 1/f\\) with \\(f\\) in metres; add powers for thin contact lenses.",
);

if (Q.length !== 100) {
  console.error("Expected 100 questions, got", Q.length);
  process.exit(1);
}

const lines = [];
lines.push(`-- PUC 1/2 Physics (JEE/NEET style): 100 items, alternating conceptual / numerical.`);
lines.push(`-- academic / physics; pack: ${PACK}`);
lines.push(`-- Generated by scripts/build-academic-physics-puc100-migration.mjs`);
lines.push("");
lines.push("BEGIN;");
lines.push("");
lines.push("DELETE FROM public.play_questions");
lines.push("WHERE domain = 'academic'");
lines.push("  AND category = 'physics'");
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
  const tag = `p${String(idx + 1).padStart(3, "0")}`;
  return `  ('academic', 'physics', ${rating}, $${tag}c$${content}$${tag}c$::jsonb, $${tag}o$${options}$${tag}o$::jsonb, 0, $${tag}e$${q.e}$${tag}e$)`;
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
  "20260430341000_play_academic_physics_puc100_jee_neet.sql",
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);
