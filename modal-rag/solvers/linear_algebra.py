"""
solvers/linear_algebra.py — Matrices, determinants, eigenvalues, Cramer's rule.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "linear_algebra"

PATTERNS = [
    {"pattern": re.compile(r"matrix|matrices|\\[.*\\]", re.I), "type": "matrix"},
    {"pattern": re.compile(r"determinant|det\(|\|A\|", re.I), "type": "determinant"},
    {"pattern": re.compile(r"eigenvalue|eigenvector|characteristic", re.I), "type": "eigen"},
    {"pattern": re.compile(r"cramer.*rule|system.*linear", re.I), "type": "cramer"},
    {"pattern": re.compile(r"adjoint|adj\(|inverse.*matrix|A\^[-−]1", re.I), "type": "adjoint"},
    {"pattern": re.compile(r"rank.*matrix|row.*echelon|rref", re.I), "type": "rank"},
]


def _verify_determinant_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix
    try:
        matrix_data = params.get("matrix", [[1, 0], [0, 1]])
        claimed = parse_expr_safe(claimed_latex)

        M = Matrix(matrix_data)
        det = M.det()

        if check_numerical(det, claimed):
            return build_response(True, str(det), "high",
                f"det(A) = {det}", SOLVER_NAME)

        return build_response(False, str(det), "high",
            f"det(A) = {det}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Determinant verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_eigen_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix
    try:
        matrix_data = params.get("matrix", [[1, 0], [0, 1]])
        claimed = parse_expr_safe(claimed_latex)

        M = Matrix(matrix_data)
        eigenvals = M.eigenvals()

        # Check if claimed matches any eigenvalue
        for ev, mult in eigenvals.items():
            if check_equivalence(ev, claimed, var_name):
                return build_response(True, str(ev), "high",
                    f"Eigenvalues: {eigenvals}", SOLVER_NAME)

        return build_response(False, str(eigenvals), "high",
            f"Eigenvalues: {eigenvals}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Eigenvalue verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_inverse_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix
    try:
        matrix_data = params.get("matrix", [[1, 0], [0, 1]])
        claimed = parse_expr_safe(claimed_latex)

        M = Matrix(matrix_data)
        inv = M.inv()

        if check_equivalence(inv, claimed, var_name):
            return build_response(True, str(inv), "high",
                f"A^(-1) = {inv}", SOLVER_NAME)

        return build_response(False, str(inv), "high",
            f"A^(-1) = {inv}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Matrix inverse failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_system_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Matrix, linsolve, symbols
    try:
        A_data = params.get("A", [[1, 0], [0, 1]])
        b_data = params.get("b", [0, 0])
        claimed = parse_expr_safe(claimed_latex)

        A = Matrix(A_data)
        b = Matrix(b_data)

        # Use linsolve
        syms = symbols(" ".join([f"x{i}" for i in range(A.cols)]))
        solutions = linsolve((A, b), *syms)

        for sol in solutions:
            if check_equivalence(Matrix(sol), claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Solution: {sol}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"System solve failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "determinant")
    fns = {
        "determinant": _verify_determinant_impl,
        "eigen": _verify_eigen_impl,
        "inverse": _verify_inverse_impl,
        "system": _verify_system_impl,
    }
    fn = fns.get(ptype, _verify_determinant_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Linear algebra verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
