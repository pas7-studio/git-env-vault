import { EnvObject, DiffResult } from '../types/index.js'

/**
 * Compute the diff between two env objects
 */
export function diffEnv(oldEnv: EnvObject, newEnv: EnvObject): DiffResult {
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  
  const oldKeys = new Set(Object.keys(oldEnv))
  const newKeys = new Set(Object.keys(newEnv))
  
  // Find added keys
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key)
    }
  }
  
  // Find removed keys
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key)
    }
  }
  
  // Find changed keys
  for (const key of oldKeys) {
    if (newKeys.has(key) && oldEnv[key] !== newEnv[key]) {
      changed.push(key)
    }
  }
  
  return { added, removed, changed }
}

/**
 * Format a safe diff that doesn't expose values
 * Shows only key names and type of change
 */
export function formatSafeDiff(diff: DiffResult): string {
  const lines: string[] = []
  
  if (diff.added.length > 0) {
    lines.push('  Added:')
    for (const key of diff.added) {
      lines.push(`    + ${key}`)
    }
  }
  
  if (diff.removed.length > 0) {
    lines.push('  Removed:')
    for (const key of diff.removed) {
      lines.push(`    - ${key}`)
    }
  }
  
  if (diff.changed.length > 0) {
    lines.push('  Changed:')
    for (const key of diff.changed) {
      lines.push(`    ~ ${key}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * Format an unsafe diff that shows values
 * WARNING: This exposes secret values - use with caution
 */
export function formatUnsafeDiff(
  diff: DiffResult,
  oldEnv: EnvObject,
  newEnv: EnvObject
): string {
  const lines: string[] = []
  
  if (diff.added.length > 0) {
    lines.push('  Added:')
    for (const key of diff.added) {
      lines.push(`    + ${key}=${maskValue(newEnv[key]!)}`)
    }
  }
  
  if (diff.removed.length > 0) {
    lines.push('  Removed:')
    for (const key of diff.removed) {
      lines.push(`    - ${key}=${maskValue(oldEnv[key]!)}`)
    }
  }
  
  if (diff.changed.length > 0) {
    lines.push('  Changed:')
    for (const key of diff.changed) {
      lines.push(`    ~ ${key}:`)
      lines.push(`        - ${maskValue(oldEnv[key]!)}`)
      lines.push(`        + ${maskValue(newEnv[key]!)}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * Mask a value for safe display
 * Shows first 2 and last 2 characters, masks the rest
 */
function maskValue(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length)
  }
  
  const start = value.slice(0, 2)
  const end = value.slice(-2)
  const middle = '*'.repeat(Math.min(value.length - 4, 8))
  
  return `${start}${middle}${end}`
}
