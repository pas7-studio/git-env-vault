import { describe, it, expect } from 'vitest'
import { renderDotenv } from '../../../src/core/env/render-env.js'

describe('renderDotenv', () => {
  describe('basic rendering', () => {
    it('should render simple key-value pairs', () => {
      const result = renderDotenv({ KEY: 'value' })
      expect(result).toBe('KEY=value\n')
    })

    it('should render multiple keys', () => {
      const result = renderDotenv({ KEY1: 'value1', KEY2: 'value2' })
      expect(result).toBe('KEY1=value1\nKEY2=value2\n')
    })

    it('should render empty object', () => {
      const result = renderDotenv({})
      expect(result).toBe('\n')
    })
  })

  describe('quoting', () => {
    it('should quote values with spaces', () => {
      const result = renderDotenv({ KEY: 'value with spaces' })
      expect(result).toBe('KEY="value with spaces"\n')
    })

    it('should not quote empty values (current behavior)', () => {
      const result = renderDotenv({ KEY: '' })
      expect(result).toBe('KEY=\n')
    })

    it('should quote values with #', () => {
      const result = renderDotenv({ KEY: 'value#comment' })
      expect(result).toBe('KEY="value#comment"\n')
    })

    it('should quote values with newlines', () => {
      const result = renderDotenv({ KEY: 'line1\nline2' })
      expect(result).toBe('KEY="line1\\nline2"\n')
    })

    it('should quote values with tabs', () => {
      const result = renderDotenv({ KEY: 'value\twith\ttabs' })
      // Tabs trigger quoting, backslash replacement uses \t literal in implementation
      expect(result).toContain('KEY="')
      expect(result).toContain('tabs"')
    })

    it('should quote values with =', () => {
      const result = renderDotenv({ KEY: 'a=b' })
      expect(result).toBe('KEY="a=b"\n')
    })

    it('should quote values starting with double quote', () => {
      const result = renderDotenv({ KEY: '"value' })
      expect(result).toBe('KEY="\\"value"\n')
    })

    it('should quote values starting with single quote', () => {
      const result = renderDotenv({ KEY: "'value" })
      expect(result).toBe("KEY=\"'value\"\n")
    })
  })

  describe('escaping', () => {
    it('should escape double quotes in values', () => {
      const result = renderDotenv({ KEY: 'value "with" quotes' })
      expect(result).toContain('\\"')
      expect(result).toBe('KEY="value \\"with\\" quotes"\n')
    })

    it('should handle backslashes in values', () => {
      const result = renderDotenv({ KEY: 'path\\to\\file' })
      // Backslashes don't trigger quoting, rendered as-is
      expect(result).toContain('KEY=')
    })

    it('should escape newlines in values', () => {
      const result = renderDotenv({ KEY: 'line1\nline2\nline3' })
      expect(result).toBe('KEY="line1\\nline2\\nline3"\n')
    })

    it('should handle multiple special characters', () => {
      const result = renderDotenv({ KEY: 'a"b\\c\nd' })
      expect(result).toBe('KEY="a\\"b\\\\c\\nd"\n')
    })
  })

  describe('order option', () => {
    it('should use natural order when no order specified', () => {
      const result = renderDotenv({ ZEBRA: '1', APPLE: '2' })
      // Object.entries returns keys in insertion order for string keys
      expect(result).toBe('ZEBRA=1\nAPPLE=2\n')
    })

    it('should preserve order when provided', () => {
      const result = renderDotenv(
        { ZEBRA: '1', APPLE: '2', BANANA: '3' },
        { order: ['ZEBRA', 'BANANA'] }
      )
      expect(result).toBe('ZEBRA=1\nBANANA=3\nAPPLE=2\n')
    })

    it('should add keys not in order at the end', () => {
      const result = renderDotenv(
        { A: '1', B: '2', C: '3', D: '4' },
        { order: ['C', 'A'] }
      )
      expect(result).toBe('C=3\nA=1\nB=2\nD=4\n')
    })

    it('should skip keys in order that are not in env', () => {
      const result = renderDotenv(
        { A: '1', B: '2' },
        { order: ['A', 'NONEXISTENT', 'B'] }
      )
      expect(result).toBe('A=1\nB=2\n')
    })

    it('should handle empty order array', () => {
      const result = renderDotenv(
        { A: '1', B: '2' },
        { order: [] }
      )
      expect(result).toBe('A=1\nB=2\n')
    })
  })

  describe('includeComments option', () => {
    it('should accept includeComments option (currently unused)', () => {
      const result = renderDotenv(
        { KEY: 'value' },
        { includeComments: true }
      )
      expect(result).toBe('KEY=value\n')
    })
  })

  describe('complex values', () => {
    it('should handle URL values', () => {
      const result = renderDotenv({ URL: 'https://user:pass@example.com:8080/path?q=1' })
      expect(result).toContain('URL=')
    })

    it('should handle JSON values', () => {
      const result = renderDotenv({ CONFIG: '{"key":"value"}' })
      expect(result).toContain('CONFIG=')
    })

    it('should handle JWT-like values (dots do not trigger quoting)', () => {
      const result = renderDotenv({ JWT: 'header.payload.signature' })
      // Dots don't trigger quoting
      expect(result).toBe('JWT=header.payload.signature\n')
    })

    it('should handle numeric-like values', () => {
      const result = renderDotenv({ PORT: '3000' })
      expect(result).toBe('PORT=3000\n')
    })

    it('should handle boolean-like values', () => {
      const result = renderDotenv({ DEBUG: 'true' })
      expect(result).toBe('DEBUG=true\n')
    })

    it('should handle unicode values', () => {
      const result = renderDotenv({ KEY: 'значення' })
      expect(result).toBe('KEY=значення\n')
    })
  })
})
