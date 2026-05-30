"""
solvers/three_d_geometry.py — Lines, planes, skew lines in 3D.
"""

import re
import logging
from . import register_solver
from .base import (
    parse_expr_safe, check_equivalence, check_numerical,
    build_response, error_response, with_timeout,
)

logger = logging.getLogger(__name__)

SOLVER_NAME = "three_d_geometry"

PATTERNS = [
    {"pattern": re.compile(r"3d.*geometry|three.*dimensional", re.I), "type": "3d"},
    {"pattern": re.compile(r"direction\s*cosine|direction\s*ratio", re.I), "type": "direction"},
    {"pattern": re.compile(r"line.*3d|line.*space|symmetric.*form|parametric.*form", re.I), "type": "line3d"},
    {"pattern": re.compile(r"plane.*equation|equation.*plane|ax\+by\+cz", re.I), "type": "plane"},
    {"pattern": re.compile(r"angle.*line.*plane|angle.*between.*plane", re.I), "type": "angle"},
    {"pattern": re.compile(r"skew.*line|shortest.*distance", re.I), "type": "skew"},
    {"pattern": re.compile(r"image.*point.*plane|reflection.*plane", re.I), "type": "image"},
]


def _verify_distance_point_plane_impl(params):
    """Distance from point to plane: |ax0+by0+cz0+d| / sqrt(a²+b²+c²)"""
    from sympy import sqrt, Abs, Rational
    plane = params.get("plane", [0, 0, 0, 0])  # [a, b, c, d]
    point = params.get("point", [0, 0, 0])  # [x0, y0, z0]

    a, b, c, d = plane
    x0, y0, z0 = point

    dist = Abs(a*x0 + b*y0 + c*z0 + d) / sqrt(a**2 + b**2 + c**2)
    return dist


def _verify_angle_line_plane_impl(params):
    """sin θ = |a⃗·n⃗| / (|a⃗|·|n⃗|)"""
    from sympy import sqrt, Abs, asin
    line_dir = params.get("line_direction", [0, 0, 0])
    plane_normal = params.get("plane_normal", [0, 0, 0])

    dot = sum(a*b for a, b in zip(line_dir, plane_normal))
    line_mag = sqrt(sum(a**2 for a in line_dir))
    plane_mag = sqrt(sum(a**2 for a in plane_normal))

    sin_theta = Abs(dot) / (line_mag * plane_mag)
    return sin_theta


def _verify_skew_distance_impl(params):
    """Shortest distance between skew lines."""
    from sympy import Matrix, sqrt
    p1 = Matrix(params.get("point1", [0, 0, 0]))
    d1 = Matrix(params.get("dir1", [0, 0, 0]))
    p2 = Matrix(params.get("point2", [0, 0, 0]))
    d2 = Matrix(params.get("dir2", [0, 0, 0]))

    cross = d1.cross(d2)
    diff = p2 - p1
    dist = abs(diff.dot(cross)) / cross.norm()
    return dist


def _verify_impl(expr_latex, claimed_latex, var_name, params):
    ptype = params.get("type", "distance")
    claimed = parse_expr_safe(claimed_latex)

    try:
        if ptype == "distance":
            result = _verify_distance_point_plane_impl(params)
        elif ptype == "angle":
            result = _verify_angle_line_plane_impl(params)
        elif ptype == "skew":
            result = _verify_skew_distance_impl(params)
        else:
            return error_response(f"Unknown 3D geometry type: {ptype}", SOLVER_NAME)

        if check_numerical(result, claimed):
            return build_response(True, str(result), "high",
                f"Result = {result}", SOLVER_NAME)

        return build_response(False, str(result), "high",
            f"Result = {result}, claimed = {claimed}", SOLVER_NAME)
    except Exception as e:
        return error_response(f"3D geometry verification failed: {str(e)[:200]}", SOLVER_NAME)


def verify(expr_latex, claimed_latex, var_name, params):
    result = with_timeout(lambda: _verify_impl(expr_latex, claimed_latex, var_name, params))
    if result is None:
        return error_response("3D geometry verification timed out", SOLVER_NAME)
    return result


register_solver(SOLVER_NAME, PATTERNS, verify)
