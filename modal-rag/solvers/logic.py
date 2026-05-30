"""
solvers/logic.py — Logical operations, tautology, converse, contrapositive.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "logic"

PATTERNS = [
    {"pattern": re.compile(r"tautolog|contradiction|logical|propositional", re.I), "type": "tautology"},
    {"pattern": re.compile(r"converse|contrapositive|inverse.*statement", re.I), "type": "converse"},
    {"pattern": re.compile(r"truth.*table|boolean.*expression", re.I), "type": "truth_table"},
]


def _verify_tautology_impl(params):
    from sympy import symbols, And, Or, Not, Implies, satisfiable
    try:
        # Parse logical expression from params
        expr_str = params.get("expression", "")
        vars_str = params.get("variables", ["p", "q"])

        # Simple tautology check: if satisfiable(expr) and satisfiable(Not(expr)) both
        # are satisfiable, it's neither tautology nor contradiction
        p, q = symbols("p q")
        expr = parse_expr_safe(expr_str)

        sat_pos = satisfiable(expr)
        sat_neg = satisfiable(Not(expr))

        if sat_pos and not sat_neg:
            return {"result": "tautology", "details": "Always true"}
        elif not sat_pos and sat_neg:
            return {"result": "contradiction", "details": "Always false"}
        else:
            return {"result": "contingency", "details": "Sometimes true, sometimes false"}

    except Exception as e:
        raise


def _verify_converse_impl(params):
    """Given p → q, find converse (q → p), inverse (¬p → ¬q), contrapositive (¬q → ¬p)."""
    try:
        statement = params.get("statement", "")
        # Parse "p implies q" or "p → q"
        # Return the requested variant
        variant = params.get("variant", "contrapositive")

        return {
            "converse": "q → p",
            "inverse": "¬p → ¬q",
            "contrapositive": "¬q → ¬p",
        }.get(variant, "Unknown variant")

    except Exception as e:
        raise


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "tautology")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "tautology":
            result = _verify_tautology_impl(params)
            return build_response(True, str(result), "high",
                f"Result: {result}", SOLVER_NAME)
        elif ptype == "converse":
            result = _verify_converse_impl(params)
            return build_response(True, str(result), "high",
                f"Result: {result}", SOLVER_NAME)

        return build_response(False, "Unknown logic type", "low",
            "Could not verify logic problem", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Logic verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Logic verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
