"""
Unit tests for Gray code utilities.

Tests cover:
- Gray code generation
- Conversion between binary and Gray code
- Hamming distance calculation
- Gray code property verification
- Bit manipulation utilities
"""

import pytest
from grayfsm.core.gray_code import (
    int_to_gray,
    gray_to_int,
    generate_gray_codes,
    hamming_distance,
    verify_gray_property,
    flip_bit,
    find_differing_bit
)


class TestIntToGray:
    """Tests for int_to_gray function."""

    def test_basic_conversion(self):
        """Test basic integer to Gray code conversion."""
        assert int_to_gray(0, 3) == "000"
        assert int_to_gray(1, 3) == "001"
        assert int_to_gray(2, 3) == "011"
        assert int_to_gray(3, 3) == "010"
        assert int_to_gray(4, 3) == "110"
        assert int_to_gray(5, 3) == "111"
        assert int_to_gray(6, 3) == "101"
        assert int_to_gray(7, 3) == "100"

    def test_different_bit_widths(self):
        """Test with various bit widths."""
        assert int_to_gray(0, 1) == "0"
        assert int_to_gray(1, 1) == "1"

        assert int_to_gray(0, 2) == "00"
        assert int_to_gray(3, 2) == "10"

        assert int_to_gray(0, 4) == "0000"
        assert int_to_gray(15, 4) == "1000"

    def test_negative_input(self):
        """Test that negative integers raise ValueError."""
        with pytest.raises(ValueError, match="must be non-negative"):
            int_to_gray(-1, 3)

    def test_overflow(self):
        """Test that integers too large for bit width raise ValueError."""
        with pytest.raises(ValueError, match="requires more than"):
            int_to_gray(8, 3)  # 8 requires 4 bits

        with pytest.raises(ValueError, match="requires more than"):
            int_to_gray(16, 4)  # 16 requires 5 bits


class TestGrayToInt:
    """Tests for gray_to_int function."""

    def test_basic_conversion(self):
        """Test basic Gray code to integer conversion."""
        assert gray_to_int("000") == 0
        assert gray_to_int("001") == 1
        assert gray_to_int("011") == 2
        assert gray_to_int("010") == 3
        assert gray_to_int("110") == 4
        assert gray_to_int("111") == 5
        assert gray_to_int("101") == 6
        assert gray_to_int("100") == 7

    def test_roundtrip(self):
        """Test that int_to_gray and gray_to_int are inverses."""
        for n in range(16):
            gray_code = int_to_gray(n, 4)
            assert gray_to_int(gray_code) == n


class TestGenerateGrayCodes:
    """Tests for generate_gray_codes function."""

    def test_1_bit(self):
        """Test 1-bit Gray codes."""
        codes = generate_gray_codes(1)
        assert codes == ["0", "1"]

    def test_2_bit(self):
        """Test 2-bit Gray codes."""
        codes = generate_gray_codes(2)
        assert codes == ["00", "01", "11", "10"]

    def test_3_bit(self):
        """Test 3-bit Gray codes."""
        codes = generate_gray_codes(3)
        expected = ["000", "001", "011", "010", "110", "111", "101", "100"]
        assert codes == expected

    def test_count(self):
        """Test that correct number of codes are generated."""
        for n_bits in range(1, 6):
            codes = generate_gray_codes(n_bits)
            assert len(codes) == 2**n_bits

    def test_gray_property(self):
        """Test that consecutive codes differ by 1 bit."""
        for n_bits in range(1, 6):
            codes = generate_gray_codes(n_bits)
            assert verify_gray_property(codes)

    def test_all_unique(self):
        """Test that all codes are unique."""
        for n_bits in range(1, 6):
            codes = generate_gray_codes(n_bits)
            assert len(codes) == len(set(codes))

    def test_zero_bits(self):
        """Test 0-bit Gray codes (edge case)."""
        codes = generate_gray_codes(0)
        assert codes == [""]

    def test_negative_bits(self):
        """Test negative bit count raises ValueError."""
        with pytest.raises(ValueError):
            generate_gray_codes(-1)


