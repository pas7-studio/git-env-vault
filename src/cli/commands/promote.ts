/**
 * Promote command - moves local override value to shared secrets
 *
 * @module gev:cli/commands/promote
 *
 * SECURITY: This command NEVER prints secret values, only key names.
 */

import { Command } from 'commander';
import { join } from 'path';
import {
  loadConfig,
  SopsAdapter,
  ConfigError,
  SopsError,
  GitAdapter,
} from '../../core/index.js';
import {
  getLocalOverride,
  removeLocalOverrideKey,
  hasLocalOverrides,
  getLocalOverrideKeys,
} from '../../core/env/local-overrides.js';

export interface PromoteOptions {
  env: string;
  service: string;
  key: string;
  commit?: boolean;
}

/**
 * Promote a local override value to shared secrets
 *
 * This command:
 * 1. Reads the local override value for the specified key
 * 2. Decrypts the shared secrets file
 * 3. Updates or adds the key with the local value
 * 4. Encrypts the file back
 * 5. Optionally commits the change
 * 6. Removes the local override
 *
 * SECURITY: Never prints the value, only the key name.
 */
export async function promoteCommandAction(options: PromoteOptions): Promise<void> {
  const cwd = process.cwd();
  const { env, service, key, commit = false } = options;

  // Load config
  let config;
  try {
    config = await loadConfig(cwd);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  // Check service exists
  if (!config.services[service]) {
    console.error(`❌ Service "${service}" not found in configuration`);
    console.error(`   Available services: ${Object.keys(config.services).join(', ') || 'none'}`);
    process.exit(1);
  }

  // Determine repo identifier for local overrides
  const repoId = config.repo?.name || cwd.split('/').pop() || 'default';

  // Check if local override exists
  const overrideValue = await getLocalOverride(
    { repo: repoId, env, service, mode: 'home' },
    key
  );

  if (overrideValue === undefined) {
    // Also check local mode
    const localValue = await getLocalOverride(
      { repo: repoId, env, service, mode: 'local', baseDir: cwd },
      key
    );

    if (localValue === undefined) {
      console.error(`❌ No local override found for key "${key}"`);
      console.error(`   Environment: ${env}`);
      console.error(`   Service: ${service}`);

      // Show available override keys
      const homeKeys = await getLocalOverrideKeys({ repo: repoId, env, service, mode: 'home' });
      const localKeys = await getLocalOverrideKeys({
        repo: repoId,
        env,
        service,
        mode: 'local',
        baseDir: cwd,
      });

      const allKeys = [...new Set([...homeKeys, ...localKeys])].sort();
      if (allKeys.length > 0) {
        console.error(`   Available override keys: ${allKeys.join(', ')}`);
      }
      process.exit(1);
    }

    // Use local mode value
    await performPromote(
      cwd,
      config.secretsDir,
      env,
      service,
      key,
      localValue,
      commit,
      repoId,
      'local'
    );
  } else {
    // Use home mode value
    await performPromote(
      cwd,
      config.secretsDir,
      env,
      service,
      key,
      overrideValue,
      commit,
      repoId,
      'home'
    );
  }
}

/**
 * Internal function to perform the actual promotion
 */
async function performPromote(
  cwd: string,
  secretsDir: string,
  env: string,
  service: string,
  key: string,
  value: string,
  commit: boolean,
  repoId: string,
  mode: 'home' | 'local'
): Promise<void> {
  const sops = new SopsAdapter();
  const git = new GitAdapter(cwd);

  // Check sops availability
  if (!(await sops.isAvailable())) {
    console.error('❌ SOPS binary not found. Install SOPS first.');
    console.log('   https://github.com/getsops/sops#install');
    process.exit(1);
  }

  const secretPath = join(cwd, secretsDir, env, `${service}.sops.yaml`);

  console.log(`\n📤 Promoting key "${key}" from local to shared...`);
  console.log(`   Environment: ${env}`);
  console.log(`   Service: ${service}`);

  try {
    // Decrypt secrets file
    const { data } = await sops.decrypt(secretPath);

    // Check if key already exists (for logging purposes only)
    const keyExists = key in data;

    // Update the data with the local value
    data[key] = value;

    // Encrypt and save
    await sops.encryptData(secretPath, data);

    // Remove the local override (securely - no value in logs)
    const removed =
      mode === 'local'
        ? await removeLocalOverrideKey({ repo: repoId, env, service, mode: 'local', baseDir: cwd }, key)
        : await removeLocalOverrideKey({ repo: repoId, env, service, mode: 'home' }, key);

    if (!removed) {
      console.warn(`   ⚠️  Warning: Could not remove local override file`);
    }

    // Optionally commit
    if (commit) {
      const relativeSecretPath = join(secretsDir, env, `${service}.sops.yaml`);
      const commitMessage = `chore(secrets): promote ${key} from local override (${env}/${service})`;

      await git.commit({
        message: commitMessage,
        add: [relativeSecretPath],
      });

      console.log(`   ✅ Committed changes`);
    }

    // Success message - NEVER include the value!
    if (keyExists) {
      console.log(`   ✅ Updated key "${key}" in shared secrets`);
    } else {
      console.log(`   ✅ Added key "${key}" to shared secrets`);
    }
    console.log(`   ✅ Removed local override for "${key}"`);
    console.log(`\n✅ Promoted ${key} from local to shared (env=${env}, service=${service})`);
  } catch (error) {
    if (error instanceof SopsError) {
      console.error(`   ❌ SOPS error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Promote all local overrides for a service/environment
 */
export async function promoteAllCommandAction(options: {
  env: string;
  service: string;
  commit?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const { env, service, commit = false } = options;

  // Load config
  let config;
  try {
    config = await loadConfig(cwd);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  // Check service exists
  if (!config.services[service]) {
    console.error(`❌ Service "${service}" not found in configuration`);
    process.exit(1);
  }

  const repoId = config.repo?.name || cwd.split('/').pop() || 'default';

  // Get all override keys
  const homeKeys = await getLocalOverrideKeys({ repo: repoId, env, service, mode: 'home' });
  const localKeys = await getLocalOverrideKeys({
    repo: repoId,
    env,
    service,
    mode: 'local',
    baseDir: cwd,
  });

  const allKeys = [...new Set([...homeKeys, ...localKeys])].sort();

  if (allKeys.length === 0) {
    console.log(`No local overrides found for ${env}/${service}`);
    return;
  }

  console.log(`\n📤 Promoting ${allKeys.length} keys from local to shared...`);
  console.log(`   Keys: ${allKeys.join(', ')}`);

  // Promote each key
  for (const key of allKeys) {
    // Check home first, then local
    let value = await getLocalOverride({ repo: repoId, env, service, mode: 'home' }, key);
    let mode: 'home' | 'local' = 'home';

    if (value === undefined) {
      value = await getLocalOverride(
        { repo: repoId, env, service, mode: 'local', baseDir: cwd },
        key
      );
      mode = 'local';
    }

    if (value !== undefined) {
      await performPromote(cwd, config.secretsDir, env, service, key, value, false, repoId, mode);
    }
  }

  // Single commit for all changes if requested
  if (commit) {
    const git = new GitAdapter(cwd);
    const relativeSecretPath = join(config.secretsDir, env, `${service}.sops.yaml`);
    const commitMessage = `chore(secrets): promote all local overrides (${env}/${service})`;

    await git.commit({
      message: commitMessage,
      add: [relativeSecretPath],
    });

    console.log(`\n   ✅ Committed all changes`);
  }

  console.log(`\n✅ Promoted ${allKeys.length} keys from local to shared (env=${env}, service=${service})`);
}

// Export the command definition
export const promoteCommand = new Command('promote')
  .description('Promote a local override value to shared secrets')
  .requiredOption('--env <env>', 'Environment (dev, staging, prod)')
  .requiredOption('--service <service>', 'Service name')
  .requiredOption('--key <key>', 'Key to promote')
  .option('--commit', 'Commit the changes after promotion', false)
  .action(promoteCommandAction);

// Additional command to promote all overrides
export const promoteAllCommand = new Command('promote-all')
  .description('Promote all local overrides to shared secrets')
  .requiredOption('--env <env>', 'Environment (dev, staging, prod)')
  .requiredOption('--service <service>', 'Service name')
  .option('--commit', 'Commit the changes after promotion', false)
  .action(promoteAllCommandAction);
