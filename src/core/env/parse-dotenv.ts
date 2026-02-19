/**
 * .env file parser with support for comments, quotes, and managed blocks
 *
 * @module gev:core/env/parse-dotenv
 *
 * SECURITY: This module never logs or exposes secret values
 */

import * as fs from 'fs';
import {
  DotenvEntry,
  DotenvFile,
  ManagedBlock,
  DuplicateKeyError,
} from './types.js';

/** Marker for managed block start */
export const MANAGED_BLOCK_START = '# >>> gev:managed env=';
/** Marker for managed block end */
export const MANAGED_BLOCK_END = '# <<< gev:managed';

/**
 * Regular expression for parsing .env lines
 * Supports: KEY=value, KEY="value", KEY='value', export KEY=value
 */
const ENV_LINE_REGEX =
  /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^#\n\r]*))?/;

/**
 * Parse .env file content into structured format
 *
 * @param content - Raw .env file content
 * @returns Parsed DotenvFile structure
 * @throws DuplicateKeyError if duplicate keys are found
 */
export function parseDotenv(content: string): DotenvFile {
  // Normalize line endings to LF
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');

  const entries: DotenvEntry[] = [];
  const rawLines: string[] = [];
  const keyLineNumbers: Map<string, number[]> = new Map();

  let currentComment = '';
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // Empty line
    if (trimmedLine === '') {
      rawLines.push(line);
      currentComment = '';
      continue;
    }

    // Comment line
    if (trimmedLine.startsWith('#')) {
      // Check if this is a managed block marker
      if (
        trimmedLine.startsWith(MANAGED_BLOCK_START) ||
        trimmedLine === MANAGED_BLOCK_END
      ) {
        rawLines.push(line);
        currentComment = '';
        continue;
      }

      // Regular comment - could be attached to next key
      const commentText = trimmedLine.slice(1).trim();
      if (currentComment) {
        currentComment += '\n' + commentText;
      } else {
        currentComment = commentText;
      }
      rawLines.push(line);
      continue;
    }

    // Try to parse as key=value
    const match = line.match(ENV_LINE_REGEX);

    if (match) {
      const hasExport = line.startsWith('export ');
      const key = match[1] as string;
      let value: string;
      let quote: '"' | "'" | null = null;

      if (match[2] !== undefined) {
        // Double-quoted value
        value = unescapeQuotedValue(match[2]);
        quote = '"';
      } else if (match[3] !== undefined) {
        // Single-quoted value
        value = unescapeQuotedValue(match[3]);
        quote = "'";
      } else if (match[4] !== undefined) {
        // Unquoted value - trim trailing whitespace and comments
        let unquoted = match[4].trimEnd();
        // Remove inline comment
        const commentIndex = unquoted.indexOf(' #');
        if (commentIndex !== -1) {
          unquoted = unquoted.slice(0, commentIndex);
        }
        value = unquoted.trim();
        quote = null;
      } else {
        // Empty value
        value = '';
        quote = null;
      }

      const entry: DotenvEntry = {
        key,
        value,
        hasExport,
        quote,
        rawLine: line,
        lineNumber,
      };

      if (currentComment) {
        entry.comment = currentComment;
        currentComment = '';
      }

      entries.push(entry);

      // Track line numbers for duplicate detection
      const existing = keyLineNumbers.get(key);
      if (existing) {
        existing.push(lineNumber);
      } else {
        keyLineNumbers.set(key, [lineNumber]);
      }
    } else {
      // Invalid line - treat as raw line
      rawLines.push(line);
    }
  }

  // Check for duplicates
  for (const [key, lineNumbers] of keyLineNumbers) {
    if (lineNumbers.length > 1) {
      throw new DuplicateKeyError(key, lineNumbers);
    }
  }

  return {
    entries,
    rawLines,
    originalContent: normalizedContent,
  };
}

/**
 * Parse .env file from filesystem
 *
 * @param filePath - Path to .env file
 * @returns Parsed DotenvFile structure
 * @throws DuplicateKeyError if duplicate keys are found
 * @throws Error if file cannot be read
 */
export function parseDotenvFile(filePath: string): DotenvFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseDotenv(content);
}

/**
 * Unescape special characters in quoted values
 * Handles: \\, \n, \r, \t, \", \'
 */
function unescapeQuotedValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

/**
 * Extract a managed block for a specific env and service
 *
 * @param content - Raw .env file content
 * @param env - Environment name
 * @param service - Service name
 * @returns ManagedBlock if found, null otherwise
 */
