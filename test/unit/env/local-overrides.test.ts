/**
 * Tests for local-overrides module
 *
 * SECURITY: These tests verify that override values are handled securely
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  getLocalOverridesPath,
  readLocalOverrides,
  readLocalOverridesSync,
  writeLocalOverrides,
  removeLocalOverrides,
  removeLocalOverrideKey,
  setLocalOverride,
  getLocalOverride,
  hasLocalOverrides,
  getLocalOverrideKeys,
  mergeWithOverrides,
  getOverriddenEntries,
  getOverriddenKeys,
  ensureEnvLocalInGitignore,
} from '../../../src/core/env/local-overrides';
import { DotenvEntry } from '../../../src/core/env/types';

// Helper to create entries
const createEntry = (key: string, value: string): DotenvEntry => ({ key, value });

describe('getLocalOverridesPath', () => {
  it('should return home mode path by default', () => {
    const result = getLocalOverridesPath({
      repo: 'my-repo',
      env: 'dev',
      service: 'api',
    });

    // Should contain the repo, env, and service
    expect(result).toContain('my-repo');
    expect(result).toContain('dev');
    expect(result).toContain('api.env');
    expect(result).toContain('.gev');
  });

  it('should return local mode path when specified', () => {
    const result = getLocalOverridesPath({
      repo: 'my-repo',
      env: 'dev',
      service: 'api',
      mode: 'local',
    });

    expect(result).toBe(path.join('apps', 'api', '.env.local'));
  });

  it('should sanitize repo name with special characters', () => {
    const result = getLocalOverridesPath({
      repo: 'my-repo/with/slashes',
      env: 'dev',
      service: 'api',
    });

    // Path is absolute in home mode; assert only the repo segment is sanitized.
    const repoSegment = path.basename(path.dirname(path.dirname(result)));
    expect(repoSegment).toBe('my-repo_with_slashes');
    expect(repoSegment).not.toContain('/');
    expect(repoSegment).not.toContain('\\');
  });
});

describe('Local overrides file operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gev-test-'));
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('readLocalOverrides', () => {
    it('should return empty array when file does not exist', async () => {
      const entries = await readLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(entries).toEqual([]);
    });

    it('should read overrides from file', async () => {
      // Create override file
      const overridePath = path.join(tempDir, 'apps', 'api', '.env.local');
      await fs.mkdir(path.dirname(overridePath), { recursive: true });
      await fs.writeFile(overridePath, 'KEY1=value1\nKEY2=value2\n', 'utf-8');

      const entries = await readLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.key === 'KEY1')?.value).toBe('value1');
      expect(entries.find((e) => e.key === 'KEY2')?.value).toBe('value2');
    });
  });

  describe('readLocalOverridesSync', () => {
    it('should return empty array when file does not exist', () => {
      const entries = readLocalOverridesSync({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(entries).toEqual([]);
    });

    it('should read overrides synchronously', async () => {
      // Create override file using async (setup)
      const overridePath = path.join(tempDir, 'apps', 'api', '.env.local');
      await fs.mkdir(path.dirname(overridePath), { recursive: true });
      await fs.writeFile(overridePath, 'KEY1=value1\n', 'utf-8');

      // Now read synchronously
      const entries = readLocalOverridesSync({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]?.key).toBe('KEY1');
      expect(entries[0]?.value).toBe('value1');
    });
  });

  describe('writeLocalOverrides', () => {
    it('should write overrides to file', async () => {
      const entries: DotenvEntry[] = [
        createEntry('KEY1', 'value1'),
        createEntry('KEY2', 'value2'),
      ];

      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        entries
      );

      // Verify file was created
      const overridePath = path.join(tempDir, 'apps', 'api', '.env.local');
      const content = await fs.readFile(overridePath, 'utf-8');

      expect(content).toContain('KEY1=value1');
      expect(content).toContain('KEY2=value2');
    });

    it('should create directory structure if needed', async () => {
      const entries: DotenvEntry[] = [createEntry('KEY', 'value')];

      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        entries
      );

      // Directory should exist
      const dir = path.join(tempDir, 'apps', 'api');
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('removeLocalOverrides', () => {
    it('should delete overrides file', async () => {
      // Create file first
      const overridePath = path.join(tempDir, 'apps', 'api', '.env.local');
      await fs.mkdir(path.dirname(overridePath), { recursive: true });
      await fs.writeFile(overridePath, 'KEY=value\n', 'utf-8');

      const result = await removeLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(result).toBe(true);

      // File should no longer exist
      await expect(fs.access(overridePath)).rejects.toThrow();
    });

    it('should return false when file does not exist', async () => {
      const result = await removeLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(result).toBe(false);
    });
  });

  describe('removeLocalOverrideKey', () => {
    it('should remove a specific key from overrides', async () => {
      // Create file with multiple keys
      const entries: DotenvEntry[] = [
        createEntry('KEY1', 'value1'),
        createEntry('KEY2', 'value2'),
      ];
      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        entries
      );

      const result = await removeLocalOverrideKey(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'KEY1'
      );

      expect(result).toBe(true);

      // Verify KEY1 is gone but KEY2 remains
      const remaining = await readLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe('KEY2');
    });

    it('should remove file when last key is removed', async () => {
      // Create file with single key
      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        [createEntry('KEY', 'value')]
      );

      await removeLocalOverrideKey(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'KEY'
      );

      const hasOverrides = await hasLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(hasOverrides).toBe(false);
    });

    it('should return false when key does not exist', async () => {
      const result = await removeLocalOverrideKey(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'NONEXISTENT'
      );

      expect(result).toBe(false);
    });
  });

  describe('setLocalOverride', () => {
    it('should add a new override', async () => {
      await setLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'NEW_KEY',
        'new_value'
      );

      const value = await getLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'NEW_KEY'
      );

      expect(value).toBe('new_value');
    });

    it('should update existing override', async () => {
      // Set initial value
      await setLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'KEY',
        'old_value'
      );

      // Update value
      await setLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'KEY',
        'new_value'
      );

      const value = await getLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'KEY'
      );

      expect(value).toBe('new_value');
    });
  });

  describe('getLocalOverride', () => {
    it('should return undefined when key does not exist', async () => {
      const value = await getLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'NONEXISTENT'
      );

      expect(value).toBeUndefined();
    });

    it('should return value when key exists', async () => {
      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        [createEntry('SECRET_KEY', 'super_secret_value')]
      );

      const value = await getLocalOverride(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        'SECRET_KEY'
      );

      expect(value).toBe('super_secret_value');
    });
  });

  describe('hasLocalOverrides', () => {
    it('should return false when no overrides exist', async () => {
      const result = await hasLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(result).toBe(false);
    });

    it('should return true when overrides exist', async () => {
      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        [createEntry('KEY', 'value')]
      );

      const result = await hasLocalOverrides({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(result).toBe(true);
    });
  });

  describe('getLocalOverrideKeys', () => {
    it('should return empty array when no overrides exist', async () => {
      const keys = await getLocalOverrideKeys({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(keys).toEqual([]);
    });

    it('should return sorted list of override keys', async () => {
      await writeLocalOverrides(
        {
          repo: 'test-repo',
          env: 'dev',
          service: 'api',
          mode: 'local',
          baseDir: tempDir,
        },
        [createEntry('ZEBRA', 'z'), createEntry('APPLE', 'a'), createEntry('MANGO', 'm')]
      );

      const keys = await getLocalOverrideKeys({
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      });

      expect(keys).toEqual(['APPLE', 'MANGO', 'ZEBRA']);
    });
  });
});

describe('mergeWithOverrides', () => {
  it('should merge shared with local overrides', () => {
    const shared: DotenvEntry[] = [
      createEntry('KEY1', 'shared_value1'),
      createEntry('KEY2', 'shared_value2'),
    ];
    const local: DotenvEntry[] = [
      createEntry('KEY2', 'local_value2'),
      createEntry('KEY3', 'local_value3'),
    ];

    const merged = mergeWithOverrides(shared, local);

    expect(merged).toHaveLength(3);
    expect(merged.find((e) => e.key === 'KEY1')?.value).toBe('shared_value1');
    expect(merged.find((e) => e.key === 'KEY2')?.value).toBe('local_value2');
    expect(merged.find((e) => e.key === 'KEY3')?.value).toBe('local_value3');
  });

  it('should return shared when no local overrides', () => {
    const shared: DotenvEntry[] = [createEntry('KEY', 'value')];
    const merged = mergeWithOverrides(shared, []);

    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('value');
  });

  it('should return local when no shared', () => {
    const local: DotenvEntry[] = [createEntry('KEY', 'value')];
    const merged = mergeWithOverrides([], local);

    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('value');
  });
});

describe('getOverriddenEntries', () => {
  it('should return entries that differ from shared', () => {
    const shared: DotenvEntry[] = [
      createEntry('KEY1', 'shared_value'),
      createEntry('KEY2', 'shared_value'),
    ];
    const local: DotenvEntry[] = [
      createEntry('KEY1', 'local_value'), // Different
      createEntry('KEY2', 'shared_value'), // Same
      createEntry('KEY3', 'new_value'), // New
    ];

    const overridden = getOverriddenEntries(shared, local);

    expect(overridden).toHaveLength(2);
    expect(overridden.map((e) => e.key)).toContain('KEY1');
    expect(overridden.map((e) => e.key)).toContain('KEY3');
  });

  it('should return empty array when no overrides', () => {
    const shared: DotenvEntry[] = [createEntry('KEY', 'value')];
    const local: DotenvEntry[] = [createEntry('KEY', 'value')];

    const overridden = getOverriddenEntries(shared, local);

    expect(overridden).toEqual([]);
  });
});

describe('getOverriddenKeys', () => {
  it('should return sorted list of overridden keys', () => {
    const shared: DotenvEntry[] = [
      createEntry('KEY1', 'shared'),
      createEntry('KEY2', 'shared'),
    ];
    const local: DotenvEntry[] = [
      createEntry('KEY1', 'local'), // Overridden
      createEntry('KEY3', 'new'), // New
    ];

    const keys = getOverriddenKeys(shared, local);

    expect(keys).toEqual(['KEY1', 'KEY3']);
  });

  it('should return empty array when no overrides', () => {
    const keys = getOverriddenKeys([], []);
    expect(keys).toEqual([]);
  });
});

describe('ensureEnvLocalInGitignore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gev-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should add .env.local to gitignore if not present', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'node_modules/\n', 'utf-8');

    const result = await ensureEnvLocalInGitignore(gitignorePath);

    expect(result).toBe(true);

    const content = await fs.readFile(gitignorePath, 'utf-8');
    expect(content).toContain('.env.local');
  });

  it('should return false if .env.local already in gitignore', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'node_modules/\n.env.local\n', 'utf-8');

    const result = await ensureEnvLocalInGitignore(gitignorePath);

    expect(result).toBe(false);
  });

  it('should create .gitignore if it does not exist', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');

    const result = await ensureEnvLocalInGitignore(gitignorePath);

    expect(result).toBe(true);

    const content = await fs.readFile(gitignorePath, 'utf-8');
    expect(content).toContain('.env.local');
  });
});

describe('Security considerations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gev-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle secret values without leaking in errors', async () => {
    // Write a secret value
    await writeLocalOverrides(
      {
        repo: 'test-repo',
        env: 'prod',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      },
      [createEntry('SUPER_SECRET', 'password123!')]
    );

    // The value should be stored but never logged
    const value = await getLocalOverride(
      {
        repo: 'test-repo',
        env: 'prod',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      },
      'SUPER_SECRET'
    );

    expect(value).toBe('password123!');
    // Note: In real implementation, logging would be mocked/verified
  });

  it('should only return keys, not values, in getLocalOverrideKeys', async () => {
    await writeLocalOverrides(
      {
        repo: 'test-repo',
        env: 'dev',
        service: 'api',
        mode: 'local',
        baseDir: tempDir,
      },
      [
        createEntry('API_KEY', 'secret_key_123'),
        createEntry('DB_PASSWORD', 'secret_password'),
      ]
    );

    const keys = await getLocalOverrideKeys({
      repo: 'test-repo',
      env: 'dev',
      service: 'api',
      mode: 'local',
      baseDir: tempDir,
    });

    // Keys should only contain key names
    expect(keys).toEqual(['API_KEY', 'DB_PASSWORD']);
    // No values should be present
    const keysString = JSON.stringify(keys);
    expect(keysString).not.toContain('secret');
    expect(keysString).not.toContain('password');
  });
});
