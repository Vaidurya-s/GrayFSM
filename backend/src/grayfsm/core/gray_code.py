"""
Gray code generation and manipulation utilities.

Gray codes are binary encodings where consecutive values differ by only one bit.
This module provides functions for generating Gray codes, converting between
binary and Gray code, and computing Hamming distances.
"""

from typing import List


def int_to_gray(n: int, bit_width: int) -> str:
    """
    Convert an integer to its Gray code representation.

    Args:
        n: Integer to convert (non-negative)
        bit_width: Number of bits in the output Gray code

    Returns:
        Gray code as a binary string

    Example:
        >>> int_to_gray(0, 3)
        '000'
        >>> int_to_gray(1, 3)
        '001'
        >>> int_to_gray(2, 3)
        '011'
        >>> int_to_gray(3, 3)
        '010'
    """
    if n < 0:
        raise ValueError(f"n must be non-negative, got {n}")
    if n >= 2**bit_width:
        raise ValueError(f"n={n} requires more than {bit_width} bits")

    # Gray code = n XOR (n >> 1)
    gray = n ^ (n >> 1)
    return format(gray, f'0{bit_width}b')


def gray_to_int(gray_code: str) -> int:
    """
    Convert a Gray code to its integer representation.

    Args:
        gray_code: Gray code as binary string

    Returns:
        Integer value

    Example:
        >>> gray_to_int('000')
        0
        >>> gray_to_int('001')
        1
        >>> gray_to_int('011')
        2
    """
    n = int(gray_code, 2)
    mask = n
    while mask:
        mask >>= 1
        n ^= mask
    return n


def generate_gray_codes(n_bits: int) -> List[str]:
    """
    Generate all 2^n Gray codes using the reflected binary method.

    Algorithm:
        G(1) = ["0", "1"]
        G(n) = ["0" + g for g in G(n-1)] + ["1" + g for g in reversed(G(n-1))]

    Args:
        n_bits: Number of bits (1-8 recommended for performance)

    Returns:
        List of Gray codes in sequence

    Example:
        >>> generate_gray_codes(2)
        ['00', '01', '11', '10']
        >>> generate_gray_codes(3)
        ['000', '001', '011', '010', '110', '111', '101', '100']
    """
    if n_bits < 0:
        raise ValueError(f"n_bits must be non-negative, got {n_bits}")
    if n_bits == 0:
        return [""]
    if n_bits == 1:
        return ["0", "1"]

    # Recursive construction using reflection
    prev_codes = generate_gray_codes(n_bits - 1)

    # Prefix with "0" in original order, then "1" in reversed order
    forward = ["0" + code for code in prev_codes]
    backward = ["1" + code for code in reversed(prev_codes)]

    return forward + backward


def hamming_distance(code1: str, code2: str) -> int:
    """
    Calculate Hamming distance between two binary strings.

    Hamming distance is the number of positions at which the bits differ.

    Args:
        code1: First binary string
        code2: Second binary string

    Returns:
        Number of differing bits

    Raises:
        ValueError: If codes have different lengths

    Example:
        >>> hamming_distance('000', '001')
        1
        >>> hamming_distance('000', '111')
        3
        >>> hamming_distance('101', '011')
        2
    """
    if len(code1) != len(code2):
        raise ValueError(
            f"Codes must have same length: '{code1}' ({len(code1)} bits) "
            f"vs '{code2}' ({len(code2)} bits)"
        )

    return sum(c1 != c2 for c1, c2 in zip(code1, code2))


def verify_gray_property(codes: List[str]) -> bool:
    """
    Verify that consecutive codes in a list differ by exactly one bit.

    Args:
        codes: List of binary strings

    Returns:
        True if all consecutive pairs differ by 1 bit, False otherwise

    Example:
        >>> verify_gray_property(['00', '01', '11', '10'])
        True
        >>> verify_gray_property(['00', '11', '01'])
        False
    """
    for i in range(len(codes) - 1):
        if hamming_distance(codes[i], codes[i + 1]) != 1:
            return False
    return True


def flip_bit(code: str, position: int) -> str:
    """
    Flip a bit at the specified position (0-indexed from left).

    Args:
        code: Binary string
        position: Bit position to flip (0 = leftmost)

    Returns:
        New binary string with flipped bit

    Example:
        >>> flip_bit('000', 2)
        '001'
        >>> flip_bit('101', 0)
        '001'
    """
    if position < 0 or position >= len(code):
        raise ValueError(f"Position {position} out of range for {len(code)}-bit code")

    code_list = list(code)
    code_list[position] = '1' if code_list[position] == '0' else '0'
    return ''.join(code_list)


def find_differing_bit(code1: str, code2: str) -> int:
    """
    Find the position of the single differing bit between two codes.

    Args:
        code1: First binary string
        code2: Second binary string

    Returns:
        Position of differing bit (0-indexed from left)

    Raises:
        ValueError: If codes differ by more than one bit

    Example:
        >>> find_differing_bit('000', '001')
        2
        >>> find_differing_bit('100', '000')
        0
    """
    dist = hamming_distance(code1, code2)
    if dist != 1:
        raise ValueError(
            f"Codes must differ by exactly 1 bit, but differ by {dist}: "
            f"'{code1}' vs '{code2}'"
        )

    for i, (c1, c2) in enumerate(zip(code1, code2)):
        if c1 != c2:
            return i

    raise AssertionError("Should not reach here")  # Hamming distance was 1
