/**
 * Schema validation for required/optional environment keys
 *
 * @module gev:core/config/schema
 *
 * Supports envvault.schema.yaml format:
 * services:
 *   api:
 *     required: [DATABASE_URL, JWT_SECRET]
 *     optional: [DEBUG, LOG_LEVEL]
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { DotenvEntry } from '../env/types.js';

const SCHEMA_FILE = 'envvault.schema.yaml';

/**
 * Schema definition for a single service
 */
export interface ServiceSchema {
  /** Required keys that must be present */
  required: string[];
  /** Optional keys that may be present */
  optional: string[];
}

/**
 * Full schema containing definitions for all services
 */
export interface Schema {
  /** Schema version for future compatibility */
  version?: number;
  /** Service schemas keyed by service name */
  services: Record<string, ServiceSchema>;
}

/**
 * Result of validating entries against a schema
 */
export interface SchemaValidationResult {
  /** Whether validation passed (no missing required keys) */
  valid: boolean;
  /** Required keys that are missing from entries */
  missing: string[];
  /** Keys that are neither in required nor optional */
  extra: string[];
}

/**
 * Error thrown when schema file has invalid format
 */
export class SchemaParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SchemaParseError';
  }
}

/**
 * Load schema from envvault.schema.yaml
 *
 * @param projectRoot - Path to project root directory
 * @returns Schema object or null if file doesn't exist
 * @throws SchemaParseError if schema file is invalid
 */
export async function loadSchema(projectRoot: string): Promise<Schema | null> {
  const schemaPath = join(projectRoot, SCHEMA_FILE);

  // Check if schema file exists
  try {
    await access(schemaPath);
  } catch {
    return null;
  }

  try {
    const content = await readFile(schemaPath, 'utf-8');
    const raw = parseYaml(content);

    // Validate structure
    if (!raw || typeof raw !== 'object') {
      throw new SchemaParseError('Schema file is empty or invalid');
    }

    // Handle version field
    const version = raw.version ?? 1;

    if (!raw.services || typeof raw.services !== 'object') {
      throw new SchemaParseError('Schema must contain "services" object');
    }

    const services: Record<string, ServiceSchema> = {};

    for (const [serviceName, serviceDef] of Object.entries(raw.services)) {
      if (!serviceDef || typeof serviceDef !== 'object') {
        throw new SchemaParseError(
          `Service "${serviceName}" must be an object with required/optional arrays`
        );
      }

      const def = serviceDef as Record<string, unknown>;

      services[serviceName] = {
        required: Array.isArray(def.required)
          ? def.required.map(String)
          : [],
        optional: Array.isArray(def.optional)
          ? def.optional.map(String)
          : [],
      };

      // Validate that required and optional contain strings
      for (const key of services[serviceName].required) {
        if (typeof key !== 'string' || key.trim() === '') {
          throw new SchemaParseError(
            `Service "${serviceName}" has invalid required key: ${JSON.stringify(key)}`
          );
        }
      }

      for (const key of services[serviceName].optional) {
        if (typeof key !== 'string' || key.trim() === '') {
          throw new SchemaParseError(
            `Service "${serviceName}" has invalid optional key: ${JSON.stringify(key)}`
          );
        }
      }
    }

    return { version, services };
  } catch (error) {
    if (error instanceof SchemaParseError) {
      throw error;
    }
    throw new SchemaParseError(
      `Failed to parse schema file: ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Validate environment entries against a service schema
 *
 * @param entries - Dotenv entries to validate
 * @param schema - Service schema to validate against
 * @returns Validation result with missing and extra keys
 */
export function validateAgainstSchema(
  entries: DotenvEntry[],
  schema: ServiceSchema
): SchemaValidationResult {
  const entryKeys = new Set(entries.map((e) => e.key));
  const allowedKeys = new Set([...schema.required, ...schema.optional]);

  const missing: string[] = [];
  const extra: string[] = [];

  // Find missing required keys
  for (const requiredKey of schema.required) {
    if (!entryKeys.has(requiredKey)) {
      missing.push(requiredKey);
    }
  }

  // Find extra keys (not in required or optional)
  for (const entryKey of entryKeys) {
    if (!allowedKeys.has(entryKey)) {
      extra.push(entryKey);
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing.sort(),
    extra: extra.sort(),
  };
}

/**
 * Generate .env content with placeholders for missing keys
 *
 * @param entries - Existing entries
 * @param schema - Service schema
 * @param placeholder - Placeholder value for missing keys (default: '__MISSING__')
 * @returns Entries with placeholders for missing required keys
 */
export function generateWithPlaceholders(
  entries: DotenvEntry[],
  schema: ServiceSchema,
  placeholder: string = '__MISSING__'
): DotenvEntry[] {
  const entryKeys = new Set(entries.map((e) => e.key));
  const result: DotenvEntry[] = [...entries];

  // Add placeholders for missing required keys
  for (const requiredKey of schema.required) {
    if (!entryKeys.has(requiredKey)) {
      result.push({
        key: requiredKey,
        value: placeholder,
        comment: 'TODO: Set this required value',
      });
    }
  }

  // Sort by key for deterministic output
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Get default empty schema
 *
 * @returns Empty schema object
 */
export function getDefaultSchema(): Schema {
  return {
    version: 1,
    services: {},
  };
}

/**
 * Generate YAML content for schema file
 *
 * @param schema - Schema object
 * @returns YAML string
 */
export function generateSchemaYaml(schema: Schema): string {
  const lines: string[] = [
    '# envvault.schema.yaml',
    '# Defines required and optional environment variables for each service',
    '',
    'version: 1',
    '',
    'services:',
  ];

  if (Object.keys(schema.services).length === 0) {
    lines.push('  # Add your services here:');
    lines.push('  # api:');
    lines.push('  #   required: [DATABASE_URL, JWT_SECRET]');
    lines.push('  #   optional: [DEBUG, LOG_LEVEL]');
  } else {
    for (const [serviceName, serviceSchema] of Object.entries(schema.services)) {
      lines.push(`  ${serviceName}:`);
      if (serviceSchema.required.length > 0) {
        lines.push(
          `    required: [${serviceSchema.required.map((k) => k).join(', ')}]`
        );
      } else {
        lines.push('    required: []');
      }
      if (serviceSchema.optional.length > 0) {
        lines.push(
          `    optional: [${serviceSchema.optional.map((k) => k).join(', ')}]`
        );
      } else {
        lines.push('    optional: []');
      }
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Merge multiple service schemas into one
 *
 * @param schemas - Schemas to merge
 * @returns Merged schema
 */
export function mergeSchemas(...schemas: ServiceSchema[]): ServiceSchema {
  const requiredSet = new Set<string>();
  const optionalSet = new Set<string>();

  for (const schema of schemas) {
    for (const key of schema.required) {
      requiredSet.add(key);
      optionalSet.delete(key); // Required takes precedence
    }
    for (const key of schema.optional) {
      if (!requiredSet.has(key)) {
        optionalSet.add(key);
      }
    }
  }

  return {
    required: Array.from(requiredSet).sort(),
    optional: Array.from(optionalSet).sort(),
  };
}
