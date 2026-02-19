import { describe, it, expect } from 'vitest'
import { diffEnv, formatSafeDiff, formatUnsafeDiff } from '../../../src/core/env/diff-env.js'

describe('diffEnv', () => {
  describe('added keys', () => {
    it('should detect single added key', () => {
      const diff = diffEnv({}, { NEW: 'value' })
      expect(diff.added).toEqual(['NEW'])
      expect(diff.removed).toEqual([])
      expect(diff.changed).toEqual([])
    })

    it('should detect multiple added keys', () => {
      const diff = diffEnv({}, { A: '1', B: '2', C: '3' })
      expect(diff.added).toHaveLength(3)
      expect(diff.added).toContain('A')
      expect(diff.added).toContain('B')
      expect(diff.added).toContain('C')
    })
  })

  describe('removed keys', () => {
    it('should detect single removed key', () => {
      const diff = diffEnv({ OLD: 'value' }, {})
      expect(diff.added).toEqual([])
      expect(diff.removed).toEqual(['OLD'])
      expect(diff.changed).toEqual([])
    })

    it('should detect multiple removed keys', () => {
      const diff = diffEnv({ A: '1', B: '2', C: '3' }, {})
      expect(diff.removed).toHaveLength(3)
    })
  })

  describe('changed values', () => {
    it('should detect single changed value', () => {
      const diff = diffEnv({ KEY: 'old' }, { KEY: 'new' })
      expect(diff.added).toEqual([])
      expect(diff.removed).toEqual([])
      expect(diff.changed).toEqual(['KEY'])
    })

    it('should detect multiple changed values', () => {
      const diff = diffEnv(
        { A: 'old1', B: 'old2', C: 'old3' },
        { A: 'new1', B: 'new2', C: 'new3' }
      )
      expect(diff.changed).toHaveLength(3)
    })

    it('should not detect unchanged values', () => {
      const diff = diffEnv({ KEY: 'same' }, { KEY: 'same' })
      expect(diff.changed).toEqual([])
    })
  })

  describe('mixed changes', () => {
    it('should detect added, removed, and changed simultaneously', () => {
      const diff = diffEnv(
        { A: '1', B: 'old', C: '3' },
        { A: '1', B: 'new', D: '4' }
      )
      expect(diff.added).toEqual(['D'])
      expect(diff.removed).toEqual(['C'])
      expect(diff.changed).toEqual(['B'])
    })

    it('should return empty when no changes', () => {
      const diff = diffEnv({ KEY: 'value' }, { KEY: 'value' })
      expect(diff.added).toHaveLength(0)
      expect(diff.removed).toHaveLength(0)
      expect(diff.changed).toHaveLength(0)
    })

    it('should handle empty to empty', () => {
      const diff = diffEnv({}, {})
      expect(diff.added).toHaveLength(0)
      expect(diff.removed).toHaveLength(0)
      expect(diff.changed).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should detect change from empty string to value', () => {
      const diff = diffEnv({ KEY: '' }, { KEY: 'value' })
      expect(diff.changed).toEqual(['KEY'])
    })

    it('should detect change from value to empty string', () => {
      const diff = diffEnv({ KEY: 'value' }, { KEY: '' })
      expect(diff.changed).toEqual(['KEY'])
    })

    it('should treat empty string as different from undefined', () => {
      const diff = diffEnv({ KEY: '' }, { OTHER: '' })
      expect(diff.removed).toContain('KEY')
      expect(diff.added).toContain('OTHER')
    })
  })
})