export function extractManagedBlock(
  content: string,
  env: string,
  service: string
): ManagedBlock | null {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');

  const startMarker = `${MANAGED_BLOCK_START}${env} service=${service}`;
  const endMarker = MANAGED_BLOCK_END;

  let startLine = -1;
  let endLine = -1;

  // Find the block markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      const trimmed = line.trim();
      if (trimmed === startMarker && startLine === -1) {
        startLine = i + 1; // 1-based line number
      } else if (trimmed === endMarker && startLine !== -1) {
        endLine = i + 1; // 1-based line number
        break;
      }
    }
  }

  if (startLine === -1 || endLine === -1) {
    return null;
  }

  // Extract content between markers
  const blockContent = lines.slice(startLine, endLine - 1).join('\n');

  // Parse the block content
  // We need a modified parser that doesn't throw on duplicates within managed blocks
  const entries = parseManagedBlockContent(blockContent, startLine);

  return {
    env,
    service,
    startLine,
    endLine,
    entries,
  };
}

/**
 * Parse managed block content (allows for simpler parsing)
 * This is more lenient than parseDotenv as it's for internal gev content
 */
function parseManagedBlockContent(
  content: string,
  startLineNumber: number
): DotenvEntry[] {
  const lines = content.split('\n');
  const entries: DotenvEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    const match = line.match(ENV_LINE_REGEX);
    if (match) {
      const key = match[1] as string;
      let value: string;
      let quote: '"' | "'" | null = null;

      if (match[2] !== undefined) {
        value = unescapeQuotedValue(match[2]);
        quote = '"';
      } else if (match[3] !== undefined) {
        value = unescapeQuotedValue(match[3]);
        quote = "'";
      } else if (match[4] !== undefined) {
        value = match[4].trim();
        quote = null;
      } else {
        value = '';
        quote = null;
      }

      entries.push({
        key,
        value,
        quote,
        rawLine: line,
        lineNumber: startLineNumber + i + 1,
      });
    }
  }

  return entries;
}

/**
 * Find all managed blocks in content
 *
 * @param content - Raw .env file content
 * @returns Array of ManagedBlock objects
 */
export function findAllManagedBlocks(content: string): ManagedBlock[] {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');
  const blocks: ManagedBlock[] = [];

  const startMarkerRegex = new RegExp(
    `^${escapeRegex(MANAGED_BLOCK_START)}([^\\s]+)\\s+service=(.+)$`
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const trimmed = line.trim();
    const match = trimmed.match(startMarkerRegex);

    if (match) {
      const env = match[1] as string;
      const service = match[2] as string;
      const startLine = i + 1;

      // Find matching end marker
      for (let j = i + 1; j < lines.length; j++) {
        const endLine = lines[j];
        if (endLine !== undefined && endLine.trim() === MANAGED_BLOCK_END) {
          const blockEndLineNumber = j + 1;
          const blockContent = lines.slice(startLine, blockEndLineNumber - 1).join('\n');
          const entries = parseManagedBlockContent(blockContent, startLine);

          blocks.push({
            env,
            service,
            startLine,
            endLine: blockEndLineNumber,
            entries,
          });
          break;
        }
      }
    }
  }

  return blocks;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all keys from a parsed .env file
 *
 * @param file - Parsed DotenvFile
 * @returns Array of keys
 */
export function getKeys(file: DotenvFile): string[] {
  return file.entries.map((entry: DotenvEntry) => entry.key);
}

/**
 * Check if a key exists in a parsed .env file
 *
 * @param file - Parsed DotenvFile
 * @param key - Key to check
 * @returns true if key exists
 */
export function hasKey(file: DotenvFile, key: string): boolean {
  return file.entries.some((entry: DotenvEntry) => entry.key === key);
}

/**
 * Get a value by key from a parsed .env file
 *
 * SECURITY: The caller is responsible for not logging the returned value
 *
 * @param file - Parsed DotenvFile
 * @param key - Key to look up
 * @returns Value if found, undefined otherwise
 */
export function getValue(file: DotenvFile, key: string): string | undefined {
  const entry = file.entries.find((e: DotenvEntry) => e.key === key);
  return entry?.value;
}

/**
 * Get an entry by key from a parsed .env file
 *
 * @param file - Parsed DotenvFile
 * @param key - Key to look up
 * @returns DotenvEntry if found, undefined otherwise
 */
export function getEntry(
  file: DotenvFile,
  key: string
): DotenvEntry | undefined {
  return file.entries.find((e: DotenvEntry) => e.key === key);
}
