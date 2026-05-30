"""
solvers/number_theory.py — Divisibility, GCD/LCM, primes, Euler, Fermat, Wilson, CRT.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "number_theory"

PATTERNS = [
    {"pattern": re.compile(r"divisi|gcd|lcm|greatest.*common|least.*common", re.I), "type": "divisibility"},
    {"pattern": re.compile(r"prime.*factor|factori[sz]e", re.I), "type": "prime_factor"},
    {"pattern": re.compile(r"euler.*totient|euler.*phi|\\phi\(", re.I), "type": "euler"},
    {"pattern": re.compile(r"fermat|wilson.*theorem", re.I), "type": "fermat_wilson"},
    {"pattern": re.compile(r"chinese.*remainder|CRT", re.I), "type": "crt"},
    {"pattern": re.compile(r"number.*theory|integer.*problem", re.I), "type": "general"},
]


def _verify_divisibility_impl(params):
    from sympy import gcd, lcm, Integer
    try:
        a = Integer(params.get("a", 0))
        b = Integer(params.get("b", 0))
        op = params.get("op", "gcd")

        if op == "gcd":
            return gcd(a, b)
        elif op == "lcm":
            return lcm(a, b)
        elif op == "divides":
            return a % b == 0
        return gcd(a, b)
    except Exception as e:
        raise


def _verify_prime_factor_impl(params):
    from sympy import factorint, Integer
    try:
        n = Integer(params.get("n", 0))
        result = factorint(n)
        return result
    except Exception as e:
        raise


def _verify_euler_impl(params):
    from sympy import totient, Integer
    try:
        n = Integer(params.get("n", 0))
        return totient(n)
    except Exception as e:
        raise


def _verify_crt_impl(params):
    from sympy import crt
    try:
        remainders = params.get("remainders", [0])
        moduli = params.get("moduli", [1])
        result, mod = crt(moduli, remainders)
        return result, mod
    except Exception as e:
        raise


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "divisibility")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "divisibility":
            result = _verify_divisibility_impl(params)
            if check_numerical(result, claimed):
                return build_response(True, str(result), "high",
                    f"Result = {result}", SOLVER_NAME)

        elif ptype == "prime_factor":
            result = _verify_prime_factor_impl(params)
            return build_response(True, str(result), "high",
                f"Prime factorization: {result}", SOLVER_NAME)

        elif ptype == "euler":
            result = _verify_euler_impl(params)
            if check_numerical(result, claimed):
                return build_response(True, str(result), "high",
                    f"φ(n) = {result}", SOLVER_NAME)

        elif ptype == "crt":
            result, mod = _verify_crt_impl(params)
            if check_numerical(result, claimed):
                return build_response(True, str(result), "high",
                    f"x ≡ {result} (mod {mod})", SOLVER_NAME)

        elif ptype == "fermat_wilson":
            from sympy import factorial, Mod, Integer
            n = Integer(params.get("n", 0))
            theorem = params.get("theorem", "fermat")

            if theorem == "fermat":
                a = Integer(params.get("a", 2))
                p = n
                result = Mod(a**(p-1), p)
                if check_numerical(result, claimed):
                    return build_response(True, str(result), "high",
                        f"a^(p-1) mod p = {result}", SOLVER_NAME)
            elif theorem == "wilson":
                result = Mod(factorial(n-1), n)
                if check_numerical(result, claimed):
                    return build_response(True, str(result), "high",
                        f"(n-1)! mod n = {result}", SOLVER_NAME)

        return build_response(False, str(result) if 'result' in dir() else "unknown", "high",
            f"Claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Number theory verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Number theory verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
