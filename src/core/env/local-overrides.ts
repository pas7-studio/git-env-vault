/**
 * Local overrides management for gev
 *
 * @module gev:core/env/local-overrides
 *
 * Provides functionality to store and manage local override values
 * that take precedence over shared secrets during development.
 *
 * SECURITY: This module handles secret values but never logs them.
 *
 * Two modes are supported:
 * - home: ~/.gev/overrides/<repo>/<env>/<service>.env
 * - local: apps/<service>/.env.local (in project directory)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DotenvEntry } from './types.js';
import { parseDotenv } from './parse-dotenv.js';
import { renderEntriesSimple, createEntry } from './render-dotenv.js';
import { mergeEnvEntries } from './diff-env.js';

/** Default overrides directory (can be overridden via GEV_OVERRIDES_DIR) */
const GEV_OVERRIDES_DIR = process.env.GEV_OVERRIDES_DIR || '~/.gev/overrides';

/**
 * Options for local overrides path
 */
export interface LocalOverridesPathOptions {
  /** Repository name or hash for uniqueness */
  repo: string;
  /** Environment name (dev, staging, prod) */
  env: string;
  /** Service name */
  service: string;
  /** Storage mode: 'home' = ~/.gev/overrides/, 'local' = apps/<service>/.env.local */
  mode?: 'home' | 'local';
}

/**
 * Options for reading/writing local overrides
 */
export interface LocalOverridesOptions {
  /** Repository name or hash */
  repo: string;
  /** Environment name */
  env: string;
  /** Service name */
  service: string;
  /** Storage mode (defaults to 'home') */
  mode?: 'home' | 'local';
  /** Base directory for local mode (defaults to process.cwd()) */
  baseDir?: string;
}

/**
 * Expand tilde path to absolute path
 */
