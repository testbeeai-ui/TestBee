"""
solvers/base.py — Shared utilities for all CAS solver modules.

Provides:
- Enhanced LaTeX-to-SymPy parsing (extends cas_verify.py's _manual_latex_to_sympy)
- Timeout wrapper for long computations
- Equivalence checking with multiple strategies
- Common constants and imports
"""

import logging
import re
import threading
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Timeout for individual solver operations (seconds)
SOLVER_TIMEOUT = 4

# Numerical comparison tolerance
NUM_TOLERANCE = 1e-8

# Spot-check parameters
SPOT_CHECK_POINTS = 5
SPOT_CHECK_THRESHOLD = 4  # out of SPOT_CHECK_POINTS


# ---------------------------------------------------------------------------
# Timeout wrapper
# ---------------------------------------------------------------------------

class SolverTimeoutError(Exception):
    pass


def with_timeout(func, timeout_seconds: int = SOLVER_TIMEOUT):
    """Execute func with a timeout. Returns None on timeout."""
    result = [None]
    error = [None]

    def target():
        try:
            result[0] = func()
        except Exception as e:
            error[0] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout_seconds)

    if thread.is_alive():
        return None  # Timed out
    if error[0]:
        raise error[0]
    return result[0]


# ---------------------------------------------------------------------------
# Enhanced LaTeX preprocessing
# ---------------------------------------------------------------------------

def clean_latex(s: str) -> str:
    """Strip surrounding $...$ / $$...$$ and common wrappers."""
    t = s.strip()
    if t.startswith("$$") and t.endswith("$$"):
        t = t[2:-2].strip()
    elif t.startswith("$") and t.endswith("$"):
        t = t[1:-1].strip()
    t = re.sub(r"\\displaystyle\s*", "", t)
    t = t.replace("\\left", "").replace("\\right", "")
    t = re.sub(r"\s*\+\s*[Cc](\s*$|\s*\))", "", t)
    return t.strip()


def enhanced_latex_to_sympy_str(latex: str) -> str:
    """
    Convert LaTeX to a SymPy-parseable string with enhanced patterns.
    Extends cas_verify.py's _manual_latex_to_sympy with additional patterns.
    """
    s = clean_latex(latex)
    if not s:
        return ""

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

    # Greek letters
    GREEK_MAP = {
        "\\alpha": "alpha", "\\beta": "beta", "\\gamma": "gamma", "\\delta": "delta",
        "\\epsilon": "epsilon", "\\varepsilon": "epsilon", "\\zeta": "zeta", "\\eta": "eta",
        "\\theta": "theta", "\\vartheta": "theta", "\\iota": "iota", "\\kappa": "kappa",
        "\\lambda": "lambda", "\\mu": "mu", "\\nu": "nu", "\\xi": "xi",
        "\\rho": "rho", "\\sigma": "sigma", "\\tau": "tau", "\\upsilon": "upsilon",
        "\\phi": "phi", "\\varphi": "phi", "\\chi": "chi", "\\psi": "psi", "\\omega": "omega",
        "\\Gamma": "Gamma", "\\Delta": "Delta", "\\Theta": "Theta", "\\Lambda": "Lambda",
        "\\Xi": "Xi", "\\Pi": "Pi", "\\Sigma": "Sigma", "\\Phi": "Phi",
        "\\Psi": "Psi", "\\Omega": "Omega",
    }
    for latex_cmd, sympy_name in GREEK_MAP.items():
        s = s.replace(latex_cmd, sympy_name)

    # === ENHANCED PATTERNS (beyond cas_verify.py) ===

    # Factorial: n! → factorial(n)
    s = re.sub(r"(\w+)!", r"factorial(\1)", s)

    # Mod operator
    s = s.replace("\\pmod", "Mod")
    s = s.replace("\\mod", "Mod")

    # Binomial coefficient
    s = re.sub(r"\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}", r"binomial(\1, \2)", s)

    # Ceiling/floor
    s = re.sub(r"\\lceil\s*(.+?)\s*\\rceil", r"ceiling(\1)", s)
    s = re.sub(r"\\lfloor\s*(.+?)\s*\\rfloor", r"floor(\1)", s)

    # Fractional part: \{x\} → frac(x) — but only if it looks like a math expression
    s = re.sub(r"\\{\s*([^{}]+?)\s*\\}", r"frac(\1)", s)

    # Summation: \sum_{i=a}^{b} expr → summation(expr, (i, a, b))
    s = re.sub(
        r"\\sum\s*_\{(\w+)\s*=\s*(\d+)\}\s*\^\{?([^}\s]+)\}?\s*(.+?)(?=\s*[+\\]|\s*$)",
        r"summation(\4, (\1, \2, \3))",
        s
    )

    # Product: \prod_{i=a}^{b} expr → product(expr, (i, a, b))
    s = re.sub(
        r"\\prod\s*_\{(\w+)\s*=\s*(\d+)\}\s*\^\{?([^}\s]+)\}?\s*(.+?)(?=\s*[+\\]|\s*$)",
        r"product(\4, (\1, \2, \3))",
        s
    )

    # Fractions
    s = re.sub(
        r"\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
        r"((\1)/(\2))", s
    )

    # Square root (n-th root first, then regular)
    s = re.sub(r"\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}", r"root(\2, \1)", s)
    s = re.sub(r"\\sqrt\s*\{([^{}]+)\}", r"sqrt(\1)", s)

    # Powers
    s = re.sub(r"\^{([^{}]+)}", r"**(\1)", s)
    s = re.sub(r"\^(\w)", r"**\1", s)

    # Subscripts
    s = re.sub(r"\_{([^{}]+)}", r"_\1", s)

    # Multiplication
    s = s.replace("\\times", "*")
    s = s.replace("\\cdot", "*")

    # Differential
    s = s.replace("\\,", " ")
    s = s.replace("\\;", " ")

    # Vector notation
    s = s.replace("\\vec{", "")
    s = s.replace("\\overrightarrow{", "")

    # Remove remaining backslashes from unknown commands
    s = re.sub(r"\\([a-zA-Z]+)", r"\1", s)

    # Clean up braces
    s = s.replace("{", "(").replace("}", ")")

    return s.strip()


