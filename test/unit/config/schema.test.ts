/**
 * Tests for schema validation module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadSchema,
  validateAgainstSchema,
  generateWithPlaceholders,
  getDefaultSchema,
  generateSchemaYaml,
  mergeSchemas,
  SchemaParseError,
  type Schema,
  type ServiceSchema,
  type DotenvEntry,
} from '../../../src/core/config/schema.js';

describe('schema', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `schema-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadSchema', () => {
    it('should return null when schema file does not exist', async () => {
      const result = await loadSchema(tempDir);
      expect(result).toBeNull();
    });

    it('should load valid schema file', async () => {
      const schemaContent = `
version: 1
services:
  api:
    required: [DATABASE_URL, JWT_SECRET]
    optional: [DEBUG, LOG_LEVEL]
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      const result = await loadSchema(tempDir);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.services.api).toBeDefined();
      expect(result?.services.api.required).toEqual(['DATABASE_URL', 'JWT_SECRET']);
      expect(result?.services.api.optional).toEqual(['DEBUG', 'LOG_LEVEL']);
    });

    it('should handle schema without version (default to 1)', async () => {
      const schemaContent = `
services:
  api:
    required: [KEY1]
    optional: []
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      const result = await loadSchema(tempDir);
      expect(result?.version).toBe(1);
    });

    it('should handle empty required and optional arrays', async () => {
      const schemaContent = `
services:
  api:
    required: []
    optional: []
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      const result = await loadSchema(tempDir);
      expect(result?.services.api.required).toEqual([]);
      expect(result?.services.api.optional).toEqual([]);
    });

    it('should throw SchemaParseError for invalid YAML', async () => {
      await writeFile(join(tempDir, 'envvault.schema.yaml'), 'invalid: [yaml');

      await expect(loadSchema(tempDir)).rejects.toThrow(SchemaParseError);
    });

    it('should throw SchemaParseError for missing services', async () => {
      const schemaContent = `
version: 1
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      await expect(loadSchema(tempDir)).rejects.toThrow('must contain "services" object');
    });

    it('should throw SchemaParseError for invalid service definition', async () => {
      const schemaContent = `
services:
  api: "not an object"
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      await expect(loadSchema(tempDir)).rejects.toThrow(SchemaParseError);
    });

    it('should handle multiple services', async () => {
      const schemaContent = `
services:
  api:
    required: [DB_URL]
    optional: [DEBUG]
  worker:
    required: [REDIS_URL]
    optional: [LOG_LEVEL]
`;
      await writeFile(join(tempDir, 'envvault.schema.yaml'), schemaContent);

      const result = await loadSchema(tempDir);
      expect(Object.keys(result?.services || {})).toHaveLength(2);
      expect(result?.services.api.required).toEqual(['DB_URL']);
      expect(result?.services.worker.required).toEqual(['REDIS_URL']);
    });
  });

  describe('validateAgainstSchema', () => {
    const schema: ServiceSchema = {
      required: ['DATABASE_URL', 'JWT_SECRET'],
      optional: ['DEBUG', 'LOG_LEVEL'],
    };

    it('should return valid for entries with all required keys', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
        { key: 'JWT_SECRET', value: 'secret' },
      ];

      const result = validateAgainstSchema(entries, schema);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return valid when optional keys are present', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
        { key: 'JWT_SECRET', value: 'secret' },
        { key: 'DEBUG', value: 'true' },
      ];

      const result = validateAgainstSchema(entries, schema);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should detect missing required keys', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
      ];

      const result = validateAgainstSchema(entries, schema);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['JWT_SECRET']);
    });

    it('should detect multiple missing required keys', () => {
      const entries: DotenvEntry[] = [];

      const result = validateAgainstSchema(entries, schema);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['DATABASE_URL', 'JWT_SECRET']);
    });

    it('should detect extra keys not in schema', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
        { key: 'JWT_SECRET', value: 'secret' },
        { key: 'UNKNOWN_KEY', value: 'value' },
      ];

      const result = validateAgainstSchema(entries, schema);
      expect(result.extra).toEqual(['UNKNOWN_KEY']);
    });

    it('should handle empty schema', () => {
      const emptySchema: ServiceSchema = {
        required: [],
        optional: [],
      };

      const entries: DotenvEntry[] = [
        { key: 'ANY_KEY', value: 'value' },
      ];

      const result = validateAgainstSchema(entries, emptySchema);
      expect(result.valid).toBe(true);
      expect(result.extra).toEqual(['ANY_KEY']);
    });
  });

  describe('generateWithPlaceholders', () => {
    const schema: ServiceSchema = {
      required: ['DATABASE_URL', 'JWT_SECRET', 'API_KEY'],
      optional: ['DEBUG'],
    };

    it('should add placeholders for missing required keys', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
      ];

      const result = generateWithPlaceholders(entries, schema);

      const keys = result.map((e) => e.key);
      expect(keys).toContain('JWT_SECRET');
      expect(keys).toContain('API_KEY');
    });

    it('should use custom placeholder value', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
      ];

      const result = generateWithPlaceholders(entries, schema, '<SET_VALUE>');

      const jwtEntry = result.find((e) => e.key === 'JWT_SECRET');
      expect(jwtEntry?.value).toBe('<SET_VALUE>');
    });

    it('should add TODO comment for placeholders', () => {
      const entries: DotenvEntry[] = [];

      const result = generateWithPlaceholders(entries, schema);

      const dbEntry = result.find((e) => e.key === 'DATABASE_URL');
      expect(dbEntry?.comment).toBe('TODO: Set this required value');
    });

    it('should not modify existing entries', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost', comment: 'Original comment' },
      ];

      const result = generateWithPlaceholders(entries, schema);

      const dbEntry = result.find((e) => e.key === 'DATABASE_URL');
      expect(dbEntry?.value).toBe('postgres://localhost');
      expect(dbEntry?.comment).toBe('Original comment');
    });

    it('should sort entries alphabetically', () => {
      const entries: DotenvEntry[] = [
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
      ];

      const result = generateWithPlaceholders(entries, schema);

      const keys = result.map((e) => e.key);
      expect(keys).toEqual([...keys].sort());
    });
  });

  describe('getDefaultSchema', () => {
    it('should return empty schema', () => {
      const schema = getDefaultSchema();
      expect(schema.version).toBe(1);
      expect(schema.services).toEqual({});
    });
  });

  describe('generateSchemaYaml', () => {
    it('should generate valid YAML for empty schema', () => {
      const schema: Schema = getDefaultSchema();
      const yaml = generateSchemaYaml(schema);

      expect(yaml).toContain('version: 1');
      expect(yaml).toContain('services:');
    });

    it('should generate valid YAML for schema with services', () => {
      const schema: Schema = {
        version: 1,
        services: {
          api: {
            required: ['DATABASE_URL', 'JWT_SECRET'],
            optional: ['DEBUG'],
          },
        },
      };

      const yaml = generateSchemaYaml(schema);

      expect(yaml).toContain('api:');
      expect(yaml).toContain('required: [DATABASE_URL, JWT_SECRET]');
      expect(yaml).toContain('optional: [DEBUG]');
    });
  });

  describe('mergeSchemas', () => {
    it('should merge required keys from multiple schemas', () => {
      const schema1: ServiceSchema = {
        required: ['KEY1', 'KEY2'],
        optional: [],
      };

      const schema2: ServiceSchema = {
        required: ['KEY2', 'KEY3'],
        optional: [],
      };

      const result = mergeSchemas(schema1, schema2);

      expect(result.required).toEqual(['KEY1', 'KEY2', 'KEY3']);
    });

    it('should merge optional keys without duplicates', () => {
      const schema1: ServiceSchema = {
        required: [],
        optional: ['OPT1', 'OPT2'],
      };

      const schema2: ServiceSchema = {
        required: [],
        optional: ['OPT2', 'OPT3'],
      };

      const result = mergeSchemas(schema1, schema2);

      expect(result.optional).toEqual(['OPT1', 'OPT2', 'OPT3']);
    });

    it('should prioritize required over optional', () => {
      const schema1: ServiceSchema = {
        required: ['KEY1'],
        optional: [],
      };

      const schema2: ServiceSchema = {
        required: [],
        optional: ['KEY1'], // Same key as required in schema1
      };

      const result = mergeSchemas(schema1, schema2);

      expect(result.required).toContain('KEY1');
      expect(result.optional).not.toContain('KEY1');
    });

    it('should return empty arrays for no input', () => {
      const result = mergeSchemas();

      expect(result.required).toEqual([]);
      expect(result.optional).toEqual([]);
    });
  });
});
