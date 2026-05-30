"""
solvers/applications_calc.py — Rate of change, tangent/normal, maxima/minima, area.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "applications_calc"

PATTERNS = [
    {"pattern": re.compile(r"rate.*change|related.*rates", re.I), "type": "rate_of_change"},
    {"pattern": re.compile(r"tangent.*line|normal.*line|equation.*tangent", re.I), "type": "tangent"},
    {"pattern": re.compile(r"maxima|minima|maximum|minimum|optimize|optimization", re.I), "type": "maxima_minima"},
    {"pattern": re.compile(r"area.*under|area.*between|area.*curve", re.I), "type": "area"},
    {"pattern": re.compile(r"increasing.*decreasing|monotonic", re.I), "type": "monotonicity"},
]


def _verify_maxima_minima_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, diff, solve, oo
    try:
        x = Symbol(var_name)
        f = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Find critical points
        f_prime = diff(f, x)
        critical = solve(f_prime, x)

        # Second derivative test
        f_double_prime = diff(f_prime, x)

        results = []
        for cp in critical:
            val = f_double_prime.subs(x, cp)
            if val > 0:
                results.append((cp, f.subs(x, cp), "minimum"))
            elif val < 0:
                results.append((cp, f.subs(x, cp), "maximum"))
            else:
                results.append((cp, f.subs(x, cp), "inconclusive"))

        # Check if claimed matches any result
        for cp, fval, nature in results:
            if check_equivalence(fval, claimed, var_name):
                return build_response(True, str(fval), "high",
                    f"{nature} at x={cp}: f({cp})={fval}", SOLVER_NAME)

        return build_response(False, str(results), "high",
            f"Extrema: {results}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Maxima/minima failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_area_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, integrate, Abs
    try:
        x = Symbol(var_name)
        f = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        a = params.get("a", 0)
        b = params.get("b", 1)

        # Area = ∫_a^b |f(x)| dx
        area = integrate(Abs(f), (x, a, b))

        if check_numerical(area, claimed):
            return build_response(True, str(area), "high",
                f"Area = {area}", SOLVER_NAME)

        return build_response(False, str(area), "high",
            f"Area = {area}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Area calculation failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_tangent_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, diff
    try:
        x = Symbol(var_name)
        f = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        x0 = params.get("x0", 0)
        y0 = f.subs(x, x0)
        slope = diff(f, x).subs(x, x0)

        # Tangent line: y - y0 = slope * (x - x0)
        tangent = slope * (x - x0) + y0

        if check_equivalence(tangent, claimed, var_name):
            return build_response(True, str(tangent), "high",
                f"Tangent at x={x0}: y = {tangent}", SOLVER_NAME)

        return build_response(False, str(tangent), "high",
            f"Tangent: y = {tangent}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Tangent calculation failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "maxima_minima")
    fns = {
        "maxima_minima": _verify_maxima_minima_impl,
        "area": _verify_area_impl,
        "tangent": _verify_tangent_impl,
    }
    fn = fns.get(ptype, _verify_maxima_minima_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Applications of calculus timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
