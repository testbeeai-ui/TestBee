"""
solvers/functions.py — Function composition, inverse, piecewise, domain/range.

Handles:
- f(g(x)) composition at depth N
- Inverse functions
- Piecewise function evaluation
- f(f(x)) = k equation solving
- Domain and range finding
- Functional equations
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout, clean_latex,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "functions"


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

PATTERNS = [
    {"pattern": re.compile(r"f\s*\(\s*f\s*\(", re.I), "type": "composition"},
    {"pattern": re.compile(r"function.*compos", re.I), "type": "composition"},
    {"pattern": re.compile(r"f\s*[\^⁲]\s*2|f\^2|f\s*∘\s*f", re.I), "type": "composition"},
    {"pattern": re.compile(r"compose.*function", re.I), "type": "composition"},
    {"pattern": re.compile(r"inverse.*function|f\s*\^\s*[\-−]\s*1", re.I), "type": "inverse"},
    {"pattern": re.compile(r"piecewise", re.I), "type": "piecewise"},
    {"pattern": re.compile(r"domain.*range|find.*domain", re.I), "type": "domain_range"},
    {"pattern": re.compile(r"functional\s*equation", re.I), "type": "functional_eq"},
]


# ---------------------------------------------------------------------------
# Core solvers
# ---------------------------------------------------------------------------

def _compose_functions(f_expr, x, depth: int = 2):
    """Compute f(f(...f(x)...)) at given depth."""
    result = f_expr
    for _ in range(depth - 1):
        result = result.subs(x, f_expr)
    return result


def _verify_composition_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Verify function composition."""
    from sympy import Symbol, solve, simplify

    try:
        x = Symbol(var_name)

        # Get f definition from params or expression
        f_def_str = params.get("f_definition", expr_latex)
        f_def = parse_expr_safe(f_def_str)

        depth = params.get("composition_depth", 2)
        target = params.get("target_value")

        # Compute f^depth(x)
        composed = _compose_functions(f_def, x, depth)
        composed = simplify(composed)

        if target is not None:
            # Solve f^depth(x) = target
            target_expr = parse_expr_safe(str(target))
            solutions = solve(composed - target_expr, x)

            claimed = parse_expr_safe(claimed_latex)

            # Check if claimed is among solutions
            for sol in solutions:
                if check_equivalence(sol, claimed, var_name):
                    # Verify by substitution
                    check_val = composed.subs(x, sol)
                    if check_numerical(check_val, target_expr):
                        return build_response(
                            correct=True,
                            computed=str(sol),
                            confidence="high",
                            explanation=(
                                f"f^{depth}(x) = {composed}, "
                                f"solving f^{depth}(x) = {target} gives x = {sol}"
                            ),
                            detected_type=SOLVER_NAME,
                        )

            return build_response(
                correct=False,
                computed=str(solutions),
                confidence="high",
                explanation=(
                    f"f^{depth}(x) = {composed}, "
                    f"solutions = {solutions}, claimed = {claimed}"
                ),
                detected_type=SOLVER_NAME,
            )
        else:
            # Just verify the composed function matches
            claimed = parse_expr_safe(claimed_latex)
            if check_equivalence(composed, claimed, var_name):
                return build_response(
                    correct=True,
                    computed=str(composed),
                    confidence="high",
                    explanation=f"f^{depth}(x) = {composed}",
                    detected_type=SOLVER_NAME,
                )

            return build_response(
                correct=False,
                computed=str(composed),
                confidence="high",
                explanation=f"f^{depth}(x) = {composed}, claimed = {claimed}",
                detected_type=SOLVER_NAME,
            )

    except Exception as e:
        return error_response(f"Composition verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_inverse_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Verify inverse function."""
    from sympy import Symbol, solve, simplify

    try:
        x = Symbol(var_name)
        y = Symbol("y")

        f_expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Solve y = f(x) for x
        solutions = solve(y - f_expr, x)

        for sol in solutions:
            # Substitute y back to get f^{-1}(x)
            inverse = sol.subs(y, x)
            if check_equivalence(inverse, claimed, var_name):
                return build_response(
                    correct=True,
                    computed=str(inverse),
                    confidence="high",
                    explanation=f"f^{{-1}}(x) = {inverse}",
                    detected_type=SOLVER_NAME,
                )

        inverses = [sol.subs(y, x) for sol in solutions]
        return build_response(
            computed=str(inverses),
            confidence="medium",
            correct=False,
            explanation=f"f^{{-1}}(x) candidates: {inverses}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Inverse function verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_domain_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Verify domain of a function."""
    from sympy import Symbol, S, sqrt, log, oo
    from sympy.calculus.util import continuous_domain

    try:
        x = Symbol(var_name)
        f_expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        domain = continuous_domain(f_expr, x, S.Reals)

        # Compare with claimed (could be an interval or set)
        if check_equivalence(domain, claimed, var_name):
            return build_response(
                correct=True,
                computed=str(domain),
                confidence="high",
                explanation=f"Domain of {f_expr} = {domain}",
                detected_type=SOLVER_NAME,
            )

        return build_response(
            correct=False,
            computed=str(domain),
            confidence="high",
            explanation=f"Domain of {f_expr} = {domain}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Domain verification failed: {str(e)[:200]}", SOLVER_NAME)


# ---------------------------------------------------------------------------
# Public verify function
# ---------------------------------------------------------------------------

def verify(expr_latex: str, claimed_latex: str, var_name: str, params: dict) -> dict:
    """Main entry point for function verification."""
    problem_type = params.get("type", "composition")

    if problem_type == "inverse":
        fn = lambda: _verify_inverse_impl(expr_latex, claimed_latex, var_name, params)
    elif problem_type == "domain":
        fn = lambda: _verify_domain_impl(expr_latex, claimed_latex, var_name, params)
    else:
        fn = lambda: _verify_composition_impl(expr_latex, claimed_latex, var_name, params)

    result = with_timeout(fn)
    if result is None:
        return error_response("Function verification timed out", SOLVER_NAME)
    return result


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

register_solver(SOLVER_NAME, PATTERNS, verify)
