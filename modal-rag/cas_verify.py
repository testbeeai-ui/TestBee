"""
cas_verify.py — SymPy CAS verification for Prof-Pi math/physics answers.

Endpoint: POST /verify-calc
Accepts a LaTeX expression + claimed result, verifies with SymPy.
Returns whether the claimed result is mathematically correct.
"""

import logging
import re
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CalcVerifyRequest(BaseModel):
    operation: str  # "integrate" | "differentiate" | "simplify" | "solve" | "limit" | "evaluate"
    expression: str  # LaTeX of the input
    variable: str = "x"
    claimed_result: str  # LaTeX of the claimed answer
    grade_level: int = 12


class CalcVerifyResponse(BaseModel):
    correct: bool
    computed: Optional[str] = None  # SymPy's result as LaTeX
    confidence: str  # "high" | "medium" | "low"
    explanation: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# LaTeX → SymPy parsing
# ---------------------------------------------------------------------------

def _clean_latex(s: str) -> str:
    """Strip surrounding $...$ / $$...$$ and common wrappers."""
    t = s.strip()
    # Strip display math
    if t.startswith("$$") and t.endswith("$$"):
        t = t[2:-2].strip()
    elif t.startswith("$") and t.endswith("$"):
        t = t[1:-1].strip()
    # Strip \displaystyle
    t = re.sub(r"\\displaystyle\s*", "", t)
    # Strip \left \right
    t = t.replace("\\left", "").replace("\\right", "")
    # Strip trailing + C (integration constant)
    t = re.sub(r"\s*\+\s*[Cc](\s*$|\s*\))", "", t)
    return t.strip()


def _latex_to_sympy_str(latex: str) -> str:
    """
    Convert LaTeX to a SymPy-parseable string.
    Uses latex2sympy2 if available, otherwise manual fallback.
    """
    cleaned = _clean_latex(latex)
    if not cleaned:
        return ""

    try:
        from latex2sympy2 import latex2sympy  # type: ignore
        expr = latex2sympy(cleaned)
        return str(expr)
    except Exception:
        pass

    # Manual fallback for common patterns
    return _manual_latex_to_sympy(cleaned)


def _manual_latex_to_sympy(latex: str) -> str:
    """Best-effort manual conversion for common LaTeX patterns."""
    s = latex

    # Named functions
    s = s.replace("\\sin^{-1}", "asin")
    s = s.replace("\\cos^{-1}", "acos")
    s = s.replace("\\tan^{-1}", "atan")
    s = s.replace("\\sinh^{-1}", "asinh")
    s = s.replace("\\cosh^{-1}", "acosh")
    s = s.replace("\\tanh^{-1}", "atanh")
    s = s.replace("\\sin", "sin")
    s = s.replace("\\cos", "cos")
    s = s.replace("\\tan", "tan")
    s = s.replace("\\log", "log")
    s = s.replace("\\ln", "log")
    s = s.replace("\\exp", "exp")
    s = s.replace("\\sqrt", "sqrt")
    s = s.replace("\\sec", "sec")
    s = s.replace("\\csc", "csc")
    s = s.replace("\\cot", "cot")

    # Constants
    s = s.replace("\\pi", "pi")
    s = s.replace("\\infty", "oo")
    s = s.replace("\\infinity", "oo")

    # Fractions: \frac{a}{b} → (a)/(b)
    s = re.sub(r"\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
               r"((\1)/(\2))", s)

    # Square root: \sqrt{x} → sqrt(x), \sqrt[n]{x} → root(x, n)
    s = re.sub(r"\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}", r"root(\2, \1)", s)
    s = re.sub(r"\\sqrt\s*\{([^{}]+)\}", r"sqrt(\1)", s)

    # Powers: x^{n} → x**(n), x^n → x**n
    s = re.sub(r"\^{([^{}]+)}", r"**(\1)", s)
    s = re.sub(r"\^(\w)", r"**\1", s)

    # Subscripts: x_{n} → x_n (SymPy treats as symbol, usually fine)
    s = re.sub(r"\_{([^{}]+)}", r"_\1", s)

    # Multiplication: \times → *, \cdot → *
    s = s.replace("\\times", "*")
    s = s.replace("\\cdot", "*")

    # Differential: dx → dx (keep as symbol)
    s = s.replace("\\,", " ")
    s = s.replace("\\;", " ")

    # Remove remaining backslashes from unknown commands
    s = re.sub(r"\\([a-zA-Z]+)", r"\1", s)

    # Clean up braces
    s = s.replace("{", "(").replace("}", ")")

    return s.strip()


