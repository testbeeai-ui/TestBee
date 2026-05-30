"""
solvers/complex_numbers.py — Modulus, argument, De Moivre, roots of unity.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "complex_numbers"

PATTERNS = [
    {"pattern": re.compile(r"complex.*number|modulus.*argument|arg\(z\)|\|z\|", re.I), "type": "basic"},
    {"pattern": re.compile(r"de\s*moivre|moivre", re.I), "type": "de_moivre"},
    {"pattern": re.compile(r"roots?\s*of\s*unity|z\^n\s*=\s*1", re.I), "type": "roots_unity"},
    {"pattern": re.compile(r"complex.*equation|complex.*solve", re.I), "type": "equation"},
    {"pattern": re.compile(r"conjugate|z\s*bar|\\bar", re.I), "type": "conjugate"},
    {"pattern": re.compile(r"polar\s*form|euler.*form", re.I), "type": "polar"},
]


def _verify_modulus_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Abs, simplify, I
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        modulus = Abs(expr)
        if check_equivalence(modulus, claimed, var_name):
            return build_response(True, str(modulus), "high",
                f"|z| = {modulus}", SOLVER_NAME)

        return build_response(False, str(modulus), "high",
            f"|z| = {modulus}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Modulus verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_conjugate_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import conjugate, simplify
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        conj = conjugate(expr)
        if check_equivalence(conj, claimed, var_name):
            return build_response(True, str(conj), "high",
                f"Conjugate = {conj}", SOLVER_NAME)

        return build_response(False, str(conj), "high",
            f"Conjugate = {conj}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Conjugate verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_roots_of_unity_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, I, pi, exp, simplify
    try:
        n = params.get("n", 3)
        x = Symbol(var_name)

        # z^n = 1
        solutions = solve(x**n - 1, x)
        claimed = parse_expr_safe(claimed_latex)

        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"{n}th roots of unity: {solutions}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"{n}th roots of unity: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Roots of unity verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_equation_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, I
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
        return error_response(f"Complex equation solve failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "basic")
    fns = {
        "basic": _verify_modulus_impl,
        "conjugate": _verify_conjugate_impl,
        "roots_unity": _verify_roots_of_unity_impl,
        "equation": _verify_equation_impl,
    }
    fn = fns.get(ptype, _verify_modulus_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Complex number verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
