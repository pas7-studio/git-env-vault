/**
 * Environment variable diff utilities
 * @module gev:core/env/diff-env
 * 
 * Provides safe and unsafe diff visualization for environment variables.
 * Safe diff only shows key names, unsafe includes values.
 */

import type { EnvObject, DiffResult, DiffResultWithValues, DiffFormatOptions, DotenvEntry } from './types.js'

/**
 * Compute the diff between two environment objects
 * 
 * @param oldEnv - Original environment variables
 * @param newEnv - New environment variables
 * @returns Diff result with added, removed, changed, and unchanged keys
 * 
 * @example
 * ```ts
 * const diff = diffEnv(
 *   { DATABASE_URL: 'old', DEBUG: 'true' },
 *   { DATABASE_URL: 'new', API_KEY: 'secret' }
 * )
 * // diff.added = ['API_KEY']
 * // diff.removed = ['DEBUG']
 * // diff.changed = ['DATABASE_URL']
 * // diff.unchanged = []
 * ```
 */
export function diffEnv(oldEnv: EnvObject, newEnv: EnvObject): DiffResult {
  const oldKeys = new Set(Object.keys(oldEnv))
  const newKeys = new Set(Object.keys(newEnv))
  
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  const unchanged: string[] = []
  
  // Find added and changed keys
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key)
    } else if (oldEnv[key] !== newEnv[key]) {
      changed.push(key)
    } else {
      unchanged.push(key)
    }
  }
  
  // Find removed keys
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key)
    }
  }
  
  // Sort for consistent output
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort()
  }
}

/**
 * Compute diff with values (for unsafe display)
 * 
 * @param oldEnv - Original environment variables
 * @param newEnv - New environment variables
 * @returns Diff result with values included
 */
export function diffEnvWithValues(
  oldEnv: EnvObject, 
  newEnv: EnvObject
): DiffResultWithValues {
  const diff = diffEnv(oldEnv, newEnv)
  
  const oldValues: Record<string, string> = {}
  const newValues: Record<string, string> = {}
  
  for (const key of diff.changed) {
    oldValues[key] = oldEnv[key]!
    newValues[key] = newEnv[key]!
  }
  
  return {
    ...diff,
    oldValues,
    newValues
  }
}

/**
 * Format diff for safe display (without values)
 * 
 * @param diff - Diff result
 * @param options - Format options
 * @returns Formatted string
 */
export function formatSafeDiff(
  diff: DiffResult, 
  options: DiffFormatOptions = {}
): string {
  const { colorize = false, indent = '' } = options
  
  const lines: string[] = []
  const green = colorize ? '\x1b[32m' : ''
  const red = colorize ? '\x1b[31m' : ''
  const yellow = colorize ? '\x1b[33m' : ''
  const reset = colorize ? '\x1b[0m' : ''
  
  if (diff.added.length > 0) {
    lines.push(`${indent}${green}+ Added:${reset}`)
    for (const key of diff.added) {
      lines.push(`${indent}  ${green}+ ${key}${reset}`)
    }
  }
  
  if (diff.removed.length > 0) {
    lines.push(`${indent}${red}- Removed:${reset}`)
    for (const key of diff.removed) {
      lines.push(`${indent}  ${red}- ${key}${reset}`)
    }
  }
  
  if (diff.changed.length > 0) {
    lines.push(`${indent}${yellow}~ Changed:${reset}`)
    for (const key of diff.changed) {
      lines.push(`${indent}  ${yellow}~ ${key}${reset}`)
    }
  }
  
  if (diff.unchanged.length > 0) {
    lines.push(`${indent}  Unchanged: ${diff.unchanged.length} keys`)
  }
  
  return lines.join('\n')
}

/**
 * Format diff with values (for unsafe display)
 * 
 * @param diff - Diff result with values
 * @param oldEnv - Original environment (for added keys)
 * @param newEnv - New environment (for removed keys)
 * @param options - Format options
 * @returns Formatted string with values
 */
