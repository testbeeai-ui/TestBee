/**
 * Generates supabase/migrations/*_play_academic_math_puc100_jee_neet.sql
 * Run: node scripts/build-academic-math-puc100-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK = "puc_math_jee_neet_100";

/** @type {{ b: string; t: string; s: string; o: [string, string, string, string]; e: string }[]} */
const Q = [];

function add(b, t, s, correct, w1, w2, w3, e) {
  Q.push({ b, t, s, o: [correct, w1, w2, w3], e });
}

// Block 1: Functions, limits, continuity (1–10)
add(
  "limits_continuity",
  "conceptual",
  "Why does \\(\\lim_{x \\to n}[x]\\) not exist when \\(n\\) is an integer? ([ ] = greatest integer function.)",
  "LHL \\(\\to n-1\\) and RHL \\(\\to n\\); one-sided limits disagree.",
  "The function is undefined at every integer.",
  "The limit always equals \\(n\\).",
  "\\([x]\\) is continuous at integers.",
  "Floor/step jumps: left limit and right limit at \\(n\\) differ.",
);
add(
  "limits_continuity",
  "numerical",
  "\\(\\displaystyle\\lim_{x \\to 0} \\frac{\\sin x - x}{x^3}\\)",
  "\\(-1/6\\)",
  "\\(1/6\\)",
  "\\(0\\)",
  "\\(-1/2\\)",
  "\\(\\sin x = x - x^3/6 + \\cdots\\) ⇒ numerator \\(\\sim -x^3/6\\).",
);
add(
  "limits_continuity",
  "conceptual",
  "Can a **jump** discontinuity be removed by redefining \\(f\\) at a single point?",
  "No — LHL \\(\\neq\\) RHL, so no single value makes the limit exist.",
  "Yes — always, like a removable discontinuity.",
  "Only if the jump is rational.",
  "Only for piecewise linear functions.",
  "Removable needs LHL = RHL \\(\\neq f(c)\\); jump has unequal one-sided limits.",
);
add(
  "limits_continuity",
  "numerical",
  "Fundamental period of \\(f(x) = \\sin^4 x + \\cos^4 x\\)?",
  "\\(\\pi/2\\)",
  "\\(\\pi\\)",
  "\\(2\\pi\\)",
  "\\(\\pi/4\\)",
  "Reduce to \\(1 - \\tfrac12\\sin^2 2x\\); \\(\\sin^2 2x\\) has period \\(\\pi/2\\).",
);
add(
  "limits_continuity",
  "conceptual",
  "Can a function be continuous on a closed bounded interval \\([a,b]\\) but **not** uniformly continuous on \\((a,b)\\)?",
  "On **[a,b]** closed and bounded: **no** — Heine–Cantor: continuous on a compact set is uniformly continuous.",
  "Yes — always on every closed interval.",
  "Only if it is unbounded.",
  "Uniform continuity never holds in calculus.",
  "Compact interval \\([a,b]\\) + continuity \\(\\Rightarrow\\) uniform continuity.",
);
add(
  "limits_continuity",
  "numerical",
  "\\(\\displaystyle\\lim_{n \\to \\infty} \\sum_{r=1}^{n} \\frac{n}{n^2 + r^2}\\)",
  "\\(\\pi/4\\)",
  "\\(1/2\\)",
  "\\(0\\)",
  "\\(1\\)",
  "Riemann sum \\(\\int_0^1 \\frac{1}{1+x^2}\\,dx = \\tan^{-1}1\\).",
);
add(
  "limits_continuity",
  "conceptual",
  "Why is the Dirichlet function (1 on rationals, 0 on irrationals) nowhere continuous on \\(\\mathbb{R}\\)?",
  "Both rationals and irrationals are dense; every neighborhood hits both 0 and 1.",
  "It is continuous only at \\(x=0\\).",
  "It equals zero almost everywhere.",
  "Limits exist everywhere.",
  "\\(\\varepsilon\\)-\\(\\delta\\) fails: no local constancy.",
);
add(
  "limits_continuity",
  "numerical",
  "How many **real** solutions does \\(e^x = x^2\\) have?",
  "**3** (one negative, two positive — standard graphical/IVT count)",
  "\\(1\\) only",
  "\\(2\\) only",
  "\\(0\\)",
  "Sketch \\(e^x\\) vs \\(x^2\\); sign changes locate three crossings (well-known classic).",
);
add(
  "limits_continuity",
  "conceptual",
  "How is Rolle’s theorem a special case of Lagrange’s MVT?",
  "MVT: \\(f'(c) = \\frac{f(b)-f(a)}{b-a}\\). Rolle adds \\(f(a)=f(b)\\) so the secant slope is 0 ⇒ \\(f'(c)=0\\).",
  "Rolle is stronger and never uses derivatives.",
  "They apply to disjoint intervals only.",
  "MVT is only for linear functions.",
  "Net change of \\(f\\) over \\([a,b]\\) is zero.",
);
add(
  "limits_continuity",
  "numerical",
  "Let \\(f(x) = x^3 + x\\). Find \\((f^{-1})'(2)\\).",
  "\\(1/4\\)",
  "\\(4\\)",
  "\\(1/2\\)",
  "\\(1\\)",
  "\\(f(1)=2\\); \\((f^{-1})'(y) = 1/f'(x)\\); \\(f'(1)=4\\).",
);

