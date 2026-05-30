"""
solvers/multi_step.py — Chains multiple solvers together for complex problems.

This is the key solver for problems like:
- f(f(x)) = 6 where f(x) = √(x + √(x + ...))
  Step 1: nested_radical → extract f(x) = (1+√(1+4x))/2
  Step 2: compose_functions → compute f(f(x))
  Step 3: solve → solve f(f(x)) = 6

- lim n→∞ n(ⁿ√(n!) - n/e)
  Step 1: sequence_limit → apply Stirling
  Step 2: limit → evaluate the resulting expression
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "multi_step"

PATTERNS = [
    # Multi-step problems are detected by combining patterns
    {"pattern": re.compile(r"f\s*\(\s*f.*=.*\d.*where.*f\s*\(.*=.*\\sqrt", re.I), "type": "nested_compose"},
    {"pattern": re.compile(r"nested.*radical.*compos|radical.*function.*solve", re.I), "type": "nested_compose"},
]


def _get_solver(name: str):
    """Get a solver by name from the registry."""
    from . import _SOLVERS
    s = _SOLVERS.get(name)
    return s["verify"] if s else None


def _execute_step(step: dict, prev_result=None) -> dict:
    """Execute a single step in the chain."""
    op = step.get("operation", "").lower()
    expr = step.get("expression", "")
    var = step.get("variable", "x")
    params = step.get("params", {})
    claimed = step.get("claimed_result", "0")

    # Substitute previous result if placeholder
    if prev_result is not None and "{{prev}}" in expr:
        expr = expr.replace("{{prev}}", str(prev_result))
    if prev_result is not None and "{{prev}}" in claimed:
        claimed = claimed.replace("{{prev}}", str(prev_result))

    # Map operation to solver module
    SOLVER_MAP = {
        "nested_radical": "nested_radical",
        "compose_functions": "functions",
        "composition": "functions",
        "solve": "algebra",
        "evaluate": "calculus",
        "limit": "calculus",
        "integrate": "calculus",
        "differentiate": "calculus",
        "simplify": "calculus",
        "modular": "discrete",
        "recurrence": "recurrence",
        "series": "infinite_series",
    }

    solver_name = SOLVER_MAP.get(op)
    if not solver_name:
        return {"error": f"Unknown step operation: {op}"}

    solver = _get_solver(solver_name)
    if not solver:
        return {"error": f"Solver '{solver_name}' not registered"}

    # Set type in params for the solver
    if op == "compose_functions" or op == "composition":
        params["type"] = "composition"
    elif op == "nested_radical":
        pass  # solver handles this natively
    elif op == "solve":
        params["type"] = "equation"
    elif op == "limit":
        params["type"] = "limit"

    return solver(expr, claimed, var, params)


def _verify_multi_step_impl(
    expr_latex: str, claimed_latex: str, var_name: str, params: dict
) -> dict:
    """
    Execute a chain of solver steps.

    params.steps: list of step dicts, each with:
        - operation: str (solver name or operation type)
        - expression: str (LaTeX, can contain {{prev}} placeholder)
        - variable: str
        - params: dict (optional)
    """
    steps = params.get("steps", [])

    if not steps:
        return error_response("No steps provided for multi-step verification", SOLVER_NAME)

    current_result = None
    step_results = []
    all_correct = True

    for i, step in enumerate(steps):
        try:
            result = _execute_step(step, current_result)

            step_results.append({
                "step": i + 1,
                "operation": step.get("operation", "unknown"),
                "input": step.get("expression", ""),
                "output": result.get("computed", "error"),
                "correct": result.get("correct", False),
                "confidence": result.get("confidence", "low"),
                "explanation": result.get("explanation", ""),
            })

            if result.get("computed"):
                current_result = parse_expr_safe(result["computed"])
            elif result.get("correct"):
                # Step verified something — use the claimed result as next input
                current_result = parse_expr_safe(step.get("claimed_result", "0"))

            if not result.get("correct"):
                all_correct = False

        except Exception as e:
            step_results.append({
                "step": i + 1,
                "operation": step.get("operation", "unknown"),
                "input": step.get("expression", ""),
                "output": f"Error: {str(e)[:100]}",
                "correct": False,
                "confidence": "low",
            })
            all_correct = False

    # Compare final result with claimed
    claimed = parse_expr_safe(claimed_latex)
    final_correct = False

    if current_result is not None:
        final_correct = check_equivalence(current_result, claimed, var_name)
        if not final_correct:
            try:
                final_correct = check_numerical(current_result, claimed)
            except Exception:
                pass

    return build_response(
        correct=final_correct,
        computed=str(current_result) if current_result else None,
        confidence="high" if final_correct else "medium",
        explanation=(
            f"Multi-step: {len(steps)} steps executed. "
            f"Final result: {current_result}, Claimed: {claimed}"
        ),
        steps=step_results,
        detected_type=SOLVER_NAME,
    )


def verify(expr_latex: str, claimed_latex: str, var_name: str, params: dict) -> dict:
    """Main entry point for multi-step verification."""
    result = with_timeout(
        lambda: _verify_multi_step_impl(expr_latex, claimed_latex, var_name, params),
        timeout_seconds=10,  # Multi-step gets more time
    )
    if result is None:
        return error_response("Multi-step verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
