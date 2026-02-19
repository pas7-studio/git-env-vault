/**
 * .env file renderer with support for managed blocks
 *
 * @module gev:core/env/render-dotenv
 *
 * SECURITY: This module handles secret values but never logs them
 */

import {
  DotenvEntry,
  DotenvFile,
  InsertManagedBlockOptions,
} from './types.js';
import {
  MANAGED_BLOCK_START,
  MANAGED_BLOCK_END,
  extractManagedBlock,
  findAllManagedBlocks,
} from './parse-dotenv.js';

/**
 * Render a DotenvEntry to a string line
 *
 * @param entry - Entry to render
 * @returns Rendered line string
 */
export function renderEntry(entry: DotenvEntry): string {
  const prefix = entry.hasExport ? 'export ' : '';
  const escapedValue = escapeValue(entry.value);

  if (entry.quote === '"') {
    return `${prefix}${entry.key}="${escapedValue}"`;
  } else if (entry.quote === "'") {
    // Single quotes - less escaping needed
    return `${prefix}${entry.key}='${entry.value.replace(/'/g, "\\'")}'`;
  } else {
    // No quotes - only use if value is safe
    if (needsQuotes(entry.value)) {
      return `${prefix}${entry.key}="${escapedValue}"`;
    }
    return `${prefix}${entry.key}=${entry.value}`;
  }
}

/**
 * Check if a value needs to be quoted
 */
function needsQuotes(value: string): boolean {
  if (value === '') return false;
  // Values with spaces, special chars, or starting with special chars need quotes
  return (
    value.includes(' ') ||
    value.includes('\n') ||
    value.includes('\t') ||
    value.includes('#') ||
    value.includes('=') ||
    value.startsWith('"') ||
    value.startsWith("'") ||
    value.includes('$')
  );
}

/**
 * Escape special characters in a value for double quotes
 */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Render a DotenvFile to a string
 *
 * @param file - File to render
 * @returns Complete .env file content
 */
export function renderDotenv(file: DotenvFile): string {
  const lines: string[] = [];

  // Group entries with their preceding comments
  for (const entry of file.entries) {
    if (entry.comment) {
      // Add comment lines
      const commentLines = entry.comment.split('\n');
      for (const commentLine of commentLines) {
        lines.push(`# ${commentLine}`);
      }
    }
    lines.push(renderEntry(entry));
  }

  // Add raw lines (comments, empty lines that weren't attached to entries)
  // This is a simplified approach - a more sophisticated version would
  // preserve exact line ordering between entries and other content
  for (const rawLine of file.rawLines) {
    // Skip if this line is already represented by an entry
    const isRepresented = file.entries.some(
      (e) => e.rawLine === rawLine
    );
    if (!isRepresented) {
      lines.push(rawLine);
    }
  }

  return lines.join('\n');
}

/**
 * Render a managed block
 *
 * @param env - Environment name
 * @param service - Service name
 * @param entries - Entries to include in the block
 * @returns Rendered managed block string
 */
export function renderManagedBlock(
  env: string,
  service: string,
  entries: DotenvEntry[]
): string {
  const lines: string[] = [];

  // Start marker
  lines.push(`${MANAGED_BLOCK_START}${env} service=${service}`);

  // Sort entries alphabetically by key for deterministic output
  const sortedEntries = [...entries].sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  // Render entries
  for (const entry of sortedEntries) {
    lines.push(renderEntry(entry));
  }

  // End marker
  lines.push(MANAGED_BLOCK_END);

  return lines.join('\n');
}

/**
 * Insert or update a managed block in .env content
 *
 * @param content - Original .env file content
 * @param env - Environment name
 * @param service - Service name
 * @param entries - Entries to include in the block
 * @param options - Insertion options
 * @returns Updated .env file content
 */
