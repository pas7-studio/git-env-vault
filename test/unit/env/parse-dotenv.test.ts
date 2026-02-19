/**
 * Tests for .env file parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseDotenv,
  extractManagedBlock,
  findAllManagedBlocks,
  getKeys,
  hasKey,
  getValue,
  getEntry,
  MANAGED_BLOCK_START,
  MANAGED_BLOCK_END,
} from '../../../src/core/env/parse-dotenv';
import { DuplicateKeyError } from '../../../src/core/env/types';

describe('parseDotenv', () => {
  describe('basic parsing', () => {
    it('should parse simple KEY=value', () => {
      const content = 'KEY=value';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].key).toBe('KEY');
      expect(result.entries[0].value).toBe('value');
      expect(result.entries[0].quote).toBeNull();
    });

    it('should parse KEY="value" with double quotes', () => {
      const content = 'KEY="value"';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].key).toBe('KEY');
      expect(result.entries[0].value).toBe('value');
      expect(result.entries[0].quote).toBe('"');
    });

    it('should parse KEY=\'value\' with single quotes', () => {
      const content = "KEY='value'";
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].key).toBe('KEY');
      expect(result.entries[0].value).toBe('value');
      expect(result.entries[0].quote).toBe("'");
    });

    it('should parse export KEY=value', () => {
      const content = 'export KEY=value';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].key).toBe('KEY');
      expect(result.entries[0].value).toBe('value');
      expect(result.entries[0].hasExport).toBe(true);
    });

    it('should parse export KEY="value"', () => {
      const content = 'export KEY="value"';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].key).toBe('KEY');
      expect(result.entries[0].value).toBe('value');
      expect(result.entries[0].hasExport).toBe(true);
      expect(result.entries[0].quote).toBe('"');
    });
  });

  describe('values with special characters', () => {
    it('should parse values with = sign', () => {
      const content = 'KEY=value=with=equals';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('value=with=equals');
    });

    it('should parse values with = in quotes', () => {
      const content = 'KEY="value=with=equals"';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('value=with=equals');
    });

    it('should parse empty value', () => {
      const content = 'KEY=';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('');
    });

    it('should parse empty quoted value', () => {
      const content = 'KEY=""';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('');
      expect(result.entries[0].quote).toBe('"');
    });

    it('should unescape \\n in quoted values', () => {
      const content = 'KEY="line1\\nline2"';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('line1\nline2');
    });

    it('should unescape \\t in quoted values', () => {
      const content = 'KEY="col1\\tcol2"';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('col1\tcol2');
    });

    it('should unescape \\" in double-quoted values', () => {
      const content = 'KEY="say \\"hello\\""';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('say "hello"');
    });

    it('should unescape \\\' in single-quoted values', () => {
      const content = "KEY='it\\'s fine'";
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe("it's fine");
    });

    it('should handle escaped backslash followed by n', () => {
      // When we want literal \n in output, we use \\n in input
      const content = 'KEY="line1\\\\nline2"';
      const result = parseDotenv(content);

      // The result should contain literal backslash followed by n
      expect(result.entries[0].value).toContain('\\');
    });
  });

  describe('comments', () => {
    it('should parse comment before key', () => {
      const content = `# This is a comment
KEY=value`;
      const result = parseDotenv(content);

      expect(result.entries[0].comment).toBe('This is a comment');
    });

    it('should parse multi-line comment before key', () => {
      const content = `# Line 1
# Line 2
KEY=value`;
      const result = parseDotenv(content);

      expect(result.entries[0].comment).toBe('Line 1\nLine 2');
    });

    it('should ignore inline comment after value', () => {
      const content = 'KEY=value # this is inline';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('value');
    });

    it('should preserve comment lines in rawLines', () => {
      const content = `# Comment 1
KEY=value
# Comment 2`;
      const result = parseDotenv(content);

      expect(result.rawLines).toContain('# Comment 1');
      expect(result.rawLines).toContain('# Comment 2');
    });
  });

  describe('empty lines and whitespace', () => {
    it('should handle empty lines', () => {
      const content = `KEY1=value1

KEY2=value2`;
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(2);
      expect(result.rawLines).toContain('');
    });

    it('should trim whitespace from unquoted values', () => {
      const content = 'KEY=value   ';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('value');
    });

    it('should preserve whitespace in quoted values', () => {
      const content = 'KEY="  value  "';
      const result = parseDotenv(content);

      expect(result.entries[0].value).toBe('  value  ');
    });
  });

  describe('line ending normalization', () => {
    it('should handle CRLF line endings', () => {
      const content = 'KEY1=value1\r\nKEY2=value2';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].value).toBe('value1');
      expect(result.entries[1].value).toBe('value2');
    });

    it('should handle LF line endings', () => {
      const content = 'KEY1=value1\nKEY2=value2';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(2);
    });

    it('should handle mixed line endings', () => {
      const content = 'KEY1=value1\r\nKEY2=value2\nKEY3=value3';
      const result = parseDotenv(content);

      expect(result.entries).toHaveLength(3);
    });
  });

  describe('key validation', () => {
    it('should accept keys starting with letter', () => {
      const content = 'KEY=value';
      const result = parseDotenv(content);

      expect(result.entries[0].key).toBe('KEY');
    });

    it('should accept keys starting with underscore', () => {
      const content = '_KEY=value';
      const result = parseDotenv(content);

      expect(result.entries[0].key).toBe('_KEY');
    });

    it('should accept keys with numbers after first char', () => {
      const content = 'KEY123=value';
      const result = parseDotenv(content);

      expect(result.entries[0].key).toBe('KEY123');
    });

    it('should accept lowercase keys', () => {
      const content = 'my_key=value';
      const result = parseDotenv(content);

      expect(result.entries[0].key).toBe('my_key');
    });
  });

  describe('duplicate key detection', () => {
    it('should throw DuplicateKeyError for duplicate keys', () => {
      const content = `KEY=value1
KEY=value2`;

      expect(() => parseDotenv(content)).toThrow(DuplicateKeyError);
    });

    it('should include line numbers in DuplicateKeyError', () => {
      const content = `KEY=value1
KEY=value2`;

      try {
        parseDotenv(content);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DuplicateKeyError);
        if (error instanceof DuplicateKeyError) {
          expect(error.key).toBe('KEY');
          expect(error.lineNumbers).toEqual([1, 2]);
        }
      }
    });
  });

  describe('managed block markers', () => {
    it('should preserve managed block start markers in rawLines', () => {
      const content = `${MANAGED_BLOCK_START}dev service=api
KEY=value
${MANAGED_BLOCK_END}`;
      const result = parseDotenv(content);

      expect(result.rawLines).toContain(`${MANAGED_BLOCK_START}dev service=api`);
      expect(result.rawLines).toContain(MANAGED_BLOCK_END);
    });
  });

  describe('line numbers', () => {
    it('should assign correct line numbers', () => {
      const content = `KEY1=value1
KEY2=value2
KEY3=value3`;
      const result = parseDotenv(content);

      expect(result.entries[0].lineNumber).toBe(1);
      expect(result.entries[1].lineNumber).toBe(2);
      expect(result.entries[2].lineNumber).toBe(3);
    });

    it('should account for empty lines in line numbers', () => {
      const content = `KEY1=value1

KEY2=value2`;
      const result = parseDotenv(content);

      expect(result.entries[0].lineNumber).toBe(1);
      expect(result.entries[1].lineNumber).toBe(3);
    });
  });
});

describe('extractManagedBlock', () => {
  it('should extract a managed block', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
API_KEY=secret123
API_URL=https://api.example.com
${MANAGED_BLOCK_END}`;

    const block = extractManagedBlock(content, 'dev', 'api');

    expect(block).not.toBeNull();
    expect(block?.env).toBe('dev');
    expect(block?.service).toBe('api');
    expect(block?.entries).toHaveLength(2);
    expect(block?.entries[0].key).toBe('API_KEY');
    expect(block?.entries[1].key).toBe('API_URL');
  });

  it('should return null if block not found', () => {
    const content = 'KEY=value';
    const block = extractManagedBlock(content, 'dev', 'api');

    expect(block).toBeNull();
  });

  it('should differentiate between different envs', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
KEY=dev-value
${MANAGED_BLOCK_END}
${MANAGED_BLOCK_START}prod service=api
KEY=prod-value
${MANAGED_BLOCK_END}`;

    const devBlock = extractManagedBlock(content, 'dev', 'api');
    const prodBlock = extractManagedBlock(content, 'prod', 'api');

    expect(devBlock?.entries[0].value).toBe('dev-value');
    expect(prodBlock?.entries[0].value).toBe('prod-value');
  });

  it('should differentiate between different services', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
KEY=api-value
${MANAGED_BLOCK_END}
${MANAGED_BLOCK_START}dev service=web
KEY=web-value
${MANAGED_BLOCK_END}`;

    const apiBlock = extractManagedBlock(content, 'dev', 'api');
    const webBlock = extractManagedBlock(content, 'dev', 'web');

    expect(apiBlock?.entries[0].value).toBe('api-value');
    expect(webBlock?.entries[0].value).toBe('web-value');
  });
});

describe('findAllManagedBlocks', () => {
  it('should find all managed blocks', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
KEY1=value1
${MANAGED_BLOCK_END}
${MANAGED_BLOCK_START}prod service=web
KEY2=value2
${MANAGED_BLOCK_END}`;

    const blocks = findAllManagedBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].env).toBe('dev');
    expect(blocks[0].service).toBe('api');
    expect(blocks[1].env).toBe('prod');
    expect(blocks[1].service).toBe('web');
  });

  it('should return empty array if no blocks found', () => {
    const content = 'KEY=value';
    const blocks = findAllManagedBlocks(content);

    expect(blocks).toHaveLength(0);
  });
});

describe('helper functions', () => {
  const content = `KEY1=value1
KEY2=value2
KEY3=value3`;
  const file = parseDotenv(content);

  describe('getKeys', () => {
    it('should return all keys', () => {
      const keys = getKeys(file);
      expect(keys).toEqual(['KEY1', 'KEY2', 'KEY3']);
    });
  });

  describe('hasKey', () => {
    it('should return true for existing key', () => {
      expect(hasKey(file, 'KEY1')).toBe(true);
    });

    it('should return false for non-existing key', () => {
      expect(hasKey(file, 'KEY4')).toBe(false);
    });
  });

  describe('getValue', () => {
    it('should return value for existing key', () => {
      expect(getValue(file, 'KEY1')).toBe('value1');
    });

    it('should return undefined for non-existing key', () => {
      expect(getValue(file, 'KEY4')).toBeUndefined();
    });
  });

  describe('getEntry', () => {
    it('should return entry for existing key', () => {
      const entry = getEntry(file, 'KEY2');
      expect(entry?.key).toBe('KEY2');
      expect(entry?.value).toBe('value2');
    });

    it('should return undefined for non-existing key', () => {
      expect(getEntry(file, 'KEY4')).toBeUndefined();
    });
  });
});