# ---------------------------------------------------------------------------
# SymPy verification
# ---------------------------------------------------------------------------

def _parse_expr(s: str):
    """Parse a string into a SymPy expression."""
    from sympy import sympify, Symbol  # type: ignore
    from sympy.parsing.latex import parse_latex  # type: ignore

    cleaned = _clean_latex(s)
    if not cleaned:
        raise ValueError("Empty expression")

    # Try SymPy's built-in LaTeX parser first
    try:
        return parse_latex(cleaned)
    except Exception:
        pass

    # Try latex2sympy2
    try:
        from latex2sympy2 import latex2sympy  # type: ignore
        return latex2sympy(cleaned)
    except Exception:
        pass

    # Manual fallback
    manual = _manual_latex_to_sympy(cleaned)
    return sympify(manual)


def _verify_integral(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify an integral by differentiating the claimed result."""
    from sympy import simplify, diff, Symbol, integrate, oo  # type: ignore

    try:
        x = Symbol(var_name)
        integrand = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        # Method 1: Differentiate claimed result, compare to integrand
        derivative = diff(claimed, x)
        diff_result = simplify(derivative - integrand)

        if diff_result == 0:
            return CalcVerifyResponse(
                correct=True,
                computed=str(claimed),
                confidence="high",
                explanation="Derivative of claimed result matches the integrand",
            )

        # Try numerical spot-check at a few points
        import random
        random.seed(42)
        matches = 0
        trials = 5
        for _ in range(trials):
            val = random.uniform(0.1, 5.0)
            try:
                d_val = float(derivative.subs(x, val).evalf())
                i_val = float(integrand.subs(x, val).evalf())
                if abs(d_val - i_val) < 1e-6:
                    matches += 1
            except Exception:
                continue

        if matches >= 3:
            return CalcVerifyResponse(
                correct=True,
                computed=str(claimed),
                confidence="medium",
                explanation=f"Numerical spot-check passed ({matches}/{trials} points)",
            )

        # Compute our own answer for the user
        try:
            computed = integrate(integrand, x)
            return CalcVerifyResponse(
                correct=False,
                computed=str(computed),
                confidence="high",
                explanation=f"Derivative of claimed result does not match integrand. SymPy computed: {computed}",
            )
        except Exception:
            return CalcVerifyResponse(
                correct=False,
                computed=None,
                confidence="medium",
                explanation="Derivative of claimed result does not match integrand",
            )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


def _verify_derivative(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify a derivative by recomputing independently."""
    from sympy import simplify, diff, Symbol  # type: ignore

    try:
        x = Symbol(var_name)
        func = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        computed = diff(func, x)
        if simplify(computed - claimed) == 0:
            return CalcVerifyResponse(
                correct=True,
                computed=str(computed),
                confidence="high",
                explanation="Derivative matches SymPy computation",
            )

        return CalcVerifyResponse(
            correct=False,
            computed=str(computed),
            confidence="high",
            explanation=f"Expected {computed}, got {claimed}",
        )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


def _verify_limit(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify a limit by recomputing."""
    from sympy import limit, Symbol, oo  # type: ignore

    try:
        x = Symbol(var_name)
        expr = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        # Try computing limit at the expression's limit point
        # Default to x→0 if not specified
        computed = limit(expr, x, 0)
        if computed == claimed:
            return CalcVerifyResponse(
                correct=True,
                computed=str(computed),
                confidence="high",
                explanation="Limit matches SymPy computation",
            )

        # Try x→∞
        computed_inf = limit(expr, x, oo)
        if computed_inf == claimed:
            return CalcVerifyResponse(
                correct=True,
                computed=str(computed_inf),
                confidence="high",
                explanation="Limit (x→∞) matches SymPy computation",
            )

        return CalcVerifyResponse(
            correct=False,
            computed=str(computed),
            confidence="medium",
            explanation=f"Limit at x→0: {computed}, limit at x→∞: {computed_inf}, claimed: {claimed}",
        )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


def _verify_simplify(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify simplification by checking equivalence."""
    from sympy import simplify, Symbol  # type: ignore

    try:
        expr = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        if simplify(expr - claimed) == 0:
            return CalcVerifyResponse(
                correct=True,
                computed=str(claimed),
                confidence="high",
                explanation="Expressions are equivalent",
            )

        simplified = simplify(expr)
        return CalcVerifyResponse(
            correct=False,
            computed=str(simplified),
            confidence="high",
            explanation=f"Simplified form: {simplified}, claimed: {claimed}",
        )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


def _verify_solve(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify equation solving by substituting solutions back."""
    from sympy import solve, Symbol, simplify  # type: ignore

    try:
        x = Symbol(var_name)
        expr = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        # If expression has an =, treat as equation
        solutions = solve(expr, x)

        # Check if claimed value is among solutions
        for sol in solutions:
            if simplify(sol - claimed) == 0:
                return CalcVerifyResponse(
                    correct=True,
                    computed=str(sol),
                    confidence="high",
                    explanation="Claimed solution verified",
                )

        return CalcVerifyResponse(
            correct=False,
            computed=str(solutions),
            confidence="high",
            explanation=f"Solutions: {solutions}, claimed: {claimed}",
        )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


def _verify_evaluate(expr_latex: str, claimed_latex: str, var_name: str) -> CalcVerifyResponse:
    """Verify numerical evaluation."""
    from sympy import simplify, Symbol, N  # type: ignore

    try:
        expr = _parse_expr(expr_latex)
        claimed = _parse_expr(claimed_latex)

        expr_val = N(expr)
        claimed_val = N(claimed)

        try:
            if abs(float(expr_val) - float(claimed_val)) < 1e-8:
                return CalcVerifyResponse(
                    correct=True,
                    computed=str(expr_val),
                    confidence="high",
                    explanation="Numerical evaluation matches",
                )
        except (TypeError, ValueError):
            # Symbolic comparison
            if simplify(expr - claimed) == 0:
                return CalcVerifyResponse(
                    correct=True,
                    computed=str(expr),
                    confidence="high",
                    explanation="Expressions are equivalent",
                )

        return CalcVerifyResponse(
            correct=False,
            computed=str(expr_val),
            confidence="high",
            explanation=f"Expected {expr_val}, got {claimed_val}",
        )

    except Exception as e:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Verification failed: {str(e)[:200]}",
            error=str(e)[:200],
        )


# ---------------------------------------------------------------------------
# Main verification dispatcher
# ---------------------------------------------------------------------------

VERIFY_DISPATCH = {
    "integrate": _verify_integral,
    "differentiate": _verify_derivative,
    "limit": _verify_limit,
    "simplify": _verify_simplify,
    "solve": _verify_solve,
    "evaluate": _verify_evaluate,
}


def verify_calculation(req: CalcVerifyRequest) -> CalcVerifyResponse:
    """Dispatch to the appropriate verification function."""
    op = req.operation.lower().strip()

    if op not in VERIFY_DISPATCH:
        return CalcVerifyResponse(
            correct=False,
            computed=None,
            confidence="low",
            explanation=f"Unknown operation: {op}",
            error=f"Unsupported operation: {op}",
        )

    handler = VERIFY_DISPATCH[op]
    return handler(req.expression, req.claimed_result, req.variable)