// Block 2: Differentiability & applications (11–20)
add(
  "derivatives_apps",
  "conceptual",
  "Why is \\(f(x) = |x-a|\\) usually **not** differentiable at \\(x=a\\)?",
  "Left derivative \\(-1\\), right derivative \\(+1\\); corner — no unique tangent.",
  "The function is undefined at \\(a\\).",
  "Absolute value is never differentiable anywhere.",
  "Only because \\(a\\) is irrational.",
  "One-sided derivatives differ at the kink.",
);
add(
  "derivatives_apps",
  "numerical",
  "Maximum volume of a right circular cylinder inscribed in a sphere of radius \\(R\\)?",
  "\\(4\\pi R^3/(3\\sqrt{3})\\)",
  "\\(4\\pi R^3/3\\)",
  "\\(\\pi R^3/\\sqrt{2}\\)",
  "\\(2\\pi R^3/3\\)",
  "Optimize \\(V(h)\\) with constraint \\(r^2 + (h/2)^2 = R^2\\).",
);
add(
  "derivatives_apps",
  "conceptual",
  "Why is \\(f'(c)=0\\) **necessary** but **not sufficient** for a local extremum?",
  "Saddle/inflection: e.g. \\(f(x)=x^3\\) at \\(0\\) has \\(f'(0)=0\\) but no max/min.",
  "It is always sufficient for a maximum.",
  "Derivatives do not exist at extrema.",
  "Only for discontinuous functions.",
  "First derivative test can fail without sign change of \\(f'\\).",
);
add(
  "derivatives_apps",
  "numerical",
  "Shortest distance between line \\(y=x\\) and parabola \\(y^2 = x-2\\)?",
  "\\(7/(4\\sqrt{2})\\)",
  "\\(7/4\\)",
  "\\(\\sqrt{2}\\)",
  "\\(1/\\sqrt{2}\\)",
  "Parallel tangent to \\(y=x\\); point \\((9/4,\\,1/2)\\); distance to \\(x-y=0\\).",
);
add(
  "derivatives_apps",
  "conceptual",
  "Geometric meaning of Lagrange’s MVT on \\([a,b]\\)?",
  "Some \\(c\\in(a,b)\\) where tangent slope equals secant slope \\((f(b)-f(a))/(b-a)\\).",
  "Tangent is always horizontal.",
  "Secant does not exist.",
  "Only for polynomials of degree 2.",
  "Instantaneous rate matches average rate.",
);
add(
  "derivatives_apps",
  "numerical",
  "If \\(x^y = e^{x-y}\\), find \\(\\displaystyle\\left.\\frac{dy}{dx}\\right|_{x=e}\\).",
  "\\(1/4\\)",
  "\\(1/2\\)",
  "\\(0\\)",
  "\\(1\\)",
  "\\(\\ln\\): \\(y\\ln x = x-y\\) ⇒ \\(y = x/(1+\\ln x)\\); quotient rule at \\(x=e\\).",
);
add(
  "derivatives_apps",
  "conceptual",
  "What **defines** an inflection point (vs a mere stationary point)?",
  "Concavity changes — typically \\(f''\\) changes sign (under mild assumptions).",
  "Only where \\(f'=0\\).",
  "Only where \\(f''=0\\) always, with no sign change needed.",
  "A point where the function is undefined.",
  "Curvature switches from cup-up to cup-down or vice versa.",
);
add(
  "derivatives_apps",
  "numerical",
  "Spherical balloon: \\(dV/dt = 10\\ \\mathrm{cm^3/s}\\). Find \\(dA/dt\\) when \\(r = 5\\ \\mathrm{cm}\\).",
  "\\(4\\ \\mathrm{cm^2/s}\\)",
  "\\(2\\ \\mathrm{cm^2/s}\\)",
  "\\(8\\ \\mathrm{cm^2/s}\\)",
  "\\(10\\ \\mathrm{cm^2/s}\\)",
  "\\(V=\\frac{4}{3}\\pi r^3\\), \\(A=4\\pi r^2\\); chain rule.",
);
add(
  "derivatives_apps",
  "conceptual",
  "When does a cubic \\(f\\) have **no** local extrema on \\(\\mathbb{R}\\)?",
  "When \\(f'(x)\\) (a quadratic) has no two distinct real roots — discriminant \\(\\le 0\\) ⇒ \\(f'\\) doesn’t change sign.",
  "When the leading coefficient is zero.",
  "Always — cubics have no extrema.",
  "When \\(f''>0\\) everywhere.",
  "Monotone cubic ⇔ derivative quadratic has \\(\\le 1\\) real root.",
);
add(
  "derivatives_apps",
  "numerical",
  "Absolute maximum of \\(f(x) = x^{1/x}\\) for \\(x>0\\)?",
  "\\(e^{1/e}\\)",
  "\\(e\\)",
  "\\(1\\)",
  "\\(e^{-1}\\)",
  "Log-derivative; maximum at \\(x=e\\).",
);

