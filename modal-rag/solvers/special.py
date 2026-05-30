"""
solvers/special.py — Ceiling/floor, fractional part, signum, modulus chains.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "special"

PATTERNS = [
    {"pattern": re.compile(r"ceiling|\\lceil|\\rceil", re.I), "type": "ceiling"},
    {"pattern": re.compile(r"floor|\\lfloor|\\rfloor", re.I), "type": "floor"},
    {"pattern": re.compile(r"fractional.*part|\\{.*\\}", re.I), "type": "frac"},
    {"pattern": re.compile(r"signum|sign\s*function|sgn", re.I), "type": "signum"},
    {"pattern": re.compile(r"modulus.*chain|\\|.*\\|.*\\+", re.I), "type": "modulus_chain"},
    {"pattern": re.compile(r"step.*function|heaviside", re.I), "type": "step"},
]


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import ceiling, floor, frac, sign, Piecewise, Symbol, Abs
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        ptype = params.get("type", "ceiling")

        if ptype == "ceiling":
            result = ceiling(expr)
        elif ptype == "floor":
            result = floor(expr)
        elif ptype == "frac":
            result = frac(expr)
        elif ptype == "signum":
            result = sign(expr)
        else:
            result = expr

        if check_equivalence(result, claimed, var_name):
            return build_response(True, str(result), "high",
                f"Result = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"Result = {result}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Special function verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Special function verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
