/**
 * Atomic file write with backup support
 *
 * @module gev:core/fs/atomic-write
 *
 * Provides safe file writing operations:
 * - Atomic writes (write to temp, then rename)
 * - Backup creation before overwriting
 * - Skip writes when content is identical
 */

import { writeFile, rename, copyFile, access, stat, unlink } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { randomBytes } from 'crypto';
import { constants } from 'fs';

/**
 * Options for atomic write operations
 */
export interface AtomicWriteOptions {
  /** Create a .bak backup before writing (default: false) */
  backup?: boolean;
  /** Custom path for backup file (default: ${filePath}.bak) */
  backupPath?: string;
  /** Skip write if content is identical (default: true) */
  skipIfIdentical?: boolean;
  /** Encoding for file write (default: 'utf-8') */
  encoding?: BufferEncoding;
}

/**
 * Result of atomic write operation
 */
export interface AtomicWriteResult {
  /** Whether the file was written */
  written: boolean;
  /** Path to backup file if created */
  backupPath?: string;
  /** Whether write was skipped due to identical content */
  skipped?: boolean;
}

/**
 * Generate a unique temp file name in the same directory
 */
function generateTempPath(filePath: string): string {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const random = randomBytes(8).toString('hex');
  return join(dir, `.${base}.tmp-${random}`);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content if it exists, return null otherwise
 */
async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if content differs from existing file
 *
 * @param filePath - Path to existing file
 * @param newContent - New content to compare
 * @returns true if file needs to be written (content differs or file doesn't exist)
 */
export async function shouldWrite(
  filePath: string,
  newContent: string
): Promise<boolean> {
  const existingContent = await readFileIfExists(filePath);

  if (existingContent === null) {
    return true; // File doesn't exist, need to write
  }

  return existingContent !== newContent;
}

/**
 * Create a backup of an existing file
 *
 * @param filePath - Path to file to backup
 * @param backupPath - Optional custom backup path (default: ${filePath}.bak)
 * @returns Path to backup file or null if file doesn't exist
 */
export async function createBackup(
  filePath: string,
  backupPath?: string
): Promise<string | null> {
  const exists = await fileExists(filePath);

  if (!exists) {
    return null;
  }

  const targetPath = backupPath || `${filePath}.bak`;

  try {
    await copyFile(filePath, targetPath);
    return targetPath;
  } catch (error) {
    // If backup fails, throw error
    throw new Error(
      `Failed to create backup at ${targetPath}: ${(error as Error).message}`
    );
  }
}

/**
 * Clean up temp file if it exists
 */
async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Atomically write content to a file
 *
 * This function:
 * 1. Checks if content differs (if skipIfIdentical is true)
 * 2. Creates backup if requested and file exists
 * 3. Writes to a temp file in the same directory
 * 4. Renames temp file to target (atomic on same filesystem)
 *
 * @param filePath - Target file path
 * @param content - Content to write
 * @param options - Write options
 * @returns Result of write operation
 */
export async function atomicWriteFile(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {}
): Promise<AtomicWriteResult> {
  const {
    backup = false,
    backupPath,
    skipIfIdentical = true,
    encoding = 'utf-8',
  } = options;

  // Check if we need to write
  if (skipIfIdentical) {
    const needsWrite = await shouldWrite(filePath, content);
    if (!needsWrite) {
      return { written: false, skipped: true };
    }
  }

  // Create backup if requested
  let actualBackupPath: string | undefined;
  if (backup) {
    const createdBackupPath = await createBackup(filePath, backupPath);
    if (createdBackupPath) {
      actualBackupPath = createdBackupPath;
    }
  }

  // Ensure directory exists
  const dir = dirname(filePath);
  const { mkdir } = await import('fs/promises');
  await mkdir(dir, { recursive: true });

  // Write to temp file first
  const tempPath = generateTempPath(filePath);

  try {
    await writeFile(tempPath, content, encoding);

    // Rename temp to target (atomic on same filesystem)
    await rename(tempPath, filePath);

    const result: AtomicWriteResult = {
      written: true,
    };
    
    if (actualBackupPath !== undefined) {
      result.backupPath = actualBackupPath;
    }
    
    return result;
  } catch (error) {
    // Clean up temp file on failure
    await cleanupTempFile(tempPath);
    throw error;
  }
}

/**
 * Write file with automatic retry on failure
 *
 * @param filePath - Target file path
 * @param content - Content to write
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param options - Write options
 * @returns Result of write operation
 */
export async function atomicWriteWithRetry(
  filePath: string,
  content: string,
  maxRetries: number = 3,
  options: AtomicWriteOptions = {}
): Promise<AtomicWriteResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await atomicWriteFile(filePath, content, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Wait briefly before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Safely delete a file (no error if doesn't exist)
 *
 * @param filePath - Path to file to delete
 */
export async function safeDelete(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get file size in bytes
 *
 * @param filePath - Path to file
 * @returns File size in bytes or -1 if file doesn't exist
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch {
    return -1;
  }
}