// Block 3: Integration (21–30)
add(
  "integration",
  "conceptual",
  "Why does \\(+C\\) appear in indefinite integrals but not in definite \\(\\int_a^b\\)?",
  "Constants cancel: \\(F(b)+C - (F(a)+C) = F(b)-F(a)\\).",
  "Definite integral always equals zero.",
  "Fundamental theorem forbids constants.",
  "Only polynomials need \\(C\\).",
  "FTC: antiderivative evaluated at endpoints.",
);
add(
  "integration",
  "numerical",
  "\\(\\displaystyle\\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x}+\\sqrt{\\cos x}}\\,dx\\)",
  "\\(\\pi/4\\)",
  "\\(\\pi/2\\)",
  "\\(0\\)",
  "\\(1\\)",
  "Use \\(\\int_0^{\\pi/2} f(x)\\,dx = \\int_0^{\\pi/2} f(\\pi/2-x)\\,dx\\); add.",
);
add(
  "integration",
  "conceptual",
  "What does the **Leibniz rule** let you differentiate?",
  "An integral \\(\\int_{u(t)}^{v(t)} g(x,t)\\,dx\\) w.r.t. \\(t\\) — limits (and integrand) may depend on \\(t\\).",
  "Only polynomials.",
  "Only improper integrals of first kind.",
  "The constant \\(C\\) in indefinite integrals.",
  "Differentiation under the integral sign / variable limits.",
);
add(
  "integration",
  "numerical",
  "\\(\\displaystyle\\int e^x\\left(\\frac{1-x}{1+x^2}\\right)^2 dx\\)",
  "\\(e^x/(1+x^2) + C\\)",
  "\\(e^x(1-x^2)/(1+x^2) + C\\)",
  "\\(\\tan^{-1}x + C\\)",
  "\\(e^x/(1-x)^2 + C\\)",
  "Recognize \\(e^x(f+f')\\) form after algebra.",
);
add(
  "integration",
  "conceptual",
  "How does **odd/even** symmetry simplify \\(\\int_{-a}^{a} f(x)\\,dx\\)?",
  "Odd ⇒ integral \\(0\\); even ⇒ \\(2\\int_0^a f\\).",
  "Odd ⇒ double the integral; even ⇒ zero.",
  "No simplification is possible.",
  "Only for periodic functions.",
  "Symmetric interval + parity.",
);
add(
  "integration",
  "numerical",
  "\\(\\displaystyle\\int_0^{\\pi} x\\log(\\sin x)\\,dx\\)",
  "\\(-\\dfrac{\\pi^2}{2}\\log 2\\)",
  "\\(0\\)",
  "\\(\\pi\\log 2\\)",
  "\\(-\\pi\\log 2\\)",
  "Use \\(x\\to \\pi-x\\); relate to \\(\\int_0^\\pi \\log(\\sin x)\\,dx = -\\pi\\log 2\\).",
);
add(
  "integration",
  "conceptual",
  "ILATE in \\(\\int u\\,dv\\) is a rule of thumb because…",
  "Pick \\(u\\) so that \\(du\\) simplifies and \\(dv\\) is easy to integrate (log/inverse often for \\(u\\)).",
  "It is a theorem proved for all integrands.",
  "Trig must always be \\(dv\\).",
  "Exponentials must always be \\(u\\).",
  "Balance differentiation vs integration difficulty.",
);
add(
  "integration",
  "numerical",
  "\\(\\displaystyle\\int_0^{100\\pi} |\\sin x|\\,dx\\)",
  "\\(200\\)",
  "\\(100\\)",
  "\\(400\\)",
  "\\(0\\)",
  "\\(|\\sin x|\\) has period \\(\\pi\\); \\(\\int_0^\\pi |\\sin x|\\,dx = 2\\).",
);
add(
  "integration",
  "conceptual",
  "Improper integral **of the first kind**?",
  "Infinite limit(s) of integration (e.g. \\(\\int_1^\\infty\\)).",
  "Integrand blows up inside \\([a,b]\\).",
  "Only when integral equals \\(\\pi\\).",
  "Same as Cauchy principal value always.",
  "Type 1: infinite interval; type 2: unbounded integrand on finite interval.",
);
add(
  "integration",
  "numerical",
  "\\(\\displaystyle\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx\\)",
  "\\(\\sqrt{\\pi}\\)",
  "\\(\\pi\\)",
  "\\(1\\)",
  "\\(2\\sqrt{\\pi}\\)",
  "Polar/double-integral trick; Gaussian.",
);

// Block 4: ODEs & area (31–40)
add(
  "diff_eq_area",
  "conceptual",
  "**Order** vs **degree** of a differential equation?",
  "Order = highest derivative present; degree = power of that highest derivative when DE is polynomial in derivatives.",
  "They always mean the same thing.",
  "Degree is always 1 for ODEs.",
  "Order is the number of arbitrary constants.",
  "e.g. \\((y'')^3 + y' = 0\\): order 2, degree 3.",
);
add(
  "diff_eq_area",
  "numerical",
  "Solve \\(\\dfrac{dy}{dx} = \\dfrac{x+y}{x}\\) (homogeneous).",
  "\\(y = x\\log|x| + cx\\)",
  "\\(y = x^2 + c\\)",
  "\\(y = \\log x + c\\)",
  "\\(y = ce^x\\)",
  "Substitute \\(y = vx\\); cancel \\(v\\); integrate \\(dv = dx/x\\).",
);
add(
  "diff_eq_area",
  "conceptual",
  "When is an **integrating factor** \\(e^{\\int P\\,dx}\\) used for first-order linear ODEs?",
  "For \\(y' + P(x)y = Q(x)\\) to turn LHS into \\(\\frac{d}{dx}(y\\cdot \\mathrm{IF})\\).",
  "Only when the equation is separable already.",
  "Only for second-order equations.",
  "Never — it is only for exact equations in \\(y\\).",
  "Linear first-order standard form.",
);
add(
  "diff_eq_area",
  "numerical",
  "Area enclosed by \\(y^2 = 4x\\) and \\(x^2 = 4y\\)?",
  "\\(16/3\\)",
  "\\(8/3\\)",
  "\\(32/3\\)",
  "\\(4\\)",
  "Intersect at \\((0,0)\\) and \\((4,4)\\); \\(\\int_0^4 (2\\sqrt{x} - x^2/4)\\,dx\\).",
);
add(
  "diff_eq_area",
  "conceptual",
  "What is an **orthogonal trajectory** of a family of curves?",
  "A curve meeting each member of the family at a right angle; DE from \\(-1/(dy/dx)\\) of given family.",
  "A curve parallel to every member.",
  "The envelope only.",
  "A singular solution always.",
  "Slope negative reciprocal at intersections.",
);
add(
  "diff_eq_area",
  "numerical",
  "Exponential growth: population doubles in 50 years. Growth constant \\(k\\) in \\(P = P_0 e^{kt}\\)?",
  "\\((\\ln 2)/50\\)",
  "\\(50/\\ln 2\\)",
  "\\(\\ln 2\\)",
  "\\(1/50\\)",
  "\\(2 = e^{50k}\\Rightarrow k = \\ln 2/50\\).",
);
add(
  "diff_eq_area",
  "conceptual",
  "Why do **singular solutions** of an ODE often carry **no** arbitrary constant?",
  "They are envelopes / limits not reachable by fixing \\(C\\) in the general solution.",
  "They always equal zero.",
  "They are particular solutions with \\(C=0\\) only.",
  "Arbitrary constants are illegal in ODEs.",
  "Lie outside the one-parameter family.",
);
add(
  "diff_eq_area",
  "numerical",
  "Area between \\(y = \\sin x\\) and \\(y = \\cos x\\) from \\(0\\) to \\(\\pi/4\\)?",
  "\\(\\sqrt{2} - 1\\)",
  "\\(1 - \\sqrt{2}\\)",
  "\\(0\\)",
  "\\(\\sqrt{2}\\)",
  "On \\([0,\\pi/4]\\), \\(\\cos x \\ge \\sin x\\); integrate difference.",
);
add(
  "diff_eq_area",
  "conceptual",
  "DE \\(y\\,dx - x\\,dy = 0\\) represents which family?",
  "Straight lines through the origin \\(y = kx\\).",
  "Circles centered at origin.",
  "Hyperbolas only.",
  "Parabolas only.",
  "\\(dy/dx = y/x\\) ⇒ separable ⇒ \\(\\ln|y| = \\ln|x|+C\\).",
);
add(
  "diff_eq_area",
  "numerical",
  "Solve \\(y'' + 4y = 0\\), \\(y(0)=1\\), \\(y'(0)=0\\).",
  "\\(y = \\cos(2x)\\)",
  "\\(y = \\sin(2x)\\)",
  "\\(y = \\cos x\\)",
  "\\(y = e^{-2x}\\)",
  "\\(r^2+4=0\\Rightarrow r=\\pm 2i\\); ICs give \\(A=1,B=0\\).",
);

