"""
solvers/vectors.py — Dot product, cross product, scalar/vector triple product, projection.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "vectors"

PATTERNS = [
    {"pattern": re.compile(r"dot\s*product|scalar\s*product|\\cdot", re.I), "type": "dot"},
    {"pattern": re.compile(r"cross\s*product|vector\s*product|\\times", re.I), "type": "cross"},
    {"pattern": re.compile(r"scalar\s*triple|\\[.*\\]", re.I), "type": "scalar_triple"},
    {"pattern": re.compile(r"projection|proj", re.I), "type": "projection"},
    {"pattern": re.compile(r"vector.*equation|\\vec|\\overrightarrow", re.I), "type": "vector"},
    {"pattern": re.compile(r"unit\s*vector|normalize", re.I), "type": "unit_vector"},
    {"pattern": re.compile(r"angle.*between.*vector", re.I), "type": "angle"},
]


def _verify_dot_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix, simplify
    try:
        a = params.get("a", [0, 0, 0])
        b = params.get("b", [0, 0, 0])
        claimed = parse_expr_safe(claimed_latex)

        va = Matrix(a)
        vb = Matrix(b)
        dot = va.dot(vb)

        if check_numerical(dot, claimed):
            return build_response(True, str(dot), "high",
                f"a·b = {dot}", SOLVER_NAME)

        return build_response(False, str(dot), "high",
            f"a·b = {dot}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Dot product failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_cross_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix
    try:
        a = params.get("a", [0, 0, 0])
        b = params.get("b", [0, 0, 0])
        claimed = parse_expr_safe(claimed_latex)

        va = Matrix(a)
        vb = Matrix(b)
        cross = va.cross(vb)

        if check_equivalence(cross, claimed, var_name):
            return build_response(True, str(cross), "high",
                f"a×b = {cross}", SOLVER_NAME)

        return build_response(False, str(cross), "high",
            f"a×b = {cross}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Cross product failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_scalar_triple_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix
    try:
        a = params.get("a", [0, 0, 0])
        b = params.get("b", [0, 0, 0])
        c = params.get("c", [0, 0, 0])
        claimed = parse_expr_safe(claimed_latex)

        va = Matrix(a)
        vb = Matrix(b)
        vc = Matrix(c)
        # [a b c] = a · (b × c)
        stp = va.dot(vb.cross(vc))

        if check_numerical(stp, claimed):
            return build_response(True, str(stp), "high",
                f"[a b c] = {stp}", SOLVER_NAME)

        return build_response(False, str(stp), "high",
            f"[a b c] = {stp}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Scalar triple product failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_projection_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix, sqrt
    try:
        a = params.get("a", [0, 0, 0])
        b = params.get("b", [0, 0, 0])
        claimed = parse_expr_safe(claimed_latex)

        va = Matrix(a)
        vb = Matrix(b)
        # proj_b(a) = (a·b / |b|²) * b
        dot = va.dot(vb)
        b_mag_sq = vb.dot(vb)
        proj = vb * dot / b_mag_sq

        if check_equivalence(proj, claimed, var_name):
            return build_response(True, str(proj), "high",
                f"proj_b(a) = {proj}", SOLVER_NAME)

        return build_response(False, str(proj), "high",
            f"proj_b(a) = {proj}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Projection failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "dot")
    fns = {
        "dot": _verify_dot_impl,
        "cross": _verify_cross_impl,
        "scalar_triple": _verify_scalar_triple_impl,
        "projection": _verify_projection_impl,
    }
    fn = fns.get(ptype, _verify_dot_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Vector verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
