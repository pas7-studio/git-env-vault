/**
 * Tests for diff summary formatting
 */

import { describe, it, expect } from 'vitest';
import {
  diffEnvEntries,
  formatDiffSummaryWithOptions,
  diffSecretsFiles,
  getOneLineSummary,
  formatDiffAsMarkdown,
  getChangeCount,
  createSafeDiffSummary,
  type DotenvEntry,
  type DiffResult,
} from '../../../src/core/env/diff-env.js';

describe('diff-summary', () => {
  const createEntry = (key: string, value: string): DotenvEntry => ({
    key,
    value,
  });

  describe('formatDiffSummaryWithOptions', () => {
    it('should format empty diff', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff);
      expect(result).toBe('No changes detected.');
    });

    it('should format added keys', () => {
      const diff: DiffResult = {
        added: ['KEY1', 'KEY2'],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff);
      expect(result).toContain('Added (2)');
      expect(result).toContain('+ KEY1');
      expect(result).toContain('+ KEY2');
    });

    it('should format removed keys', () => {
      const diff: DiffResult = {
        added: [],
        removed: ['OLD_KEY'],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff);
      expect(result).toContain('Removed (1)');
      expect(result).toContain('- OLD_KEY');
    });

    it('should format changed keys', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: ['CHANGED_KEY'],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff);
      expect(result).toContain('Changed (1)');
      expect(result).toContain('~ CHANGED_KEY');
    });

    it('should format unchanged keys when showUnchanged is true', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: ['SAME_KEY'],
      };

      const result = formatDiffSummaryWithOptions(diff, { showUnchanged: true });
      expect(result).toContain('Unchanged (1)');
      expect(result).toContain('= SAME_KEY');
    });

    it('should hide unchanged keys by default', () => {
      const diff: DiffResult = {
        added: ['NEW_KEY'],
        removed: [],
        changed: [],
        unchanged: ['SAME_KEY'],
      };

      const result = formatDiffSummaryWithOptions(diff);
      expect(result).not.toContain('Unchanged');
      expect(result).not.toContain('= SAME_KEY');
    });

    it('should format in compact mode', () => {
      const diff: DiffResult = {
        added: ['KEY1', 'KEY2'],
        removed: ['OLD_KEY'],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff, { compact: true });
      expect(result).toContain('+ [2]');
      expect(result).toContain('- [1]');
    });

    it('should colorize output when colorize is true', () => {
      const diff: DiffResult = {
        added: ['KEY1'],
        removed: ['KEY2'],
        changed: ['KEY3'],
        unchanged: [],
      };

      const result = formatDiffSummaryWithOptions(diff, { colorize: true });
      expect(result).toContain('\x1b[32m'); // green for added
      expect(result).toContain('\x1b[31m'); // red for removed
      expect(result).toContain('\x1b[33m'); // yellow for changed
    });

    it('should format all changes together', () => {
      const diff: DiffResult = {
        added: ['NEW'],
        removed: ['OLD'],
        changed: ['MODIFIED'],
        unchanged: ['SAME'],
      };

      const result = formatDiffSummaryWithOptions(diff, { showUnchanged: true });
      expect(result).toContain('Added');
      expect(result).toContain('Removed');
      expect(result).toContain('Changed');
      expect(result).toContain('Unchanged');
    });
  });

  describe('diffSecretsFiles', () => {
    it('should compare two sets of entries', () => {
      const oldEntries: DotenvEntry[] = [
        createEntry('KEY1', 'value1'),
        createEntry('KEY2', 'value2'),
      ];

      const newEntries: DotenvEntry[] = [
        createEntry('KEY1', 'value1'),
        createEntry('KEY2', 'new-value2'),
        createEntry('KEY3', 'value3'),
      ];

      const result = diffSecretsFiles(oldEntries, newEntries);

      expect(result.added).toEqual(['KEY3']);
      expect(result.removed).toEqual([]);
      expect(result.changed).toEqual(['KEY2']);
      expect(result.unchanged).toEqual(['KEY1']);
    });

    it('should be identical to diffEnvEntries', () => {
      const oldEntries: DotenvEntry[] = [createEntry('A', '1')];
      const newEntries: DotenvEntry[] = [createEntry('A', '2'), createEntry('B', '3')];

      const result1 = diffEnvEntries(oldEntries, newEntries);
      const result2 = diffSecretsFiles(oldEntries, newEntries);

      expect(result1).toEqual(result2);
    });

    it('should never expose values in result', () => {
      const oldEntries: DotenvEntry[] = [createEntry('SECRET', 'super-secret-value')];
      const newEntries: DotenvEntry[] = [createEntry('SECRET', 'different-secret')];

      const result = diffSecretsFiles(oldEntries, newEntries);

      expect(result.changed).toContain('SECRET');
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(JSON.stringify(result)).not.toContain('value');
    });
  });

  describe('getOneLineSummary', () => {
    it('should return "No changes" for empty diff', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
      };

      expect(getOneLineSummary(diff)).toBe('No changes');
    });

    it('should summarize changes in one line', () => {
      const diff: DiffResult = {
        added: ['A', 'B'],
        removed: ['C'],
        changed: ['D', 'E', 'F'],
        unchanged: [],
      };

      const result = getOneLineSummary(diff);
      expect(result).toBe('6 changes: +2 -1 ~3');
    });
  });

  describe('formatDiffAsMarkdown', () => {
    it('should format empty diff as markdown', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffAsMarkdown(diff);
      expect(result).toContain('## Environment Changes');
      expect(result).toContain('No changes detected');
    });

    it('should format added keys as markdown', () => {
      const diff: DiffResult = {
        added: ['KEY1', 'KEY2'],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffAsMarkdown(diff);
      expect(result).toContain('### Added');
      expect(result).toContain('- `KEY1`');
      expect(result).toContain('- `KEY2`');
    });

    it('should format removed keys as markdown', () => {
      const diff: DiffResult = {
        added: [],
        removed: ['OLD_KEY'],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffAsMarkdown(diff);
      expect(result).toContain('### Removed');
      expect(result).toContain('- `OLD_KEY`');
    });

    it('should format changed keys as markdown', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: ['MODIFIED'],
        unchanged: [],
      };

      const result = formatDiffAsMarkdown(diff);
      expect(result).toContain('### Changed');
      expect(result).toContain('- `MODIFIED`');
    });

    it('should never include values in markdown', () => {
      const diff: DiffResult = {
        added: ['NEW_SECRET'],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const result = formatDiffAsMarkdown(diff);
      expect(result).toContain('NEW_SECRET');
      expect(result).not.toContain('value');
      expect(result).not.toContain('=');
    });
  });

  describe('getChangeCount', () => {
    it('should count all changes', () => {
      const diff: DiffResult = {
        added: ['A', 'B'],
        removed: ['C'],
        changed: ['D', 'E'],
        unchanged: ['F', 'G', 'H'],
      };

      const counts = getChangeCount(diff);
      expect(counts.added).toBe(2);
      expect(counts.removed).toBe(1);
      expect(counts.changed).toBe(2);
      expect(counts.total).toBe(5);
    });

    it('should return zero for empty diff', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
      };

      const counts = getChangeCount(diff);
      expect(counts.total).toBe(0);
    });
  });

  describe('createSafeDiffSummary', () => {
    it('should create safe one-line summary', () => {
      const diff: DiffResult = {
        added: ['A'],
        removed: ['B', 'C'],
        changed: [],
        unchanged: [],
      };

      const result = createSafeDiffSummary(diff);
      expect(result).toBe('1 added, 2 removed');
    });

    it('should return "No changes" for empty diff', () => {
      const diff: DiffResult = {
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
      };

      expect(createSafeDiffSummary(diff)).toBe('No changes');
    });
  });

  describe('security tests', () => {
    it('should never expose values in any format function', () => {
      const diff: DiffResult = {
        added: ['SECRET_KEY'],
        removed: ['PASSWORD'],
        changed: ['API_KEY'],
        unchanged: ['TOKEN'],
      };

      // All format functions should only output keys
      const formatted = formatDiffSummaryWithOptions(diff, { showUnchanged: true });
      const markdown = formatDiffAsMarkdown(diff);
      const oneLine = getOneLineSummary(diff);
      const safe = createSafeDiffSummary(diff);

      // None should contain typical value patterns
      const outputs = [formatted, markdown, oneLine, safe];
      for (const output of outputs) {
        // Note: "=" is used as a prefix for unchanged keys, not for value assignments
        // Check for actual value assignment patterns like KEY="value" or KEY=value
        expect(output).not.toMatch(/KEY\s*=\s*["']?value/i);
        expect(output).not.toMatch(/"value"/i);
        expect(output).not.toMatch(/secret.*=\s*\w+/i);
      }
    });
  });
});
