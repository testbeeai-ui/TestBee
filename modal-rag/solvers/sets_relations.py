"""
solvers/sets_relations.py — Set operations, relation types.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "sets_relations"

PATTERNS = [
    {"pattern": re.compile(r"set.*operation|union|intersection|\\bcup|\\bcap|\\bA\\'|complement", re.I), "type": "set_ops"},
    {"pattern": re.compile(r"relation|reflexive|symmetric|transitive|equivalence", re.I), "type": "relation"},
    {"pattern": re.compile(r"subset|superset|power.*set|cardinali", re.I), "type": "set_props"},
]


def _verify_set_ops_impl(params):
    from sympy import FiniteSet, Union, Intersection, Complement
    try:
        A = FiniteSet(*params.get("A", []))
        B = FiniteSet(*params.get("B", []))
        op = params.get("op", "union")

        if op == "union":
            return Union(A, B)
        elif op == "intersection":
            return Intersection(A, B)
        elif op == "difference":
            return Complement(A, B)
        elif op == "symmetric_diff":
            return Union(Complement(A, B), Complement(B, A))
        return Union(A, B)
    except Exception as e:
        raise


def _verify_relation_impl(params):
    """Check if a relation is reflexive, symmetric, transitive."""
    try:
        elements = params.get("elements", [])
        relation = params.get("relation", [])  # list of (a, b) pairs

        is_reflexive = all((a, a) in relation for a in elements)
        is_symmetric = all((b, a) in relation for a, b in relation)
        is_transitive = True
        for a, b in relation:
            for c, d in relation:
                if b == c and (a, d) not in relation:
                    is_transitive = False
                    break

        return {
            "reflexive": is_reflexive,
            "symmetric": is_symmetric,
            "transitive": is_transitive,
            "equivalence": is_reflexive and is_symmetric and is_transitive,
        }
    except Exception as e:
        raise


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "set_ops")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "set_ops":
            result = _verify_set_ops_impl(params)
        elif ptype == "relation":
            result = _verify_relation_impl(params)
            return build_response(True, str(result), "high",
                f"Relation properties: {result}", SOLVER_NAME)
        else:
            result = _verify_set_ops_impl(params)

        if check_equivalence(result, claimed, var_name):
            return build_response(True, str(result), "high",
                f"Result = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"Result = {result}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Set/relation verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Set/relation verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
