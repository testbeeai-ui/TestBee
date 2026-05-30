"""
solvers/discrete.py — Modular arithmetic, combinatorics, permutations, combinations.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "discrete"

PATTERNS = [
    {"pattern": re.compile(r"modular|\\bmod\\b|remainder|clock", re.I), "type": "modular"},
    {"pattern": re.compile(r"permut|nPr|circular.*permut", re.I), "type": "permutation"},
    {"pattern": re.compile(r"combin|nCr|\\binom|choose", re.I), "type": "combination"},
    {"pattern": re.compile(r"binomial.*theorem|binomial.*expansion", re.I), "type": "binomial"},
    {"pattern": re.compile(r"inclusion.*exclusion|pigeonhole", re.I), "type": "counting"},
    {"pattern": re.compile(r"division.*group|distribute.*group", re.I), "type": "grouping"},
]


def _verify_modular_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Mod, Integer
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)
        modulus = params.get("modulus", 12)

        result = Mod(expr, modulus)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"{expr} mod {modulus} = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"{expr} mod {modulus} = {result}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Modular arithmetic failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_permutation_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import factorial
    try:
        n = params.get("n", 0)
        r = params.get("r", 0)
        claimed = parse_expr_safe(claimed_latex)

        # nPr = n! / (n-r)!
        result = factorial(n) // factorial(n - r)

        if params.get("circular"):
            result = factorial(n - 1)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"P({n},{r}) = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"P({n},{r}) = {result}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Permutation failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_combination_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import binomial
    try:
        n = params.get("n", 0)
        r = params.get("r", 0)
        claimed = parse_expr_safe(claimed_latex)

        result = binomial(n, r)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"C({n},{r}) = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"C({n},{r}) = {result}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Combination failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_binomial_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, expand, binomial
    try:
        x = Symbol(var_name)
        n = params.get("n", 2)
        claimed = parse_expr_safe(claimed_latex)

        # Expand (1+x)^n or (a+b)^n
        a = params.get("a", 1)
        b = params.get("b", 1)
        expanded = expand((a + b*x)**n)

        if params.get("what") == "general_term":
            k = params.get("k", 0)
            term = binomial(n, k) * a**(n-k) * b**k * x**k
            if check_equivalence(term, claimed, var_name):
                return build_response(True, str(term), "high",
                    f"General term T_{k+1} = {term}", SOLVER_NAME)

        if check_equivalence(expanded, claimed, var_name):
            return build_response(True, str(expanded), "high",
                f"Expansion: {expanded}", SOLVER_NAME)

        return build_response(False, str(expanded), "high",
            f"Expansion: {expanded}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Binomial theorem failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "modular")
    fns = {
        "modular": _verify_modular_impl,
        "permutation": _verify_permutation_impl,
        "combination": _verify_combination_impl,
        "binomial": _verify_binomial_impl,
    }
    fn = fns.get(ptype, _verify_modular_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Discrete math verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
