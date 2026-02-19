import { describe, it, expect } from 'vitest'
import { parseDotenv } from '../../../src/core/env/parse-env.js'

describe('parseDotenv', () => {
  describe('basic parsing', () => {
    it('should parse simple KEY=value', () => {
      const result = parseDotenv('KEY=value')
      expect(result.env).toEqual({ KEY: 'value' })
      expect(result.order).toEqual(['KEY'])
    })

    it('should parse multiple keys', () => {
      const result = parseDotenv('KEY1=value1\nKEY2=value2')
      expect(result.env).toEqual({ KEY1: 'value1', KEY2: 'value2' })
      expect(result.order).toEqual(['KEY1', 'KEY2'])
    })

    it('should skip empty lines', () => {
      const result = parseDotenv('KEY1=value1\n\n\nKEY2=value2')
      expect(result.env).toEqual({ KEY1: 'value1', KEY2: 'value2' })
      expect(result.order).toEqual(['KEY1', 'KEY2'])
    })

    it('should skip comments', () => {
      const result = parseDotenv('# comment\nKEY=value\n# another comment')
      expect(result.env).toEqual({ KEY: 'value' })
      expect(result.order).toEqual(['KEY'])
    })

    it('should skip lines with only whitespace', () => {
      const result = parseDotenv('KEY1=value1\n   \n\t\nKEY2=value2')
      expect(result.env).toEqual({ KEY1: 'value1', KEY2: 'value2' })
    })
  })

  describe('quoted values', () => {
    it('should parse double-quoted values', () => {
      const result = parseDotenv('KEY="value with spaces"')
      expect(result.env.KEY).toBe('value with spaces')
    })

    it('should parse single-quoted values', () => {
      const result = parseDotenv("KEY='value with spaces'")
      expect(result.env.KEY).toBe('value with spaces')
    })

    it('should remove quotes from simple quoted values', () => {
      const result = parseDotenv('KEY="simple"')
      expect(result.env.KEY).toBe('simple')
    })

    it('should handle empty quoted values', () => {
      const result = parseDotenv('KEY=""')
      expect(result.env.KEY).toBe('')
    })

    it('should handle single quotes empty values', () => {
      const result = parseDotenv("KEY=''")
      expect(result.env.KEY).toBe('')
    })
  })

  describe('edge cases', () => {
    it('should handle values with = signs', () => {
      const result = parseDotenv('JWT=header.payload.signature')
      expect(result.env.JWT).toBe('header.payload.signature')
    })

    it('should handle values with multiple = signs', () => {
      const result = parseDotenv('EQUATION=a=b=c')
      expect(result.env.EQUATION).toBe('a=b=c')
    })

    it('should handle empty values', () => {
      const result = parseDotenv('EMPTY=')
      expect(result.env.EMPTY).toBe('')
    })

    it('should handle lines without = sign', () => {
      const result = parseDotenv('INVALID_LINE\nKEY=value')
      expect(result.env).toEqual({ KEY: 'value' })
    })

    it('should handle lines starting with =', () => {
      const result = parseDotenv('=value\nKEY=value')
      expect(result.env).toEqual({ KEY: 'value' })
    })

    it('should handle CRLF line endings', () => {
      const result = parseDotenv('KEY1=value1\r\nKEY2=value2')
      expect(result.env).toEqual({ KEY1: 'value1', KEY2: 'value2' })
    })

    it('should handle spaces around =', () => {
      const result = parseDotenv('KEY = value')
      expect(result.env.KEY).toBe('value')
    })

    it('should handle spaces in keys (trimmed)', () => {
      const result = parseDotenv('  KEY  =value')
      expect(result.env.KEY).toBe('value')
    })

    it('should handle spaces after value (trimmed)', () => {
      const result = parseDotenv('KEY=value  ')
      expect(result.env.KEY).toBe('value')
    })

    it('should handle inline comments (not supported - treated as part of value)', () => {
      const result = parseDotenv('KEY=value # comment')
      // Without special handling, this is treated as part of the value
      expect(result.env.KEY).toBe('value # comment')
    })
  })

  describe('duplicates', () => {
    it('should keep first occurrence of duplicate keys', () => {
      const result = parseDotenv('KEY=value1\nKEY=value2')
      expect(result.env.KEY).toBe('value1')
      expect(result.order).toEqual(['KEY'])
    })

    it('should only add key to order once', () => {
      const result = parseDotenv('KEY=value1\nKEY=value2\nKEY=value3')
      expect(result.order).toHaveLength(1)
      expect(result.order).toEqual(['KEY'])
    })
  })

  describe('complex scenarios', () => {
    it('should parse typical .env file', () => {
      const content = `# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb

# API Keys
API_KEY=secret123
API_URL=https://api.example.com`
      
      const result = parseDotenv(content)
      expect(result.env).toEqual({
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'mydb',
        API_KEY: 'secret123',
        API_URL: 'https://api.example.com'
      })
      expect(result.order).toEqual(['DB_HOST', 'DB_PORT', 'DB_NAME', 'API_KEY', 'API_URL'])
    })

    it('should handle empty input', () => {
      const result = parseDotenv('')
      expect(result.env).toEqual({})
      expect(result.order).toEqual([])
    })

    it('should handle only comments', () => {
      const result = parseDotenv('# comment 1\n# comment 2\n# comment 3')
      expect(result.env).toEqual({})
      expect(result.order).toEqual([])
    })

    it('should handle only empty lines', () => {
      const result = parseDotenv('\n\n\n')
      expect(result.env).toEqual({})
      expect(result.order).toEqual([])
    })
  })

  describe('special characters in values', () => {
    it('should handle special characters in quoted values', () => {
      const result = parseDotenv('KEY="value@#$%^&*"')
      expect(result.env.KEY).toBe('value@#$%^&*')
    })

    it('should handle unicode in values', () => {
      const result = parseDotenv('KEY="значення"')
      expect(result.env.KEY).toBe('значення')
    })

    it('should handle newlines in quoted values (raw)', () => {
      // Note: the parser doesn't process escape sequences
      const result = parseDotenv('KEY="line1\\nline2"')
      expect(result.env.KEY).toBe('line1\\nline2')
    })

    it('should handle colons in values', () => {
      const result = parseDotenv('URL=http://localhost:3000')
      expect(result.env.URL).toBe('http://localhost:3000')
    })
  })
})
