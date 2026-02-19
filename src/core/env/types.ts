/**
 * Types for environment variable handling
 * @module gev:core/env/types
 */

import type { EnvObject } from '../types/index.js'

// Re-export for convenience
export type { EnvObject } from '../types/index.js'

/**
 * Quote style for dotenv values
 */
export type QuoteStyle = 'single' | 'double' | 'none'

/**
 * A single entry in a dotenv file with optional metadata
 */
export interface DotenvEntry {
  /** Variable name */
  key: string
  /** Variable value */
  value: string
  /** Optional comment above the variable */
  comment?: string | undefined
  /** Quote style for value */
  quote?: QuoteStyle | undefined
  /** Has export prefix */
  hasExport?: boolean | undefined
  /** Line number in file (1-based) */
  lineNumber?: number | undefined
}

/**
 * Parsed dotenv file structure
 */
export interface DotenvFile {
  /** Parsed environment variables as key-value pairs */
  env: EnvObject
  /** Original order of keys */
  order: string[]
  /** Parsed entries with full metadata */
  entries: DotenvEntry[]
  /** Raw lines from the file */
  rawLines: string[]
  /** Comments that appeared at the end of file */
  trailingComments?: string[] | undefined
}

/**
 * Result of parsing a dotenv file (alias for DotenvFile for backward compatibility)
 * @deprecated Use DotenvFile instead
 */
export type ParseResult = DotenvFile

/**
 * Options for rendering dotenv content
 */
export interface RenderOptions {
  /** Desired order of keys (if not specified, uses insertion order) */
  order?: string[] | undefined
  /** Header comment to add at the top */
  header?: string | undefined
  /** Whether to include comments from entries */
  includeComments?: boolean | undefined
  /** Position for inserting managed blocks */
  position?: 'top' | 'bottom' | undefined
  /** Show unchanged keys in diff */
  showUnchanged?: boolean | undefined
  /** Use compact format */
  compact?: boolean | undefined
}

/**
 * Result of diffing two environment objects
 */
export interface DiffResult {
  /** Keys that were added */
  added: string[]
  /** Keys that were removed */
  removed: string[]
  /** Keys that had values changed */
  changed: string[]
  /** Keys that remained unchanged */
  unchanged: string[]
}

/**
 * Full diff with values (for unsafe display)
 */
export interface DiffResultWithValues extends DiffResult {
  /** Old values for changed keys */
  oldValues: Record<string, string>
  /** New values for changed keys */
  newValues: Record<string, string>
}

/**
 * Options for formatting diff output
 */
export interface DiffFormatOptions {
  /** Use colors in output */
  colorize?: boolean | undefined
  /** Show values (unsafe) */
  showValues?: boolean | undefined
  /** Indent string */
  indent?: string | undefined
  /** Show unchanged keys */
  showUnchanged?: boolean | undefined
  /** Use compact format */
  compact?: boolean | undefined
}

/**
 * Error thrown when duplicate keys are found in dotenv file
 */
export class DuplicateKeyError extends Error {
  constructor(
    public readonly key: string,
    public readonly lineNumbers: number[]
  ) {
    super(`Duplicate key "${key}" found on lines: ${lineNumbers.join(', ')}`)
    this.name = 'DuplicateKeyError'
  }
}