export function formatUnsafeDiff(
  diff: DiffResult,
  oldEnv: EnvObject,
  newEnv: EnvObject,
  options: DiffFormatOptions = {}
): string {
  const { colorize = false, indent = '' } = options
  
  const lines: string[] = []
  const green = colorize ? '\x1b[32m' : ''
  const red = colorize ? '\x1b[31m' : ''
  const yellow = colorize ? '\x1b[33m' : ''
  const reset = colorize ? '\x1b[0m' : ''
  
  if (diff.added.length > 0) {
    lines.push(`${indent}${green}+ Added:${reset}`)
    for (const key of diff.added) {
      lines.push(`${indent}  ${green}+ ${key}="${newEnv[key]}"${reset}`)
    }
  }
  
  if (diff.removed.length > 0) {
    lines.push(`${indent}${red}- Removed:${reset}`)
    for (const key of diff.removed) {
      lines.push(`${indent}  ${red}- ${key}="${oldEnv[key]}"${reset}`)
    }
  }
  
  if (diff.changed.length > 0) {
    lines.push(`${indent}${yellow}~ Changed:${reset}`)
    for (const key of diff.changed) {
      lines.push(`${indent}  ${yellow}~ ${key}:${reset}`)
      lines.push(`${indent}    ${red}- "${oldEnv[key]}"${reset}`)
      lines.push(`${indent}    ${green}+ "${newEnv[key]}"${reset}`)
    }
  }
  
  if (diff.unchanged.length > 0) {
    lines.push(`${indent}  Unchanged: ${diff.unchanged.length} keys`)
  }
  
  return lines.join('\n')
}

/**
 * Diff two arrays of DotenvEntry (for file comparison)
 * Alias for diffEnvEntries
 * 
 * @param oldEntries - Original entries
 * @param newEntries - New entries
 * @returns Diff result
 */
export function diffSecretsFiles(
  oldEntries: DotenvEntry[],
  newEntries: DotenvEntry[]
): DiffResult {
  return diffEnvEntries(oldEntries, newEntries)
}

/**
 * Diff two arrays of DotenvEntry
 * 
 * @param oldEntries - Original entries
 * @param newEntries - New entries
 * @returns Diff result
 */
export function diffEnvEntries(
  oldEntries: DotenvEntry[],
  newEntries: DotenvEntry[]
): DiffResult {
  const oldEnv: EnvObject = {}
  const newEnv: EnvObject = {}
  
  for (const entry of oldEntries) {
    oldEnv[entry.key] = entry.value
  }
  
  for (const entry of newEntries) {
    newEnv[entry.key] = entry.value
  }
  
  return diffEnv(oldEnv, newEnv)
}

/**
 * Check if there are any changes in the diff
 * 
 * @param diff - Diff result
 * @returns True if there are changes
 */
export function hasChanges(diff: DiffResult): boolean {
  return diff.added.length > 0 || 
         diff.removed.length > 0 || 
         diff.changed.length > 0
}

/**
 * Format diff summary with options
 *
 * @param diff - Diff result
 * @param options - Format options
 * @returns Formatted summary
 */
