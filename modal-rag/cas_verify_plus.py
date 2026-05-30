"""
cas_verify_plus.py — Universal math solver orchestrator.

Imports the original cas_verify.py (all 7 operations unchanged) and adds
new solver-based operations from the solvers/ directory.

This file is the new entry point for /verify-calc. It:
1. Tries the original VERIFY_DISPATCH first (integrals, derivatives, etc.)
2. If no match, tries the solver registry (nested radicals, functions, etc.)
3. If still no match, tries auto-detect from question_text
"""

import logging
from typing import Optional

from cas_verify import (
    CalcVerifyRequest as _BaseRequest,
    CalcVerifyResponse as _BaseResponse,
    VERIFY_DISPATCH,
    _parse_expr,
    _clean_latex,
    verify_calculation as _original_verify,
)

# Import solver registry
from solvers import auto_detect_and_verify, get_solver, list_solvers, detect_problem_type

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Extended request/response models
# ---------------------------------------------------------------------------

class CalcVerifyRequest(_BaseRequest):
    """Extended request with multi-step and auto-detect support."""
    steps: list = []
    params: dict = {}
    question_text: str = ""


class CalcVerifyResponse(_BaseResponse):
    """Extended response with step breakdown and detected type."""
    steps: list = []
    detected_type: Optional[str] = None


# ---------------------------------------------------------------------------
# New operations from solvers
# ---------------------------------------------------------------------------

# Map operation names to solver module names
SOLVER_OPERATIONS = {
    "nested_radical": "nested_radical",
    "compose_functions": "functions",
    "composition": "functions",
    "inverse_function": "functions",
    "domain": "functions",
    "recurrence_relation": "recurrence",
    "recurrence": "recurrence",
    "infinite_series": "infinite_series",
    "series_convergence": "infinite_series",
    "algebra": "algebra",
    "quadratic": "algebra",
    "factor_polynomial": "algebra",
    "inequality": "algebra",
    "system_of_equations": "algebra",
    "trigonometry": "trigonometry",
    "trig_identity": "trigonometry",
    "trig_equation": "trigonometry",
    "complex_numbers": "complex_numbers",
    "modulus_complex": "complex_numbers",
    "roots_of_unity": "complex_numbers",
    "coordinate_geometry": "coordinate_geometry",
    "conic_section": "coordinate_geometry",
    "vectors": "vectors",
    "dot_product": "vectors",
    "cross_product": "vectors",
    "three_d_geometry": "three_d_geometry",
    "line_3d": "three_d_geometry",
    "plane_3d": "three_d_geometry",
    "linear_algebra": "linear_algebra",
    "determinant": "linear_algebra",
    "eigenvalue": "linear_algebra",
    "matrix_inverse": "linear_algebra",
    "discrete": "discrete",
    "modular_arithmetic": "discrete",
    "permutation": "discrete",
    "combination": "discrete",
    "binomial_theorem": "discrete",
    "number_theory": "number_theory",
    "prime_factorization": "number_theory",
    "euler_totient": "number_theory",
    "probability": "probability",
    "conditional_probability": "probability",
    "bayes_theorem": "probability",
    "ode": "ode",
    "differential_equation": "ode",
    "sequences_series": "sequences_series",
    "arithmetic_progression": "sequences_series",
    "geometric_progression": "sequences_series",
    "statistics": "statistics",
    "mean": "statistics",
    "variance": "statistics",
    "continuity": "continuity",
    "differentiability": "continuity",
    "mvt": "continuity",
    "rolles_theorem": "continuity",
    "applications_calc": "applications_calc",
    "maxima_minima": "applications_calc",
    "area_under_curve": "applications_calc",
    "tangent_line": "applications_calc",
    "sets_relations": "sets_relations",
    "set_operations": "sets_relations",
    "logic": "logic",
    "tautology": "logic",
    "special": "special",
    "ceiling_floor": "special",
    "multi_step": "multi_step",
}


# ---------------------------------------------------------------------------
# Main verification function
# ---------------------------------------------------------------------------

def verify_calculation_plus(req: CalcVerifyRequest) -> CalcVerifyResponse:
    """
    Universal verification: tries original operations, then solvers, then auto-detect.
    """
    op = req.operation.lower().strip()

    # 1. Try original VERIFY_DISPATCH (integrals, derivatives, limits, etc.)
    if op in VERIFY_DISPATCH:
        try:
            original_req = _BaseRequest(
                operation=req.operation,
                expression=req.expression,
                variable=req.variable,
                claimed_result=req.claimed_result,
                grade_level=req.grade_level,
            )
            result = _original_verify(original_req)
            return CalcVerifyResponse(
                correct=result.correct,
                computed=result.computed,
                confidence=result.confidence,
                explanation=result.explanation,
                error=result.error,
                detected_type=f"original_{op}",
            )
        except Exception as e:
            logger.warning(f"Original dispatch failed for '{op}': {e}")

    # 2. Try solver registry
    solver_name = SOLVER_OPERATIONS.get(op)
    if solver_name:
        solver_fn = get_solver(solver_name)
        if solver_fn:
            try:
                result = solver_fn(
                    req.expression,
                    req.claimed_result,
                    req.variable,
                    req.params,
                )
                return CalcVerifyResponse(
                    correct=result.get("correct", False),
                    computed=result.get("computed"),
                    confidence=result.get("confidence", "low"),
                    explanation=result.get("explanation", ""),
                    error=result.get("error"),
                    steps=result.get("steps", []),
                    detected_type=result.get("detected_type", solver_name),
                )
            except Exception as e:
                logger.warning(f"Solver '{solver_name}' failed for '{op}': {e}")

    # 3. Multi-step: if steps provided, use multi_step solver
    if req.steps:
        multi_step_fn = get_solver("multi_step")
        if multi_step_fn:
            try:
                params_with_steps = {**req.params, "steps": req.steps}
                result = multi_step_fn(
                    req.expression,
                    req.claimed_result,
                    req.variable,
                    params_with_steps,
                )
                return CalcVerifyResponse(
                    correct=result.get("correct", False),
                    computed=result.get("computed"),
                    confidence=result.get("confidence", "low"),
                    explanation=result.get("explanation", ""),
                    error=result.get("error"),
                    steps=result.get("steps", []),
                    detected_type=result.get("detected_type", "multi_step"),
                )
            except Exception as e:
                logger.warning(f"Multi-step solver failed: {e}")

    # 4. Auto-detect from question_text
    if req.question_text:
        try:
            result = auto_detect_and_verify(
                req.question_text,
                req.expression,
                req.claimed_result,
                req.variable,
                req.params,
            )
            if result:
                return CalcVerifyResponse(
                    correct=result.get("correct", False),
                    computed=result.get("computed"),
                    confidence=result.get("confidence", "low"),
                    explanation=result.get("explanation", ""),
                    error=result.get("error"),
                    steps=result.get("steps", []),
                    detected_type=result.get("detected_type", "auto"),
                )
        except Exception as e:
            logger.warning(f"Auto-detect failed: {e}")

    # 5. Nothing matched
    available = list_solvers()
    return CalcVerifyResponse(
        correct=False,
        computed=None,
        confidence="low",
        explanation=f"Unknown operation: '{op}'. Available solvers: {', '.join(available[:10])}...",
        error=f"Unsupported operation: {op}",
        detected_type="unknown",
    )
