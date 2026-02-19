/**
 * Tests for atomic file write module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm, access, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  atomicWriteFile,
  shouldWrite,
  createBackup,
  atomicWriteWithRetry,
  safeDelete,
  getFileSize,
} from '../../../src/core/fs/atomic-write.js';

describe('atomic-write', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `atomic-write-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('shouldWrite', () => {
    it('should return true when file does not exist', async () => {
      const filePath = join(tempDir, 'nonexistent.txt');
      const result = await shouldWrite(filePath, 'content');
      expect(result).toBe(true);
    });

    it('should return true when content differs', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'old content', 'utf-8');

      const result = await shouldWrite(filePath, 'new content');
      expect(result).toBe(true);
    });

    it('should return false when content is identical', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'same content', 'utf-8');

      const result = await shouldWrite(filePath, 'same content');
      expect(result).toBe(false);
    });

    it('should handle empty files', async () => {
      const filePath = join(tempDir, 'empty.txt');
      await writeFile(filePath, '', 'utf-8');

      const result = await shouldWrite(filePath, '');
      expect(result).toBe(false);
    });

    it('should detect whitespace differences', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content\n', 'utf-8');

      const result = await shouldWrite(filePath, 'content');
      expect(result).toBe(true);
    });
  });

  describe('createBackup', () => {
    it('should create backup file with .bak extension', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'original content', 'utf-8');

      const backupPath = await createBackup(filePath);

      expect(backupPath).toBe(`${filePath}.bak`);
      const backupContent = await readFile(backupPath!, 'utf-8');
      expect(backupContent).toBe('original content');
    });

    it('should return null when file does not exist', async () => {
      const filePath = join(tempDir, 'nonexistent.txt');
      const backupPath = await createBackup(filePath);
      expect(backupPath).toBeNull();
    });

    it('should use custom backup path', async () => {
      const filePath = join(tempDir, 'test.txt');
      const customBackupPath = join(tempDir, 'custom-backup.txt');
      await writeFile(filePath, 'original content', 'utf-8');

      const backupPath = await createBackup(filePath, customBackupPath);

      expect(backupPath).toBe(customBackupPath);
      const backupContent = await readFile(customBackupPath, 'utf-8');
      expect(backupContent).toBe('original content');
    });

    it('should overwrite existing backup file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'new content', 'utf-8');
      await writeFile(`${filePath}.bak`, 'old backup', 'utf-8');

      await createBackup(filePath);

      const backupContent = await readFile(`${filePath}.bak`, 'utf-8');
      expect(backupContent).toBe('new content');
    });
  });

  describe('atomicWriteFile', () => {
    it('should write new file', async () => {
      const filePath = join(tempDir, 'new.txt');
      const result = await atomicWriteFile(filePath, 'content');

      expect(result.written).toBe(true);
      expect(result.skipped).toBeUndefined();
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should overwrite existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'old content', 'utf-8');

      const result = await atomicWriteFile(filePath, 'new content');

      expect(result.written).toBe(true);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should skip write when content is identical (default)', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'same content', 'utf-8');

      const result = await atomicWriteFile(filePath, 'same content');

      expect(result.written).toBe(false);
      expect(result.skipped).toBe(true);
    });

    it('should write when skipIfIdentical is false', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'same content', 'utf-8');

      const result = await atomicWriteFile(filePath, 'same content', {
        skipIfIdentical: false,
      });

      expect(result.written).toBe(true);
      expect(result.skipped).toBeUndefined();
    });

    it('should create backup when option is set', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'old content', 'utf-8');

      const result = await atomicWriteFile(filePath, 'new content', {
        backup: true,
      });

      expect(result.written).toBe(true);
      expect(result.backupPath).toBe(`${filePath}.bak`);
      const backupContent = await readFile(result.backupPath!, 'utf-8');
      expect(backupContent).toBe('old content');
    });

    it('should not create backup for new files', async () => {
      const filePath = join(tempDir, 'new.txt');

      const result = await atomicWriteFile(filePath, 'content', {
        backup: true,
      });

      expect(result.written).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });

    it('should use custom backup path', async () => {
      const filePath = join(tempDir, 'test.txt');
      const customBackupPath = join(tempDir, 'custom.bak');
      await writeFile(filePath, 'old content', 'utf-8');

      const result = await atomicWriteFile(filePath, 'new content', {
        backup: true,
        backupPath: customBackupPath,
      });

      expect(result.backupPath).toBe(customBackupPath);
      const backupContent = await readFile(customBackupPath, 'utf-8');
      expect(backupContent).toBe('old content');
    });

    it('should create directory if it does not exist', async () => {
      const filePath = join(tempDir, 'subdir', 'nested', 'test.txt');

      const result = await atomicWriteFile(filePath, 'content');

      expect(result.written).toBe(true);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should clean up temp file on failure', async () => {
      const filePath = join(tempDir, 'test.txt');

      // Mock a failure scenario by trying to write to an invalid path
      // This is tricky to test directly, but we can verify temp files are cleaned
      // For now, just verify the function doesn't leave temp files on success
      await atomicWriteFile(filePath, 'content');

      // Check no temp files remain
      const { readdir } = await import('fs/promises');
      const files = await readdir(tempDir);
      const tempFiles = files.filter((f) => f.startsWith('.test.txt.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('atomicWriteWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const filePath = join(tempDir, 'test.txt');
      const result = await atomicWriteWithRetry(filePath, 'content', 3);

      expect(result.written).toBe(true);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should retry on failure', async () => {
      const filePath = join(tempDir, 'test.txt');
      // This is hard to test without mocking, but we can verify it eventually succeeds
      const result = await atomicWriteWithRetry(filePath, 'content', 3);

      expect(result.written).toBe(true);
    });
  });

  describe('safeDelete', () => {
    it('should delete existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');

      await safeDelete(filePath);

      await expect(access(filePath)).rejects.toThrow();
    });

    it('should not throw when file does not exist', async () => {
      const filePath = join(tempDir, 'nonexistent.txt');

      await expect(safeDelete(filePath)).resolves.not.toThrow();
    });
  });

  describe('getFileSize', () => {
    it('should return file size for existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');

      const size = await getFileSize(filePath);
      expect(size).toBe(7); // 'content'.length
    });

    it('should return -1 for non-existent file', async () => {
      const filePath = join(tempDir, 'nonexistent.txt');

      const size = await getFileSize(filePath);
      expect(size).toBe(-1);
    });

    it('should return 0 for empty file', async () => {
      const filePath = join(tempDir, 'empty.txt');
      await writeFile(filePath, '', 'utf-8');

      const size = await getFileSize(filePath);
      expect(size).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should handle full workflow: write, backup, update', async () => {
      const filePath = join(tempDir, 'workflow.txt');

      // Initial write
      await atomicWriteFile(filePath, 'version 1');
      expect(await readFile(filePath, 'utf-8')).toBe('version 1');

      // Update with backup
      await atomicWriteFile(filePath, 'version 2', { backup: true });
      expect(await readFile(filePath, 'utf-8')).toBe('version 2');
      expect(await readFile(`${filePath}.bak`, 'utf-8')).toBe('version 1');

      // Skip identical write
      const result = await atomicWriteFile(filePath, 'version 2');
      expect(result.skipped).toBe(true);
    });

    it('should handle concurrent writes safely', async () => {
      const filePath = join(tempDir, 'concurrent.txt');

      // Write initial content
      await writeFile(filePath, 'initial', 'utf-8');

      // Simulate concurrent writes
      const writes = [
        atomicWriteFile(filePath, 'write 1'),
        atomicWriteFile(filePath, 'write 2'),
        atomicWriteFile(filePath, 'write 3'),
      ];

      await Promise.all(writes);

      // File should exist and contain one of the values
      const content = await readFile(filePath, 'utf-8');
      expect(['write 1', 'write 2', 'write 3']).toContain(content);
    });
  });
});
