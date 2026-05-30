"""
solvers/ode.py — Ordinary differential equations.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "ode"

PATTERNS = [
    {"pattern": re.compile(r"differential.*equation|\\bODE\\b", re.I), "type": "ode"},
    {"pattern": re.compile(r"dsolve|dy/dx.*=|y'", re.I), "type": "ode"},
    {"pattern": re.compile(r"separable|homogeneous.*equation", re.I), "type": "ode"},
]


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, Function, dsolve, Eq, classify_ode
    try:
        x = Symbol(var_name)
        y = Function('y')
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        # Try to form an ODE
        ode = Eq(expr, 0)

        solution = dsolve(ode, y(x))

        if isinstance(solution, list):
            for sol in solution:
                if check_equivalence(sol.rhs, claimed, var_name):
                    return build_response(True, str(sol.rhs), "high",
                        f"ODE solution: {sol}", SOLVER_NAME)
        else:
            if check_equivalence(solution.rhs, claimed, var_name):
                return build_response(True, str(solution.rhs), "high",
                    f"ODE solution: {solution}", SOLVER_NAME)

        computed = solution.rhs if hasattr(solution, 'rhs') else str(solution)
        return build_response(False, str(computed), "high",
            f"ODE solution: {computed}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"ODE verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("ODE verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
