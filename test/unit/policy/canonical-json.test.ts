import { describe, it, expect } from 'vitest'
import { canonicalizeJson } from '../../../src/core/policy/canonical-json.js'

describe('canonicalizeJson', () => {
  describe('primitives', () => {
    it('should handle null', () => {
      expect(canonicalizeJson(null)).toBe('null')
    })

    it('should handle undefined', () => {
      expect(canonicalizeJson(undefined)).toBe('null')
    })

    it('should handle true', () => {
      expect(canonicalizeJson(true)).toBe('true')
    })

    it('should handle false', () => {
      expect(canonicalizeJson(false)).toBe('false')
    })

    it('should handle integers', () => {
      expect(canonicalizeJson(42)).toBe('42')
    })

    it('should handle negative integers', () => {
      expect(canonicalizeJson(-42)).toBe('-42')
    })

    it('should handle zero', () => {
      expect(canonicalizeJson(0)).toBe('0')
    })

    it('should handle floats', () => {
      expect(canonicalizeJson(3.14)).toBe('3.14')
    })

    it('should handle negative floats', () => {
      expect(canonicalizeJson(-3.14)).toBe('-3.14')
    })

    it('should handle scientific notation', () => {
      expect(canonicalizeJson(1e5)).toBe('100000')
    })

    it('should handle strings', () => {
      expect(canonicalizeJson('string')).toBe('"string"')
    })

    it('should handle empty string', () => {
      expect(canonicalizeJson('')).toBe('""')
    })

    it('should handle strings with special characters', () => {
      expect(canonicalizeJson('hello "world"')).toBe('"hello \\"world\\""')
    })

    it('should handle strings with unicode', () => {
      expect(canonicalizeJson('привіт')).toBe('"привіт"')
    })
  })

  describe('arrays', () => {
    it('should handle empty array', () => {
      expect(canonicalizeJson([])).toBe('[]')
    })

    it('should handle single element array', () => {
      expect(canonicalizeJson([1])).toBe('[1]')
    })

    it('should handle multiple elements array', () => {
      expect(canonicalizeJson([1, 2, 3])).toBe('[1,2,3]')
    })

    it('should handle mixed type array', () => {
      expect(canonicalizeJson([1, 'two', true, null])).toBe('[1,"two",true,null]')
    })

    it('should handle nested arrays', () => {
      expect(canonicalizeJson([[1, 2], [3, 4]])).toBe('[[1,2],[3,4]]')
    })

    it('should preserve array order', () => {
      expect(canonicalizeJson([3, 1, 2])).toBe('[3,1,2]')
    })
  })

  describe('objects', () => {
    it('should handle empty object', () => {
      expect(canonicalizeJson({})).toBe('{}')
    })

    it('should handle single key object', () => {
      expect(canonicalizeJson({ key: 'value' })).toBe('{"key":"value"}')
    })

    it('should handle multiple keys object', () => {
      const result = canonicalizeJson({ a: 1, b: 2 })
      expect(result).toBe('{"a":1,"b":2}')
    })

    it('should sort object keys alphabetically', () => {
      const result1 = canonicalizeJson({ b: 1, a: 2 })
      const result2 = canonicalizeJson({ a: 2, b: 1 })
      expect(result1).toBe(result2)
      expect(result1).toBe('{"a":2,"b":1}')
    })

    it('should handle numeric keys (sorted as strings)', () => {
      const result = canonicalizeJson({ 2: 'two', 1: 'one', 10: 'ten' })
      // String sort: '1' < '10' < '2'
      expect(result).toBe('{"1":"one","10":"ten","2":"two"}')
    })

    it('should handle nested objects', () => {
      const result = canonicalizeJson({ outer: { inner: 'value' } })
      expect(result).toBe('{"outer":{"inner":"value"}}')
    })

    it('should sort nested object keys', () => {
      const result = canonicalizeJson({ z: { c: 3, a: 1, b: 2 } })
      expect(result).toBe('{"z":{"a":1,"b":2,"c":3}}')
    })

    it('should handle object with array value', () => {
      const result = canonicalizeJson({ items: [1, 2, 3] })
      expect(result).toBe('{"items":[1,2,3]}')
    })

    it('should handle object with null value', () => {
      const result = canonicalizeJson({ key: null })
      expect(result).toBe('{"key":null}')
    })

    it('should handle object with boolean value', () => {
      const result = canonicalizeJson({ enabled: true, disabled: false })
      expect(result).toBe('{"disabled":false,"enabled":true}')
    })
  })

  describe('determinism', () => {
    it('should produce identical output for identical content in different order', () => {
      const obj1 = { z: 1, a: 2, m: { d: 4, b: 3 } }
      const obj2 = { a: 2, m: { b: 3, d: 4 }, z: 1 }
      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2))
    })

    it('should produce identical output for complex nested structures', () => {
      const obj1 = {
        version: 1,
        environments: {
          prod: { services: { api: { recipients: ['b', 'a'] } } },
          dev: { services: { web: { recipients: ['c'] } } }
        }
      }
      const obj2 = {
        environments: {
          dev: { services: { web: { recipients: ['c'] } } },
          prod: { services: { api: { recipients: ['b', 'a'] } } }
        },
        version: 1
      }
      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2))
    })
  })

  describe('error cases', () => {
    it('should throw on NaN', () => {
      expect(() => canonicalizeJson(NaN)).toThrow('Cannot canonicalize NaN or Infinity')
    })

    it('should throw on positive Infinity', () => {
      expect(() => canonicalizeJson(Infinity)).toThrow('Cannot canonicalize NaN or Infinity')
    })

    it('should throw on negative Infinity', () => {
      expect(() => canonicalizeJson(-Infinity)).toThrow('Cannot canonicalize NaN or Infinity')
    })

    it('should throw on function', () => {
      expect(() => canonicalizeJson(() => {})).toThrow('Unknown type: function')
    })

    it('should throw on Symbol', () => {
      expect(() => canonicalizeJson(Symbol('test'))).toThrow()
    })
  })

  describe('real-world examples', () => {
    it('should canonicalize a policy object', () => {
      const policy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc'] }
            }
          }
        }
      }
      const result = canonicalizeJson(policy)
      expect(result).toContain('"version":1')
      expect(result).toContain('"environments"')
      expect(result).toContain('"dev"')
      expect(result).toContain('"api"')
      expect(result).toContain('"recipients"')
      expect(result).toContain('age1abc')
    })

    it('should handle deeply nested policy', () => {
      const policy = {
        version: 1,
        environments: {
          production: {
            services: {
              'service-a': { recipients: ['key1', 'key2', 'key3'] },
              'service-b': { recipients: ['key4'] }
            }
          }
        }
      }
      const result = canonicalizeJson(policy)
      // Should be deterministic regardless of insertion order
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
