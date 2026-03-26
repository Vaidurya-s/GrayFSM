"""
Gray Code generation and manipulation utilities
"""
from typing import List

def int_to_gray(n: int, bit_width: int) -> str:
    """
    Convert integer to Gray code binary string.

    Args:
        n: Integer to convert
        bit_width: Number of bits in encoding

    Returns:
        Gray code as binary string

    Example:
        >>> int_to_gray(5, 4)
        '0111'
    """
    gray = n ^ (n >> 1)
    return format(gray, f'0{bit_width}b')


def gray_to_int(gray: str) -> int:
    """
    Convert Gray code binary string to integer.

    Args:
        gray: Gray code binary string

    Returns:
        Integer value
    """
    n = int(gray, 2)
    mask = n
    while mask:
        mask >>= 1
        n ^= mask
    return n


def generate_gray_codes(bit_width: int) -> List[str]:
    """
    Generate all n-bit Gray codes in sequence.

    Args:
        bit_width: Number of bits

    Returns:
        List of Gray code strings

    Example:
        >>> generate_gray_codes(2)
        ['00', '01', '11', '10']
    """
    count = 2 ** bit_width
    return [int_to_gray(i, bit_width) for i in range(count)]


def hamming_distance(code1: str, code2: str) -> int:
    """
    Calculate Hamming distance between two binary codes.

    Args:
        code1: First binary string
        code2: Second binary string

    Returns:
        Number of bit positions that differ
    """
    if len(code1) != len(code2):
        raise ValueError("Codes must have same length")

    return sum(b1 != b2 for b1, b2 in zip(code1, code2))


def get_bit_flip_position(code1: str, code2: str) -> int:
    """
    Get the position of the single bit that differs (if any).

    Args:
        code1: First binary string
        code2: Second binary string

    Returns:
        Bit position (0-indexed) or -1 if multiple bits differ
    """
    if hamming_distance(code1, code2) != 1:
        return -1

    for i, (b1, b2) in enumerate(zip(code1, code2)):
        if b1 != b2:
            return i
    return -1
