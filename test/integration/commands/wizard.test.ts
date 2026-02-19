/**
 * Integration tests for wizard command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanProject, type ScanResult } from '../../../src/cli/commands/wizard.js';

// Mock inquirer prompts
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn().mockResolvedValue(true),
  input: vi.fn().mockResolvedValue('secrets'),
  checkbox: vi.fn().mockResolvedValue(['api', 'worker']),
}));

describe('wizard command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `wizard-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('scanProject', () => {
    it('should detect monorepo with apps structure', async () => {
      // Create monorepo structure
      await mkdir(join(tempDir, 'apps', 'api'), { recursive: true });
      await mkdir(join(tempDir, 'apps', 'worker'), { recursive: true });
      await writeFile(join(tempDir, 'apps', 'api', '.env'), 'KEY=value');
      await mkdir(join(tempDir, 'packages', 'shared'), { recursive: true });

      const result = await scanProject(tempDir);

      expect(result.monorepoType).toBe('apps-packages');
      expect(result.services.length).toBe(3);
      expect(result.services.map((s) => s.name)).toContain('api');
      expect(result.services.map((s) => s.name)).toContain('worker');
      expect(result.services.map((s) => s.name)).toContain('shared');

      const apiService = result.services.find((s) => s.name === 'api');
      expect(apiService?.hasEnvFile).toBe(true);
      expect(apiService?.type).toBe('app');
    });

    it('should detect docker-compose project', async () => {
      await writeFile(
        join(tempDir, 'docker-compose.yml'),
        `
services:
  api:
    image: node:18
  db:
    image: postgres:15
`
      );

      const result = await scanProject(tempDir);

      expect(result.hasDockerCompose).toBe(true);
      expect(result.dockerComposePath).toBe(join(tempDir, 'docker-compose.yml'));
    });

    it('should detect compose.yaml file', async () => {
      await writeFile(
        join(tempDir, 'compose.yaml'),
        `
services:
  app:
    image: node:18
`
      );

      const result = await scanProject(tempDir);

      expect(result.hasDockerCompose).toBe(true);
      expect(result.dockerComposePath).toBe(join(tempDir, 'compose.yaml'));
    });

    it('should detect single service with .env file', async () => {
      await writeFile(join(tempDir, '.env'), 'KEY=value');

      const result = await scanProject(tempDir);

      expect(result.monorepoType).toBe('single');
      expect(result.services.length).toBe(1);
      expect(result.services[0].hasEnvFile).toBe(true);
    });

    it('should detect multiple .env files', async () => {
      await mkdir(join(tempDir, 'apps', 'api'), { recursive: true });
      await writeFile(join(tempDir, 'apps', 'api', '.env'), 'KEY=value');
      await writeFile(join(tempDir, 'apps', 'api', '.env.local'), 'LOCAL=value');

      const result = await scanProject(tempDir);

      const apiService = result.services.find((s) => s.name === 'api');
      expect(apiService?.envFilePaths.length).toBe(2);
    });

    it('should return empty services for unknown structure', async () => {
      // Empty directory
      const result = await scanProject(tempDir);

      expect(result.services.length).toBe(0);
      expect(result.monorepoType).toBe('unknown');
    });

    it('should detect packages directory', async () => {
      await mkdir(join(tempDir, 'packages', 'ui'), { recursive: true });
      await mkdir(join(tempDir, 'packages', 'utils'), { recursive: true });

      const result = await scanProject(tempDir);

      expect(result.services.length).toBe(2);
      expect(result.services.every((s) => s.type === 'package')).toBe(true);
    });

    it('should generate correct envOutput paths', async () => {
      await mkdir(join(tempDir, 'apps', 'api'), { recursive: true });

      const result = await scanProject(tempDir);

      const apiService = result.services.find((s) => s.name === 'api');
      // Use path normalization for cross-platform compatibility
      expect(apiService?.envOutput.replace(/\\/g, '/')).toBe('apps/api/.env');
    });
  });

  describe('wizard integration', () => {
    it('should create valid config structure', async () => {
      // Create structure
      await mkdir(join(tempDir, 'apps', 'api'), { recursive: true });
      await mkdir(join(tempDir, 'apps', 'worker'), { recursive: true });

      // Run wizard by importing it (this would normally be interactive)
      // For integration test, we just verify the module can be imported
      const { wizardCommand } = await import(
        '../../../src/cli/commands/wizard.js'
      );

      expect(wizardCommand).toBeDefined();
      expect(wizardCommand.name()).toBe('wizard');
    });
  });

  describe('config generation', () => {
    it('should generate valid JSON config', async () => {
      const { generateConfigJson } = await import(
        '../../../src/core/config/load-config.js'
      );

      const config = {
        version: 1,
        secretsDir: 'secrets',
        services: {
          api: { envOutput: 'apps/api/.env' },
          worker: { envOutput: 'apps/worker/.env' },
        },
      };

      const json = generateConfigJson(config);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.secretsDir).toBe('secrets');
      expect(parsed.services.api.envOutput).toBe('apps/api/.env');
    });
  });
});