// Block 5: Complex numbers & quadratics (41–50)
add(
  "complex_quad",
  "conceptual",
  "Role of **De Moivre** \\((\\cos\\theta+i\\sin\\theta)^n = \\cos n\\theta + i\\sin n\\theta\\)?",
  "Turns powers of complex numbers on the unit circle into angle multiplication.",
  "Only expands binomials with real roots.",
  "Computes matrix rank.",
  "Only for \\(n<0\\).",
  "Bridges complex exponentials/trig for integer \\(n\\).",
);
add(
  "complex_quad",
  "numerical",
  "\\(\\omega\\) a non-real cube root of unity. \\((1-\\omega+\\omega^2)^5 + (1+\\omega-\\omega^2)^5\\)?",
  "\\(32\\)",
  "\\(0\\)",
  "\\(-32\\)",
  "\\(64\\)",
  "Use \\(1+\\omega+\\omega^2=0\\); simplify brackets to \\(-2\\omega\\), \\(-2\\omega^2\\); sum.",
);
add(
  "complex_quad",
  "conceptual",
  "\\(|z-z_1|+|z-z_2| = 2a\\) with \\(2a > |z_1-z_2|\\) is the locus of \\(z\\)?",
  "**Ellipse** with foci \\(z_1,z_2\\).",
  "A parabola",
  "A hyperbola",
  "A straight line",
  "Sum of distances to two fixed points constant.",
);
add(
  "complex_quad",
  "numerical",
  "Minimum of \\(|z-1|+|z-5|\\) over \\(z\\in\\mathbb{C}\\)?",
  "\\(4\\)",
  "\\(6\\)",
  "\\(2\\)",
  "\\(0\\)",
  "Triangle inequality on segment from 1 to 5; minimum at points between.",
);
add(
  "complex_quad",
  "conceptual",
  "Real quadratic with **negative discriminant** \\(\\Delta<0\\) — nature of roots?",
  "Non-real complex conjugate pair.",
  "Two distinct real roots",
  "One repeated real root",
  "No roots in \\(\\mathbb{C}\\)",
  "\\(\\sqrt{\\Delta}\\) imaginary; coefficients real ⇒ conjugate pair.",
);
add(
  "complex_quad",
  "numerical",
  "Roots of \\(x^2-px+q=0\\) differ by exactly 1. Relation between \\(p\\) and \\(q\\)?",
  "\\(p^2 - 4q = 1\\)",
  "\\(p^2 - 4q = 0\\)",
  "\\(p = 4q\\)",
  "\\(p+q=1\\)",
  "\\((\\alpha-\\beta)^2 = (\\alpha+\\beta)^2 - 4\\alpha\\beta\\).",
);
add(
  "complex_quad",
  "conceptual",
  "Why must non-real roots of a real-coefficient polynomial occur in conjugate pairs?",
  "Complex conjugation preserves the polynomial (real coefficients) ⇒ roots closed under \\(\\bar{\\cdot}\\).",
  "Because \\(|z|=1\\).",
  "Only for cubics.",
  "Roots must be rational.",
  "\\(P(\\bar z) = \\overline{P(z)} = 0\\) if \\(P(z)=0\\).",
);
add(
  "complex_quad",
  "numerical",
  "Principal argument of \\(z = \\dfrac{-1-i\\sqrt{3}}{2}\\)?",
  "\\(-2\\pi/3\\)",
  "\\(\\pi/3\\)",
  "\\(2\\pi/3\\)",
  "\\(-\\pi/6\\)",
  "Third quadrant; reference \\(\\pi/3\\).",
);
add(
  "complex_quad",
  "conceptual",
  "Multiplying \\(z\\) by \\(i\\) in the Argand plane?",
  "**Counter-clockwise** rotation by \\(\\pi/2\\); \\(|z|\\) unchanged.",
  "Reflection in real axis",
  "Dilation by factor \\(i\\)",
  "Rotation by \\(\\pi\\)",
  "\\(\\arg(iz) = \\arg z + \\pi/2\\).",
);
add(
  "complex_quad",
  "numerical",
  "All real roots of \\(x^4 - 5x^2 + 4 = 0\\)?",
  "\\(x = \\pm 1,\\ \\pm 2\\)",
  "\\(x = 1,2\\) only",
  "\\(x = \\pm \\sqrt{5}\\)",
  "No real roots",
  "Let \\(u=x^2\\); \\((u-1)(u-4)=0\\).",
);