def parse_expr_safe(s: str):
    """Parse a string into a SymPy expression with fallback chain."""
    from sympy import sympify

    cleaned = clean_latex(s)
    if not cleaned:
        raise ValueError("Empty expression")

    # 1. Try latex2sympy2
    try:
        from latex2sympy2 import latex2sympy
        return latex2sympy(cleaned)
    except Exception:
        pass

    # 2. Try latex2sympy2 on light-cleaned
    light = s.strip().strip("$").strip()
    if light != cleaned:
        try:
            from latex2sympy2 import latex2sympy
            return latex2sympy(light)
        except Exception:
            pass

    # 3. Try SymPy's parse_latex
    try:
        from sympy.parsing.latex import parse_latex
        return parse_latex(cleaned)
    except Exception:
        pass

    # 4. Enhanced manual fallback
    manual = enhanced_latex_to_sympy_str(cleaned)
    return sympify(manual)


# ---------------------------------------------------------------------------
# Equivalence checking
# ---------------------------------------------------------------------------

def check_equivalence(expr1, expr2, var_name: str = "x") -> bool:
    """Check if two SymPy expressions are equivalent using multiple strategies."""
    from sympy import simplify, expand, factor, Symbol
    import random

    # Direct symbolic difference
    try:
        if simplify(expr1 - expr2) == 0:
            return True
    except Exception:
        pass

    # Expanded forms
    try:
        if expand(expr1) == expand(expr2):
            return True
    except Exception:
        pass

    # Factored forms
    try:
        if factor(expr1) == factor(expr2):
            return True
    except Exception:
        pass

    # Numerical spot-check
    try:
        x = Symbol(var_name)
        random.seed(42)
        matches = 0
        for _ in range(SPOT_CHECK_POINTS):
            val = random.uniform(0.5, 10.0)
            try:
                v1 = float(expr1.subs(x, val).evalf())
                v2 = float(expr2.subs(x, val).evalf())
                if abs(v1 - v2) < NUM_TOLERANCE:
                    matches += 1
            except Exception:
                continue
        if matches >= SPOT_CHECK_THRESHOLD:
            return True
    except Exception:
        pass

    return False


def check_numerical(val1, val2) -> bool:
    """Check if two numerical values are close enough."""
    try:
        return abs(float(val1) - float(val2)) < NUM_TOLERANCE
    except (TypeError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Response builder
# ---------------------------------------------------------------------------

def build_response(
    correct: bool,
    computed: Any = None,
    confidence: str = "high",
    explanation: str = "",
    error: Optional[str] = None,
    steps: Optional[list] = None,
    detected_type: Optional[str] = None,
):
    """Build a CalcVerifyResponse dict."""
    return {
        "correct": correct,
        "computed": str(computed) if computed is not None else None,
        "confidence": confidence,
        "explanation": explanation,
        "error": error,
        "steps": steps or [],
        "detected_type": detected_type,
    }


def error_response(msg: str, detected_type: str = "unknown"):
    """Build an error response."""
    return build_response(
        correct=False,
        confidence="low",
        explanation=msg[:200],
        error=msg[:200],
        detected_type=detected_type,
    )
