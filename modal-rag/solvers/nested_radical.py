"""
solvers/nested_radical.py — Infinite nested radicals and continued fractions.

Handles:
- x = √(a + √(a + ...)) → quadratic x² = a + x
- x = √(a - √(a + ...)) → system of equations
- x = √(a + √(b + ...)) → general nested radicals
- Alternating sign patterns
- Continued fractions
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout, clean_latex,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "nested_radical"


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

PATTERNS = [
    {"pattern": re.compile(r"\\sqrt\s*\{.*?\\sqrt\s*\{", re.I), "type": "nested_sqrt"},
    {"pattern": re.compile(r"nested\s*radical", re.I), "type": "nested_radical"},
    {"pattern": re.compile(r"√.*√", re.I), "type": "nested_sqrt"},
    {"pattern": re.compile(r"infinite.*radical", re.I), "type": "infinite_radical"},
    {"pattern": re.compile(r"continued\s*fraction", re.I), "type": "continued_fraction"},
    {"pattern": re.compile(r"\\cfrac|\\dfrac.*\\cfrac", re.I), "type": "continued_fraction"},
]


# ---------------------------------------------------------------------------
# Core solvers
# ---------------------------------------------------------------------------

def _extract_nested_constant(expr_latex: str) -> tuple:
    """
    Extract the repeating constant from nested radical LaTeX.
    Returns (constant_a, constant_b, structure_type) or None.

    Patterns detected:
    - √(a + √(a + ...)) → (a, a, "same")
    - √(a - √(a + ...)) → (a, a, "alternating")
    - √(a + √(b + ...)) → (a, b, "different")
    """
    cleaned = clean_latex(expr_latex)

    # Pattern: \sqrt{N + \sqrt{N + ...}} or \sqrt{N+\sqrt{N+\cdots}}
    m = re.search(
        r'\\sqrt\s*\{?\s*(\d+)\s*(\+|-)\s*\\sqrt\s*\{?\s*(\d+)\s*(\+|-)',
        cleaned
    )
    if m:
        a = int(m.group(1))
        sign1 = m.group(2)
        b = int(m.group(3))
        sign2 = m.group(4)

        if sign1 == "+" and sign2 == "+":
            return (a, b, "same_plus")
        elif sign1 == "-" and sign2 == "+":
            return (a, b, "alternating")
        elif sign1 == "+" and sign2 == "-":
            return (a, b, "alternating_reverse")
        else:
            return (a, b, "same_minus")

    # Simpler pattern: \sqrt{N + \sqrt{N + \cdots}} with same constant
    m = re.search(r'\\sqrt\s*\{?\s*(\d+)\s*\+?\s*\\sqrt', cleaned)
    if m:
        a = int(m.group(1))
        return (a, a, "same_plus")

    return None


def _solve_nested_radical_same_plus(a: int) -> list:
    """
    Solve x = √(a + √(a + ...))
    x = √(a + x) → x² = a + x → x² - x - a = 0
    """
    from sympy import Symbol, solve, sqrt, simplify, S

    x = Symbol("x")
    eq = x**2 - x - a
    solutions = solve(eq, x)

    # Filter: x must be >= 0 (since √ returns non-negative)
    valid = [s for s in solutions if s.is_real and s >= 0]
    return valid, solutions


def _solve_nested_radical_alternating(a: int, b: int) -> tuple:
    """
    Solve: x = √(a - √(b + √(a - √(b + ...))))
    Let y = √(b + √(a - √(b + ...)))  (the inner part)
    Then: x = √(a - y) and y = √(b + x)
    So: x² = a - y and y² = b + x
    Substituting: x² = a - √(b + x)
    Square: (a - x²)² = b + x → x⁴ - 2ax² - x + a² - b = 0
    """
    from sympy import Symbol, solve, sqrt, simplify

    x = Symbol("x")
    # x² = a - y, y = √(b + x)
    # So: x² = a - √(b + x)
    # Let u = √(b + x), then u² = b + x, x = u² - b
    # Substituting: (u² - b)² = a - u → u⁴ - 2bu² + b² = a - u
    # u⁴ - 2bu² + u + b² - a = 0

    u = Symbol("u")
    eq_u = u**4 - 2*b*u**2 + u + b**2 - a
    u_solutions = solve(eq_u, u)

    # Convert back to x: x = u² - b
    x_solutions = []
    for u_sol in u_solutions:
        x_val = u_sol**2 - b
        x_solutions.append(x_val)

    # Filter: x >= 0, u >= 0
    valid = [x_val for x_val in x_solutions if x_val.is_real and x_val >= 0]
    return valid, x_solutions


def _solve_continued_fraction(terms: list) -> Any:
    """
    Evaluate a finite continued fraction [a0; a1, a2, ..., an].
    Returns the exact rational value.
    """
    from sympy import Rational

    if not terms:
        return None

    # Start from the last term
    result = Rational(terms[-1])
    for i in range(len(terms) - 2, -1, -1):
        result = Rational(terms[i]) + Rational(1, result)

    return result


def _verify_nested_radical_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Main verification logic for nested radicals."""
    from sympy import sqrt, simplify, N

    try:
        parsed = _extract_nested_constant(expr_latex)

        if parsed is None:
            # Try to parse as a self-referential equation directly
            return error_response("Could not extract nested radical structure", SOLVER_NAME)

        a, b, structure = parsed

        if structure == "same_plus":
            valid, all_sols = _solve_nested_radical_same_plus(a)
            desc = f"x = √({a} + √({a} + ...))"
        elif structure in ("alternating", "alternating_reverse"):
            valid, all_sols = _solve_nested_radical_alternating(a, b)
            desc = f"x = √({a} - √({b} + √({a} - ...)))"
        else:
            # For other structures, try the same_plus approach
            valid, all_sols = _solve_nested_radical_same_plus(a)
            desc = f"x = √({a} ± √({a} + ...))"

        # Parse claimed result
        claimed = parse_expr_safe(claimed_latex)

        # Check if claimed matches any valid solution
        for sol in valid:
            if check_equivalence(sol, claimed, var_name):
                return build_response(
                    correct=True,
                    computed=str(sol),
                    confidence="high",
                    explanation=f"{desc} → x² = {a} + x → positive root x = {sol}",
                    detected_type=SOLVER_NAME,
                )

        # Check if claimed is an extraneous root (negative solution)
        for sol in all_sols:
            if check_equivalence(sol, claimed, var_name) and sol < 0:
                return build_response(
                    correct=False,
                    computed=str(valid[0]) if valid else str(all_sols),
                    confidence="high",
                    explanation=(
                        f"{desc} → x² = {a} + x → solutions {all_sols}. "
                        f"Claimed {claimed} is negative (extraneous root). "
                        f"Valid root: {valid}"
                    ),
                    detected_type=SOLVER_NAME,
                )

        return build_response(
            correct=False,
            computed=str(valid[0]) if valid else str(all_sols),
            confidence="high",
            explanation=(
                f"{desc} → solutions: {all_sols}, valid (≥0): {valid}, "
                f"claimed: {claimed}"
            ),
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Nested radical verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_continued_fraction_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Verify continued fraction evaluation."""
    try:
        # Extract terms from params or parse from expression
        terms = params.get("terms", [])
        if not terms:
            return error_response("No continued fraction terms provided", SOLVER_NAME)

        result = _solve_continued_fraction(terms)
        claimed = parse_expr_safe(claimed_latex)

        if result is not None and check_equivalence(result, claimed, var_name):
            return build_response(
                correct=True,
                computed=str(result),
                confidence="high",
                explanation=f"Continued fraction [{', '.join(map(str, terms))}] = {result}",
                detected_type=SOLVER_NAME,
            )

        return build_response(
            correct=False,
            computed=str(result),
            confidence="high",
            explanation=f"Continued fraction = {result}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Continued fraction verification failed: {str(e)[:200]}", SOLVER_NAME)


# ---------------------------------------------------------------------------
# Public verify function
# ---------------------------------------------------------------------------

def verify(expr_latex: str, claimed_latex: str, var_name: str, params: dict) -> dict:
    """Main entry point for nested radical verification."""
    # Check if it's a continued fraction
    if params.get("type") == "continued_fraction":
        return _verify_continued_fraction_impl(expr_latex, claimed_latex, var_name, params)

    result = with_timeout(
        lambda: _verify_nested_radical_impl(expr_latex, claimed_latex, var_name, params)
    )
    if result is None:
        return error_response("Nested radical verification timed out", SOLVER_NAME)
    return result


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

register_solver(SOLVER_NAME, PATTERNS, verify)