// Block 6: Matrices, determinants, probability (51–60)
add(
  "matrices_prob",
  "conceptual",
  "**Singular** vs **non-singular** matrix — inverse?",
  "Singular: \\(\\det A = 0\\), no inverse; non-singular: \\(\\det A \\neq 0\\), inverse exists.",
  "Singular matrices always have two inverses.",
  "Determinant is always 1 for invertible matrices.",
  "Only diagonal matrices are invertible.",
  "\\(A^{-1}\\) needs \\(\\det A \\neq 0\\).",
);
add(
  "matrices_prob",
  "numerical",
  "\\(|A|=4\\) for a \\(3\\times 3\\) matrix \\(A\\). Find \\(|\\mathrm{adj}(A)|\\).",
  "\\(16\\)",
  "\\(4\\)",
  "\\(64\\)",
  "\\(12\\)",
  "\\(|\\mathrm{adj}A| = |A|^{n-1} = 4^2\\).",
);
add(
  "matrices_prob",
  "conceptual",
  "**Cayley–Hamilton** theorem says what about a square matrix \\(A\\)?",
  "\\(A\\) satisfies its own characteristic polynomial: \\(p_A(A)=0\\).",
  "\\(\\det A = 0\\) always",
  "\\(A\\) is diagonalizable",
  "\\(A^2 = I\\) always",
  "Substitute matrix into characteristic equation.",
);
add(
  "matrices_prob",
  "numerical",
  "\\(P(A)=0.3\\), \\(P(B)=0.4\\), \\(P(A\\cup B)=0.58\\). Are \\(A,B\\) independent?",
  "**Yes** — \\(P(A\\cap B) = 0.12 = P(A)P(B)\\).",
  "No",
  "Cannot tell",
  "Only if mutually exclusive",
  "\\(P(A\\cap B) = P(A)+P(B)-P(A\\cup B)\\).",
);
add(
  "matrices_prob",
  "conceptual",
  "\\(AX=B\\) has **infinitely many** solutions when?",
  "\\(|A|=0\\) and system consistent (e.g. \\((\\mathrm{adj}A)B=0\\) in \\(3\\times 3\\) case / rank conditions).",
  "\\(|A|\\neq 0\\)",
  "Always for square \\(A\\)",
  "Never for linear systems",
  "Singular + compatible ⇒ line/plane of solutions.",
);
add(
  "matrices_prob",
  "numerical",
  "\\(A\\) orthogonal \\((AA^T = I)\\). Possible values of \\(\\det A\\)?",
  "\\(\\pm 1\\)",
  "\\(0,1\\)",
  "Any real number",
  "\\(2\\) only",
  "\\(|AA^T|=|A|^2=1\\).",
);
add(
  "matrices_prob",
  "conceptual",
  "**Mutually exclusive** vs **independent** events?",
  "Mutually exclusive: cannot both occur (\\(P(A\\cap B)=0\\)); independent: \\(P(A\\cap B)=P(A)P(B)\\) (can co-occur).",
  "They are synonyms.",
  "Independent implies \\(P(A\\cap B)=0\\).",
  "Mutually exclusive implies independence.",
  "Exclusive forbids overlap; independence is probabilistic factorization.",
);
add(
  "matrices_prob",
  "numerical",
  "Fair coin 10 times: probability of **exactly** 5 heads?",
  "\\(63/256\\)",
  "\\(1/2\\)",
  "\\(105/512\\) (\\(\\binom{10}{4}/2^{10}\\))",
  "\\(1/32\\)",
  "\\(\\binom{10}{5}/2^{10} = 252/1024 = 63/256\\).",
);
add(
  "matrices_prob",
  "conceptual",
  "**Bayes** theorem updates probabilities how?",
  "Reverses conditioning using prior and likelihood: \\(P(A|B)\\) from \\(P(B|A)\\) etc.",
  "Always doubles every probability",
  "Only for independent events",
  "Removes all priors",
  "Posterior from prior \\(\\times\\) likelihood / evidence.",
);
add(
  "matrices_prob",
  "numerical",
  "Urn: 3 red, 4 black; draw 2 **without** replacement. Expected number of red balls?",
  "\\(6/7\\)",
  "\\(3/7\\)",
  "\\(1\\)",
  "\\(12/49\\)",
  "Hypergeometric mean \\(nK/N = 2\\cdot 3/7\\).",
);

