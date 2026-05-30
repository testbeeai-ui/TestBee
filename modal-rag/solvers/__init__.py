"""
solvers/__init__.py — Solver registry and auto-detect engine.

Each solver module registers itself by defining:
- SOLVER_NAME: str — unique identifier
- PATTERNS: list[dict] — regex patterns for auto-detect
- verify(expr, claimed, var, params) — main entry point
"""

import importlib
import logging
import re
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Solver registry
# ---------------------------------------------------------------------------

_SOLVERS: dict[str, dict] = {}


def register_solver(name: str, patterns: list[dict], verify_fn: Callable):
    """Register a solver module."""
    _SOLVERS[name] = {
        "patterns": patterns,
        "verify": verify_fn,
    }


def get_solver(name: str) -> Optional[Callable]:
    """Get a solver's verify function by name."""
    s = _SOLVERS.get(name)
    return s["verify"] if s else None


def list_solvers() -> list[str]:
    """List all registered solver names."""
    return list(_SOLVERS.keys())


# ---------------------------------------------------------------------------
# Auto-detect engine
# ---------------------------------------------------------------------------

def detect_problem_type(question_text: str, expression: str = "") -> Optional[str]:
    """
    Detect problem type from question text and expression.
    Returns solver name or None if no match.
    """
    text = f"{question_text} {expression}".lower()

    # Try each solver's patterns in registration order
    for name, solver in _SOLVERS.items():
        for pat_info in solver["patterns"]:
            if pat_info["pattern"].search(text):
                return name

    return None


def auto_detect_and_verify(
    question_text: str,
    expression: str,
    claimed_result: str,
    variable: str = "x",
    params: dict = None,
) -> Optional[dict]:
    """
    Auto-detect problem type and run verification.
    Returns response dict or None if no solver matched.
    """
    solver_name = detect_problem_type(question_text, expression)
    if not solver_name:
        return None

    solver = _SOLVERS.get(solver_name)
    if not solver:
        return None

    try:
        return solver["verify"](expression, claimed_result, variable, params or {})
    except Exception as e:
        from .base import error_response
        return error_response(f"Auto-detect solver '{solver_name}' failed: {str(e)[:200]}", solver_name)


# ---------------------------------------------------------------------------
# Load all solver modules
# ---------------------------------------------------------------------------

def load_all_solvers():
    """Import all solver modules to trigger registration."""
    solver_dir = Path(__file__).parent
    for f in sorted(solver_dir.glob("*.py")):
        if f.name.startswith("_") or f.name == "base.py":
            continue
        module_name = f".{f.stem}"
        try:
            importlib.import_module(module_name, package="solvers")
        except Exception as e:
            logger.warning(f"Failed to load solver {module_name}: {e}")


# Auto-load on import
load_all_solvers()
