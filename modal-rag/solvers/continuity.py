"""
solvers/continuity.py — Continuity, differentiability, Rolle's, MVT.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "continuity"

PATTERNS = [
    {"pattern": re.compile(r"continuity|continuous|discontinuity", re.I), "type": "continuity"},
    {"pattern": re.compile(r"differentiab|differentiable", re.I), "type": "differentiability"},
    {"pattern": re.compile(r"rolle.*theorem|mean.*value.*theorem|\\bMVT\\b|lagrange", re.I), "type": "mvt"},
]


def _verify_continuity_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, limit, oo
    try:
        x = Symbol(var_name)
        f = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        point = params.get("point", 0)
        point_expr = parse_expr_safe(str(point))

        # Check left and right limits
        left = limit(f, x, point_expr, "-")
        right = limit(f, x, point_expr, "+")
        value = f.subs(x, point_expr)

        is_continuous = (left == right) and (left == value)

        if check_numerical(is_continuous, claimed):
            return build_response(True, str(is_continuous), "high",
                f"Left={left}, Right={right}, f({point})={value}, continuous={is_continuous}", SOLVER_NAME)

        return build_response(False, str(is_continuous), "high",
            f"Left={left}, Right={right}, f({point})={value}, claimed={claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Continuity check failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_mvt_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, diff, solve
    try:
        x = Symbol(var_name)
        f = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        a = params.get("a", 0)
        b = params.get("b", 1)

        # MVT: f'(c) = (f(b) - f(a)) / (b - a)
        slope = (f.subs(x, b) - f.subs(x, a)) / (b - a)
        f_prime = diff(f, x)
        c_values = solve(f_prime - slope, x)

        # Filter to (a, b)
        valid = [c for c in c_values if a < c < b]

        for c in valid:
            if check_equivalence(c, claimed, var_name):
                return build_response(True, str(c), "high",
                    f"MVT: c = {c} in ({a}, {b})", SOLVER_NAME)

        return build_response(False, str(valid), "high",
            f"MVT: c = {valid} in ({a}, {b}), claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"MVT verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "continuity")
    fns = {
        "continuity": _verify_continuity_impl,
        "differentiability": _verify_continuity_impl,
        "mvt": _verify_mvt_impl,
    }
    fn = fns.get(ptype, _verify_continuity_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Continuity verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
