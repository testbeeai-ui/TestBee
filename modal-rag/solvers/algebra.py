"""
solvers/algebra.py — Algebra: equations, inequalities, polynomials.

Handles:
- Linear equations, simultaneous equations
- Quadratic equations (discriminant, nature of roots, Vieta's)
- Polynomial factorization
- Inequalities (AM-GM, Cauchy-Schwarz, modulus)
- Absolute value equations/inequalities
- Logarithmic/exponential equations
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "algebra"

PATTERNS = [
    {"pattern": re.compile(r"solve.*equation|find.*roots?|find.*zeros?", re.I), "type": "equation"},
    {"pattern": re.compile(r"quadratic|discriminant|nature.*roots", re.I), "type": "quadratic"},
    {"pattern": re.compile(r"factor.*polynomial|polynomial.*factor", re.I), "type": "factor"},
    {"pattern": re.compile(r"inequality|inequaliti|≥|≤|>=|<=|greater.*than|less.*than", re.I), "type": "inequality"},
    {"pattern": re.compile(r"absolute.*value|\|.*\|", re.I), "type": "absolute"},
    {"pattern": re.compile(r"system.*equation|simultaneous", re.I), "type": "system"},
    {"pattern": re.compile(r"vieta|sum.*roots|product.*roots", re.I), "type": "vieta"},
    {"pattern": re.compile(r"log.*equation|exp.*equation", re.I), "type": "log_exp"},
]


def _verify_equation_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, simplify
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        solutions = solve(expr, x)

        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Solutions: {solutions}, claimed {claimed} matches", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Equation solve failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_quadratic_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, discriminant, simplify
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        disc = discriminant(expr, x)
        solutions = solve(expr, x)

        # Check if claimed matches solutions or discriminant
        if params.get("what") == "discriminant":
            if check_equivalence(disc, claimed, var_name):
                return build_response(True, str(disc), "high",
                    f"Discriminant = {disc}", SOLVER_NAME)

        for sol in solutions:
            if check_equivalence(sol, claimed, var_name):
                return build_response(True, str(sol), "high",
                    f"Roots: {solutions}, discriminant = {disc}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"Roots: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Quadratic verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_factor_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import factor, simplify
    try:
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)
        factored = factor(expr)

        if check_equivalence(factored, claimed, var_name):
            return build_response(True, str(factored), "high",
                f"Factorization: {factored}", SOLVER_NAME)

        return build_response(False, str(factored), "high",
            f"Factorization: {factored}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Factorization failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_inequality_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Symbol, solve, S
    try:
        x = Symbol(var_name)
        expr = parse_expr_safe(expr_latex)
        claimed = parse_expr_safe(claimed_latex)

        solution = solve(expr, x, domain=S.Reals)

        if check_equivalence(solution, claimed, var_name):
            return build_response(True, str(solution), "high",
                f"Inequality solution: {solution}", SOLVER_NAME)

        return build_response(False, str(solution), "high",
            f"Inequality solution: {solution}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"Inequality verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_system_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import symbols, solve, linsolve
    try:
        equations_str = params.get("equations", [expr_latex])
        var_names = params.get("variables", [var_name])

        syms = symbols(" ".join(var_names))
        if not isinstance(syms, tuple):
            syms = (syms,)

        equations = [parse_expr_safe(eq) for eq in equations_str]
        claimed = parse_expr_safe(claimed_latex)

        solutions = solve(equations, syms)

        for sol in solutions:
            if isinstance(sol, (list, tuple)):
                sol_tuple = tuple(sol)
            else:
                sol_tuple = (sol,)
            claimed_tuple = claimed if isinstance(claimed, (list, tuple)) else (claimed,)
            if all(check_equivalence(s, c, var_name) for s, c in zip(sol_tuple, claimed_tuple)):
                return build_response(True, str(sol), "high",
                    f"System solution: {solutions}", SOLVER_NAME)

        return build_response(False, str(solutions), "high",
            f"System solutions: {solutions}, claimed: {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"System solve failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "equation")
    fns = {
        "equation": _verify_equation_impl,
        "quadratic": _verify_quadratic_impl,
        "factor": _verify_factor_impl,
        "inequality": _verify_inequality_impl,
        "system": _verify_system_impl,
    }
    fn = fns.get(ptype, _verify_equation_impl)
    result = with_timeout(lambda: fn(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Algebra verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
