"""
test_cas_verify_plus.py — Comprehensive tests for the universal math solver.

Tests every solver module with correct and incorrect claimed results.
Run: cd modal-rag && pytest test_cas_verify_plus.py -v
"""

import pytest
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(__file__))

from cas_verify_plus import CalcVerifyRequest, CalcVerifyResponse, verify_calculation_plus


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def verify(op, expr, claimed, var="x", params=None, steps=None, question_text=""):
    req = CalcVerifyRequest(
        operation=op,
        expression=expr,
        variable=var,
        claimed_result=claimed,
        grade_level=12,
        steps=steps or [],
        params=params or {},
        question_text=question_text,
    )
    return verify_calculation_plus(req)


# ===========================================================================
# NESTED RADICAL TESTS
# ===========================================================================

class TestNestedRadical:
    """x = √(a + √(a + ...)) → x² = a + x"""

    def test_sqrt_6_correct(self):
        """x = √(6 + √(6 + ...)) = 3"""
        r = verify("nested_radical", r"\sqrt{6 + \sqrt{6 + \cdots}}", "3")
        assert r.correct is True
        assert r.detected_type == "nested_radical"

    def test_sqrt_6_wrong_negative(self):
        """x = √(6 + √(6 + ...)) ≠ -2 (extraneous root)"""
        r = verify("nested_radical", r"\sqrt{6 + \sqrt{6 + \cdots}}", "-2")
        assert r.correct is False

    def test_sqrt_2_correct(self):
        """x = √(2 + √(2 + ...)) = 2"""
        r = verify("nested_radical", r"\sqrt{2 + \sqrt{2 + \cdots}}", "2")
        assert r.correct is True

    def test_sqrt_12_correct(self):
        """x = √(12 + √(12 + ...)) = 4"""
        r = verify("nested_radical", r"\sqrt{12 + \sqrt{12 + \cdots}}", "4")
        assert r.correct is True

    def test_sqrt_20_correct(self):
        """x = √(20 + √(20 + ...)) = 5"""
        r = verify("nested_radical", r"\sqrt{20 + \sqrt{20 + \cdots}}", "5")
        assert r.correct is True


# ===========================================================================
# FUNCTION COMPOSITION TESTS
# ===========================================================================

class TestComposition:
    """f(f(x)) = k problems"""

    def test_f_squared(self):
        """f(x) = x² + 1, f(f(1)) = f(2) = 5"""
        r = verify("compose_functions", "x**2 + 1", "5", params={
            "f_definition": "x**2 + 1", "composition_depth": 2, "target_value": 5
        })
        assert r.correct is True

    def test_f_squared_wrong(self):
        """f(x) = x² + 1, f(f(1)) ≠ 4"""
        r = verify("compose_functions", "x**2 + 1", "4", params={
            "f_definition": "x**2 + 1", "composition_depth": 2, "target_value": 5
        })
        assert r.correct is False


# ===========================================================================
# RECURRENCE TESTS
# ===========================================================================

class TestRecurrence:
    """a_{n+1} = f(a_n) problems"""

    def test_geometric(self):
        """a_1 = 1, a_{n+1} = 2*a_n, a_5 = 16"""
        r = verify("recurrence_relation", "2*a(n)", "16", params={
            "recurrence": "2*a(n)", "initial": {"a(1)": 1}, "evaluate_at": 5
        })
        assert r.correct is True

    def test_arithmetic(self):
        """a_1 = 1, a_{n+1} = a_n + 3, a_10 = 28"""
        r = verify("recurrence_relation", "a(n) + 3", "28", params={
            "recurrence": "a(n) + 3", "initial": {"a(1)": 1}, "evaluate_at": 10
        })
        assert r.correct is True

    def test_geometric_wrong(self):
        """a_1 = 1, a_{n+1} = 2*a_n, a_5 ≠ 8"""
        r = verify("recurrence_relation", "2*a(n)", "8", params={
            "recurrence": "2*a(n)", "initial": {"a(1)": 1}, "evaluate_at": 5
        })
        assert r.correct is False


# ===========================================================================
# INFINITE SERIES TESTS
# ===========================================================================

class TestInfiniteSeries:
    """Σ a_n convergence and evaluation"""

    def test_geometric_series(self):
        """Σ (1/2)^n from 1 to ∞ = 1"""
        r = verify("infinite_series", "1/2**n", "1")
        assert r.correct is True

    def test_geometric_series_wrong(self):
        """Σ (1/2)^n from 1 to ∞ ≠ 2"""
        r = verify("infinite_series", "1/2**n", "2")
        assert r.correct is False


# ===========================================================================
# ALGEBRA TESTS
# ===========================================================================

class TestAlgebra:
    """Equations, quadratics, factoring"""

    def test_quadratic(self):
        """x² - 5x + 6 = 0, roots 2 and 3"""
        r = verify("solve", "x**2 - 5*x + 6", "3")
        assert r.correct is True

    def test_quadratic_wrong(self):
        """x² - 5x + 6 = 0, root ≠ 4"""
        r = verify("solve", "x**2 - 5*x + 6", "4")
        assert r.correct is False


# ===========================================================================
# CALCULUS TESTS
# ===========================================================================

class TestCalculus:
    """Integrals, derivatives, limits"""

    def test_integral(self):
        """∫x² dx = x³/3 + C"""
        r = verify("integrate", "x**2", "x**3/3")
        assert r.correct is True

    def test_derivative(self):
        """d/dx(x³) = 3x²"""
        r = verify("differentiate", "x**3", "3*x**2")
        assert r.correct is True

    def test_limit_sinx_over_x(self):
        """lim x→0 sin(x)/x = 1"""
        r = verify("limit", "sin(x)/x", "1", params={"point": "0"})
        assert r.correct is True

    def test_limit_wrong(self):
        """lim x→0 sin(x)/x ≠ 0"""
        r = verify("limit", "sin(x)/x", "0", params={"point": "0"})
        assert r.correct is False


