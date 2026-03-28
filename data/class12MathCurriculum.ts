import type { ExamType } from '@/types';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { CurriculumUnit, CurriculumChapter, CurriculumTopic } from '@/data/class12PhysicsCurriculum';

const RAW_CLASS12_MATH_CURRICULUM = `
UNIT I - RELATIONS AND FUNCTIONS

Ch 1: Relations and Functions

Topic: Types of Relations
Empty relation: no element of A is related to any element; R = phi subset of A x A
Universal relation: every element is related to every element; R = A x A
Reflexive relation: (a, a) in R for every a in A
Symmetric relation: (a,b) in R implies (b,a) in R
Transitive relation: (a,b) in R and (b,c) in R implies (a,c) in R
Equivalence relation: reflexive + symmetric + transitive
Equivalence class [a]: all elements b such that (a,b) in R; classes partition the set

Topic: Types of Functions
Injective (one-to-one): f(a1) = f(a2) implies a1 = a2; or a1 != a2 implies f(a1) != f(a2)
Surjective (onto): for every b in codomain, there exists a in domain such that f(a) = b
Bijective: both injective and surjective; inverse function exists
Horizontal line test: function is injective iff every horizontal line meets graph at most once
Number of functions from A(m elements) to B(n elements) = n^m

Ch 2: Inverse Trigonometric Functions

Topic: Domain and Range (Must Memorise)
sin^-1x: domain [-1, 1]; range [-pi/2, pi/2] (principal value branch)
cos^-1x: domain [-1, 1]; range [0, pi]
tan^-1x: domain R; range (-pi/2, pi/2)
cosec^-1x: domain R - (-1, 1); range [-pi/2, pi/2] - {0}
sec^-1x: domain R - (-1, 1); range [0, pi] - {pi/2}
cot^-1x: domain R; range (0, pi)

Topic: Key Properties and Identities
sin^-1(-x) = -sin^-1x; cos^-1(-x) = pi - cos^-1x; tan^-1(-x) = -tan^-1x
sin^-1x + cos^-1x = pi/2; tan^-1x + cot^-1x = pi/2; sec^-1x + cosec^-1x = pi/2
tan^-1x + tan^-1y = tan^-1[(x+y)/(1-xy)] when xy < 1
2tan^-1x = sin^-1[2x/(1+x^2)] = cos^-1[(1-x^2)/(1+x^2)] = tan^-1[2x/(1-x^2)]
Simplification: sin^-1(sin x) = x only if x in [-pi/2, pi/2]; otherwise apply range restriction

UNIT II - ALGEBRA

Ch 3: Matrices

Topic: Matrix Basics
Matrix of order m x n: m rows and n columns; element aij is in row i, column j
Types: row matrix (1 x n), column (m x 1), square (m=n), zero/null, identity I (aij = deltaij), diagonal, scalar
Equality: same order AND corresponding elements equal

Topic: Matrix Operations
Addition (A+B): only if same order; (A+B)ij = aij + bij; commutative and associative
Scalar multiplication: (kA)ij = k.aij
Matrix multiplication (AB): A is m x n and B is n x p -> AB is m x p; (AB)ij = Sigma_k aikbkj
Non-commutativity: AB != BA in general; AB = 0 does not imply A=0 or B=0
Associativity: (AB)C = A(BC); distributive: A(B+C) = AB + AC

Topic: Transpose and Symmetric
Transpose AT: rows become columns; (AT)T = A; (kA)T = kAT; (A+B)T = AT + BT; (AB)T = BTAT
Symmetric: AT = A (aij = aji); diagonal elements can be anything
Skew-symmetric: AT = -A (aij = -aji; aii = 0 always)
Any matrix A = 1/2(A + AT) + 1/2(A - AT) (symmetric + skew-symmetric decomposition)

Topic: Invertible Matrices
A is invertible if B such that AB = BA = I; B = A^-1
Inverse is unique (if it exists); square matrix invertible iff |A| != 0
Using elementary row operations to find A^-1: write [A|I] and reduce to [I|A^-1]

Ch 4: Determinants

Topic: Computation
2 x 2 det: |A| = a11a22 - a12a21
3 x 3 det (Sarrus or cofactor expansion along any row/column): 6 products (3 positive, 3 negative)
Expansion along row i: |A| = Sigma_j aij.Cij (Cij = cofactor of aij)

Topic: Properties of Determinants
P1: det(A) = det(AT) (row and column operations equivalent)
P2: Interchange any two rows/cols -> det changes sign
P3: Two identical rows/cols -> det = 0
P4: Multiply one row by k -> det multiplied by k
P5: Add multiple of one row to another -> det unchanged
P6: det is linear in each row separately
P7: det(AB) = det(A).det(B); det(kA) = k^n det(A) for n x n matrix

Topic: Cofactors, Adjoint and Inverse
Minor Mij: det of matrix obtained by deleting row i and col j
Cofactor Cij = (-1)^(i+j) Mij
Adjoint: adj(A) = transpose of cofactor matrix; A.adj(A) = |A|.I
A^-1 = adj(A)/|A| (valid only if |A| != 0; A is non-singular)
Area of triangle formula using determinant representation

Topic: Solving Linear Equations
Matrix equation: AX = B; solution X = A^-1B (only if |A| != 0 -> unique solution)
Consistent (infinite solutions): |A| = 0 and (adj A)B = 0
Inconsistent (no solution): |A| = 0 and (adj A)B != 0

UNIT III - CALCULUS

Ch 5: Continuity and Differentiability

Topic: Continuity
f is continuous at x = a if: f(a) exists, lim_(x->a) f(x) exists, and both are equal
LHL = lim_(x->a-) f(x); RHL = lim_(x->a+) f(x); both must equal f(a)
Continuous functions: polynomials, rational (at non-zero denominator), trig, exp, log on their domains
Algebra of continuous functions: sum, product, quotient (denominator != 0), composition are continuous

Topic: Differentiability
f is differentiable at x = a if LHD = RHD; one-sided derivative limits must match
Differentiability implies continuity (converse not always true); |x| is continuous but not differentiable at x=0
Second order derivative: d^2y/dx^2 = d/dx(dy/dx); notation f''(x) or y''

Topic: Differentiation Methods
Chain rule: d/dx[f(g(x))] = f'(g(x)).g'(x)
Derivatives of inverse trig: d/dx(sin^-1x) = 1/sqrt(1-x^2); d/dx(cos^-1x) = -1/sqrt(1-x^2); d/dx(tan^-1x) = 1/(1+x^2)
Implicit differentiation: treat y as function of x; d/dx(y^2) = 2y dy/dx
Logarithmic differentiation: useful for [f(x)]^{g(x)} type
Parametric: dy/dx = (dy/dt)/(dx/dt); d^2y/dx^2 = (d/dt)(dy/dx)/(dx/dt)

Ch 6: Applications of Derivatives

Topic: Rate of Change
ds/dt = velocity; dv/dt = acceleration; dA/dt = rate of change of area
Related rates: connect rates using chain rule; establish equation relating variables first

Topic: Increasing, Decreasing and Critical Points
Increasing on (a,b): f'(x) > 0 for all x in (a,b)
Decreasing on (a,b): f'(x) < 0 for all x in (a,b)
Critical point: f'(c) = 0 or f'(c) undefined

Topic: Tangent and Normal
Slope of tangent at P(x1,y1) = dy/dx at the point
Equation of tangent: y - y1 = m(x - x1)
Slope of normal = -1/m
Equation of normal: y - y1 = (-1/m)(x - x1)

Topic: Maxima and Minima
First Derivative Test: f'(c)=0; + to - gives local max; - to + gives local min
Second Derivative Test: f'(c)=0 and f''(c)<0 gives max; f''(c)>0 gives min; f''(c)=0 inconclusive
Absolute max/min on [a,b]: evaluate f at critical points in (a,b) and endpoints
Optimisation: frame equation, differentiate, set to zero, verify with second derivative test

Ch 7: Integrals

Topic: Indefinite Integrals - Standard Forms
Integral x^n dx = x^(n+1)/(n+1) + C (n != -1); integral 1/x dx = ln|x| + C
Integral e^x dx = e^x + C; integral a^x dx = a^x/ln a + C
Integral sin x dx = -cos x + C; integral cos x dx = sin x + C
Integral sec^2x dx = tan x + C; integral cosec^2x dx = -cot x + C
Integral sec x tan x dx = sec x + C; integral cosec x cot x dx = -cosec x + C
Integral tan x dx = ln|sec x| + C; integral cot x dx = ln|sin x| + C
Integral sec x dx = ln|sec x + tan x| + C; integral cosec x dx = ln|cosec x - cot x| + C

Topic: Special Standard Integrals
Integral dx/(x^2+a^2) = (1/a)tan^-1(x/a) + C
Integral dx/sqrt(a^2-x^2) = sin^-1(x/a) + C
Integral dx/(x^2-a^2) = (1/2a)ln|(x-a)/(x+a)| + C
Integral dx/(a^2-x^2) = (1/2a)ln|(a+x)/(a-x)| + C
Integral sqrt(a^2-x^2) dx = (x/2)sqrt(a^2-x^2) + (a^2/2)sin^-1(x/a) + C
Integral sqrt(x^2+a^2) dx = (x/2)sqrt(x^2+a^2) + (a^2/2)ln|x+sqrt(x^2+a^2)| + C
Integral sqrt(x^2-a^2) dx = (x/2)sqrt(x^2-a^2) - (a^2/2)ln|x+sqrt(x^2-a^2)| + C

Topic: Methods of Integration
Substitution: choose u = g(x) so integrand simplifies; du = g'(x)dx
Partial fractions: decompose rational function P(x)/Q(x) where degree P < degree Q
Integration by parts (ILATE): integral u dv = uv - integral v du
ILATE order: Inverse trig > Logarithm > Algebraic > Trigonometric > Exponential

Topic: Definite Integrals
Fundamental Theorem: integral_a^b f(x) dx = F(b) - F(a)
Property 1: integral_a^b f = -integral_b^a f
Property 2: integral_a^b = integral_a^c + integral_c^b
King's property: integral_a^b f(x)dx = integral_a^b f(a+b-x)dx
Even function: integral_-a^a f(x)dx = 2integral_0^a f(x)dx
Odd function: integral_-a^a f(x)dx = 0

Ch 8: Application of Integrals

Topic: Area Under Curves
Area between curve y = f(x) and x-axis from x=a to x=b: A = integral_a^b |f(x)| dx
Area between curve x = g(y) and y-axis from y=c to y=d: A = integral_c^d |g(y)| dy
Area between two curves: A = integral_a^b [f(x) - g(x)] dx where f(x) >= g(x)
Find intersection points first (set f(x) = g(x)) to determine limits

Ch 9: Differential Equations

Topic: Basic Concepts
Order: highest order derivative present; Degree: power of highest order derivative after clearing radicals
Degree is undefined if DE involves trig/log of derivatives
General solution: contains arbitrary constants equal to order of DE
Particular solution: obtained by substituting specific initial/boundary conditions
Formation of DE: if solution has n constants, differentiate n times and eliminate constants

Topic: Variable Separable
Form: dy/dx = f(x).g(y) -> dy/g(y) = f(x)dx -> integrate both sides
Example flow: dy/dx = xy -> dy/y = x dx -> ln|y| = x^2/2 + C

Topic: Homogeneous Differential Equations
Homogeneous form: dy/dx = F(y/x)
Substitute y = vx -> dy/dx = v + x dv/dx
Reduce to separable equation in v and x, integrate, then replace v = y/x

Topic: Linear Differential Equations
Form: dy/dx + P(x)y = Q(x); Integrating Factor = e^(integral P(x)dx)
Solution: y * IF = integral (Q * IF) dx + C
Form: dx/dy + P(y)x = Q(y); IF = e^(integral P(y)dy)
Solution: x * IF = integral (Q * IF) dy + C

UNIT IV - VECTORS AND THREE-DIMENSIONAL GEOMETRY

Ch 10: Vectors

Topic: Fundamentals
Scalar: magnitude only; Vector: magnitude and direction
Position vector of point P(x,y,z): OP = xi + yj + zk; |OP| = sqrt(x^2+y^2+z^2)
Unit vector a_hat = a/|a|; zero vector has zero magnitude and no direction
Equal vectors: same magnitude and direction
Collinear vectors: a = lambda b for some scalar lambda

Topic: Operations
Section formula: P divides AB in ratio m:n internally -> OP = (m.OB + n.OA)/(m+n)
Addition: triangle law OA + AB = OB; parallelogram law for resultant
Direction cosines l,m,n satisfy l^2 + m^2 + n^2 = 1
Direction ratios are proportional to direction cosines

Topic: Dot Product
a.b = |a||b|cos(theta) = a1b1 + a2b2 + a3b3
a.a = |a|^2; i.i = j.j = k.k = 1; i.j = j.k = k.i = 0
Angle relation: cos(theta) = (a.b)/(|a||b|); perpendicular if a.b = 0
Projection of a on b and component vector formulas

Topic: Cross Product
a x b = |a||b|sin(theta) n_hat by right-hand rule
Determinant form for cross product in i,j,k
i x j = k, j x k = i, k x i = j and anti-cyclic negatives
a x a = 0; a x b = -(b x a)
Area of triangle with sides a,b = (1/2)|a x b|
Area of parallelogram with sides a,b = |a x b|
Parallel vectors condition: a x b = 0

Ch 11: Three-Dimensional Geometry

Topic: Line in 3D
Vector equation: r = a + lambda b
Cartesian form: (x-x1)/l = (y-y1)/m = (z-z1)/n = lambda
Line through A and B has direction ratios (x2-x1, y2-y1, z2-z1)
Angle between lines formula via direction ratios/cosines
Parallel lines have proportional direction ratios; perpendicular satisfy dot product zero

Topic: Skew Lines and Shortest Distance
Skew lines: non-intersecting and non-parallel lines in 3D
Shortest distance between skew lines formula using scalar triple product
Shortest distance between parallel lines formula using cross product

UNIT V - LINEAR PROGRAMMING

Ch 12: Linear Programming

Topic: Formulation
Decision variables x, y representing quantities with x >= 0, y >= 0
Objective function Z = ax + by to maximize or minimize
Constraints are linear inequalities with non-negativity conditions

Topic: Graphical Solution
Plot each constraint as a line and choose satisfying half-planes
Feasible region is intersection of all constraints
Corner Point Method: optimum occurs at a vertex of feasible region
Evaluate objective function at all vertices and choose best value
Bounded feasible region typically has both max and min
Unbounded region may not have finite max in maximization cases

Topic: Types of LPP
Manufacturing: maximize profit under resource constraints
Diet: minimize cost under nutrition constraints
Transportation: minimize transport cost

UNIT VI - PROBABILITY

Ch 13: Probability

Topic: Conditional Probability
P(A|B) = P(A intersect B)/P(B), P(B) > 0
Multiplication theorem: P(A intersect B) = P(A)P(B|A) = P(B)P(A|B)
Extended multiplication theorem for multiple events
Properties: 0 <= P(A|B) <= 1, P(S|B)=1, P(A'|B)=1-P(A|B)

Topic: Independent Events
A and B independent if P(A|B)=P(A), equivalent to P(A intersect B)=P(A)P(B)
Independent and mutually exclusive are not the same
Mutual independence for three events includes pairwise and triple-product conditions

Topic: Total Probability and Bayes' Theorem
Partition B1, B2, ..., Bn are mutually exclusive and exhaustive
Total probability: P(A) = Sigma_i P(Bi)P(A|Bi)
Bayes' theorem: P(Bi|A) = P(Bi)P(A|Bi) / Sigma_j P(Bj)P(A|Bj)
Prior probability is before observation; posterior is after observing event A

Topic: Random Variable
Discrete random variable takes countable values with probabilities
Probability distribution conditions: Sigma pi = 1 and pi >= 0
Expectation: E(X) = Sigma x_i p_i
Variance: Var(X) = E(X^2) - [E(X)]^2
Standard deviation: sigma = sqrt(Var(X))

Topic: Binomial Distribution
Conditions: n independent Bernoulli trials, constant success probability p
P(X = r) = nCr * p^r * q^(n-r), q = 1-p
Mean = np; Variance = npq; Standard deviation = sqrt(npq)
Mode rule based on (n+1)p
`;

function parseClass12MathCurriculum(raw: string): CurriculumUnit[] {
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

export const class12MathUnits: CurriculumUnit[] = parseClass12MathCurriculum(
  RAW_CLASS12_MATH_CURRICULUM
);

const CLASS_12_MATH_EXAMS: ExamType[] = ['JEE', 'KCET'];

export const math12DetailedTopicTaxonomy: TopicNode[] = class12MathUnits.flatMap((unit) =>
  unit.chapters.flatMap((chapter) =>
    chapter.topics.map((topic) => ({
      subject: 'math',
      classLevel: 12,
      topic: topic.title,
      chapterTitle: chapter.title,
      unitLabel: unit.unitLabel,
      unitTitle: unit.unitTitle,
      subtopics: topic.subtopics.map((name) => ({ name })),
      examRelevance: CLASS_12_MATH_EXAMS,
    }))
  )
);
