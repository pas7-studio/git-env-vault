/**
 * Environment variable utilities module
 * @module gev:core/env
 * 
 * Provides parsing, rendering, and diffing of .env files
 */

// Types
export * from './types.js'

// Parsing
export { 
  parseDotenv, 
  parseSimple,
  extractManagedBlock,
  findAllManagedBlocks,
  getKeys,
  hasKey,
  getValue,
  getEntry,
  MANAGED_BLOCK_START,
  MANAGED_BLOCK_END
} from './parse-dotenv.js'

// Rendering
export { 
  renderEntry,
  renderDotenv, 
  renderEntries, 
  renderEntriesSimple, 
  createEntry,
  updateEntryValue,
  renderManagedBlock,
  insertManagedBlock,
  removeManagedBlock,
  unescapeValue 
} from './render-dotenv.js'

// Diffing
export { 
  diffEnv, 
  diffEnvWithValues,
  diffEnvEntries,
  formatSafeDiff, 
  formatUnsafeDiff,
  diffSecretsFiles,
  hasChanges,
  formatDiffSummaryWithOptions,
  formatDiffSummary,
  getDiffSummary,
  mergeEnvEntries,
  getChangeCount,
  getChangedKeys,
  filterEntriesByKeys,
  getUniqueEntries,
  createSafeDiffSummary,
  getOneLineSummary,
  formatDiffAsMarkdown
} from './diff-env.js'

// Local overrides
export * from './local-overrides.js'
