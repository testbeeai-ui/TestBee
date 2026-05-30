"""
solvers/recurrence.py — Recurrence relations.

Handles:
- Linear recurrences: a_{n+1} = c·a_n + d
- Nonlinear recurrences: a_{n+1} = f(a_n)
- Finding closed forms via rsolve
- Evaluating a_k for specific k
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "recurrence"


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

PATTERNS = [
    {"pattern": re.compile(r"recurrence", re.I), "type": "recurrence"},
    {"pattern": re.compile(r"a_\{?n\s*\+\s*1\}?", re.I), "type": "recurrence"},
    {"pattern": re.compile(r"a_\(n\s*\+\s*1\)", re.I), "type": "recurrence"},
    {"pattern": re.compile(r"closed\s*form.*sequence", re.I), "type": "recurrence"},
    {"pattern": re.compile(r"find\s+a_n|find\s+the\s+nth\s+term", re.I), "type": "recurrence"},
]


# ---------------------------------------------------------------------------
# Core solver
# ---------------------------------------------------------------------------

def _verify_recurrence_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """
    Verify recurrence relation solution.

    params:
        recurrence: str — the recurrence expression (e.g., "2*a(n) + 1")
        initial: dict — initial conditions (e.g., {"a(1)": 1})
        evaluate_at: int — if set, evaluate the closed form at this term
    """
    from sympy import Symbol, Function, rsolve, Eq, simplify, Integer

    try:
        n = Symbol(var_name, integer=True)
        a = Function('a')

        # Parse recurrence from params
        recurrence_str = params.get("recurrence", expr_latex)
        initial = params.get("initial", {})
        eval_at = params.get("evaluate_at")

        recurrence_expr = parse_expr_safe(recurrence_str)

        # Set up the recurrence: a(n+1) = recurrence_expr
        eq = a(n + 1) - recurrence_expr

        # Build initial conditions dict for rsolve
        init_conds = {}
        for k, v in initial.items():
            # Parse "a(1)" -> a(1) = v
            m = re.search(r"a\s*\(\s*(\d+)\s*\)", k)
            if m:
                init_conds[a(int(m.group(1)))] = Integer(v)

        closed_form = rsolve(eq, a(n), init_conds)

        if closed_form is None:
            # rsolve couldn't find closed form — try iteration
            return _verify_by_iteration(recurrence_expr, initial, eval_at, claimed_latex, n, a)

        if eval_at is not None:
            result = closed_form.subs(n, int(eval_at))
            claimed = parse_expr_safe(claimed_latex)

            if check_equivalence(result, claimed, var_name):
                return build_response(
                    correct=True,
                    computed=str(result),
                    confidence="high",
                    explanation=(
                        f"Closed form: a(n) = {closed_form}, "
                        f"a({eval_at}) = {result}"
                    ),
                    detected_type=SOLVER_NAME,
                )

            return build_response(
                correct=False,
                computed=str(result),
                confidence="high",
                explanation=(
                    f"Closed form: a(n) = {closed_form}, "
                    f"a({eval_at}) = {result}, claimed = {claimed}"
                ),
                detected_type=SOLVER_NAME,
            )

        # Just verify the closed form matches
        claimed = parse_expr_safe(claimed_latex)
        if check_equivalence(closed_form, claimed, var_name):
            return build_response(
                correct=True,
                computed=str(closed_form),
                confidence="high",
                explanation=f"Closed form: a(n) = {closed_form}",
                detected_type=SOLVER_NAME,
            )

        return build_response(
            correct=False,
            computed=str(closed_form),
            confidence="high",
            explanation=f"Closed form: a(n) = {closed_form}, claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Recurrence verification failed: {str(e)[:200]}", SOLVER_NAME)


def _verify_by_iteration(
    recurrence_expr, initial: dict, eval_at, claimed_latex: str, n, a
) -> dict:
    """Fallback: iterate the recurrence to find the value."""
    from sympy import simplify, Integer

    try:
        # Find the starting index and value
        start_idx = 1
        start_val = 1
        for k, v in initial.items():
            m = re.search(r"a\s*\(\s*(\d+)\s*\)", k)
            if m:
                start_idx = int(m.group(1))
                start_val = Integer(v)
                break

        if eval_at is None:
            return error_response("No evaluate_at provided for iteration", SOLVER_NAME)

        # Iterate
        current = start_val
        x = n  # variable
        for i in range(start_idx, int(eval_at)):
            current = recurrence_expr.subs(a(x), current).subs(x, i)

        claimed = parse_expr_safe(claimed_latex)

        if check_equivalence(current, claimed, "n"):
            return build_response(
                correct=True,
                computed=str(current),
                confidence="medium",
                explanation=f"Iterated from a({start_idx})={start_val} to a({eval_at})={current}",
                detected_type=SOLVER_NAME,
            )

        return build_response(
            correct=False,
            computed=str(current),
            confidence="medium",
            explanation=f"a({eval_at}) = {current} (by iteration), claimed = {claimed}",
            detected_type=SOLVER_NAME,
        )

    except Exception as e:
        return error_response(f"Iteration failed: {str(e)[:200]}", SOLVER_NAME)


# ---------------------------------------------------------------------------
# Public verify function
# ---------------------------------------------------------------------------

def verify(expr_latex: str, claimed_latex: str, var_name: str, params: dict) -> dict:
    """Main entry point for recurrence verification."""
    result = with_timeout(
        lambda: _verify_recurrence_impl(expr_latex, claimed_latex, var_name, params)
    )
    if result is None:
        return error_response("Recurrence verification timed out", SOLVER_NAME)
    return result


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

register_solver(SOLVER_NAME, PATTERNS, verify)
