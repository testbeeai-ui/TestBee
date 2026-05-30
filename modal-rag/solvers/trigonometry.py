"""
solvers/trigonometry.py — Trig identities, equations, inverse trig.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "trigonometry"

PATTERNS = [
    {"pattern": re.compile(r"trig.*identit|identit.*trig|sin\^2|cos\^2", re.I), "type": "identity"},
    {"pattern": re.compile(r"trig.*equation|sin\s*\(|cos\s*\(|tan\s*\(", re.I), "type": "equation"},
    {"pattern": re.compile(r"inverse.*trig|sin\^[-−]1|cos\^[-−]1|tan\^[-−]1|arcsin|arccos|arctan", re.I), "type": "inverse"},
    {"pattern": re.compile(r"general\s*solution|trig.*inequality", re.I), "type": "general_solution"},
]


def _verify_identity_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import simplify, trigsimp
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Try trigsimp
        diff = trigsimp(expr - claimed)
        if diff == 0:
            return build_response(True, str(claimed), "high",
                "Trig identity verified by trigsimp", SOLVER_NAME)

        # Try simplify
        if simplify(expr - claimed) == 0:
            return build_response(True, str(claimed), "high",
                "Trig identity verified by simplify", SOLVER_NAME)

        return build_response(False, str(expr), "high",
            f"Expressions are not equivalent: {expr} ≠ {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Trig identity check failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_equation_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, simplify
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        solutions = solve(expr, x)

        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Solutions: {solutions}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Trig equation solve failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_inverse_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import simplify, trigsimp
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        simplified = trigsimp(expr)
        if check_equivalence(simplified, claimed, var_name):
            return build_response(True, str(simplified), "high",
                f"Simplified to {simplified}", SOLVER_NAME)

        return build_response(False, str(simplified), "high",
            f"Simplified: {simplified}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Inverse trig verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "equation")
    fns = {
        "identity": _verify_identity_impl,
        "equation": _verify_equation_impl,
        "inverse": _verify_inverse_impl,
    }
    fn = fns.get(ptype, _verify_equation_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Trig verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
