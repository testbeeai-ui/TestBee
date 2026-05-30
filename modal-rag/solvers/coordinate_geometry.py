"""
solvers/coordinate_geometry.py — Lines, circles, conics.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "coordinate_geometry"

PATTERNS = [
    {"pattern": re.compile(r"straight\s*line|slope|intercept|angle.*between.*line", re.I), "type": "line"},
    {"pattern": re.compile(r"circle|tangent.*circle|chord", re.I), "type": "circle"},
    {"pattern": re.compile(r"parabola|focus|directrix", re.I), "type": "parabola"},
    {"pattern": re.compile(r"ellipse|eccentricity", re.I), "type": "ellipse"},
    {"pattern": re.compile(r"hyperbola|asymptote", re.I), "type": "hyperbola"},
    {"pattern": re.compile(r"distance.*formula|midpoint|section\s*formula", re.I), "type": "distance"},
    {"pattern": re.compile(r"conic\s*section", re.I), "type": "conic"},
]


def _verify_distance_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import sqrt, simplify
    try:
        # params: point1, point2
        p1 = params.get("point1", [0, 0])
        p2 = params.get("point2", [0, 0])
        claimed = parse_expr_safe(claimed_latex)

        dist = sqrt(sum((a - b)**2 for a, b in zip(p1, p2)))
        dist = simplify(dist)

        if check_numerical(dist, claimed):
            return build_response(True, str(dist), "high",
                f"Distance = {dist}", SOLVER_NAME)

        return build_response(False, str(dist), "high",
            f"Distance = {dist}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Distance verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_line_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, simplify, atan
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # If solving for intersection or angle
        solutions = solve(expr, x)
        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Solution: {sol}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Line verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_conic_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, simplify
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # General conic verification — check if claimed satisfies the equation
        solutions = solve(expr, x)
        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Solution: {sol}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Conic verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "line")
    fns = {
        "distance": _verify_distance_impl,
        "line": _verify_line_impl,
        "circle": _verify_conic_impl,
        "parabola": _verify_conic_impl,
        "ellipse": _verify_conic_impl,
        "hyperbola": _verify_conic_impl,
    }
    fn = fns.get(ptype, _verify_conic_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Geometry verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