// Block 7: Permutations, binomial (61–70)
add(
  "perm_binom",
  "conceptual",
  "When is **inclusion–exclusion** needed for counting?",
  "Union of overlapping sets — avoid double-counting intersections.",
  "Only for disjoint sets",
  "Only for circular permutations",
  "Never in combinatorics",
  "\\(|A\\cup B\\cup\\cdots|\\) with overlaps.",
);
add(
  "perm_binom",
  "numerical",
  "Distinct permutations of letters in **MISSISSIPPI**?",
  "\\(34650\\)",
  "\\(11!\\)",
  "\\(39916800\\)",
  "\\(1663200\\)",
  "\\(11!/(4!\\,4!\\,2!)\\).",
);
add(
  "perm_binom",
  "conceptual",
  "Why define \\(0! = 1\\)?",
  "So \\(\\binom{n}{n}=1 = n!/(n!\\,0!)\\) and factorial recurrence extends consistently.",
  "Because zero is prime.",
  "Historical convention only with no formula reason.",
  "So \\(0! = 0\\).",
  "Combinatorial consistency.",
);
add(
  "perm_binom",
  "numerical",
  "Coefficient of \\(x^5\\) in \\((1+x)^{10}\\)?",
  "\\(252\\)",
  "\\(200\\)",
  "\\(210\\)",
  "\\(120\\)",
  "\\(\\binom{10}{5}\\).",
);
add(
  "perm_binom",
  "conceptual",
  "**Derangement**?",
  "Permutation of \\(\\{1,\\ldots,n\\}\\) with **no fixed points**.",
  "Any permutation",
  "Only the identity",
  "Permutation with all fixed points",
  "No \\(i\\) maps to \\(i\\).",
);
add(
  "perm_binom",
  "numerical",
  "Sum of all coefficients in \\((2x - y)^{10}\\)?",
  "\\(1\\)",
  "\\(1024\\)",
  "\\(0\\)",
  "\\(3^{10}\\)",
  "Set \\(x=y=1\\): \\((2-1)^{10}\\).",
);
add(
  "perm_binom",
  "conceptual",
  "**Pascal’s identity** \\(\\binom{n}{k} = \\binom{n-1}{k-1} + \\binom{n-1}{k}\\) means?",
  "Recursive construction of binomial coefficients / Pascal triangle rows.",
  "Binomial coefficients are always prime.",
  "\\(\\binom{n}{k} = nk\\) always",
  "Only for \\(k=1\\)",
  "Choose \\(k\\) items: include a distinguished element or not.",
);
add(
  "perm_binom",
  "numerical",
  "5 distinct balls into 3 distinct boxes (empty allowed)?",
  "\\(243\\)",
  "\\(125\\)",
  "\\(15\\)",
  "\\(3!\\,5!\\)",
  "\\(3^5\\) choices per ball.",
);
add(
  "perm_binom",
  "conceptual",
  "Middle term of \\((x+a)^n\\) is **unique** when…",
  "\\(n\\) is **even** (\\(n+1\\) terms ⇒ odd count ⇒ one middle).",
  "\\(n\\) is odd",
  "Never",
  "Always two middle terms",
  "Even \\(n\\) gives single central binomial term.",
);
add(
  "perm_binom",
  "numerical",
  "Constant term in \\((x^2 - 1/x)^9\\)?",
  "\\(84\\)",
  "\\(-84\\)",
  "\\(0\\)",
  "\\(126\\)",
  "General term exponent \\(18-3r=0\\Rightarrow r=6\\); \\(\\binom{9}{6}(-1)^6\\).",
);

// Block 8: Coordinate geometry (71–80)
add(
  "coordinate_geometry",
  "conceptual",
  "**Orthocenter** of a triangle — obtuse case?",
  "Intersection of altitudes; for an obtuse triangle, orthocenter lies **outside** the triangle.",
  "Always inside",
  "Always at the centroid",
  "Undefined for obtuse triangles",
  "Altitudes meet extended lines outside.",
);
add(
  "coordinate_geometry",
  "numerical",
  "Perpendicular distance from \\((3,4)\\) to line \\(3x+4y-5=0\\)?",
  "\\(4\\)",
  "\\(5\\)",
  "\\(20\\)",
  "\\(1\\)",
  "\\(|Ax_0+By_0+C|/\\sqrt{A^2+B^2}\\).",
);
add(
  "coordinate_geometry",
  "conceptual",
  "**Power of a point** w.r.t. a circle \\(S=0\\)?",
  "Value \\(S(x_1,y_1)\\); equals square of tangent length from point to circle (signed via inside/outside).",
  "Always the radius",
  "Area of the circle",
  "Slope of tangent only",
  "Chord product for secants through the point.",
);
add(
  "coordinate_geometry",
  "numerical",
  "Radius of circle \\(x^2+y^2-6x+8y=0\\)?",
  "\\(5\\)",
  "\\(10\\)",
  "\\(\\sqrt{5}\\)",
  "\\(25\\)",
  "\\(r = \\sqrt{g^2+f^2-c}\\) with standard form.",
);
add(
  "coordinate_geometry",
  "conceptual",
  "Lines \\(ax^2+2hxy+by^2=0\\) through origin are perpendicular if?",
  "\\(a+b=0\\)",
  "\\(h=0\\)",
  "\\(a=b\\)",
  "\\(ab=1\\)",
  "Product of slopes \\(= -1\\Rightarrow a+b=0\\).",
);
add(
  "coordinate_geometry",
  "numerical",
  "Angle between lines given by \\(x^2 - y^2 = 0\\)?",
  "\\(90^\\circ\\) (\\(\\pi/2\\))",
  "\\(45^\\circ\\)",
  "\\(60^\\circ\\)",
  "\\(0^\\circ\\)",
  "Factors to \\(y=\\pm x\\); slopes \\(\\pm1\\) ⇒ perpendicular.",
);
add(
  "coordinate_geometry",
  "conceptual",
  "**Radical axis** of two circles?",
  "Locus of points of **equal power** w.r.t. both circles; line \\(S_1-S_2=0\\).",
  "Line through both centers only",
  "Common chord only when circles don’t intersect",
  "Always a parabola",
  "Tangent lengths to the two circles equal.",
);
add(
  "coordinate_geometry",
  "numerical",
  "Circle through \\((0,0)\\), \\((3,0)\\), \\((0,4)\\). Radius?",
  "\\(2.5\\) (\\(5/2\\))",
  "\\(5\\)",
  "\\(3.5\\)",
  "\\(\\sqrt{12}\\)",
  "Right triangle inscribed; hypotenuse \\(5\\) is diameter.",
);
add(
  "coordinate_geometry",
  "conceptual",
  "Family of lines through intersection of \\(L_1=0\\) and \\(L_2=0\\)?",
  "\\(L_1 + \\lambda L_2 = 0\\) (or \\(L_1+\\lambda L_2\\) form).",
  "\\(L_1 L_2 = 0\\)",
  "\\(L_1^2+L_2^2=0\\)",
  "\\(L_1 = L_2\\) only",
  "Linear combination through common point.",
);
add(
  "coordinate_geometry",
  "numerical",
  "Locus of midpoints of chords of \\(x^2+y^2=a^2\\) subtending \\(90^\\circ\\) at origin?",
  "\\(x^2+y^2 = a^2/2\\)",
  "\\(x^2+y^2 = a^2\\)",
  "\\(x^2+y^2 = a/2\\)",
  "\\(x+y=0\\)",
  "Geometry: distance from center to chord \\(= a/\\sqrt{2}\\) for \\(90^\\circ\\) at center.",
);

