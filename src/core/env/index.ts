/**
 * Environment file parsing, rendering, and diff module
 *
 * @module gev:core/env
 *
 * This module provides comprehensive support for .env file manipulation:
 * - Parsing .env files with support for comments, quotes, and exports
 * - Rendering .env files with managed blocks
 * - Diffing environment entries without exposing secret values
 * - Local overrides management for development
 *
 * SECURITY: This module handles secret values but is designed to never
 * leak them through logging or diff output.
 */

// Types
export * from './types.js';

// Parser
export * from './parse-dotenv.js';

// Renderer
export * from './render-dotenv.js';

// Diff engine
export * from './diff-env.js';

// Local overrides
export * from './local-overrides.js';

// Re-export with aliases for backwards compatibility
import { diffEnvEntries } from './diff-env.js';
import { formatDiffSummary } from './diff-env.js';
import { createSafeDiffSummary } from './diff-env.js';

/** @deprecated Use diffEnvEntries instead */
export const diffEnv = diffEnvEntries;

/** @deprecated Use formatDiffSummary instead */
export const formatSafeDiff = formatDiffSummary;

/** 
 * Format diff for internal use (still safe - no values)
 * @deprecated Use formatDiffSummary instead
 */
export const formatUnsafeDiff = formatDiffSummary;
