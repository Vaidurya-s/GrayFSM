/**
 * Gray Code generation utilities
 */

/**
 * Convert integer to Gray code
 * @param n - Integer to convert
 * @param bitWidth - Number of bits
 * @returns Gray code as binary string
 */
export function intToGray(n: number, bitWidth: number): string {
  const gray = n ^ (n >> 1);
  return gray.toString(2).padStart(bitWidth, '0');
}

/**
 * Convert Gray code to integer
 * @param gray - Gray code as binary string
 * @returns Integer value
 */
export function grayToInt(gray: string): number {
  let n = parseInt(gray, 2);
  let mask = n;
  while (mask) {
    mask >>= 1;
    n ^= mask;
  }
  return n;
}

/**
 * Generate all n-bit Gray codes
 * @param bitWidth - Number of bits
 * @returns Array of Gray codes
 */
export function generateGrayCodes(bitWidth: number): string[] {
  const count = Math.pow(2, bitWidth);
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    codes.push(intToGray(i, bitWidth));
  }

  return codes;
}

/**
 * Calculate Hamming distance between two binary strings
 * @param a - First binary string
 * @param b - Second binary string
 * @returns Hamming distance
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error('Strings must have equal length');
  }

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Check if transition is safe (single-bit change)
 * @param from - Source encoding
 * @param to - Target encoding
 * @returns True if transition is safe
 */
export function isSafeTransition(from: string, to: string): boolean {
  return hammingDistance(from, to) === 1;
}

/**
 * Get the bit position that differs between two Gray codes
 * @param a - First Gray code
 * @param b - Second Gray code
 * @returns Bit position (0-indexed) or -1 if multiple differ
 */
export function getDifferingBit(a: string, b: string): number {
  if (a.length !== b.length) return -1;

  let position = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (position !== -1) return -1; // Multiple bits differ
      position = i;
    }
  }

  return position;
}