// Block 9: Conics (81–90)
add(
  "conics",
  "conceptual",
  "Eccentricity \\(e\\): ellipse vs parabola vs hyperbola?",
  "Ellipse \\(0<e<1\\); parabola \\(e=1\\); hyperbola \\(e>1\\).",
  "All have \\(e<1\\)",
  "Hyperbola \\(e<1\\)",
  "Parabola \\(e=0\\)",
  "Deviation from circular (\\(e=0\\)).",
);
add(
  "conics",
  "numerical",
  "Latus rectum length of parabola \\(y^2 = 16x\\)?",
  "\\(16\\)",
  "\\(8\\)",
  "\\(4\\)",
  "\\(32\\)",
  "\\(y^2=4ax\\Rightarrow 4a=16\\).",
);
add(
  "conics",
  "conceptual",
  "Standard ellipse relation among \\(a,b,c\\) (semi-major, semi-minor, focal distance)?",
  "\\(a^2 = b^2 + c^2\\) (with \\(a\\) semi-major along major axis)",
  "\\(c^2 = a^2 + b^2\\)",
  "\\(a=b=c\\)",
  "\\(a+b=c\\)",
  "Right triangle from geometry of definition \\(2a\\) sum of focal distances.",
);
add(
  "conics",
  "numerical",
  "Eccentricity of hyperbola \\(16x^2 - 9y^2 = 144\\)?",
  "\\(5/3\\)",
  "\\(3/5\\)",
  "\\(5/4\\)",
  "\\(1\\)",
  "Standard form \\(x^2/9 - y^2/16 = 1\\); \\(e = \\sqrt{1+b^2/a^2}\\).",
);
add(
  "conics",
  "conceptual",
  "**Directrix** of a conic (focus–directrix definition)?",
  "Fixed line; ratio of distances from point to focus vs to directrix is \\(e\\).",
  "The major axis only",
  "The latus rectum only",
  "Center of the conic",
  "Defines parabola/ellipse/hyperbola with focus.",
);
add(
  "conics",
  "numerical",
  "Area inside ellipse \\(\\dfrac{x^2}{16} + \\dfrac{y^2}{9} = 1\\)?",
  "\\(12\\pi\\)",
  "\\(7\\pi\\)",
  "\\(48\\pi\\)",
  "\\(\\pi\\)",
  "Area \\(\\pi ab\\) with \\(a=4,b=3\\).",
);
add(
  "conics",
  "conceptual",
  "**Auxiliary circle** of an ellipse \\(x^2/a^2 + y^2/b^2 = 1\\) (\\(a>b\\))?",
  "\\(x^2+y^2=a^2\\); eccentric angle \\(\\theta\\) for \\((a\\cos\\theta,\\,b\\sin\\theta)\\) measured via this circle.",
  "\\(x^2+y^2=b^2\\) only",
  "The director circle only",
  "The circumcircle of any focal triangle",
  "Relates parametric angle to geometry.",
);
add(
  "conics",
  "numerical",
  "Ellipse foci \\((\\pm 4,0)\\), eccentricity \\(0.8\\). Length of **major** axis?",
  "\\(10\\)",
  "\\(8\\)",
  "\\(5\\)",
  "\\(20\\)",
  "\\(ae=4\\Rightarrow a=5\\Rightarrow 2a=10\\).",
);
add(
  "conics",
  "conceptual",
  "Why are asymptotes of a **rectangular** hyperbola \\(x^2-y^2=a^2\\) perpendicular?",
  "Here \\(a=b\\); asymptotes \\(y=\\pm x\\) have slopes \\(\\pm1\\) with product \\(-1\\).",
  "All hyperbolas have perpendicular asymptotes",
  "Because \\(e=1\\)",
  "Because foci coincide",
  "Equal \\(a\\) and \\(b\\) in standard rectangular form.",
);
add(
  "conics",
  "numerical",
  "Tangent to \\(y^2 = 8x\\) at \\((2,4)\\) (line form)?",
  "\\(x - y + 2 = 0\\) (equivalent rearrangements OK)",
  "\\(x+y=0\\)",
  "\\(y=2x\\)",
  "\\(2x+y-8=0\\)",
  "Chord of contact / \\(T=0\\): \\(yy_1 = 4(x+x_1)\\) for \\(y^2=4ax\\), \\(4a=8\\).",
);

