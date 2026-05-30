"""
solvers/sequences_series.py — AP, GP, HP, AGP, telescoping, sigma notation.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "sequences_series"

PATTERNS = [
    {"pattern": re.compile(r"arithmetic.*progression|\\bAP\\b|common.*difference", re.I), "type": "ap"},
    {"pattern": re.compile(r"geometric.*progression|\\bGP\\b|common.*ratio", re.I), "type": "gp"},
    {"pattern": re.compile(r"harmonic.*progression|\\bHP\\b", re.I), "type": "hp"},
    {"pattern": re.compile(r"sum.*series|sigma|\\bsumm?ation", re.I), "type": "sum"},
    {"pattern": re.compile(r"nth.*term|general.*term.*sequence", re.I), "type": "nth_term"},
]


def _verify_ap_impl(params):
    """AP: a_n = a + (n-1)d, S_n = n/2 * (2a + (n-1)d)"""
    from sympy import Rational
    a = params.get("a", 0)
    d = params.get("d", 0)
    n = params.get("n", 1)

    if params.get("what") == "sum":
        return Rational(n, 2) * (2*a + (n-1)*d)
    return a + (n-1)*d


def _verify_gp_impl(params):
    """GP: a_n = a*r^(n-1), S_n = a*(r^n - 1)/(r - 1)"""
    from sympy import Rational
    a = params.get("a", 1)
    r = params.get("r", 1)
    n = params.get("n", 1)

    if params.get("what") == "sum":
        if r == 1:
            return a * n
        return a * (r**n - 1) / (r - 1)
    return a * r**(n-1)


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "ap")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "ap":
            result = _verify_ap_impl(params)
        elif ptype == "gp":
            result = _verify_gp_impl(params)
        else:
            # General summation
            from sympy import Symbol, summation, oo
            n = Symbol(var_name, positive=True, integer=True)
            expr = parse_expr_safe(expr_latex)
            lower = params.get("lower", 1)
            upper = params.get("upper", oo)
            result = summation(expr, (n, lower, upper))

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"Result = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"Result = {result}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Sequence/series verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Sequence/series verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
