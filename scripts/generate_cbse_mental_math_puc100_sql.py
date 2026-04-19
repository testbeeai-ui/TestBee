#!/usr/bin/env python3
"""
Generate Supabase INSERTs for play_questions (funbrain / mental_math).
Omits difficulty_rating — DB default 1000 applies.
Each item: stem, correct (string), explanation, three distractor strings.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

# (stem, correct, explanation, distractor1, distractor2, distractor3)
ROWS: list[tuple[str, str, str, str, str, str]] = [
    (
        "In combinatorics, how many distinct subsets containing exactly 2 elements can be formed from a master set containing 5 distinct elements?",
        "10",
        "This asks for combinations, ⁵C₂. Mentally calculate (5 × 4) / (2 × 1) = 20 / 2 = 10.",
        "20", "5", "25",
    ),
    (
        r"Evaluate \(3^4 \pmod 5\).",
        "1",
        "Calculate 3⁴ = 81. Divide 81 by 5, which gives 80 with a remainder of 1.",
        "0", "4", "2",
    ),
    (
        r"According to Vieta's formulas, what is the sum of the roots of the cubic equation \(x^3 - 6x^2 + 11x - 6 = 0\)?",
        "6",
        "The sum of the roots of any polynomial is always −b/a. Here, −(−6)/1 = 6.",
        "11", "−6", "3",
    ),
    (
        r"Evaluate \(\log_2(64) - \log_3(27)\).",
        "3",
        "log₂(64) = 6; log₃(27) = 3; therefore 6 − 3 = 3.",
        "9", "0", "1",
    ),
    (
        r"What is the total number of terms in the completely expanded binomial expression of \((x + y)^{15}\)?",
        "16",
        "The expansion of (a+b)ⁿ always yields exactly n + 1 terms.",
        "15", "14", "256",
    ),
    (
        r"Evaluate \(|3 - 4i|^2\).",
        "25",
        "The modulus squared is a² + b² = 9 + 16 = 25.",
        "5", "7", "34",
    ),
    (
        "If Set A and Set B are mutually disjoint, what is P(A ∩ B)?",
        "0",
        "Disjoint sets share no common elements; intersection is empty (impossible event).",
        "1", "P(A)P(B)", "P(A) + P(B)",
    ),
    (
        r"Evaluate \(2^{10} \div 2^7\).",
        "8",
        "Subtract exponents: 10 − 7 = 3; 2³ = 8.",
        "4", "16", "128",
    ),
    (
        r"Evaluate \(i^{2024} + i^{2025}\).",
        r"\(1 + i\)",
        "2024 is a multiple of 4, so i²⁰²⁴ = 1; i²⁰²⁵ = i.",
        r"\(0\)", r"\(1 - i\)", r"\(-1 + i\)",
    ),
    (
        r"Evaluate \(5! \div 3!\).",
        "20",
        "5! / 3! = 5 × 4 = 20 after cancelling 3!.",
        "60", "10", "15",
    ),
    (
        r"What is the absolute maximum value of \(3\sin(x) - 4\cos(x)\)?",
        "5",
        r"Maximum of a sin x + b cos x is √(a² + b²) = √(9+16) = 5.",
        "7", "1", "25",
    ),
    (
        r"Evaluate \(\sin(15^\circ)\cos(15^\circ)\).",
        r"\(1/4\)",
        r"Use 2 sin θ cos θ = sin 2θ: value is sin(30°)/2 = 1/4.",
        "1/2", "√3/4", "0",
    ),
    (
        r"How many real solutions does \(\sin(x) = 2\) have in \([0, 2\pi]\)?",
        "0",
        "Range of sine is [−1, 1]; it can never equal 2.",
        "1", "2", "∞",
    ),
    (
        r"Evaluate \(\tan(1^\circ)\tan(89^\circ)\).",
        "1",
        "tan(89°) = cot(1°); product of tan and cot of same angle is 1.",
        "0", "−1", "2",
    ),
    (
        r"What is the fundamental period of \(f(x) = \sin(3x)\)?",
        r"\(2\pi/3\)",
        "Period of sin(kx) is 2π/k.",
        r"\(2\pi\)", r"\(\pi/3\)", r"\(3\pi\)",
    ),
    (
        r"Evaluate \(\cos^2(\pi/8) - \sin^2(\pi/8)\).",
        r"\(\sqrt{2}/2\)",
        r"This is cos(π/4) = 1/√2 = √2/2.",
        "1", "0", "1/2",
    ),
    (
        r"What is the principal value of \(\arcsin(-\sqrt{3}/2)\) in radians?",
        r"\(-\pi/3\)",
        "Principal range [−π/2, π/2]; sin(−π/3) = −√3/2.",
        r"\(\pi/3\)", r"\(-\pi/6\)", r"\(\pi/6\)",
    ),
    (
        r"Evaluate \(2\sin(75^\circ)\cos(75^\circ)\).",
        "1/2",
        "Equals sin(150°) = 1/2.",
        "1", "√3/2", "0",
    ),
    (
        "In triangle ABC with sides a=3, b=4, c=5, what is cos(C)?",
        "0",
        "3-4-5 right triangle; angle C is 90°; cos 90° = 0.",
        "1", "3/5", "4/5",
    ),
    (
        r"Evaluate \(\sec^2(45^\circ) + \csc^2(45^\circ)\).",
        "4",
        "sec 45° = csc 45° = √2; each square is 2; sum = 4.",
        "2", "8", "1",
    ),
    (
        "What is the geometric mean of 4 and 36?",
        "12",
        "√(4×36) = √144 = 12.",
        "20", "9", "18",
    ),
    (
        r"Evaluate \(\sum_{k=1}^5 (2k - 1)\).",
        "25",
        "Sum of first n odd numbers is n²; here n=5 → 25.",
        "15", "36", "20",
    ),
    (
        "What is the 5th term of a GP with first term 2 and common ratio −2?",
        "32",
        "ar⁴ = 2(−2)⁴ = 2×16 = 32.",
        "−32", "16", "64",
    ),
    (
        r"Evaluate the infinite sum \(1 - 1/2 + 1/4 - 1/8 + \cdots\).",
        "2/3",
        "Geometric series a=1, r=−1/2; sum = 1/(1−r) = 2/3.",
        "1", "1/2", "4/3",
    ),
    (
        "The sum of the first n natural numbers is 55. Find n.",
        "10",
        "n(n+1)/2 = 55 ⇒ n(n+1)=110 ⇒ n=10.",
        "11", "9", "12",
    ),
    (
        r"Evaluate \((1+2+3)^2 - (1^2+2^2+3^2)\).",
        "22",
        "6² − (1+4+9) = 36 − 14 = 22.",
        "14", "36", "0",
    ),
    (
        "What is the arithmetic mean of the roots of x² − 10x + 21 = 0?",
        "5",
        "Sum of roots = 10; mean of two roots = 10/2 = 5.",
        "10", "21/2", "3",
    ),
    (
        r"Evaluate \(1000^{1/3} \times 16^{1/4}\).",
        "20",
        "10 × 2 = 20.",
        "12", "40", "8",
    ),
    (
        "How many positive three-digit integers are divisible by 5?",
        "180",
        "From 100 to 995 step 5: (995−100)/5 + 1 = 180.",
        "179", "200", "90",
    ),
    (
        r"Evaluate \(^5C_2 \times {}^3C_1\).",
        "30",
        "10 × 3 = 30.",
        "15", "20", "60",
    ),
    (
        "Tangent to y = x³ at x = −1 has slope 3. What is the slope of the normal at that point?",
        "−1/3",
        "Normal slope is negative reciprocal of tangent slope.",
        "3", "−3", "1/3",
    ),
    (
        r"Evaluate \(\lim_{x \to 2} \dfrac{x^2 - 4}{x - 2}\).",
        "4",
        "0/0 form; simplify to x+2 or L'Hôpital → 2x at 2 → 4.",
        "0", "2", "∞",
    ),
    (
        r"What is \(\dfrac{d}{d(e^x)}(e^{2x})\) (derivative of \(e^{2x}\) w.r.t. \(e^x\))?",
        r"\(2e^x\)",
        "Chain rule ratio du/dv gives 2e²ˣ/eˣ = 2eˣ.",
        r"\(2e^{2x}\)", r"\(e^x\)", "2",
    ),
    (
        r"Evaluate \(\dfrac{d}{dx}(\ln(x^3))\) at \(x = e\).",
        "3/e",
        "3/x at x=e gives 3/e.",
        "3", "1/e", "e³",
    ),
    (
        "x-coordinate of inflection of f(x) = x³ − 3x²?",
        "1",
        "f''(x) = 6x − 6 = 0 ⇒ x = 1.",
        "0", "2", "−1",
    ),
    (
        r"Evaluate \(\lim_{x \to \infty} \dfrac{2x^2 + 3}{5x^2 - 1}\).",
        "2/5",
        "Ratio of leading coefficients.",
        "5/2", "0", "1",
    ),
    (
        "If y = sin(x), what is the 2026th derivative of y w.r.t. x?",
        r"\(-\sin(x)\)",
        "Derivatives cycle every 4; 2026 ≡ 2 mod 4 → −sin x.",
        r"\(\sin(x)\)", r"\(\cos(x)\)", r"\(-\cos(x)\)",
    ),
    (
        r"Evaluate \(\dfrac{d}{dx}(x^x)\) at \(x = 1\).",
        "1",
        "xˣ(1 + ln x) at 1 gives 1.",
        "0", "e", "2",
    ),
    (
        "Minimum value of x² + 1/x² for real non-zero x (AM–GM)?",
        "2",
        "AM–GM gives (x² + 1/x²)/2 ≥ 1 ⇒ minimum sum 2.",
        "1", "4", "0",
    ),
    (
        r"Evaluate \(\lim_{x \to 0} \dfrac{1 - \cos 2x}{x^2}\).",
        "2",
        "1 − cos 2x = 2 sin²x; limit 2(sin x/x)² = 2.",
        "1", "4", "0",
    ),
    (
        "Definite integral of an odd continuous function from −a to a?",
        "0",
        "Symmetric limits cancel areas.",
        "2a", "1", "undefined",
    ),
    (
        r"Evaluate \(\int_0^{\pi/4} \sec^2 x \, dx\).",
        "1",
        "tan x from 0 to π/4 = 1 − 0 = 1.",
        "0", "√2", "2",
    ),
    (
        "Geometric area under y = sin x from 0 to π (above x-axis)?",
        "2",
        "∫₀^π sin x dx = 2.",
        "0", "1", "π",
    ),
    (
        r"Evaluate \(\int_0^1 x e^{x^2} \, dx\).",
        "(e − 1)/2",
        "u = x²; integral (1/2)(e − 1).",
        "e − 1", "e/2", "1/2",
    ),
    (
        r"Integrating factor for \(dy/dx + (1/x)y = x^2\)?",
        "x",
        "IF = e^{∫(1/x)dx} = e^{ln x} = x.",
        "1/x", "x²", "eˣ",
    ),
    (
        r"Evaluate \(\int_1^2 (3x^2 - 2x) \, dx\).",
        "4",
        "Antiderivative x³ − x²; (8−4)−(1−1)=4.",
        "3", "5", "2",
    ),
    (
        "Order of the differential equation y'' = √(1 + (y')³)?",
        "2",
        "Highest derivative is y''.",
        "1", "3", "0",
    ),
    (
        r"Evaluate \(\int_{-1}^1 |x| \, dx\).",
        "1",
        "Two triangles area 1/2 each → total 1.",
        "2", "0", "1/2",
    ),
    (
        "General solution of dy/dx = y/x?",
        "y = cx",
        "Separate and integrate → y proportional to x.",
        "y = x²", "y = eˣ", "y = 0",
    ),
    (
        r"Evaluate \(\int_0^{\infty} e^{-x} \, dx\).",
        "1",
        "Improper integral of e^{−x} from 0 to ∞ = 1.",
        "0", "∞", "e",
    ),
    (
        "Determinant of a skew-symmetric matrix of odd order (e.g. 3×3)?",
        "0",
        "Odd-order skew-symmetric matrices have determinant 0.",
        "1", "−1", "undefined",
    ),
    (
        "Determinant of 3I₃ (3×3 scalar multiple of identity)?",
        "27",
        "Product of diagonal: 3³ = 27.",
        "9", "3", "81",
    ),
    (
        "If A and B are symmetric matrices of same order, when is AB symmetric?",
        "If AB = BA (they commute)",
        "(AB)ᵀ = BᵀAᵀ = BA; need BA = AB.",
        "Always", "Never", "If A = B",
    ),
    (
        r"Trace of \(A = \begin{bmatrix}2 & -1\\ 4 & 5\end{bmatrix}\)?",
        "7",
        "Sum of diagonal: 2 + 5 = 7.",
        "6", "10", "−3",
    ),
    (
        "Relationship between |A| and |A⁻¹| for non-singular A?",
        "|A⁻¹| = 1/|A|",
        "|A||A⁻¹| = |I| = 1.",
        "|A⁻¹| = |A|", "|A⁻¹| = −|A|", "|A⁻¹| = 0",
    ),
    (
        "If |A| = 5 for 2×2 A, evaluate |2A|.",
        "20",
        "|kA| = kⁿ|A| with n=2 → 4×5 = 20.",
        "10", "40", "25",
    ),
    (
        "Maximum number of distinct 2×2 matrices with entries only 0 or 1?",
        "16",
        "2⁴ = 16 choices for four entries.",
        "8", "32", "4",
    ),
    (
        r"If \(|A| = 4\) for invertible 3×3 A, find \(|adj(A)|\).",
        "16",
        "|adj A| = |A|ⁿ⁻¹ = 4² = 16.",
        "4", "64", "12",
    ),
    (
        "A square matrix is orthogonal if AAᵀ equals?",
        "The identity matrix I",
        "Orthogonal: Aᵀ = A⁻¹ ⇒ AAᵀ = I.",
        "Zero matrix", "A", "2I",
    ),
    (
        "Rank of 2×2 matrix with rows [2,4] and [4,8]?",
        "1",
        "Rows are dependent; one independent row.",
        "2", "0", "−1",
    ),
    (
        "Geometric meaning of |a · (b × c)|?",
        "Volume of a parallelepiped",
        "Scalar triple product magnitude is parallelotope volume.",
        "Area of triangle", "Length of a", "Dot product",
    ),
    (
        r"Evaluate \(\hat{i} \cdot (\hat{j} \times \hat{k}) + \hat{j} \cdot (\hat{i} \times \hat{k})\).",
        "0",
        "1 + (−1) = 0.",
        "1", "2", "−2",
    ),
    (
        r"Locus of points satisfying \(x^2 + y^2 + z^2 = 0\) in ℝ³?",
        "The origin (0, 0, 0)",
        "Sum of squares zero ⇒ each coordinate 0.",
        "A sphere", "A line", "A plane",
    ),
    (
        "Perpendicular distance from (3,4,5) to the y-axis?",
        "√34",
        "√(x²+z²) = √(9+25) = √34.",
        "5", "7", "√50",
    ),
    (
        "Direction cosines of a line equally inclined to all three axes?",
        "±1/√3, ±1/√3, ±1/√3",
        "3 cos²θ = 1 ⇒ cos θ = ±1/√3.",
        "1, 0, 0", "1/2, 1/2, 1/√2", "1, 1, 1",
    ),
    (
        "Scalar projection of A = 2i − j + k onto B = i + 2j − 2k?",
        "−2/3",
        "(A·B)/|B| = −2/3.",
        "2/3", "0", "−2",
    ),
    (
        "Maximum number of mutually perpendicular unit vectors in ℝ³?",
        "3",
        "Dimension of space.",
        "2", "4", "∞",
    ),
    (
        "Dot product of two distinct unit vectors at 60°?",
        "1/2",
        "cos 60° = 1/2.",
        "0", "√3/2", "1",
    ),
    (
        "Four points are coplanar if scalar triple product of three edge vectors equals?",
        "0",
        "Zero volume ⇒ coplanar.",
        "1", "−1", "undefined",
    ),
    (
        "Area of parallelogram with adjacent sides 3i and 4j?",
        "12",
        "|3i × 4j| = 12.",
        "7", "24", "0",
    ),
    (
        "If A and B are independent, P(A|B) equals?",
        "P(A)",
        "Conditioning gives no new information.",
        "P(B)", "P(A∩B)", "0",
    ),
    (
        "Variance of Binomial(n=10, p=0.5)?",
        "2.5",
        "npq = 10×0.5×0.5 = 2.5.",
        "5", "2", "10",
    ),
    (
        "Bayes: initial probability before evidence is called?",
        "Prior probability",
        "Updated value is posterior.",
        "Posterior", "Likelihood", "Marginal",
    ),
    (
        "Fair coin tossed 3 times: probability of exactly two heads?",
        "3/8",
        "3 favorable outcomes out of 8.",
        "1/2", "1/4", "3/4",
    ),
    (
        "A numerical outcome of a random experiment is modeled as a?",
        "Random variable",
        "Maps outcomes to real numbers.",
        "Sample space", "Event", "Distribution",
    ),
    (
        "P(A)=0.6, P(B)=0.5, P(A∪B)=0.8. Find P(A∩B).",
        "0.3",
        "0.6+0.5−x=0.8 ⇒ x=0.3.",
        "0.1", "0.4", "0.8",
    ),
    (
        "Sum of probabilities over all outcomes of a discrete random variable?",
        "1",
        "Total probability is 100%.",
        "0", "100", "∞",
    ),
    (
        "Expected value of one roll of a fair six-sided die?",
        "3.5",
        "(1+2+3+4+5+6)/6 = 21/6 = 3.5.",
        "3", "4", "21",
    ),
    (
        "If E and F are mutually exclusive, P(E ∩ F)?",
        "0",
        "Cannot occur together.",
        "1", "P(E)P(F)", "P(E)+P(F)",
    ),
    (
        "Probability a random leap year has exactly 53 Sundays?",
        "2/7",
        "366 = 52 weeks + 2 days; 2 of 7 weekday pairs include Sunday.",
        "1/7", "3/7", "1/2",
    ),
    (
        "Distinct arrangements of n different objects in a circle?",
        "(n − 1)!",
        "Fix one object to break rotational symmetry.",
        "n!", "nⁿ", "2ⁿ",
    ),
    (
        r"Evaluate \(^6P_3 \div {}^6C_3\).",
        "6",
        "Equals r! = 3! = 6.",
        "3", "20", "120",
    ),
    (
        "Total number of subsets of a set with n distinct elements?",
        "2ⁿ",
        "Each element in or out.",
        "n!", "n²", "2n",
    ),
    (
        "Sum of all binomial coefficients in (1+x)¹⁰?",
        "1024",
        "Set x=1: 2¹⁰ = 1024.",
        "512", "100", "2048",
    ),
    (
        "Ways to select 1 or more from n identical items?",
        "n",
        "Choose count 1 through n.",
        "2ⁿ − 1", "n!", "1",
    ),
    (
        "Number of distinct diagonals in a regular decagon?",
        "35",
        "n(n−3)/2 = 10×7/2 = 35.",
        "10", "45", "20",
    ),
    (
        "If ⁿCᵣ = ⁿCᵣ₊₂, then n in terms of r?",
        "n = 2r + 2",
        "r + (r+2) = n.",
        "n = 2r", "n = r + 1", "n = 2r − 2",
    ),
    (
        r"Evaluate \(^8C_0 + {}^8C_2 + {}^8C_4 + {}^8C_6 + {}^8C_8\).",
        "128",
        "Sum of even binomial coefficients = 2ⁿ⁻¹ = 2⁷ = 128.",
        "256", "64", "120",
    ),
    (
        r"For \((ax + b/x)^n\), a term independent of x exists only if n is?",
        "An even integer",
        "Need n = 2r for zero power of x.",
        "Odd", "Prime", "Any positive integer",
    ),
    (
        "Coefficient of x⁴ in (1+x)⁶?",
        "15",
        "⁶C₄ = 15.",
        "20", "6", "30",
    ),
    (
        "Conic with eccentricity e < 1 (distance to focus / distance to directrix)?",
        "An ellipse",
        "e<1 defines ellipse.",
        "A parabola", "A hyperbola", "A circle",
    ),
    (
        "Distance between parallel lines 3x+4y=5 and 3x+4y=15?",
        "2",
        "|15−5|/5 = 2.",
        "10", "1", "5",
    ),
    (
        "Standard first base case in induction on natural numbers?",
        "n = 1",
        "Usually prove P(1) first.",
        "n = 0", "n = 2", "n = ∞",
    ),
    (
        r"Minimum value of \(4\sec^2 x + 9\csc^2 x\)?",
        "25",
        "Minimum (√a + √b)² with pattern gives (2+3)² = 25.",
        "13", "36", "12",
    ),
    (
        "A continuous function is strictly monotonic if it is?",
        "Strictly increasing or strictly decreasing throughout",
        "Derivative does not change sign.",
        "Constant", "Bounded", " Differentiable only once",
    ),
    (
        "Product of roots of 2x² − 7x + 12 = 0?",
        "6",
        "c/a = 12/2 = 6.",
        "7/2", "12", "−6",
    ),
    (
        "Which identity states e^{iπ} + 1 = 0?",
        "Euler's identity",
        "Links e, i, π, 1, 0.",
        "De Moivre's theorem", "Pythagorean theorem", "Binomial theorem",
    ),
    (
        r"Convert \(\pi/12\) radians to degrees.",
        "15°",
        "π rad = 180° ⇒ π/12 = 15°.",
        "12°", "30°", "75°",
    ),
    (
        r"Line \(x\cos\alpha + y\sin\alpha = p\) is in what standard form?",
        "Normal form (perpendicular form)",
        "p is perpendicular distance from origin.",
        "Slope-intercept form", "Intercept form", "Parametric form",
    ),
    (
        r"Evaluate \(\log_{10}(0.001)\).",
        "−3",
        "0.001 = 10⁻³.",
        "3", "0", "−1",
    ),
]

assert len(ROWS) == 100, len(ROWS)


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def build_options(correct: str, d1: str, d2: str, d3: str) -> tuple[list[str], int]:
    opts = [correct, d1, d2, d3]
    idx = 0
    random.shuffle(opts)
    correct_index = opts.index(correct)
    return opts, correct_index


def main() -> None:
    random.seed(42)
    lines = [
        "-- CBSE PUC 1/2 medium mental mathematics (100 items).",
        "-- funbrain / mental_math; difficulty_rating omitted (default 1000).",
        "",
        "INSERT INTO public.play_questions (domain, category, content, options, correct_answer_index, explanation)",
        "VALUES",
    ]
    value_rows: list[str] = []
    for stem, correct, expl, w1, w2, w3 in ROWS:
        opts, ci = build_options(correct, w1, w2, w3)
        content_json = json.dumps({"text": stem, "pack": "cbse_mental_math_puc100"}, ensure_ascii=False)
        options_json = json.dumps(opts, ensure_ascii=False)
        expl_sql = sql_escape(expl)
        value_rows.append(
            "  ('funbrain', 'mental_math', "
            f"'{sql_escape(content_json)}'::jsonb, "
            f"'{sql_escape(options_json)}'::jsonb, "
            f"{ci}, "
            f"'{expl_sql}')"
        )
    lines.append(",\n".join(value_rows) + ";")
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260430330000_play_mental_math_cbse_puc100_medium.sql"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(ROWS)} rows)")


if __name__ == "__main__":
    main()
