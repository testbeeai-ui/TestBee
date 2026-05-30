"""
solvers/infinite_series.py — Convergence tests and sum evaluation.

Handles:
- Σ a_n convergence testing
- Sum evaluation (geometric, telescoping, power series)
- Radius of convergence
- Alternating series
- Comparison tests
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "infinite_series"


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

PATTERNS = [
    {"pattern": re.compile(r"\\sum.*\\infty|\\sum.*oo", re.I), "type": "series"},
    {"pattern": re.compile(r"infinite\s*series", re.I), "type": "series"},
    {"pattern": re.compile(r"convergence.*series|series.*converge", re.I), "type": "convergence"},
    {"pattern": re.compile(r"sum.*series|find.*sum", re.I), "type": "sum"},
    {"pattern": re.compile(r"power\s*series|radius.*convergence", re.I), "type": "power_series"},
    {"pattern": re.compile(r"alternating\s*series", re.I), "type": "alternating"},
]


# ---------------------------------------------------------------------------
# Core solver
# ---------------------------------------------------------------------------

def _verify_series_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Verify infinite series sum or convergence."""
    from sympy import Symbol, summation, oo, simplify, Sum, S, Rational

    try:
        n = Symbol(var_name, positive=True, integer=True)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Get series bounds from params or default
        lower = params.get("lower", 1)
        upper = params.get("upper", oo)

        # Evaluate the series
        result = summation(expr, (n, lower, upper))

        # Handle divergence
        if result == oo or result == -oo:
            if claimed == oo or claimed == -oo:
                return build_response(
                    correct=True,
                    computed=str(result),
                    confidence="high",
                    explanation=f"Series diverges to {result}",
                    detected_type=SOLVER_NAME,
                )
            return build_response(
                correct=False,
                computed=str(result),
                confidence="high",
                explanation=f"Series diverges to {result}, claimed = {claimed}",
                detected_type=SOLVER_NAME,
            )

        # Check convergence first if we have a Sum object
        if isinstance(result, Sum):
            try:
                is_conv = result.is_convergent()
                if not is_conv:
                    if claimed == oo or claimed == -oo:
                        return build_response(
                            correct=True, computed="oo",
                            confidence="high",
                            explanation="Series diverges",
                            detected_type=SOLVER_NAME,
                        )
                    return build_response(
                        correct=False, computed="divergent",
                        confidence="high",
                        explanation="Series diverges, but claimed finite value",
                        detected_type=SOLVER_NAME,
                    )
            except Exception:
                pass  # Convergence check failed, try evaluation anyway

        # Symbolic comparison
        if check_equivalence(result, claimed, var_name):
            return build_response(
                correct=True,
                computed=str(result),
                confidence="high",
                explanation=f"Series evaluates to {result}",
                detected_type=SOLVER_NAME,
            )

        # Numerical fallback
        try:
            result_num = float(result.evalf())
            claimed_num = float(claimed.evalf())
            if abs(result_num - claimed_num) < 1e-8:
                return build_response(
                    correct=True,
                    computed=str(result),
                    confidence="medium",
                    explanation=f"Series ≈ {result_num}",
                    detected_type=SOLVER_NAME,
                )
        except Exception:
            pass

        return build_response(
            correct=False,
            computed=str(result),
            confidence="high",
            explanation=f"Series = {result}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Series verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_convergence_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """Check if a series converges."""
    from sympy import Symbol, Sum, oo

    try:
        n = Symbol(var_name, positive=True, integer=True)
        expr = parse_expr_safe(expr_latex)

        lower = params.get("lower", 1)
        upper = params.get("upper", oo)

        series = Sum(expr, (n, lower, upper))
        is_convergent = series.is_convergent()

        claimed = claimed_latex.strip().lower()
        claimed_converges = claimed in ("true", "convergent", "converges", "yes", "1")

        if is_convergent == claimed_converges:
            return build_response(
                correct=True,
                computed=str(is_convergent),
                confidence="high",
                explanation=f"Series {'converges' if is_convergent else 'diverges'}",
                detected_type=SOLVER_NAME,
            )

        return build_response(
            correct=False,
            computed=str(is_convergent),
            confidence="high",
            explanation=f"Series {'converges' if is_convergent else 'diverges'}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Convergence check failed: {str(e)[:200]}", SOLVER_NAME)


# ---------------------------------------------------------------------------
# Public verify function
# ---------------------------------------------------------------------------

def verify(expr_latex: str, claimed_latex: str, var_name: str, params: dict) -> dict:
    """Main entry point for series verification."""
    problem_type = params.get("type", "sum")

    if problem_type == "convergence":
        fn = lambda: _verify_convergence_impl(expr_latex, claimed_latex, var_name, params)
    else:
        fn = lambda: _verify_series_impl(expr_latex, claimed_latex, var_name, params)

    result = with_timeout(fn)
    if result is None:
        return error_response("Series verification timed out", SOLVER_NAME)
    return result


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

register_solver(SOLVER_NAME, PATTERNS, verify)
