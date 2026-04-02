"""
Unit tests for Gray code utilities (app.core.gray_code).

Tests cover:
- int_to_gray: integer to Gray code conversion
- gray_to_int: Gray code to integer conversion
- generate_gray_codes: full Gray code sequence generation
- hamming_distance: bit-distance between binary strings
- get_bit_flip_position: identify the single differing bit
"""

import pytest
from app.core.gray_code import (
    int_to_gray,
    gray_to_int,
    generate_gray_codes,
    hamming_distance,
    get_bit_flip_position,
)


# =====================================================================
# int_to_gray
# =====================================================================

class TestIntToGray:
    """Tests for int_to_gray(n, bit_width)."""

    def test_zero_three_bits(self):
        assert int_to_gray(0, 3) == "000"

    def test_one_three_bits(self):
        assert int_to_gray(1, 3) == "001"

    def test_full_3bit_sequence(self):
        """Verify the classic 3-bit Gray code table."""
        expected = ["000", "001", "011", "010", "110", "111", "101", "100"]
        for i, exp in enumerate(expected):
            assert int_to_gray(i, 3) == exp, f"int_to_gray({i}, 3) should be {exp}"

    def test_1bit(self):
        assert int_to_gray(0, 1) == "0"
        assert int_to_gray(1, 1) == "1"

    def test_2bit(self):
        assert int_to_gray(0, 2) == "00"
        assert int_to_gray(1, 2) == "01"
        assert int_to_gray(2, 2) == "11"
        assert int_to_gray(3, 2) == "10"

    def test_4bit_boundaries(self):
        assert int_to_gray(0, 4) == "0000"
        assert int_to_gray(15, 4) == "1000"

    @pytest.mark.parametrize("n, bits, expected", [
        (5, 4, "0111"),
        (7, 4, "0100"),
        (10, 4, "1111"),
    ])
    def test_known_values(self, n, bits, expected):
        assert int_to_gray(n, bits) == expected

    def test_powers_of_two(self):
        """Powers of 2 should produce specific patterns."""
        # 2 in 3 bits: binary 010, Gray 011
        assert int_to_gray(2, 3) == "011"
        # 4 in 4 bits: binary 0100, Gray 0110
        assert int_to_gray(4, 4) == "0110"
        # 8 in 4 bits: binary 1000, Gray 1100
        assert int_to_gray(8, 4) == "1100"

    def test_result_has_correct_length(self):
        """Output should always be bit_width characters."""
        for bits in range(1, 6):
            for n in range(2**bits):
                result = int_to_gray(n, bits)
                assert len(result) == bits


# =====================================================================
# gray_to_int
# =====================================================================

class TestGrayToInt:
    """Tests for gray_to_int(gray_str)."""

    def test_basic_conversions(self):
        assert gray_to_int("000") == 0
        assert gray_to_int("001") == 1
        assert gray_to_int("011") == 2
        assert gray_to_int("010") == 3
        assert gray_to_int("110") == 4
        assert gray_to_int("111") == 5
        assert gray_to_int("101") == 6
        assert gray_to_int("100") == 7

    def test_single_bit(self):
        assert gray_to_int("0") == 0
        assert gray_to_int("1") == 1

    def test_roundtrip_4bit(self):
        """int -> gray -> int should be identity for all 4-bit values."""
        for n in range(16):
            gray = int_to_gray(n, 4)
            assert gray_to_int(gray) == n

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5, 6])
    def test_roundtrip_all_values(self, n_bits):
        """Roundtrip for every value at each bit width."""
        for n in range(2**n_bits):
            gray = int_to_gray(n, n_bits)
            assert gray_to_int(gray) == n


# =====================================================================
# generate_gray_codes
# =====================================================================

class TestGenerateGrayCodes:
    """Tests for generate_gray_codes(bit_width)."""

    def test_1bit(self):
        assert generate_gray_codes(1) == ["0", "1"]

    def test_2bit(self):
        assert generate_gray_codes(2) == ["00", "01", "11", "10"]

    def test_3bit(self):
        expected = ["000", "001", "011", "010", "110", "111", "101", "100"]
        assert generate_gray_codes(3) == expected

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_count_is_power_of_two(self, n_bits):
        """Should produce exactly 2^n codes."""
        codes = generate_gray_codes(n_bits)
        assert len(codes) == 2**n_bits

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_all_codes_unique(self, n_bits):
        """Every code in the sequence should be distinct."""
        codes = generate_gray_codes(n_bits)
        assert len(codes) == len(set(codes))

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_adjacent_codes_differ_by_one_bit(self, n_bits):
        """Core Gray code property: consecutive codes differ by exactly 1 bit."""
        codes = generate_gray_codes(n_bits)
        for i in range(len(codes) - 1):
            dist = hamming_distance(codes[i], codes[i + 1])
            assert dist == 1, (
                f"Codes at index {i} and {i+1} ({codes[i]}, {codes[i+1]}) "
                f"differ by {dist} bits, expected 1"
            )

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_all_codes_correct_length(self, n_bits):
        """Each code string should have exactly n_bits characters."""
        codes = generate_gray_codes(n_bits)
        assert all(len(c) == n_bits for c in codes)

    def test_first_code_is_all_zeros(self):
        """The first Gray code should always be all zeros."""
        for n_bits in range(1, 6):
            codes = generate_gray_codes(n_bits)
            assert codes[0] == "0" * n_bits

    def test_codes_only_contain_0_and_1(self):
        """Every character in every code should be '0' or '1'."""
        codes = generate_gray_codes(4)
        for code in codes:
            assert all(c in ("0", "1") for c in code)


