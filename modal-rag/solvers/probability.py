"""
solvers/probability.py — Classical, conditional, Bayes, distributions, RV.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "probability"

PATTERNS = [
    {"pattern": re.compile(r"probability|chance|likelihood", re.I), "type": "classical"},
    {"pattern": re.compile(r"conditional.*prob|P\(A\|B\)|bayes", re.I), "type": "conditional"},
    {"pattern": re.compile(r"binomial.*distribut|poisson|normal.*distribut", re.I), "type": "distribution"},
    {"pattern": re.compile(r"expected.*value|E\(X\)|mean.*distribut", re.I), "type": "expectation"},
    {"pattern": re.compile(r"variance|standard.*deviation", re.I), "type": "variance"},
    {"pattern": re.compile(r"random.*variable|probability.*mass|pdf|pmf", re.I), "type": "rv"},
]


def _verify_classical_impl(params):
    """P(E) = n(E) / n(S)"""
    favorable = params.get("favorable", 0)
    total = params.get("total", 1)
    from sympy import Rational
    return Rational(favorable, total)


def _verify_bayes_impl(params):
    """P(A|B) = P(B|A) * P(A) / P(B)"""
    from sympy import Rational
    p_ba = Rational(*params.get("p_ba", [1, 1]))
    p_a = Rational(*params.get("p_a", [1, 1]))
    p_b = Rational(*params.get("p_b", [1, 1]))
    return (p_ba * p_a) / p_b


def _verify_binomial_impl(params):
    """Binomial distribution: P(X=k) = C(n,k) p^k (1-p)^(n-k)"""
    from sympy import binomial, Rational
    n = params.get("n", 1)
    k = params.get("k", 0)
    p = Rational(*params.get("p", [1, 2]))
    return binomial(n, k) * p**k * (1-p)**(n-k)


def _verify_expectation_impl(params):
    """E(X) = Σ x * P(x)"""
    from sympy import Rational
    values = params.get("values", [])
    probs = params.get("probs", [])
    if not values or not probs:
        return None
    return sum(v * Rational(*p) for v, p in zip(values, probs))


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "classical")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "classical":
            result = _verify_classical_impl(params)
        elif ptype == "conditional" or ptype == "bayes":
            result = _verify_bayes_impl(params)
        elif ptype == "distribution":
            result = _verify_binomial_impl(params)
        elif ptype == "expectation":
            result = _verify_expectation_impl(params)
        else:
            result = _verify_classical_impl(params)

        if result is None:
            return error_response("Could not compute probability", SOLVER_NAME)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"P = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"P = {result}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Probability verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Probability verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
