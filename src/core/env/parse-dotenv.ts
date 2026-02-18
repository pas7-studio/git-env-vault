import { EnvObject, ParseError } from '../types/index.js'

export interface ParseOptions {
  allowDuplicates?: boolean
  preserveOrder?: boolean
}

export interface ParseResult {
  env: EnvObject
  order: string[]
  warnings: string[]
}

const LINE_REGEX = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

/**
 * Parse .env file content into key-value object
 * Supports:
 * - KEY=value
 * - KEY="value"
 * - KEY='value'
 * - export KEY=value
 * - # comments
 * - Empty lines
 * - Values with = signs
 * - CRLF and LF line endings
 */
export function parseDotenv(
  content: string,
  options: ParseOptions = {}
): ParseResult {
  const { allowDuplicates = false, preserveOrder = true } = options
  const env: EnvObject = {}
  const order: string[] = []
  const warnings: string[] = []

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1

    // Skip empty lines and comments
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const match = LINE_REGEX.exec(trimmed)
    if (!match) {
      warnings.push(
        `Line ${lineNum}: Invalid format, skipping: ${trimmed.slice(0, 50)}`
      )
      continue
    }

    const [, key, rawValue] = match

    // Check for duplicates
    if (key! in env) {
      if (!allowDuplicates) {
        throw new ParseError(`Duplicate key "${key}" on line ${lineNum}`, lineNum)
      }
      warnings.push(`Line ${lineNum}: Duplicate key "${key}"`)
    } else if (preserveOrder) {
      order.push(key!)
    }

    // Parse value
    const value = parseValue(rawValue!)
    env[key!] = value
  }

  return { env, order, warnings }
}

/**
 * Parse a value string, handling quotes and escapes
 */
function parseValue(raw: string): string {
  const trimmed = raw.trim()

  // Double quotes
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1)
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }

  // Single quotes (no escapes)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1)
  }

  // Unquoted value - trim trailing comments
  const commentIndex = trimmed.indexOf('#')
  if (commentIndex > 0) {
    // Check if it's really a comment (not inside quotes)
    const beforeHash = trimmed.slice(0, commentIndex).trim()
    return beforeHash
  }

  return trimmed
}

/**
 * Check if a string is a valid env key
 */
export function isValidEnvKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(key)
}