# =====================================================================
# hamming_distance
# =====================================================================

class TestHammingDistance:
    """Tests for hamming_distance(code1, code2)."""

    def test_identical_codes_zero(self):
        assert hamming_distance("000", "000") == 0
        assert hamming_distance("111", "111") == 0
        assert hamming_distance("0", "0") == 0

    def test_single_bit_difference(self):
        assert hamming_distance("000", "001") == 1
        assert hamming_distance("000", "010") == 1
        assert hamming_distance("000", "100") == 1

    def test_two_bit_difference(self):
        assert hamming_distance("000", "011") == 2
        assert hamming_distance("000", "101") == 2
        assert hamming_distance("000", "110") == 2

    def test_all_bits_different(self):
        assert hamming_distance("000", "111") == 3
        assert hamming_distance("0000", "1111") == 4

    def test_symmetric(self):
        """hamming_distance(a, b) == hamming_distance(b, a)."""
        assert hamming_distance("001", "110") == hamming_distance("110", "001")

    def test_different_lengths_raises(self):
        """Codes of different lengths should raise ValueError."""
        with pytest.raises(ValueError, match="same length"):
            hamming_distance("00", "000")

        with pytest.raises(ValueError, match="same length"):
            hamming_distance("1111", "11")

    @pytest.mark.parametrize("code1, code2, expected", [
        ("101", "100", 1),
        ("101", "010", 3),
        ("1100", "0011", 4),
        ("1010", "1010", 0),
    ])
    def test_parametrized(self, code1, code2, expected):
        assert hamming_distance(code1, code2) == expected

    def test_adjacent_gray_codes_distance_one(self):
        """Adjacent Gray codes (by definition) should have Hamming distance 1."""
        codes = generate_gray_codes(4)
        for i in range(len(codes) - 1):
            assert hamming_distance(codes[i], codes[i + 1]) == 1


# =====================================================================
# get_bit_flip_position
# =====================================================================

class TestGetBitFlipPosition:
    """Tests for get_bit_flip_position(code1, code2)."""

    def test_single_bit_flip_position_0(self):
        """Leftmost bit differs."""
        assert get_bit_flip_position("000", "100") == 0

    def test_single_bit_flip_position_1(self):
        """Middle bit differs."""
        assert get_bit_flip_position("000", "010") == 1

    def test_single_bit_flip_position_2(self):
        """Rightmost bit differs."""
        assert get_bit_flip_position("000", "001") == 2

    def test_returns_minus_one_for_same_codes(self):
        """Identical codes differ by 0 bits -> returns -1."""
        assert get_bit_flip_position("010", "010") == -1

    def test_returns_minus_one_for_multiple_diffs(self):
        """Codes differing by >1 bit -> returns -1."""
        assert get_bit_flip_position("000", "111") == -1
        assert get_bit_flip_position("000", "011") == -1

    def test_1_to_0_flip(self):
        """Flipping a 1 to a 0 should work the same way."""
        assert get_bit_flip_position("111", "011") == 0
        assert get_bit_flip_position("111", "101") == 1
        assert get_bit_flip_position("111", "110") == 2

    @pytest.mark.parametrize("n_bits", [2, 3, 4, 5])
    def test_adjacent_gray_codes_have_valid_position(self, n_bits):
        """For adjacent Gray codes, the flip position should be in range."""
        codes = generate_gray_codes(n_bits)
        for i in range(len(codes) - 1):
            pos = get_bit_flip_position(codes[i], codes[i + 1])
            assert 0 <= pos < n_bits, (
                f"Position {pos} out of range for {n_bits}-bit codes "
                f"({codes[i]} vs {codes[i+1]})"
            )

    def test_symmetric(self):
        """Position should be the same regardless of argument order."""
        assert get_bit_flip_position("010", "000") == get_bit_flip_position("000", "010")


# =====================================================================
# Edge cases and integration between functions
# =====================================================================

class TestGrayCodeIntegration:
    """Cross-function consistency tests."""

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_generate_matches_int_to_gray(self, n_bits):
        """generate_gray_codes should produce the same result as calling
        int_to_gray for each index."""
        codes = generate_gray_codes(n_bits)
        for i, code in enumerate(codes):
            assert code == int_to_gray(i, n_bits)

    def test_hamming_and_flip_position_consistency(self):
        """When hamming_distance is 1, get_bit_flip_position should return a
        valid position that actually identifies the differing bit."""
        codes = generate_gray_codes(4)
        for i in range(len(codes) - 1):
            a, b = codes[i], codes[i + 1]
            assert hamming_distance(a, b) == 1
            pos = get_bit_flip_position(a, b)
            assert pos >= 0
            # Verify the position is actually the one that differs
            assert a[pos] != b[pos]
            # All other positions should match
            for j in range(len(a)):
                if j != pos:
                    assert a[j] == b[j]

    def test_large_bit_width(self):
        """Verify correctness with a larger bit width (8 bits = 256 codes)."""
        codes = generate_gray_codes(8)
        assert len(codes) == 256
        assert len(set(codes)) == 256
        for i in range(255):
            assert hamming_distance(codes[i], codes[i + 1]) == 1
