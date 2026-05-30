"""
solvers/statistics.py — Mean, median, mode, variance, std dev.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "statistics"

PATTERNS = [
    {"pattern": re.compile(r"mean|average", re.I), "type": "mean"},
    {"pattern": re.compile(r"median", re.I), "type": "median"},
    {"pattern": re.compile(r"mode", re.I), "type": "mode"},
    {"pattern": re.compile(r"variance|\\sigma\^2", re.I), "type": "variance"},
    {"pattern": re.compile(r"standard.*deviation|\\sigma", re.I), "type": "std_dev"},
    {"pattern": re.compile(r"coefficient.*variation|\\bCV\\b", re.I), "type": "cv"},
]


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    from sympy import Rational, sqrt
    try:
        data = params.get("data", [])
        claimed = parse_expr_safe(claimed_latex)

        if not data:
            return error_response("No data provided", SOLVER_NAME)

        ptype = params.get("type", "mean")
        n = len(data)

        if ptype == "mean":
            result = Rational(sum(data), n)
        elif ptype == "median":
            sorted_data = sorted(data)
            if n % 2 == 1:
                result = Rational(sorted_data[n // 2])
            else:
                result = Rational(sorted_data[n//2 - 1] + sorted_data[n//2], 2)
        elif ptype == "mode":
            from collections import Counter
            counts = Counter(data)
            max_count = max(counts.values())
            modes = [k for k, v in counts.items() if v == max_count]
            result = modes[0] if len(modes) == 1 else modes
        elif ptype == "variance":
            mean = Rational(sum(data), n)
            result = Rational(sum((x - mean)**2 for x in data), n)
        elif ptype == "std_dev":
            mean = Rational(sum(data), n)
            var = Rational(sum((x - mean)**2 for x in data), n)
            result = sqrt(var)
        elif ptype == "cv":
            mean = Rational(sum(data), n)
            var = Rational(sum((x - mean)**2 for x in data), n)
            result = sqrt(var) / mean * 100
        else:
            result = Rational(sum(data), n)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"{ptype} = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"{ptype} = {result}, claimed = {claimed}", SOLVER_NAME)

    except Exception as e:
        return error_response(f"Statistics verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("Statistics verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
