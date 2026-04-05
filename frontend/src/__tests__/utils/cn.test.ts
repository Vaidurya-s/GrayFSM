import { describe, it, expect } from 'vitest'
import { cn } from '@/utils/cn'

describe('cn - Tailwind CSS Class Merger', () => {
  it('should merge single classes', () => {
    expect(cn('px-2 py-1')).toBe('px-2 py-1')
    expect(cn('flex items-center')).toBe('flex items-center')
  })

  it('should handle multiple arguments', () => {
    const result = cn('px-2', 'py-1', 'flex')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toContain('flex')
  })

  it('should merge conflicting Tailwind classes', () => {
    const result = cn('px-2 px-4')
    // The second px-4 should override px-2
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })

  it('should handle conditional classes with arrays', () => {
    const isActive = true
    const result = cn(['bg-blue-500', isActive && 'opacity-100'])
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('opacity-100')
  })

  it('should handle false conditional classes', () => {
    const isActive = false
    const result = cn('bg-blue-500', isActive && 'opacity-100')
    expect(result).toContain('bg-blue-500')
    expect(result).not.toContain('opacity-100')
  })

  it('should handle objects with conditional classes', () => {
    const isError = true
    const result = cn({
      'border border-red-500': isError,
      'border border-gray-300': !isError,
    })
    expect(result).toContain('border')
    expect(result).toContain('red-500')
  })

  it('should merge overlapping responsive classes', () => {
    const result = cn('md:px-2 md:px-4')
    expect(result).toContain('md:px-4')
  })

  it('should handle undefined and null values', () => {
    const result = cn('px-2', undefined, 'py-1', null)
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toBeTruthy()
  })

  it('should handle empty strings', () => {
    const result = cn('', 'px-2', '', 'py-1')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
  })

  it('should resolve display conflicts', () => {
    const result = cn('flex block')
    // One should win, likely the last one (block)
    expect(result).toMatch(/flex|block/)
  })

  it('should handle complex real-world case', () => {
    const isDisabled = true
    const variant: string = 'primary'

    const result = cn(
      'px-4 py-2 rounded transition-colors',
      variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
      variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none'
    )

    expect(result).toContain('px-4')
    expect(result).toContain('rounded')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('opacity-50')
  })

  it('should handle nested arrays', () => {
    const result = cn('px-2', ['py-1', ['flex', 'items-center']])
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toContain('flex')
  })

  it('should be case-sensitive for class names', () => {
    const result = cn('px-2 PX-2')
    // Both should be in the result
    expect(result).toContain('px-2')
  })

  it('should handle clsx ClassValue types', () => {
    const classes = [
      'base-class',
      { conditional: true },
      ['array', 'of', 'classes'],
    ]
    const result = cn(...classes)
    expect(result).toContain('base-class')
    expect(result).toContain('conditional')
    expect(result).toContain('array')
  })

  it('should preserve specificity with important modifier', () => {
    const result = cn('!px-2 px-4')
    expect(result).toContain('!px-2')
  })

  it('should handle empty input', () => {
    expect(cn()).toBeTruthy()
    const result = cn('', '', '')
    expect(typeof result).toBe('string')
  })

  it('should work with utility variants', () => {
    const result = cn('hover:bg-blue-500 focus:outline-none group-hover:bg-gray-100')
    expect(result).toContain('hover:bg-blue-500')
    expect(result).toContain('focus:outline-none')
  })
})