function expandTilde(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Generate a safe directory name from repo identifier
 * Uses hash if repo name contains problematic characters
 */
function safeRepoName(repo: string): string {
  // Replace problematic characters with underscore
  return repo.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Get the path to the local override file
 *
 * @param options - Path options
 * @returns Absolute path to the override file
 */
export function getLocalOverridesPath(options: LocalOverridesPathOptions): string {
  const { repo, env, service, mode = 'home' } = options;

  if (mode === 'local') {
    // Local mode: apps/<service>/.env.local in project directory
    // This is a relative path that should be joined with baseDir
    return path.join('apps', service, '.env.local');
  }

  // Home mode: ~/.gev/overrides/<repo>/<env>/<service>.env
  const overridesBase = expandTilde(GEV_OVERRIDES_DIR);
  const safeRepo = safeRepoName(repo);
  return path.join(overridesBase, safeRepo, env, `${service}.env`);
}

/**
 * Read local overrides from file
 *
 * @param options - Override options
 * @returns Array of DotenvEntry objects (empty if file doesn't exist)
 */
export async function readLocalOverrides(
  options: LocalOverridesOptions
): Promise<DotenvEntry[]> {
  const { mode = 'home', baseDir = process.cwd() } = options;

  const overridePath =
    mode === 'local'
      ? path.join(baseDir, getLocalOverridesPath({ ...options, mode }))
      : getLocalOverridesPath({ ...options, mode });

  try {
    const content = await fs.promises.readFile(overridePath, 'utf-8');
    const parsed = parseDotenv(content);
    return parsed.entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - no overrides
      return [];
    }
    throw error;
  }
}

/**
 * Synchronous version of readLocalOverrides
 *
 * @param options - Override options
 * @returns Array of DotenvEntry objects (empty if file doesn't exist)
 */
export function readLocalOverridesSync(options: LocalOverridesOptions): DotenvEntry[] {
  const { mode = 'home', baseDir = process.cwd() } = options;

  const overridePath =
    mode === 'local'
      ? path.join(baseDir, getLocalOverridesPath({ ...options, mode }))
      : getLocalOverridesPath({ ...options, mode });

  try {
    const content = fs.readFileSync(overridePath, 'utf-8');
    const parsed = parseDotenv(content);
    return parsed.entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Write local overrides to file
 *
 * @param options - Override options
 * @param entries - Array of DotenvEntry objects to write
 */
export async function writeLocalOverrides(
  options: LocalOverridesOptions,
  entries: DotenvEntry[]
): Promise<void> {
  const { mode = 'home', baseDir = process.cwd() } = options;

  const overridePath =
    mode === 'local'
      ? path.join(baseDir, getLocalOverridesPath({ ...options, mode }))
      : getLocalOverridesPath({ ...options, mode });

  // Ensure directory exists
  const dir = path.dirname(overridePath);
  await fs.promises.mkdir(dir, { recursive: true });

  // Render and write entries
  const content = renderEntriesSimple(entries);
  await fs.promises.writeFile(overridePath, content + '\n', 'utf-8');

  // Set restrictive permissions (owner read/write only)
  if (mode === 'home' && process.platform !== 'win32') {
    await fs.promises.chmod(overridePath, 0o600);
  }
}

/**
 * Delete local overrides file
 *
 * @param options - Override options
 * @returns true if file was deleted, false if it didn't exist
 */
export async function removeLocalOverrides(
  options: LocalOverridesOptions
): Promise<boolean> {
  const { mode = 'home', baseDir = process.cwd() } = options;

  const overridePath =
    mode === 'local'
      ? path.join(baseDir, getLocalOverridesPath({ ...options, mode }))
      : getLocalOverridesPath({ ...options, mode });

  try {
    await fs.promises.unlink(overridePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Remove a specific key from local overrides
 *
 * @param options - Override options
 * @param key - Key to remove
 * @returns true if key was removed, false if it didn't exist
 */
export async function removeLocalOverrideKey(
  options: LocalOverridesOptions,
  key: string
): Promise<boolean> {
  const entries = await readLocalOverrides(options);
  const initialLength = entries.length;
  const filtered = entries.filter((e) => e.key !== key);

  if (filtered.length === initialLength) {
    return false; // Key wasn't in overrides
  }

  if (filtered.length === 0) {
    // No more overrides - remove file entirely
    await removeLocalOverrides(options);
  } else {
    // Write remaining overrides
    await writeLocalOverrides(options, filtered);
  }

  return true;
}

/**
 * Set a single local override value
 *
 * @param options - Override options
 * @param key - Key to set
 * @param value - Value to set
 */
export async function setLocalOverride(
  options: LocalOverridesOptions,
  key: string,
  value: string
): Promise<void> {
  const entries = await readLocalOverrides(options);

  // Check if key already exists
  const existingIndex = entries.findIndex((e) => e.key === key);

  if (existingIndex >= 0) {
    // Update existing entry
    const existing = entries[existingIndex];
    if (existing) {
      const updatedEntry: DotenvEntry = {
        key: existing.key,
        value: value,
      };
      // Only add optional properties if they exist
      if (existing.comment !== undefined) updatedEntry.comment = existing.comment;
      if (existing.hasExport !== undefined) updatedEntry.hasExport = existing.hasExport;
      if (existing.quote !== undefined) updatedEntry.quote = existing.quote;
      entries[existingIndex] = updatedEntry;
    }
  } else {
    // Add new entry
    entries.push(createEntry(key, value));
  }

  await writeLocalOverrides(options, entries);
}

/**
 * Get a single local override value
 *
 * SECURITY: The returned value should never be logged
 *
 * @param options - Override options
 * @param key - Key to get
 * @returns Value if found, undefined otherwise
 */
export async function getLocalOverride(
  options: LocalOverridesOptions,
  key: string
): Promise<string | undefined> {
  const entries = await readLocalOverrides(options);
  const entry = entries.find((e) => e.key === key);
  return entry?.value;
}

/**
 * Check if local overrides exist
 *
 * @param options - Override options
 * @returns true if overrides file exists
 */
export async function hasLocalOverrides(
  options: LocalOverridesOptions
): Promise<boolean> {
  const { mode = 'home', baseDir = process.cwd() } = options;

  const overridePath =
    mode === 'local'
      ? path.join(baseDir, getLocalOverridesPath({ ...options, mode }))
      : getLocalOverridesPath({ ...options, mode });

  try {
    await fs.promises.access(overridePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of keys that have local overrides
 *
 * @param options - Override options
 * @returns Array of keys with local overrides
 */
export async function getLocalOverrideKeys(
  options: LocalOverridesOptions
): Promise<string[]> {
  const entries = await readLocalOverrides(options);
  return entries.map((e) => e.key).sort();
}

/**
 * Merge shared secrets with local overrides
 *
 * Local overrides take precedence over shared values.
 *
 * @param shared - Base entries from shared secrets
 * @param local - Local override entries
 * @returns Merged entries with local values taking precedence
 */
export function mergeWithOverrides(
  shared: DotenvEntry[],
  local: DotenvEntry[]
): DotenvEntry[] {
  return mergeEnvEntries(shared, local);
}

/**
 * Get only the entries that differ from shared (i.e., are overridden)
 *
 * @param shared - Base entries from shared secrets
 * @param local - Local override entries
 * @returns Entries that are different from shared
 */
export function getOverriddenEntries(
  shared: DotenvEntry[],
  local: DotenvEntry[]
): DotenvEntry[] {
  const sharedMap = new Map<string, DotenvEntry>();
  for (const entry of shared) {
    sharedMap.set(entry.key, entry);
  }

  return local.filter((localEntry) => {
    const sharedEntry = sharedMap.get(localEntry.key);
    // Include if key doesn't exist in shared OR value is different
    return !sharedEntry || sharedEntry.value !== localEntry.value;
  });
}

/**
 * Get list of keys that have different values in local vs shared
 *
 * @param shared - Base entries from shared secrets
 * @param local - Local override entries
 * @returns Array of keys that are overridden
 */
export function getOverriddenKeys(
  shared: DotenvEntry[],
  local: DotenvEntry[]
): string[] {
  const overridden = getOverriddenEntries(shared, local);
  return overridden.map((e) => e.key).sort();
}

/**
 * Ensure .env.local is in .gitignore for local mode
 *
 * @param gitignorePath - Path to .gitignore file
 * @returns true if pattern was added, false if already present
 */
export async function ensureEnvLocalInGitignore(
  gitignorePath: string
): Promise<boolean> {
  const pattern = '.env.local';

  try {
    const content = await fs.promises.readFile(gitignorePath, 'utf-8');
    const lines = content.split('\n');

    // Check if pattern already exists
    if (lines.some((line) => line.trim() === pattern)) {
      return false;
    }

    // Add pattern
    const newContent = content.trim()
      ? `${content.trim()}\n${pattern}\n`
      : `${pattern}\n`;

    await fs.promises.writeFile(gitignorePath, newContent, 'utf-8');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Create new .gitignore
      await fs.promises.writeFile(gitignorePath, `${pattern}\n`, 'utf-8');
      return true;
    }
    throw error;
  }
}