describe('formatSafeDiff', () => {
  it('should not show values', () => {
    const diff = diffEnv({ KEY: 'secret' }, { KEY: 'newsecret', NEW: 'value' })
    const output = formatSafeDiff(diff)
    expect(output).not.toContain('secret')
    expect(output).not.toContain('newsecret')
    expect(output).not.toContain('value')
  })

  it('should show key names with markers', () => {
    const diff = diffEnv({ KEY: 'old' }, { KEY: 'new', NEW: 'value' })
    const output = formatSafeDiff(diff)
    expect(output).toContain('~ KEY')
    expect(output).toContain('+ NEW')
  })

  it('should format added keys', () => {
    const diff = diffEnv({}, { NEW1: 'a', NEW2: 'b' })
    const output = formatSafeDiff(diff)
    expect(output).toContain('Added:')
    expect(output).toContain('+ NEW1')
    expect(output).toContain('+ NEW2')
  })

  it('should format removed keys', () => {
    const diff = diffEnv({ OLD1: 'a', OLD2: 'b' }, {})
    const output = formatSafeDiff(diff)
    expect(output).toContain('Removed:')
    expect(output).toContain('- OLD1')
    expect(output).toContain('- OLD2')
  })

  it('should format changed keys', () => {
    const diff = diffEnv({ KEY: 'old' }, { KEY: 'new' })
    const output = formatSafeDiff(diff)
    expect(output).toContain('Changed:')
    expect(output).toContain('~ KEY')
  })

  it('should return empty string for no changes', () => {
    const diff = diffEnv({}, {})
    const output = formatSafeDiff(diff)
    expect(output).toBe('')
  })

  it('should handle all types of changes', () => {
    const diff = diffEnv(
      { A: '1', B: 'old' },
      { A: '1', B: 'new', C: '3' }
    )
    const output = formatSafeDiff(diff)
    expect(output).toContain('Added:')
    expect(output).toContain('Changed:')
    expect(output).not.toContain('Removed:')
  })
})

describe('formatUnsafeDiff', () => {
  it('should show masked values', () => {
    const diff = diffEnv({ KEY: 'secret' }, { KEY: 'newsecret' })
    const output = formatUnsafeDiff(diff, { KEY: 'secret' }, { KEY: 'newsecret' })
    // Values are masked, but still partially visible
    expect(output).toContain('se')
    expect(output).toContain('et')
  })

  it('should mask short values completely', () => {
    const diff = diffEnv({}, { KEY: 'abc' })
    const output = formatUnsafeDiff(diff, {}, { KEY: 'abc' })
    expect(output).toContain('***')
    expect(output).not.toContain('abc')
  })

  it('should mask very short values', () => {
    const diff = diffEnv({}, { KEY: 'ab' })
    const output = formatUnsafeDiff(diff, {}, { KEY: 'ab' })
    expect(output).toContain('**')
  })

  it('should mask single character values', () => {
    const diff = diffEnv({}, { KEY: 'x' })
    const output = formatUnsafeDiff(diff, {}, { KEY: 'x' })
    expect(output).toContain('*')
  })

  it('should format added keys with masked values', () => {
    const diff = diffEnv({}, { NEW: 'secretvalue' })
    const output = formatUnsafeDiff(diff, {}, { NEW: 'secretvalue' })
    expect(output).toContain('Added:')
    expect(output).toContain('+ NEW=')
  })

  it('should format removed keys with masked values', () => {
    const diff = diffEnv({ OLD: 'secretvalue' }, {})
    const output = formatUnsafeDiff(diff, { OLD: 'secretvalue' }, {})
    expect(output).toContain('Removed:')
    expect(output).toContain('- OLD=')
  })

  it('should format changed keys with old and new masked values', () => {
    const diff = diffEnv({ KEY: 'oldvalue' }, { KEY: 'newvalue' })
    const output = formatUnsafeDiff(diff, { KEY: 'oldvalue' }, { KEY: 'newvalue' })
    expect(output).toContain('Changed:')
    expect(output).toContain('~ KEY:')
    expect(output).toContain('-')
    expect(output).toContain('+')
  })

  it('should return empty string for no changes', () => {
    const diff = diffEnv({}, {})
    const output = formatUnsafeDiff(diff, {}, {})
    expect(output).toBe('')
  })

  it('should handle long values with partial masking', () => {
    const diff = diffEnv({}, { KEY: 'verylongsecretvalue12345' })
    const output = formatUnsafeDiff(diff, {}, { KEY: 'verylongsecretvalue12345' })
    // Should show first 2 and last 2 chars with masked middle
    expect(output).toContain('ve')  // First 2
    expect(output).toContain('45')  // Last 2
    expect(output).toContain('*')   // Masked middle
  })
})
