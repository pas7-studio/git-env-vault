/**
 * Diff engine for .env entries - compares keys without exposing values
 *
 * @module gev:core/env/diff-env
 *
 * SECURITY: This module NEVER includes values in diff output to prevent secret leakage
 */

import { DotenvEntry, DiffResult } from './types.js';

/**
 * Compare two sets of environment entries
 *
 * IMPORTANT: Only compares keys, never exposes values in the result
 *
 * @param oldEntries - Old/original entries
 * @param newEntries - New/updated entries
 * @returns DiffResult with key changes only (no values)
 */
export function diffEnvEntries(
  oldEntries: DotenvEntry[],
  newEntries: DotenvEntry[]
): DiffResult {
  const oldMap = new Map<string, DotenvEntry>();
  const newMap = new Map<string, DotenvEntry>();

  // Build maps for O(1) lookup
  for (const entry of oldEntries) {
    oldMap.set(entry.key, entry);
  }

  for (const entry of newEntries) {
    newMap.set(entry.key, entry);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  // Find added and changed keys
  for (const [key, newEntry] of newMap) {
    const oldEntry = oldMap.get(key);
    if (!oldEntry) {
      added.push(key);
    } else if (oldEntry.value !== newEntry.value) {
      changed.push(key);
    } else {
      unchanged.push(key);
    }
  }

  // Find removed keys
  for (const key of oldMap.keys()) {
    if (!newMap.has(key)) {
      removed.push(key);
    }
  }

  // Sort all arrays for deterministic output
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort(),
  };
}

/**
 * Format a diff result for display
 *
 * SECURITY: Never includes values, only shows key names and change types
 *
 * @param diff - DiffResult to format
 * @returns Formatted string for display
 */