export function insertManagedBlock(
  content: string,
  env: string,
  service: string,
  entries: DotenvEntry[],
  options?: InsertManagedBlockOptions
): string {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');
  const position = options?.position ?? 'bottom';

  // Check if block already exists
  const existingBlock = extractManagedBlock(content, env, service);

  if (existingBlock) {
    // Remove existing block
    const beforeBlock = lines.slice(0, existingBlock.startLine - 1);
    const afterBlock = lines.slice(existingBlock.endLine);
    const newBlockLines = renderManagedBlock(env, service, entries).split('\n');

    // Combine: before + new block + after
    const result = [...beforeBlock, ...newBlockLines, ...afterBlock];
    return result.join('\n');
  }

  // Block doesn't exist - create new one
  const newBlock = renderManagedBlock(env, service, entries);

  if (position === 'top') {
    // Insert at the top (after any existing managed blocks)
    const existingBlocks = findAllManagedBlocks(content);
    if (existingBlocks.length > 0) {
      // Find the end of the last managed block at the top
      const sortedBlocks = [...existingBlocks].sort(
        (a, b) => a.startLine - b.startLine
      );
      const lastBlock = sortedBlocks[sortedBlocks.length - 1];
      if (lastBlock) {
        const insertAfterLine = lastBlock.endLine;
        const beforeInsert = lines.slice(0, insertAfterLine);
        const afterInsert = lines.slice(insertAfterLine);
        return [...beforeInsert, '', ...newBlock.split('\n'), ...afterInsert].join('\n');
      }
    }
    // Insert at very top
    return [newBlock, ...lines].join('\n');
  } else {
    // Insert at bottom
    // Remove trailing empty lines, add block, add single newline
    const trimmedContent = normalizedContent.trimEnd();
    if (trimmedContent) {
      return `${trimmedContent}\n\n${newBlock}\n`;
    } else {
      return `${newBlock}\n`;
    }
  }
}

/**
 * Remove a managed block from .env content
 *
 * @param content - Original .env file content
 * @param env - Environment name
 * @param service - Service name
 * @returns Content with the managed block removed
 */
export function removeManagedBlock(
  content: string,
  env: string,
  service: string
): string {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');

  const existingBlock = extractManagedBlock(content, env, service);

  if (!existingBlock) {
    return content; // No change needed
  }

  // Remove the block (including the start marker line which is at startLine - 1)
  const beforeBlock = lines.slice(0, existingBlock.startLine - 1);
  const afterBlock = lines.slice(existingBlock.endLine);

  // Remove extra empty line if present before the block
  if (beforeBlock.length > 0 && beforeBlock[beforeBlock.length - 1] === '') {
    beforeBlock.pop();
  }

  const result = [...beforeBlock, ...afterBlock];

  // Clean up multiple consecutive empty lines
  const cleaned: string[] = [];
  let prevEmpty = false;

  for (const line of result) {
    if (line === '') {
      if (!prevEmpty) {
        cleaned.push(line);
      }
      prevEmpty = true;
    } else {
      cleaned.push(line);
      prevEmpty = false;
    }
  }

  return cleaned.join('\n');
}

/**
 * Render entries to a simple key=value format (for display/export)
 *
 * @param entries - Entries to render
 * @returns Simple .env format string
 */
export function renderEntriesSimple(entries: DotenvEntry[]): string {
  return entries
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => renderEntry(entry))
    .join('\n');
}

/**
 * Create a DotenvEntry from key and value
 *
 * @param key - Entry key
 * @param value - Entry value
 * @param options - Additional options
 * @returns DotenvEntry object
 */
export function createEntry(
  key: string,
  value: string,
  options?: {
    hasExport?: boolean;
    quote?: '"' | "'" | null;
    comment?: string;
  }
): DotenvEntry {
  const entry: DotenvEntry = {
    key,
    value,
    hasExport: options?.hasExport ?? false,
    quote: options?.quote ?? null,
  };
  if (options?.comment !== undefined) {
    entry.comment = options.comment;
  }
  return entry;
}

/**
 * Update an entry's value while preserving format
 *
 * @param entry - Original entry
 * @param newValue - New value
 * @returns Updated entry
 */
export function updateEntryValue(
  entry: DotenvEntry,
  newValue: string
): DotenvEntry {
  return {
    ...entry,
    value: newValue,
    // Update quote style if new value needs quotes
    quote: entry.quote ?? (needsQuotes(newValue) ? '"' : null),
  };
}
