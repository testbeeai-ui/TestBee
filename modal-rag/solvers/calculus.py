"""
solvers/calculus.py — Integrals, derivatives, limits, Taylor/Maclaurin.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout, clean_latex,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "calculus"

PATTERNS = [
    {"pattern": re.compile(r"\bintegrat|antiderivative|find.*integral|∫|\\\\int", re.I), "type": "integral"},
    {"pattern": re.compile(r"\bderiv|differentiat|d/dx|dy/dx|\\\\frac\{d\}", re.I), "type": "derivative"},
    {"pattern": re.compile(r"\blimit\b|\blim\b|\\\\lim", re.I), "type": "limit"},
    {"pattern": re.compile(r"taylor|maclaurin|series.*expansion", re.I), "type": "series_expansion"},
]


def _verify_integral_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, integrate, diff, simplify
    import random
    try:
        x = Symbol(var_name)
        integrand = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Method 1: differentiate claimed, compare to integrand
        derivative = diff(claimed, x)
        if simplify(derivative - integrand) == 0:
            return build_response(True, str(claimed), "high",
                "Derivative of claimed result matches integrand", SOLVER_NAME)

        # Method 2: numerical spot-check
        random.seed(42)
        matches = 0
        for _ in range(5):
            val = random.uniform(0.1, 5.0)
            try:
                d_val = float(derivative.subs(x, val).evalf())
                i_val = float(integrand.subs(x, val).evalf())
                if abs(d_val - i_val) < 1e-6:
                    matches += 1
            except Exception:
                continue
        if matches >= 3:
            return build_response(True, str(claimed), "medium",
                f"Numerical spot-check passed ({matches}/5)", SOLVER_NAME)

        # Method 3: compute our own
        computed = integrate(integrand, x)
        return build_response(False, str(computed), "high",
            f"Expected {computed}, got {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Integral verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_derivative_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, diff, simplify
    try:
        x = Symbol(var_name)
        func = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        order = params.get("order", 1)
        computed = func
        for _ in range(order):
            computed = diff(computed, x)

        if simplify(computed - claimed) == 0:
            return build_response(True, str(computed), "high",
                f"Derivative (order {order}) matches", SOLVER_NAME)

        return build_response(False, str(computed), "high",
            f"Expected {computed}, got {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Derivative verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_limit_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, limit, oo
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        point_str = params.get("point", "oo")
        point = oo if point_str in ("oo", "inf", "\\infty") else parse_expr_safe(point_str)

        direction = params.get("direction", "+")  # "+", "-", or "+-"

        if direction == "+-":
            left = limit(expr, x, point, "-")
            right = limit(expr, x, point, "+")
            if left == right:
                computed = left
            else:
                computed = f"left={left}, right={right}"
        else:
            computed = limit(expr, x, point, direction)

        if check_equivalence(computed, claimed, var_name):
            return build_response(True, str(computed), "high",
                f"Limit as {var_name}→{point} = {computed}", SOLVER_NAME)

        return build_response(False, str(computed), "high",
            f"Limit = {computed}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Limit verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_series_expansion_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, series, oo
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        point = parse_expr_safe(params.get("point", "0"))
        order = params.get("order", 6)

        expanded = series(expr, x, point, order).removeO()

        if check_equivalence(expanded, claimed, var_name):
            return build_response(True, str(expanded), "high",
                f"Series expansion: {expanded}", SOLVER_NAME)

        return build_response(False, str(expanded), "high",
            f"Series expansion: {expanded}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Series expansion failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "integral")
    fns = {
        "integral": _verify_integral_impl,
        "derivative": _verify_derivative_impl,
        "limit": _verify_limit_impl,
        "series_expansion": _verify_series_expansion_impl,
    }
    fn = fns.get(ptype, _verify_integral_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Calculus verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
