/**
 * Dotenv file parser
 * @module gev:core/env/parse-dotenv
 * 
 * Parses .env files while preserving:
 * - Variable order
 * - Comments (associated with variables)
 * - Trailing comments
 */

import type { DotenvEntry, ParseResult, EnvObject, DotenvFile } from './types.js'

/**
 * Managed block markers
 */
export const MANAGED_BLOCK_START = '# >>> ge-vault'
export const MANAGED_BLOCK_END = '# <<< ge-vault'

/**
 * Error thrown when duplicate keys are found
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

/**
 * Parse a dotenv file content into structured data
 * 
 * @param content - Raw .env file content
 * @returns Parsed result with env object, order, and entries
 * 
 * @example
 * ```ts
 * const result = parseDotenv(`
 * # Database config
 * DATABASE_URL=postgres://localhost:5432/db
 * DEBUG=true
 * `)
 * // result.env = { DATABASE_URL: 'postgres://localhost:5432/db', DEBUG: 'true' }
 * // result.order = ['DATABASE_URL', 'DEBUG']
 * ```
 */
export function parseDotenv(content: string): DotenvFile {
  const lines = content.split(/\r?\n/)
  const env: EnvObject = {}
  const order: string[] = []
  const entries: DotenvEntry[] = []
  const rawLines: string[] = []
  const keyLines: Map<string, number[]> = new Map()
  
  let currentComment = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmedLine = line.trim()
    const lineNumber = i + 1
    
    // Preserve raw lines
    rawLines.push(line)
    
    // Empty line
    if (trimmedLine === '') {
      continue
    }
    
    // Comment line or managed block marker
    if (trimmedLine.startsWith('#')) {
      const commentText = trimmedLine.slice(1).trim()
      if (order.length === 0) {
        // Before any variables - this is a leading comment
        currentComment += (currentComment ? '\n' : '') + commentText
      }
      continue
    }
    
    // Variable line
    const eqIndex = trimmedLine.indexOf('=')
    if (eqIndex === -1) {
      // No '=' - treat as empty value
      const key = trimmedLine
      if (key && !key.includes(' ')) {
        // Check for duplicates
        if (keyLines.has(key)) {
          keyLines.get(key)!.push(lineNumber)
          throw new DuplicateKeyError(key, keyLines.get(key)!)
        }
        keyLines.set(key, [lineNumber])
        
        env[key] = ''
        order.push(key)
        entries.push({
          key,
          value: '',
          comment: currentComment || undefined,
          quote: 'none',
          hasExport: false,
          lineNumber
        })
        currentComment = ''
      }
      continue
    }
    
    // Check for export prefix
    let keyPart = trimmedLine.slice(0, eqIndex).trim()
    let hasExport = false
    if (keyPart.startsWith('export ')) {
      hasExport = true
      keyPart = keyPart.slice(7).trim()
    }
    
    const key = keyPart
    let rawValue = trimmedLine.slice(eqIndex + 1)
    let value = rawValue
    let quote: 'single' | 'double' | 'none' = 'none'
    
    // Handle quoted values
    if (rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2) {
      quote = 'double'
      value = rawValue.slice(1, -1)
      // Handle escaped characters in double quotes
      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    } else if (rawValue.startsWith("'") && rawValue.endsWith("'") && rawValue.length >= 2) {
      quote = 'single'
      value = rawValue.slice(1, -1)
      // Handle escaped single quotes in single-quoted values
      value = value.replace(/\\'/g, "'")
    } else {
      // Inline comment (only for unquoted values)
      const commentIndex = value.indexOf(' #')
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim()
      }
    }
    
    // Check for duplicates
    if (keyLines.has(key)) {
      keyLines.get(key)!.push(lineNumber)
      throw new DuplicateKeyError(key, keyLines.get(key)!)
    }
    keyLines.set(key, [lineNumber])
    
    env[key] = value
    order.push(key)
    entries.push({
      key,
      value,
      comment: currentComment || undefined,
      quote,
      hasExport,
      lineNumber
    })
    currentComment = ''
  }
  
  return {
    env,
    order,
    entries,
    rawLines
  }
}

/**
 * Parse a simple key=value string (no comments, no ordering)
 * 
 * @param content - Content to parse
 * @returns Simple env object
 */
export function parseSimple(content: string): EnvObject {
  const result: EnvObject = {}
  const lines = content.split(/\r?\n/)
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      result[key] = value.slice(1, -1)
    } else {
      result[key] = value
    }
  }
  
  return result
}

/**
 * Managed block info
 */
export interface ManagedBlock {
  env: string
  service: string
  entries: DotenvEntry[]
  startIndex: number
  endIndex: number
}

/**
 * Extract a managed block for a specific env and service
 * 
 * @param content - File content
 * @param env - Environment name
 * @param service - Service name
 * @returns Managed block or null if not found
 */