export function formatDiffSummaryWithOptions(
  diff: DiffResult,
  options: DiffFormatOptions = {}
): string {
  const { colorize = false, indent = '', showUnchanged = false, compact = false } = options
  
  // Handle empty diff
  if (!hasChanges(diff) && diff.unchanged.length === 0) {
    return 'No changes detected.'
  }
  
  // Handle only unchanged keys
  if (!hasChanges(diff)) {
    if (showUnchanged) {
      const lines: string[] = []
      lines.push(`Unchanged (${diff.unchanged.length}):`)
      for (const key of diff.unchanged) {
        lines.push(`  = ${key}`)
      }
      return lines.join('\n')
    }
    return 'No changes detected.'
  }
  
  const lines: string[] = []
  const green = colorize ? '\x1b[32m' : ''
  const red = colorize ? '\x1b[31m' : ''
  const yellow = colorize ? '\x1b[33m' : ''
  const reset = colorize ? '\x1b[0m' : ''
  
  if (compact) {
    // Compact mode: show counts only
    if (diff.added.length > 0) {
      lines.push(`${indent}${green}+ [${diff.added.length}]${reset}`)
    }
    if (diff.removed.length > 0) {
      lines.push(`${indent}${red}- [${diff.removed.length}]${reset}`)
    }
    if (diff.changed.length > 0) {
      lines.push(`${indent}${yellow}~ [${diff.changed.length}]${reset}`)
    }
  } else {
    // Detailed mode
    if (diff.added.length > 0) {
      lines.push(`${indent}${green}Added (${diff.added.length}):${reset}`)
      for (const key of diff.added) {
        lines.push(`${indent}  ${green}+ ${key}${reset}`)
      }
    }
    
    if (diff.removed.length > 0) {
      lines.push(`${indent}${red}Removed (${diff.removed.length}):${reset}`)
      for (const key of diff.removed) {
        lines.push(`${indent}  ${red}- ${key}${reset}`)
      }
    }
    
    if (diff.changed.length > 0) {
      lines.push(`${indent}${yellow}Changed (${diff.changed.length}):${reset}`)
      for (const key of diff.changed) {
        lines.push(`${indent}  ${yellow}~ ${key}${reset}`)
      }
    }
  }
  
  if (showUnchanged && diff.unchanged.length > 0) {
    lines.push(`${indent}Unchanged (${diff.unchanged.length}):`)
    for (const key of diff.unchanged) {
      lines.push(`${indent}  = ${key}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * Get summary statistics from diff
 * 
 * @param diff - Diff result
 * @returns Summary string
 */
export function getDiffSummary(diff: DiffResult): string {
  const parts: string[] = []
  
  if (diff.added.length > 0) {
    parts.push(`+${diff.added.length}`)
  }
  if (diff.removed.length > 0) {
    parts.push(`-${diff.removed.length}`)
  }
  if (diff.changed.length > 0) {
    parts.push(`~${diff.changed.length}`)
  }
  
  return parts.length > 0 ? parts.join(' ') : 'No changes'
}

/**
 * Merge two arrays of DotenvEntry, with later entries taking precedence
 * Used for applying local overrides to shared secrets
 * 
 * @param base - Base entries
 * @param override - Override entries (take precedence)
 * @returns Merged entries sorted alphabetically
 */
export function mergeEnvEntries(
  base: DotenvEntry[],
  override: DotenvEntry[]
): DotenvEntry[] {
  const baseMap = new Map<string, DotenvEntry>()
  
  // Add base entries
  for (const entry of base) {
    baseMap.set(entry.key, entry)
  }
  
  // Apply overrides, preserving comment from base if overlay has none
  for (const entry of override) {
    const existing = baseMap.get(entry.key)
    if (existing && !entry.comment && existing.comment) {
      baseMap.set(entry.key, { ...entry, comment: existing.comment })
    } else {
      baseMap.set(entry.key, entry)
    }
  }
  
  // Return as array sorted alphabetically
  return Array.from(baseMap.values()).sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Format diff summary (detailed format)
 *
 * @param diff - Diff result
 * @returns Formatted summary
 */
export function formatDiffSummary(diff: DiffResult): string {
  // Always show unchanged if there are no other changes
  if (!hasChanges(diff)) {
    if (diff.unchanged.length > 0) {
      const lines: string[] = []
      lines.push(`Unchanged (${diff.unchanged.length}):`)
      for (const key of diff.unchanged) {
        lines.push(`  = ${key}`)
      }
      return lines.join('\n')
    }
    return 'No changes detected.'
  }
  
  const lines: string[] = []
  
  if (diff.added.length > 0) {
    lines.push(`Added (${diff.added.length}):`)
    for (const key of diff.added) {
      lines.push(`  + ${key}`)
    }
  }
  
  if (diff.removed.length > 0) {
    lines.push(`Removed (${diff.removed.length}):`)
    for (const key of diff.removed) {
      lines.push(`  - ${key}`)
    }
  }
  
  if (diff.changed.length > 0) {
    lines.push(`Changed (${diff.changed.length}):`)
    for (const key of diff.changed) {
      lines.push(`  ~ ${key}`)
    }
  }
  
  if (diff.unchanged.length > 0) {
    lines.push(`Unchanged (${diff.unchanged.length}):`)
    for (const key of diff.unchanged) {
      lines.push(`  = ${key}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * Get change count from diff
 * 
 * @param diff - Diff result
 * @returns Change counts
 */
export function getChangeCount(diff: DiffResult): { total: number; added: number; removed: number; changed: number } {
  return {
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
    total: diff.added.length + diff.removed.length + diff.changed.length
  }
}

/**
 * Get all changed keys from two entry arrays
 * 
 * @param oldEntries - Original entries
 * @param newEntries - New entries
 * @returns Array of changed keys
 */
export function getChangedKeys(oldEntries: DotenvEntry[], newEntries: DotenvEntry[]): string[] {
  const diff = diffEnvEntries(oldEntries, newEntries)
  return [...diff.added, ...diff.removed, ...diff.changed].sort()
}

/**
 * Filter entries to only include specified keys
 * 
 * @param entries - Entries to filter
 * @param keys - Keys to include
 * @returns Filtered entries
 */
export function filterEntriesByKeys(entries: DotenvEntry[], keys: string[]): DotenvEntry[] {
  const keySet = new Set(keys)
  return entries.filter(e => keySet.has(e.key))
}

/**
 * Get entries that are unique to the first array (not in second)
 * 
 * @param entries - Entries to check
 * @param compareWith - Entries to compare against
 * @returns Unique entries
 */
export function getUniqueEntries(entries: DotenvEntry[], compareWith: DotenvEntry[]): DotenvEntry[] {
  const compareKeys = new Set(compareWith.map(e => e.key))
  return entries.filter(e => !compareKeys.has(e.key))
}

/**
 * Create a safe one-line diff summary
 * 
 * @param diff - Diff result
 * @returns One-line summary
 */
export function createSafeDiffSummary(diff: DiffResult): string {
  const parts: string[] = []
  
  if (diff.added.length > 0) {
    parts.push(`${diff.added.length} added`)
  }
  if (diff.removed.length > 0) {
    parts.push(`${diff.removed.length} removed`)
  }
  if (diff.changed.length > 0) {
    parts.push(`${diff.changed.length} changed`)
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No changes'
}

/**
 * Get one-line summary
 * 
 * @param diff - Diff result
 * @returns One-line summary
 */
export function getOneLineSummary(diff: DiffResult): string {
  const total = diff.added.length + diff.removed.length + diff.changed.length
  
  if (total === 0) {
    return 'No changes'
  }
  
  return `${total} changes: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`
}
/**
 * Format diff as markdown
 *
 * @param diff - Diff result
 * @returns Markdown formatted string
 */
export function formatDiffAsMarkdown(diff: DiffResult): string {
  if (!hasChanges(diff)) {
    return '## Environment Changes\n\nNo changes detected.'
  }
  
  const lines: string[] = ['## Environment Changes', '']
  
  if (diff.added.length > 0) {
    lines.push('### Added')
    lines.push('')
    for (const key of diff.added) {
      lines.push(`- \`${key}\``)
    }
    lines.push('')
  }
  
  if (diff.removed.length > 0) {
    lines.push('### Removed')
    lines.push('')
    for (const key of diff.removed) {
      lines.push(`- \`${key}\``)
    }
    lines.push('')
  }
  
  if (diff.changed.length > 0) {
    lines.push('### Changed')
    lines.push('')
    for (const key of diff.changed) {
      lines.push(`- \`${key}\``)
    }
    lines.push('')
  }
  
  return lines.join('\n').trim()
}
