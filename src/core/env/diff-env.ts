import { EnvObject, DiffResult } from '../types/index.js'

export interface DiffOptions {
  showValues?: boolean
}

export interface DetailedDiffResult extends DiffResult {
  details: {
    added: Array<{ key: string; value: string }>
    removed: Array<{ key: string; oldValue: string }>
    changed: Array<{ key: string; oldValue: string; newValue: string }>
  }
}

/**
 * Compare two EnvObjects and compute diff
 */
export function diffEnv(oldEnv: EnvObject, newEnv: EnvObject): DetailedDiffResult {
  const oldKeys = new Set(Object.keys(oldEnv))
  const newKeys = new Set(Object.keys(newEnv))

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  const addedDetails: Array<{ key: string; value: string }> = []
  const removedDetails: Array<{ key: string; oldValue: string }> = []
  const changedDetails: Array<{
    key: string
    oldValue: string
    newValue: string
  }> = []

  // Find added and changed
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key)
      addedDetails.push({ key, value: newEnv[key]! })
    } else if (oldEnv[key] !== newEnv[key]) {
      changed.push(key)
      changedDetails.push({
        key,
        oldValue: oldEnv[key]!,
        newValue: newEnv[key]!,
      })
    }
  }

  // Find removed
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key)
      removedDetails.push({ key, oldValue: oldEnv[key]! })
    }
  }

  return {
    added,
    removed,
    changed,
    details: {
      added: addedDetails,
      removed: removedDetails,
      changed: changedDetails,
    },
  }
}

/**
 * Format diff for display (safe - no values shown)
 */
export function formatSafeDiff(diff: DetailedDiffResult): string {
  const lines: string[] = []

  if (diff.added.length > 0) {
    lines.push('Added:')
    for (const key of diff.added) {
      lines.push(`  + ${key}`)
    }
  }

  if (diff.removed.length > 0) {
    lines.push('Removed:')
    for (const key of diff.removed) {
      lines.push(`  - ${key}`)
    }
  }

  if (diff.changed.length > 0) {
    lines.push('Changed:')
    for (const key of diff.changed) {
      lines.push(`  ~ ${key}`)
    }
  }

  if (lines.length === 0) {
    lines.push('No changes')
  }

  return lines.join('\n')
}

/**
 * Format diff with values (unsafe - for explicit --unsafe-show-values)
 */
export function formatUnsafeDiff(diff: DetailedDiffResult): string {
  const lines: string[] = []

  if (diff.details.added.length > 0) {
    lines.push('Added:')
    for (const item of diff.details.added) {
      lines.push(`  + ${item.key}=${item.value}`)
    }
  }

  if (diff.details.removed.length > 0) {
    lines.push('Removed:')
    for (const item of diff.details.removed) {
      lines.push(`  - ${item.key}=${item.oldValue}`)
    }
  }

  if (diff.details.changed.length > 0) {
    lines.push('Changed:')
    for (const item of diff.details.changed) {
      lines.push(`  - ${item.key}=${item.oldValue}`)
      lines.push(`  + ${item.key}=${item.newValue}`)
    }
  }

  if (lines.length === 0) {
    lines.push('No changes')
  }

  return lines.join('\n')
}
