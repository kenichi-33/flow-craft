import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('c1', 'c2')).toBe('c1 c2')
    })

    it('should handle conditional classes', () => {
      // eslint-disable-next-line no-constant-binary-expression
      expect(cn('c1', false && 'c2', 'c3')).toBe('c1 c3')
    })

    it('should merge tailwind classes', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4')
      expect(cn('px-2 py-1', 'p-4')).toBe('p-4')
    })
  })
})
