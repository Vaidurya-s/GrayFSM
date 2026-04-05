import { describe, it, expect } from 'vitest'
import {
  intToGray,
  grayToInt,
  generateGrayCodes,
  hammingDistance,
  isSafeTransition,
  getDifferingBit,
} from '@/utils/gray-code/generator'

describe('Gray Code Generator', () => {
  describe('intToGray', () => {
    it('should convert integers to Gray code', () => {
      expect(intToGray(0, 4)).toBe('0000')
      expect(intToGray(1, 4)).toBe('0001')
      expect(intToGray(2, 4)).toBe('0011')
      expect(intToGray(3, 4)).toBe('0010')
      expect(intToGray(4, 4)).toBe('0110')
      expect(intToGray(5, 4)).toBe('0111')
    })

    it('should pad result with zeros', () => {
      expect(intToGray(1, 8).length).toBe(8)
      expect(intToGray(255, 8)).toBe('10000000')
    })

    it('should work with various bit widths', () => {
      expect(intToGray(0, 1)).toBe('0')
      expect(intToGray(1, 1)).toBe('1')
      expect(intToGray(3, 2)).toBe('10')
      expect(intToGray(7, 3)).toBe('100')
    })
  })

  describe('grayToInt', () => {
    it('should convert Gray code back to integer', () => {
      expect(grayToInt('0000')).toBe(0)
      expect(grayToInt('0001')).toBe(1)
      expect(grayToInt('0011')).toBe(2)
      expect(grayToInt('0010')).toBe(3)
      expect(grayToInt('0110')).toBe(4)
    })

    it('should be inverse of intToGray', () => {
      for (let i = 0; i < 16; i++) {
        const gray = intToGray(i, 4)
        expect(grayToInt(gray)).toBe(i)
      }
    })
  })

  describe('generateGrayCodes', () => {
    it('should generate correct number of codes', () => {
      expect(generateGrayCodes(1).length).toBe(2)
      expect(generateGrayCodes(2).length).toBe(4)
      expect(generateGrayCodes(3).length).toBe(8)
      expect(generateGrayCodes(4).length).toBe(16)
      expect(generateGrayCodes(5).length).toBe(32)
    })

    it('should generate codes with correct bit width', () => {
      const codes2 = generateGrayCodes(2)
      expect(codes2.every((c) => c.length === 2)).toBe(true)

      const codes4 = generateGrayCodes(4)
      expect(codes4.every((c) => c.length === 4)).toBe(true)
    })

    it('should ensure adjacent codes differ by exactly 1 bit', () => {
      const codes = generateGrayCodes(3)
      for (let i = 0; i < codes.length - 1; i++) {
        const distance = hammingDistance(codes[i], codes[i + 1])
        expect(distance).toBe(1)
      }
    })

    it('should generate unique codes', () => {
      const codes = generateGrayCodes(4)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it('should start with 0 and end with a code differing by 1 bit from start', () => {
      const codes = generateGrayCodes(3)
      expect(codes[0]).toBe('000')
      const distance = hammingDistance(codes[0], codes[codes.length - 1])
      expect(distance).toBe(1)
    })
  })

  describe('hammingDistance', () => {
    it('should calculate Hamming distance correctly', () => {
      expect(hammingDistance('0000', '0000')).toBe(0)
      expect(hammingDistance('0001', '0000')).toBe(1)
      expect(hammingDistance('1111', '0000')).toBe(4)
      expect(hammingDistance('1010', '0101')).toBe(4)
      expect(hammingDistance('1100', '1010')).toBe(2)
    })

    it('should throw on mismatched lengths', () => {
      expect(() => hammingDistance('01', '0101')).toThrow()
      expect(() => hammingDistance('111', '11')).toThrow()
    })
  })

  describe('isSafeTransition', () => {
    it('should return true for single-bit changes', () => {
      expect(isSafeTransition('0000', '0001')).toBe(true)
      expect(isSafeTransition('0010', '0011')).toBe(true)
      expect(isSafeTransition('1111', '1110')).toBe(true)
    })

    it('should return false for multi-bit or no changes', () => {
      expect(isSafeTransition('0000', '0000')).toBe(false)
      expect(isSafeTransition('0000', '0011')).toBe(false)
      expect(isSafeTransition('1010', '0101')).toBe(false)
    })
  })

  describe('getDifferingBit', () => {
    it('should return position of differing bit', () => {
      expect(getDifferingBit('0000', '0001')).toBe(3)
      expect(getDifferingBit('0000', '1000')).toBe(0)
      expect(getDifferingBit('1010', '1011')).toBe(3)
    })

    it('should return -1 for no differences', () => {
      expect(getDifferingBit('0101', '0101')).toBe(-1)
    })

    it('should return -1 for multiple differences', () => {
      expect(getDifferingBit('0000', '0011')).toBe(-1)
      expect(getDifferingBit('1010', '0101')).toBe(-1)
    })

    it('should return -1 for mismatched lengths', () => {
      expect(getDifferingBit('01', '0101')).toBe(-1)
    })
  })
})