export function extractManagedBlock(
  content: string,
  env: string,
  service: string
): ManagedBlock | null {
  const lines = content.split(/\r?\n/)
  // Support multiple marker formats:
  // - # >>> ge-vault env=dev service=api
  // - # >>> ge-vaultdev service=api (legacy format without space after ge-vault)
  // - # >>> ge-vault dev service=api (with space)
  const startMarkers = [
    `${MANAGED_BLOCK_START} env=${env} service=${service}`,
    `${MANAGED_BLOCK_START}${env} service=${service}`,
    `${MANAGED_BLOCK_START} ${env} service=${service}`,
  ]
  
  let startIndex = -1
  let endIndex = -1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (startMarkers.includes(line)) {
      startIndex = i
    } else if (startIndex !== -1 && line === MANAGED_BLOCK_END) {
      endIndex = i
      break
    }
  }
  
  if (startIndex === -1 || endIndex === -1) {
    return null
  }
  
  // Parse entries between markers
  const entries: DotenvEntry[] = []
  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i]!.trim()
    if (!line || line.startsWith('#')) continue
    
    const eqIndex = line.indexOf('=')
    if (eqIndex !== -1) {
      const key = line.slice(0, eqIndex).trim()
      const rawValue = line.slice(eqIndex + 1)
      let value = rawValue
      let quote: 'single' | 'double' | 'none' = 'none'
      
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        quote = 'double'
        value = rawValue.slice(1, -1)
      } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
        quote = 'single'
        value = rawValue.slice(1, -1)
      }
      
      entries.push({ key, value, quote })
    }
  }
  
  return {
    env,
    service,
    entries,
    startIndex,
    endIndex
  }
}

/**
 * Find all managed blocks in content
 * 
 * @param content - File content
 * @returns Array of managed blocks
 */
export function findAllManagedBlocks(content: string): ManagedBlock[] {
  const blocks: ManagedBlock[] = []
  const lines = content.split(/\r?\n/)
  
  // Match both:
  // - "# >>> ge-vault env=dev service=api" (with space after ge-vault)
  // - "# >>> ge-vaultdev service=api" (without space, env directly appended)
  const startPattern = new RegExp(`^${MANAGED_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*\\S+.*)?$`)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    const match = line.match(startPattern)
    
    if (match) {
      // Parse env and service from the marker
      const params = match[1] || ''
      let env = ''
      let service = ''
      
      // Support formats:
      // - "env=dev service=api"
      // - "dev service=api"
      // - "dev service=api" where dev is directly after ge-vault
      const envMatch = params.match(/(?:env=)?(\w+)/)
      const serviceMatch = params.match(/service=(\w+)/)
      
      if (envMatch) env = envMatch[1]!
      if (serviceMatch) service = serviceMatch[1]!
      
      // Find end marker
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]!.trim() === MANAGED_BLOCK_END) {
          // Parse entries
          const entries: DotenvEntry[] = []
          for (let k = i + 1; k < j; k++) {
            const entryLine = lines[k]!.trim()
            if (!entryLine || entryLine.startsWith('#')) continue
            
            const eqIndex = entryLine.indexOf('=')
            if (eqIndex !== -1) {
              const key = entryLine.slice(0, eqIndex).trim()
              const rawValue = entryLine.slice(eqIndex + 1)
              let value = rawValue
              let quote: 'single' | 'double' | 'none' = 'none'
              
              if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
                quote = 'double'
                value = rawValue.slice(1, -1)
              } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
                quote = 'single'
                value = rawValue.slice(1, -1)
              }
              
              entries.push({ key, value, quote })
            }
          }
          
          blocks.push({
            env,
            service,
            entries,
            startIndex: i,
            endIndex: j
          })
          
          i = j
          break
        }
      }
    }
  }
  
  return blocks
}

/**
 * Get all keys from a parsed file
 * 
 * @param file - Parsed file
 * @returns Array of keys
 */
export function getKeys(file: DotenvFile): string[] {
  return file.entries.map(e => e.key)
}

/**
 * Check if a key exists in the file
 * 
 * @param file - Parsed file
 * @param key - Key to check
 * @returns True if key exists
 */
export function hasKey(file: DotenvFile, key: string): boolean {
  return file.entries.some(e => e.key === key)
}

/**
 * Get value for a key
 * 
 * @param file - Parsed file
 * @param key - Key to look up
 * @returns Value or undefined
 */
export function getValue(file: DotenvFile, key: string): string | undefined {
  const entry = file.entries.find(e => e.key === key)
  return entry?.value
}

/**
 * Get entry for a key
 * 
 * @param file - Parsed file
 * @param key - Key to look up
 * @returns Entry or undefined
 */
export function getEntry(file: DotenvFile, key: string): DotenvEntry | undefined {
  return file.entries.find(e => e.key === key)
}