class TestHammingDistance:
    """Tests for hamming_distance function."""

    def test_identical_codes(self):
        """Test distance between identical codes is 0."""
        assert hamming_distance("000", "000") == 0
        assert hamming_distance("111", "111") == 0
        assert hamming_distance("101", "101") == 0

    def test_single_bit_difference(self):
        """Test codes differing by 1 bit."""
        assert hamming_distance("000", "001") == 1
        assert hamming_distance("000", "010") == 1
        assert hamming_distance("000", "100") == 1
        assert hamming_distance("101", "100") == 1

    def test_multiple_bit_differences(self):
        """Test codes differing by multiple bits."""
        assert hamming_distance("000", "111") == 3
        assert hamming_distance("000", "011") == 2
        assert hamming_distance("101", "010") == 3

    def test_different_lengths(self):
        """Test that different length codes raise ValueError."""
        with pytest.raises(ValueError, match="must have same length"):
            hamming_distance("00", "000")

        with pytest.raises(ValueError, match="must have same length"):
            hamming_distance("111", "11")


class TestVerifyGrayProperty:
    """Tests for verify_gray_property function."""

    def test_valid_gray_sequence(self):
        """Test that valid Gray code sequences pass."""
        assert verify_gray_property(["00", "01", "11", "10"])
        assert verify_gray_property(["000", "001", "011", "010"])

    def test_invalid_sequence(self):
        """Test that invalid sequences fail."""
        assert not verify_gray_property(["00", "11"])  # 2-bit jump
        assert not verify_gray_property(["000", "111"])  # 3-bit jump
        # Note: ["00", "01", "00"] IS valid - Gray property only requires
        # consecutive codes to differ by 1 bit, which this satisfies

    def test_single_code(self):
        """Test single code (no pairs to check)."""
        assert verify_gray_property(["0"])
        assert verify_gray_property(["101"])

    def test_empty_list(self):
        """Test empty list."""
        assert verify_gray_property([])


class TestFlipBit:
    """Tests for flip_bit function."""

    def test_flip_single_bit(self):
        """Test flipping individual bits."""
        assert flip_bit("000", 0) == "100"
        assert flip_bit("000", 1) == "010"
        assert flip_bit("000", 2) == "001"

    def test_flip_1_to_0(self):
        """Test flipping 1 to 0."""
        assert flip_bit("111", 0) == "011"
        assert flip_bit("111", 1) == "101"
        assert flip_bit("111", 2) == "110"

    def test_flip_twice(self):
        """Test flipping same bit twice returns original."""
        code = "101"
        for pos in range(3):
            flipped_once = flip_bit(code, pos)
            flipped_twice = flip_bit(flipped_once, pos)
            assert flipped_twice == code

    def test_out_of_range(self):
        """Test that out of range position raises ValueError."""
        with pytest.raises(ValueError, match="out of range"):
            flip_bit("000", 3)

        with pytest.raises(ValueError, match="out of range"):
            flip_bit("000", -1)


class TestFindDifferingBit:
    """Tests for find_differing_bit function."""

    def test_single_difference(self):
        """Test finding the differing bit position."""
        assert find_differing_bit("000", "001") == 2
        assert find_differing_bit("000", "010") == 1
        assert find_differing_bit("000", "100") == 0
        assert find_differing_bit("101", "100") == 2

    def test_multiple_differences(self):
        """Test that multiple differences raise ValueError."""
        with pytest.raises(ValueError, match="must differ by exactly 1 bit"):
            find_differing_bit("000", "111")

        with pytest.raises(ValueError, match="must differ by exactly 1 bit"):
            find_differing_bit("000", "011")

    def test_no_difference(self):
        """Test that identical codes raise ValueError."""
        with pytest.raises(ValueError, match="must differ by exactly 1 bit"):
            find_differing_bit("000", "000")


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_large_bit_width(self):
        """Test with larger bit widths."""
        codes = generate_gray_codes(5)
        assert len(codes) == 32
        assert verify_gray_property(codes)

    def test_consistency(self):
        """Test consistency between different functions."""
        for n_bits in range(1, 5):
            # Generate codes
            codes = generate_gray_codes(n_bits)

            # Verify each code converts correctly
            for i, code in enumerate(codes):
                assert int_to_gray(i, n_bits) == code
                assert gray_to_int(code) == i

            # Verify consecutive codes differ by 1 bit
            for i in range(len(codes) - 1):
                dist = hamming_distance(codes[i], codes[i + 1])
                assert dist == 1

                # And we can find which bit differs
                pos = find_differing_bit(codes[i], codes[i + 1])
                assert 0 <= pos < n_bits
