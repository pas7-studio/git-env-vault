/**
 * Dotenv file renderer
 * @module gev:core/env/render-dotenv
 * 
 * Renders environment variables to .env file format
 */

import type { DotenvEntry, EnvObject, RenderOptions, DotenvFile } from './types.js'
import { MANAGED_BLOCK_START, MANAGED_BLOCK_END, extractManagedBlock } from './parse-dotenv.js'

/**
 * Render a single dotenv entry to string
 * 
 * @param entry - Entry to render
 * @returns Formatted entry string
 */
export function renderEntry(entry: DotenvEntry): string {
  const { key, value, quote, hasExport } = entry
  
  let renderedValue: string
  if (quote === 'double' || (quote === undefined && needsQuoting(value))) {
    renderedValue = `"${escapeForDoubleQuotes(value)}"`
  } else if (quote === 'single') {
    renderedValue = `'${value}'`
  } else if (quote === 'none' || quote === undefined) {
    // Auto-quote if needed
    if (needsQuoting(value)) {
      renderedValue = `"${escapeForDoubleQuotes(value)}"`
    } else {
      renderedValue = value
    }
  } else {
    renderedValue = value
  }
  
  const prefix = hasExport ? 'export ' : ''
  return `${prefix}${key}=${renderedValue}`
}

/**
 * Check if a value needs quoting
 */
function needsQuoting(value: string): boolean {
  return (
    value.includes(' ') ||
    value.includes('#') ||
    value.includes('=') ||
    value.includes('\n') ||
    value.includes('\t') ||
    value.includes('"') ||
    value.includes("'")
  )
}

/**
 * Escape value for double quotes
 */
function escapeForDoubleQuotes(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
}

/**
 * Type guard to check if data is a DotenvFile
 */
function isDotenvFile(data: unknown): data is DotenvFile {
  return typeof data === 'object' && data !== null &&
    'entries' in data && 'rawLines' in data
}

/**
 * Render an env object to .env file content
 *
 * @param data - Environment variables as key-value pairs or DotenvFile
 * @param options - Render options
 * @returns Formatted .env content
 *
 * @example
 * ```ts
 * const content = renderDotenv({ DATABASE_URL: 'postgres://...', DEBUG: 'true' })
 * // DATABASE_URL=postgres://...
 * // DEBUG=true
 * ```
 */
export function renderDotenv(data: EnvObject | DotenvFile, options: RenderOptions = {}): string {
  // Handle DotenvFile format
  if (isDotenvFile(data)) {
    return renderDotenvFile(data, options)
  }
  
  const envData = data as EnvObject
  const { order, header, includeComments = false } = options
  const lines: string[] = []
  
  // Add header if provided
  if (header) {
    lines.push('# ' + header)
    lines.push('')
  }
  
  // Get keys in the specified order or use object keys
  const keys = order ?? Object.keys(envData)
  
  for (const key of keys) {
    if (key in envData) {
      const value = envData[key]
      // Handle non-string values gracefully
      const strValue = value === null || value === undefined ? '' : String(value)
      lines.push(`${key}=${escapeValue(strValue)}`)
    }
  }
  
  // Add any keys not in the order list
  const remainingKeys = Object.keys(envData).filter(k => !keys.includes(k))
  for (const key of remainingKeys) {
    lines.push(`${key}=${escapeValue(envData[key]!)}`)
  }
  
  return lines.join('\n') + '\n'
}

/**
 * Render a DotenvFile to string
 */
function renderDotenvFile(file: DotenvFile, options: RenderOptions = {}): string {
  const { header } = options
  const lines: string[] = []
  
  // Add header if provided
  if (header) {
    lines.push('# ' + header)
    lines.push('')
  }
  
  for (const entry of file.entries) {
    // Add comment if present
    if (entry.comment) {
      const commentLines = entry.comment.split('\n')
      for (const commentLine of commentLines) {
        lines.push('# ' + commentLine)
      }
    }
    
    lines.push(renderEntry(entry))
  }
  
  // Add raw lines that aren't already rendered (like managed block markers)
  const renderedKeys = new Set(file.entries.map(e => e.key))
  for (const line of file.rawLines) {
    const trimmed = line.trim()
    // Include managed block markers and comments not associated with entries
    if (trimmed.startsWith(MANAGED_BLOCK_START) || trimmed === MANAGED_BLOCK_END) {
      lines.push(line)
    }
  }
  
  return lines.join('\n') + (lines.length > 0 ? '\n' : '')
}

/**
 * Escape a value for .env format
 * 
 * @param value - Value to escape
 * @returns Escaped value
 */
function escapeValue(value: string): string {
  // If empty, just return empty
  if (value === '') return ''
  
  // Check if we need to quote
  const needsQuoting = 
    value.includes(' ') ||
    value.includes('#') ||
    value.includes('=') ||
    value.includes('\n') ||
    value.includes('\t') ||
    value.includes('"') ||
    value.includes("'")
  
  if (!needsQuoting) {
    return value
  }
  
  // Use double quotes and escape special characters
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  
  return `"${escaped}"`
}

/**
 * Render DotenvEntry array to .env file content
 * Preserves comments and order from entries
 * 
 * @param entries - Array of dotenv entries
 * @param options - Render options
 * @returns Formatted .env content
 */