# ===========================================================================
# MODULAR ARITHMETIC TESTS
# ===========================================================================

class TestModular:
    """Clock problems, modular congruence"""

    def test_basic_mod(self):
        """17 mod 5 = 2"""
        r = verify("modular_arithmetic", "17", "2", params={"modulus": 5})
        assert r.correct is True

    def test_clock(self):
        """9 + 5 mod 12 = 2"""
        r = verify("modular_arithmetic", "9 + 5", "2", params={"modulus": 12})
        assert r.correct is True


# ===========================================================================
# TRIGONOMETRY TESTS
# ===========================================================================

class TestTrig:
    """Trig identities and equations"""

    def test_identity(self):
        """sin²x + cos²x = 1"""
        r = verify("trigonometry", "sin(x)**2 + cos(x)**2", "1", params={"type": "identity"})
        assert r.correct is True


# ===========================================================================
# COMPLEX NUMBERS TESTS
# ===========================================================================

class TestComplex:
    """Modulus, argument, roots of unity"""

    def test_modulus(self):
        """|3 + 4i| = 5"""
        r = verify("complex_numbers", "3 + 4*I", "5", params={"type": "basic"})
        assert r.correct is True


# ===========================================================================
# LINEAR ALGEBRA TESTS
# ===========================================================================

class TestLinearAlgebra:
    """Determinants, eigenvalues"""

    def test_determinant_2x2(self):
        """det([[1,2],[3,4]]) = -2"""
        r = verify("determinant", "[[1,2],[3,4]]", "-2", params={
            "matrix": [[1, 2], [3, 4]]
        })
        assert r.correct is True


# ===========================================================================
# NUMBER THEORY TESTS
# ===========================================================================

class TestNumberTheory:
    """GCD, LCM, primes, Euler"""

    def test_gcd(self):
        """gcd(12, 8) = 4"""
        r = verify("number_theory", "12", "4", params={"type": "divisibility", "a": 12, "b": 8, "op": "gcd"})
        assert r.correct is True


# ===========================================================================
# PROBABILITY TESTS
# ===========================================================================

class TestProbability:
    """Classical probability"""

    def test_coin_flip(self):
        """P(heads) = 1/2"""
        r = verify("probability", "coin", "1/2", params={
            "type": "classical", "favorable": 1, "total": 2
        })
        assert r.correct is True


# ===========================================================================
# STATISTICS TESTS
# ===========================================================================

class TestStatistics:
    """Mean, median, variance"""

    def test_mean(self):
        """Mean of [1,2,3,4,5] = 3"""
        r = verify("statistics", "data", "3", params={
            "type": "mean", "data": [1, 2, 3, 4, 5]
        })
        assert r.correct is True


# ===========================================================================
# SEQUENCES & SERIES TESTS
# ===========================================================================

class TestSequencesSeries:
    """AP, GP"""

    def test_ap_nth_term(self):
        """AP: a=2, d=3, a_10 = 2 + 9*3 = 29"""
        r = verify("arithmetic_progression", "ap", "29", params={
            "type": "ap", "a": 2, "d": 3, "n": 10
        })
        assert r.correct is True

    def test_gp_nth_term(self):
        """GP: a=2, r=3, a_5 = 2*3^4 = 162"""
        r = verify("geometric_progression", "gp", "162", params={
            "type": "gp", "a": 2, "r": 3, "n": 5
        })
        assert r.correct is True


# ===========================================================================
# MULTI-STEP TESTS
# ===========================================================================

class TestMultiStep:
    """Chain of operations"""

    def test_multi_step_basic(self):
        """Multi-step: solve then evaluate"""
        steps = [
            {"operation": "solve", "expression": "x**2 - 5*x + 6", "variable": "x"},
            {"operation": "evaluate", "expression": "{{prev}}", "variable": "x"},
        ]
        r = verify("multi_step", "x**2 - 5*x + 6", "3", steps=steps)
        # This tests the multi-step pipeline runs without crashing
        assert r is not None


# ===========================================================================
# BACKWARD COMPATIBILITY TESTS
# ===========================================================================

class TestBackwardCompatibility:
    """Original 7 operations still work"""

    def test_original_integrate(self):
        r = verify("integrate", "x**2", "x**3/3")
        assert r.correct is True

    def test_original_differentiate(self):
        r = verify("differentiate", "x**3", "3*x**2")
        assert r.correct is True

    def test_original_limit(self):
        r = verify("limit", "sin(x)/x", "1", params={"point": "0"})
        assert r.correct is True

    def test_original_solve(self):
        r = verify("solve", "x**2 - 4", "2")
        assert r.correct is True

    def test_original_simplify(self):
        r = verify("simplify", "(x**2 - 1)/(x - 1)", "x + 1")
        assert r.correct is True

    def test_original_evaluate(self):
        r = verify("evaluate", "2 + 3", "5")
        assert r.correct is True


# ===========================================================================
# AUTO-DETECT TESTS
# ===========================================================================

class TestAutoDetect:
    """Auto-detect from question text"""

    def test_auto_detect_nested_radical(self):
        r = verify("auto", r"\sqrt{6 + \sqrt{6 + \cdots}}", "3",
                    question_text="Find x = √(6 + √(6 + √(6 + ...)))")
        # Should auto-detect as nested_radical
        assert r is not None

    def test_auto_detect_unknown(self):
        r = verify("unknown_op", "x", "1")
        # Should return unknown operation
        assert r.correct is False


# ===========================================================================
# RUN
# ===========================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