// Block 10: Vectors, 3D, inverse trig (91–100)
add(
  "vectors_3d_trig",
  "conceptual",
  "Scalar triple product \\(\\mathbf{a}\\cdot(\\mathbf{b}\\times\\mathbf{c})\\) measures?",
  "**Signed volume** of parallelepiped with edges \\(\\mathbf{a},\\mathbf{b},\\mathbf{c}\\).",
  "Surface area only",
  "Angle between \\(\\mathbf{a}\\) and \\(\\mathbf{b}\\) only",
  "Always zero",
  "Volume = magnitude of STP (sign = orientation).",
);
add(
  "vectors_3d_trig",
  "numerical",
  "\\(|\\mathbf{a}\\times\\mathbf{b}|\\) for \\(\\mathbf{a}=2\\hat i+\\hat j-\\hat k\\), \\(\\mathbf{b}=\\hat i-\\hat j+2\\hat k\\)?",
  "\\(\\sqrt{35}\\)",
  "\\(\\sqrt{14}\\)",
  "\\(7\\)",
  "\\(5\\)",
  "Cross product \\((1,-5,-3)\\); magnitude \\(\\sqrt{1+25+9}\\).",
);
add(
  "vectors_3d_trig",
  "conceptual",
  "If \\(\\mathbf{a}\\cdot\\mathbf{b}=0\\) for non-zero \\(\\mathbf{a},\\mathbf{b}\\)?",
  "Vectors are **orthogonal** (\\(\\theta = 90^\\circ\\)).",
  "Parallel",
  "Anti-parallel only",
  "One must be zero",
  "\\(\\cos\\theta=0\\).",
);
add(
  "vectors_3d_trig",
  "numerical",
  "Shortest distance between skew lines \\(\\frac{x-1}{2}=\\frac{y-2}{3}=\\frac{z-3}{4}\\) and \\(\\frac{x-2}{3}=\\frac{y-4}{4}=\\frac{z-5}{5}\\)?",
  "\\(1/\\sqrt{6}\\)",
  "\\(\\sqrt{6}\\)",
  "\\(1/6\\)",
  "\\(0\\)",
  "\\(|(\\mathbf{a}_2-\\mathbf{a}_1)\\cdot\\mathbf{n}|/|\\mathbf{n}|\\) with \\(\\mathbf{n}=\\mathbf{b}_1\\times\\mathbf{b}_2\\).",
);
add(
  "vectors_3d_trig",
  "conceptual",
  "Why restrict \\(\\sin^{-1},\\cos^{-1},\\tan^{-1}\\) to **principal branches**?",
  "Trig functions are not one-to-one on \\(\\mathbb{R}\\); inverses need injective domains.",
  "To make derivatives infinite",
  "Because angles are always integers",
  "No restriction is needed",
  "Horizontal line test / function definition.",
);
add(
  "vectors_3d_trig",
  "numerical",
  "Principal values: \\(\\tan^{-1}(1)+\\cos^{-1}(-1/2)+\\sin^{-1}(-1/2)\\)?",
  "\\(3\\pi/4\\)",
  "\\(\\pi/2\\)",
  "\\(\\pi\\)",
  "\\(5\\pi/6\\)",
  "\\(\\pi/4 + 2\\pi/3 - \\pi/6\\).",
);
add(
  "vectors_3d_trig",
  "conceptual",
  "Three vectors **coplanar** iff?",
  "\\(\\mathbf{a}\\cdot(\\mathbf{b}\\times\\mathbf{c}) = 0\\) (scalar triple product zero).",
  "Their dot product is 1",
  "They are unit vectors",
  "Their sum is zero",
  "Zero parallelepiped volume.",
);
add(
  "vectors_3d_trig",
  "numerical",
  "Angle \\(\\theta\\) between planes \\(2x+y-2z=5\\) and \\(3x-6y-2z=7\\) satisfies?",
  "\\(\\cos\\theta = 4/21\\) (often written \\(\\theta = \\cos^{-1}(4/21)\\))",
  "\\(\\cos\\theta = 21/4\\)",
  "\\(\\theta = 90^\\circ\\)",
  "\\(\\cos\\theta = 1\\)",
  "Normals \\((2,1,-2)\\) and \\((3,-6,-2)\\); use dot product over magnitudes.",
);
add(
  "vectors_3d_trig",
  "conceptual",
  "**Direction cosines** \\((l,m,n)\\) of a vector in 3D?",
  "Cosines of angles with axes; for unit vector, \\((l,m,n)\\) are its components; \\(l^2+m^2+n^2=1\\).",
  "They always sum to \\(\\pi\\)",
  "They equal the vector’s magnitude",
  "Only defined in 2D",
  "Components of the normalized direction.",
);
add(
  "vectors_3d_trig",
  "numerical",
  "\\(\\sin\\bigl(2\\tan^{-1}(3/4)\\bigr)\\)?",
  "\\(24/25\\)",
  "\\(7/25\\)",
  "\\(3/5\\)",
  "\\(1\\)",
  "\\(\\sin 2\\theta = 2\\tan\\theta/(1+\\tan^2\\theta)\\) with \\(\\tan\\theta=3/4\\).",
);

if (Q.length !== 100) {
  console.error("Expected 100 questions, got", Q.length);
  process.exit(1);
}

const lines = [];
lines.push(`-- PUC 1/2 Mathematics (JEE/NEET style): 100 items, alternating conceptual / numerical.`);
lines.push(`-- academic / math; pack: ${PACK}`);
lines.push(`-- Generated by scripts/build-academic-math-puc100-migration.mjs`);
lines.push("");
lines.push("BEGIN;");
lines.push("");
lines.push("DELETE FROM public.play_questions");
lines.push("WHERE domain = 'academic'");
lines.push("  AND category = 'math'");
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
  const tag = `m${String(idx + 1).padStart(3, "0")}`;
  return `  ('academic', 'math', ${rating}, $${tag}c$${content}$${tag}c$::jsonb, $${tag}o$${options}$${tag}o$::jsonb, 0, $${tag}e$${q.e}$${tag}e$)`;
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
  "20260430343000_play_academic_math_puc100_jee_neet.sql",
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);
