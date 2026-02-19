/**
 * Types for .env file parsing and rendering
 *
 * @module gev:core/env/types
 */

/**
 * Represents a single entry in a .env file
 */
export interface DotenvEntry {
  /** The environment variable key */
  key: string;
  /** The environment variable value */
  value: string;
  /** Comment line(s) preceding the key */
  comment?: string;
  /** Whether this entry uses 'export KEY=value' format */
  hasExport?: boolean;
  /** Type of quotes used for the value */
  quote?: '"' | "'" | null;
  /** Original line content (for preserving format) */
  rawLine?: string;
  /** Line number in the original file (1-based) */
  lineNumber?: number;
}

/**
 * Represents a parsed .env file structure
 */
export interface DotenvFile {
  /** Parsed entries with keys */
  entries: DotenvEntry[];
  /** Raw lines without keys (comments, empty lines, invalid lines) */
  rawLines: string[];
  /** Original content for reference */
  originalContent?: string;
}

/**
 * Represents a managed block in a .env file
 * Managed blocks are automatically generated and maintained by gev
 */
export interface ManagedBlock {
  /** Environment name (e.g., 'dev', 'staging', 'prod') */
  env: string;
  /** Service name */
  service: string;
  /** Start line number (1-based) */
  startLine: number;
  /** End line number (1-based) */
  endLine: number;
  /** Entries within this managed block */
  entries: DotenvEntry[];
}

/**
 * Result of comparing two sets of environment entries
 * IMPORTANT: Never includes values to prevent secret leakage
 */
export interface DiffResult {
  /** Keys that were added */
  added: string[];
  /** Keys that were removed */
  removed: string[];
  /** Keys whose values changed */
  changed: string[];
  /** Keys that remain unchanged */
  unchanged: string[];
}

/**
 * Options for inserting managed blocks
 */
export interface InsertManagedBlockOptions {
  /** Where to insert new blocks: 'top' or 'bottom' of file */
  position?: 'top' | 'bottom';
}

/**
 * Error thrown when duplicate keys are found in .env file
 */
export class DuplicateKeyError extends Error {
  constructor(
    public key: string,
    public lineNumbers: number[]
  ) {
    super(
      `Duplicate key "${key}" found on lines ${lineNumbers.join(', ')}. ` +
        `Please remove duplicates or use different key names.`
    );
    this.name = 'DuplicateKeyError';
  }
}

/**
 * Error thrown when parsing fails
 */
export class DotenvParseError extends Error {
  constructor(
    message: string,
    public lineNumber?: number,
    public line?: string
  ) {
    super(
      lineNumber !== undefined
        ? `Parse error on line ${lineNumber}: ${message}`
        : `Parse error: ${message}`
    );
    this.name = 'DotenvParseError';
  }
}