export function formatDiffSummary(diff: DiffResult): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push(`Added (${diff.added.length}):`);
    for (const key of diff.added) {
      lines.push(`  + ${key}`);
    }
  }

  if (diff.removed.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Removed (${diff.removed.length}):`);
    for (const key of diff.removed) {
      lines.push(`  - ${key}`);
    }
  }

  if (diff.changed.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Changed (${diff.changed.length}):`);
    for (const key of diff.changed) {
      lines.push(`  ~ ${key}`);
    }
  }

  if (diff.unchanged.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Unchanged (${diff.unchanged.length}):`);
    for (const key of diff.unchanged) {
      lines.push(`  = ${key}`);
    }
  }

  if (lines.length === 0) {
    lines.push('No changes detected.');
  }

  return lines.join('\n');
}

/**
 * Check if a diff result has any changes
 *
 * @param diff - DiffResult to check
 * @returns true if there are any changes
 */
export function hasChanges(diff: DiffResult): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
}

/**
 * Get a summary count of changes
 *
 * @param diff - DiffResult to summarize
 * @returns Object with change counts
 */
export function getChangeCount(diff: DiffResult): {
  total: number;
  added: number;
  removed: number;
  changed: number;
} {
  return {
    total: diff.added.length + diff.removed.length + diff.changed.length,
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
  };
}

/**
 * Merge two sets of entries, with overlay taking precedence
 *
 * This is useful for local overrides where local values should
 * take precedence over base values.
 *
 * @param base - Base entries
 * @param overlay - Overlay entries (take precedence)
 * @returns Merged entries
 */
export function mergeEnvEntries(
  base: DotenvEntry[],
  overlay: DotenvEntry[]
): DotenvEntry[] {
  const resultMap = new Map<string, DotenvEntry>();

  // Add base entries first
  for (const entry of base) {
    resultMap.set(entry.key, entry);
  }

  // Overlay entries take precedence
  for (const entry of overlay) {
    const existing = resultMap.get(entry.key);
    if (existing) {
      // Merge: keep comment from base if overlay doesn't have one
      const merged: DotenvEntry = {
        ...existing,
        value: entry.value,
      };
      // Use overlay's quote preference if specified, otherwise keep existing
      if (entry.quote !== undefined) {
        merged.quote = entry.quote;
      }
      if (entry.hasExport !== undefined) {
        merged.hasExport = entry.hasExport;
      }
      resultMap.set(entry.key, merged);
    } else {
      resultMap.set(entry.key, entry);
    }
  }

  // Return in sorted order for deterministic output
  return Array.from(resultMap.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );
}

/**
 * Get only the keys that differ between two entry sets
 *
 * @param oldEntries - Old entries
 * @param newEntries - New entries
 * @returns Array of keys that are different
 */
export function getChangedKeys(
  oldEntries: DotenvEntry[],
  newEntries: DotenvEntry[]
): string[] {
  const diff = diffEnvEntries(oldEntries, newEntries);
  return [...diff.added, ...diff.removed, ...diff.changed].sort();
}

/**
 * Filter entries to only include specified keys
 *
 * @param entries - Entries to filter
 * @param keys - Keys to include
 * @returns Filtered entries
 */
export function filterEntriesByKeys(
  entries: DotenvEntry[],
  keys: string[]
): DotenvEntry[] {
  const keySet = new Set(keys);
  return entries.filter((entry) => keySet.has(entry.key));
}

/**
 * Get entries that exist in one set but not another
 *
 * @param entries - Entries to check
 * @param compareWith - Entries to compare against
 * @returns Entries that don't exist in compareWith
 */
export function getUniqueEntries(
  entries: DotenvEntry[],
  compareWith: DotenvEntry[]
): DotenvEntry[] {
  const compareKeys = new Set(compareWith.map((e) => e.key));
  return entries.filter((entry) => !compareKeys.has(entry.key));
}

/**
 * Create a diff summary for logging (safe to log - no secrets)
 *
 * @param diff - DiffResult to summarize
 * @returns Short summary string
 */
export function createSafeDiffSummary(diff: DiffResult): string {
  const counts = getChangeCount(diff);
  if (counts.total === 0) {
    return 'No changes';
  }

  const parts: string[] = [];
  if (counts.added > 0) parts.push(`${counts.added} added`);
  if (counts.removed > 0) parts.push(`${counts.removed} removed`);
  if (counts.changed > 0) parts.push(`${counts.changed} changed`);

  return parts.join(', ');
}

/**
 * Options for formatting diff summary
 */
export interface FormatDiffOptions {
  /** Show unchanged keys (default: false) */
  showUnchanged?: boolean;
  /** Colorize output using ANSI codes (default: false) */
  colorize?: boolean;
  /** Compact format - single line per category (default: false) */
  compact?: boolean;
}

// ANSI color codes for colorize option
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',  // Added
  red: '\x1b[31m',    // Removed
  yellow: '\x1b[33m', // Changed
  dim: '\x1b[2m',     // Unchanged
} as const;

/**
 * Format a diff result with enhanced options
 *
 * SECURITY: Never includes values, only shows key names and change types
 *
 * @param diff - DiffResult to format
 * @param options - Formatting options
 * @returns Formatted string for display
 */
export function formatDiffSummaryWithOptions(
  diff: DiffResult,
  options: FormatDiffOptions = {}
): string {
  const { showUnchanged = false, colorize = false, compact = false } = options;
  const lines: string[] = [];

  const color = (text: string, colorName: keyof typeof COLORS): string => {
    if (!colorize) return text;
    return `${COLORS[colorName]}${text}${COLORS.reset}`;
  };

  if (diff.added.length > 0) {
    if (compact) {
      const keys = diff.added.join(', ');
      lines.push(color(`+ [${diff.added.length}] ${keys}`, 'green'));
    } else {
      lines.push(color(`Added (${diff.added.length}):`, 'green'));
      for (const key of diff.added) {
        lines.push(color(`  + ${key}`, 'green'));
      }
    }
  }

  if (diff.removed.length > 0) {
    if (lines.length > 0 && !compact) lines.push('');
    if (compact) {
      const keys = diff.removed.join(', ');
      lines.push(color(`- [${diff.removed.length}] ${keys}`, 'red'));
    } else {
      lines.push(color(`Removed (${diff.removed.length}):`, 'red'));
      for (const key of diff.removed) {
        lines.push(color(`  - ${key}`, 'red'));
      }
    }
  }

  if (diff.changed.length > 0) {
    if (lines.length > 0 && !compact) lines.push('');
    if (compact) {
      const keys = diff.changed.join(', ');
      lines.push(color(`~ [${diff.changed.length}] ${keys}`, 'yellow'));
    } else {
      lines.push(color(`Changed (${diff.changed.length}):`, 'yellow'));
      for (const key of diff.changed) {
        lines.push(color(`  ~ ${key}`, 'yellow'));
      }
    }
  }

  if (showUnchanged && diff.unchanged.length > 0) {
    if (lines.length > 0 && !compact) lines.push('');
    if (compact) {
      const keys = diff.unchanged.join(', ');
      lines.push(color(`= [${diff.unchanged.length}] ${keys}`, 'dim'));
    } else {
      lines.push(color(`Unchanged (${diff.unchanged.length}):`, 'dim'));
      for (const key of diff.unchanged) {
        lines.push(color(`  = ${key}`, 'dim'));
      }
    }
  }

  if (lines.length === 0) {
    lines.push(color('No changes detected.', 'dim'));
  }

  return lines.join('\n');
}

/**
 * Compare two sets of .env entries for secrets files
 * This is an alias for diffEnvEntries with clearer naming
 *
 * SECURITY: Only compares keys, never exposes values
 *
 * @param oldEntries - Old/original entries
 * @param newEntries - New/updated entries
 * @returns DiffSummary with key changes only (no values)
 */
export function diffSecretsFiles(
  oldEntries: DotenvEntry[],
  newEntries: DotenvEntry[]
): DiffResult {
  return diffEnvEntries(oldEntries, newEntries);
}

/**
 * Get a simple one-line summary of changes
 *
 * @param diff - DiffResult to summarize
 * @returns One-line summary string
 */
export function getOneLineSummary(diff: DiffResult): string {
  const counts = getChangeCount(diff);
  if (counts.total === 0) {
    return 'No changes';
  }
  return `${counts.total} changes: +${counts.added} -${counts.removed} ~${counts.changed}`;
}

/**
 * Create a markdown-formatted diff summary
 *
 * @param diff - DiffResult to format
 * @returns Markdown formatted string
 */
export function formatDiffAsMarkdown(diff: DiffResult): string {
  const lines: string[] = ['## Environment Changes', ''];

  if (diff.added.length > 0) {
    lines.push('### Added');
    for (const key of diff.added) {
      lines.push(`- \`${key}\``);
    }
    lines.push('');
  }

  if (diff.removed.length > 0) {
    lines.push('### Removed');
    for (const key of diff.removed) {
      lines.push(`- \`${key}\``);
    }
    lines.push('');
  }

  if (diff.changed.length > 0) {
    lines.push('### Changed');
    for (const key of diff.changed) {
      lines.push(`- \`${key}\``);
    }
    lines.push('');
  }

  if (lines.length === 2) {
    return '## Environment Changes\n\nNo changes detected.\n';
  }

  return lines.join('\n');
}