export function renderEntries(entries: DotenvEntry[], options: RenderOptions = {}): string {
  const { header } = options
  const lines: string[] = []
  
  // Add header if provided
  if (header) {
    lines.push('# ' + header)
    lines.push('')
  }
  
  for (const entry of entries) {
    // Add comment if present
    if (entry.comment) {
      const commentLines = entry.comment.split('\n')
      for (const commentLine of commentLines) {
        lines.push('# ' + commentLine)
      }
    }
    
    lines.push(`${entry.key}=${escapeValue(entry.value)}`)
  }
  
  return lines.join('\n') + '\n'
}

/**
 * Render DotenvEntry array to simple .env content (without comments)
 * 
 * @param entries - Array of dotenv entries
 * @returns Simple .env content
 */
export function renderEntriesSimple(entries: DotenvEntry[]): string {
  const lines: string[] = []
  
  // Sort entries alphabetically
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key))
  
  for (const entry of sorted) {
    lines.push(`${entry.key}=${escapeValue(entry.value)}`)
  }
  
  return lines.join('\n') + (lines.length > 0 ? '\n' : '')
}

/**
 * Create a DotenvEntry from key-value pair
 * 
 * @param key - Variable name
 * @param value - Variable value
 * @param commentOrOptions - Optional comment or options object
 * @returns DotenvEntry object
 */
export function createEntry(
  key: string,
  value: string,
  commentOrOptions?: string | { comment?: string; hasExport?: boolean; quote?: 'single' | 'double' | 'none' }
): DotenvEntry {
  if (typeof commentOrOptions === 'string') {
    return { key, value, comment: commentOrOptions, quote: 'none', hasExport: false }
  }
  
  return {
    key,
    value,
    comment: commentOrOptions?.comment,
    hasExport: commentOrOptions?.hasExport ?? false,
    quote: commentOrOptions?.quote ?? 'none'
  }
}

/**
 * Update entry value
 * 
 * @param entry - Entry to update
 * @param newValue - New value
 * @returns Updated entry
 */
export function updateEntryValue(entry: DotenvEntry, newValue: string): DotenvEntry {
  let newQuote = entry.quote
  
  // If the new value needs quoting and wasn't quoted before, add double quotes
  if ((!entry.quote || entry.quote === 'none') && needsQuoting(newValue)) {
    newQuote = 'double'
  }
  
  return {
    ...entry,
    value: newValue,
    quote: newQuote
  }
}

/**
 * Render a managed block
 * 
 * @param env - Environment name
 * @param service - Service name
 * @param entries - Entries to include in block
 * @returns Rendered managed block
 */
export function renderManagedBlock(
  env: string,
  service: string,
  entries: DotenvEntry[]
): string {
  const lines: string[] = []
  
  lines.push(`${MANAGED_BLOCK_START} env=${env} service=${service}`)
  
  // Sort entries alphabetically
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key))
  
  for (const entry of sorted) {
    lines.push(renderEntry(entry))
  }
  
  lines.push(MANAGED_BLOCK_END)
  
  return lines.join('\n') + '\n'
}

/**
 * Insert a managed block into content
 * 
 * @param content - Original content
 * @param env - Environment name
 * @param service - Service name
 * @param entries - Entries to include
 * @param options - Options including position
 * @returns Content with managed block inserted or updated
 */
export function insertManagedBlock(
  content: string,
  env: string,
  service: string,
  entries: DotenvEntry[],
  options: RenderOptions = {}
): string {
  const { position = 'bottom' } = options
  
  // Check if block already exists
  const existingBlock = extractManagedBlock(content, env, service)
  
  if (existingBlock) {
    // Replace existing block
    const lines = content.split(/\r?\n/)
    const before = lines.slice(0, existingBlock.startIndex).join('\n')
    const after = lines.slice(existingBlock.endIndex + 1).join('\n')
    
    const newBlock = renderManagedBlock(env, service, entries)
    
    // Normalize line endings
    const normalizedBefore = before ? before + '\n' : ''
    const normalizedAfter = after ? '\n' + after : ''
    
    return normalizedBefore + newBlock.trimEnd() + normalizedAfter
  }
  
  // Insert new block
  const newBlock = renderManagedBlock(env, service, entries)
  
  if (position === 'top') {
    return newBlock + content
  }
  
  // Bottom position
  if (!content || content.trim() === '') {
    return newBlock
  }
  
  return content.trimEnd() + '\n\n' + newBlock
}

/**
 * Remove a managed block from content
 * 
 * @param content - Original content
 * @param env - Environment name
 * @param service - Service name
 * @returns Content with managed block removed
 */
export function removeManagedBlock(
  content: string,
  env: string,
  service: string
): string {
  const block = extractManagedBlock(content, env, service)
  
  if (!block) {
    return content
  }
  
  const lines = content.split(/\r?\n/)
  const before = lines.slice(0, block.startIndex)
  const after = lines.slice(block.endIndex + 1)
  
  // Combine and clean up extra empty lines
  const result = [...before, ...after].join('\n')
  
  // Remove multiple consecutive empty lines
  return result.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/**
 * Unescape a value from .env format
 * 
 * @param value - Escaped value
 * @returns Unescaped value
 */
export function unescapeValue(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value
  }
  
  return value
    .slice(1, -1)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}
