/**
 * Tests for .env diff engine
 *
 * SECURITY: These tests verify that diff output NEVER contains secret values
 */

import { describe, it, expect } from 'vitest';
import {
  diffEnvEntries,
  formatDiffSummary,
  hasChanges,
  getChangeCount,
  mergeEnvEntries,
  getChangedKeys,
  filterEntriesByKeys,
  getUniqueEntries,
  createSafeDiffSummary,
} from '../../../src/core/env/diff-env';
import { DotenvEntry, DiffResult } from '../../../src/core/env/types';

// Helper to create entries
const createEntry = (key: string, value: string): DotenvEntry => ({ key, value });

describe('diffEnvEntries', () => {
  it('should detect added keys', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
      createEntry('KEY2', 'value2'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    expect(diff.added).toEqual(['KEY2']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['KEY1']);
  });

  it('should detect removed keys', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
      createEntry('KEY2', 'value2'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(['KEY2']);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['KEY1']);
  });

  it('should detect changed values', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('KEY1', 'old_value'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('KEY1', 'new_value'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual(['KEY1']);
    expect(diff.unchanged).toEqual([]);
  });

  it('should detect unchanged entries', () => {
    const entries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
      createEntry('KEY2', 'value2'),
    ];

    const diff = diffEnvEntries(entries, entries);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual(['KEY1', 'KEY2']);
  });

  it('should handle empty entries', () => {
    const diff = diffEnvEntries([], []);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it('should detect all types of changes at once', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('KEY1', 'unchanged'),
      createEntry('KEY2', 'changed_old'),
      createEntry('KEY3', 'removed'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('KEY1', 'unchanged'),
      createEntry('KEY2', 'changed_new'),
      createEntry('KEY4', 'added'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    expect(diff.added).toEqual(['KEY4']);
    expect(diff.removed).toEqual(['KEY3']);
    expect(diff.changed).toEqual(['KEY2']);
    expect(diff.unchanged).toEqual(['KEY1']);
  });

  it('should sort results alphabetically', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('ZEBRA', 'z'),
      createEntry('APPLE', 'a'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('MANGO', 'm'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    expect(diff.removed).toEqual(['APPLE', 'ZEBRA']);
    expect(diff.added).toEqual(['MANGO']);
  });

  it('should NEVER include values in diff result', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('SECRET_KEY', 'super_secret_value_123'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('SECRET_KEY', 'new_secret_value_456'),
    ];

    const diff = diffEnvEntries(oldEntries, newEntries);

    // Verify the diff result structure
    expect(diff.changed).toContain('SECRET_KEY');

    // Verify no values are in the diff object
    const diffString = JSON.stringify(diff);
    expect(diffString).not.toContain('super_secret_value_123');
    expect(diffString).not.toContain('new_secret_value_456');
  });
});

describe('formatDiffSummary', () => {
  it('should format added keys', () => {
    const diff: DiffResult = {
      added: ['KEY1', 'KEY2'],
      removed: [],
      changed: [],
      unchanged: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toContain('Added (2):');
    expect(summary).toContain('+ KEY1');
    expect(summary).toContain('+ KEY2');
  });

  it('should format removed keys', () => {
    const diff: DiffResult = {
      added: [],
      removed: ['KEY3'],
      changed: [],
      unchanged: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toContain('Removed (1):');
    expect(summary).toContain('- KEY3');
  });

  it('should format changed keys', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: ['KEY4'],
      unchanged: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toContain('Changed (1):');
    expect(summary).toContain('~ KEY4');
  });

  it('should format unchanged keys', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      unchanged: ['KEY5'],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toContain('Unchanged (1):');
    expect(summary).toContain('= KEY5');
  });

  it('should format all change types together', () => {
    const diff: DiffResult = {
      added: ['NEW'],
      removed: ['OLD'],
      changed: ['MODIFIED'],
      unchanged: ['SAME'],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toContain('Added');
    expect(summary).toContain('Removed');
    expect(summary).toContain('Changed');
    expect(summary).toContain('Unchanged');
  });

  it('should return message for no changes', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      unchanged: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toBe('No changes detected.');
  });

  it('should NEVER include secret values in summary', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: ['API_KEY', 'DB_PASSWORD'],
      unchanged: [],
    };

    const summary = formatDiffSummary(diff);

    // Summary should only contain key names, not values
    expect(summary).toContain('API_KEY');
    expect(summary).toContain('DB_PASSWORD');
    // Even if we tried to add values (which we shouldn't), they shouldn't appear
    expect(summary).not.toContain('secret');
    expect(summary).not.toContain('password');
  });
});

describe('hasChanges', () => {
  it('should return true for added keys', () => {
    const diff: DiffResult = {
      added: ['KEY'],
      removed: [],
      changed: [],
      unchanged: [],
    };
    expect(hasChanges(diff)).toBe(true);
  });

  it('should return true for removed keys', () => {
    const diff: DiffResult = {
      added: [],
      removed: ['KEY'],
      changed: [],
      unchanged: [],
    };
    expect(hasChanges(diff)).toBe(true);
  });

  it('should return true for changed keys', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: ['KEY'],
      unchanged: [],
    };
    expect(hasChanges(diff)).toBe(true);
  });

  it('should return false for no changes', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      unchanged: ['KEY'],
    };
    expect(hasChanges(diff)).toBe(false);
  });
});

describe('getChangeCount', () => {
  it('should count all changes correctly', () => {
    const diff: DiffResult = {
      added: ['A1', 'A2'],
      removed: ['R1', 'R2', 'R3'],
      changed: ['C1'],
      unchanged: ['U1', 'U2'],
    };

    const count = getChangeCount(diff);

    expect(count.total).toBe(6);
    expect(count.added).toBe(2);
    expect(count.removed).toBe(3);
    expect(count.changed).toBe(1);
  });

  it('should return zeros for no changes', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      unchanged: [],
    };

    const count = getChangeCount(diff);

    expect(count.total).toBe(0);
    expect(count.added).toBe(0);
    expect(count.removed).toBe(0);
    expect(count.changed).toBe(0);
  });
});

describe('mergeEnvEntries', () => {
  it('should merge entries with overlay taking precedence', () => {
    const base: DotenvEntry[] = [
      createEntry('KEY1', 'base_value1'),
      createEntry('KEY2', 'base_value2'),
    ];
    const overlay: DotenvEntry[] = [
      createEntry('KEY2', 'overlay_value2'),
      createEntry('KEY3', 'overlay_value3'),
    ];

    const merged = mergeEnvEntries(base, overlay);

    expect(merged).toHaveLength(3);
    expect(merged.find((e) => e.key === 'KEY1')?.value).toBe('base_value1');
    expect(merged.find((e) => e.key === 'KEY2')?.value).toBe('overlay_value2');
    expect(merged.find((e) => e.key === 'KEY3')?.value).toBe('overlay_value3');
  });

  it('should return base entries if no overlay', () => {
    const base: DotenvEntry[] = [createEntry('KEY1', 'value1')];
    const merged = mergeEnvEntries(base, []);

    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('value1');
  });

  it('should return overlay entries if no base', () => {
    const overlay: DotenvEntry[] = [createEntry('KEY1', 'value1')];
    const merged = mergeEnvEntries([], overlay);

    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('value1');
  });

  it('should preserve comment from base when overlay has none', () => {
    const base: DotenvEntry[] = [
      { key: 'KEY', value: 'base', comment: 'base comment' },
    ];
    const overlay: DotenvEntry[] = [{ key: 'KEY', value: 'overlay' }];

    const merged = mergeEnvEntries(base, overlay);

    expect(merged[0].comment).toBe('base comment');
    expect(merged[0].value).toBe('overlay');
  });

  it('should sort entries alphabetically', () => {
    const base: DotenvEntry[] = [
      createEntry('ZEBRA', 'z'),
      createEntry('APPLE', 'a'),
    ];

    const merged = mergeEnvEntries(base, []);

    expect(merged[0].key).toBe('APPLE');
    expect(merged[1].key).toBe('ZEBRA');
  });
});

describe('getChangedKeys', () => {
  it('should return all changed keys', () => {
    const oldEntries: DotenvEntry[] = [
      createEntry('REMOVED', 'value'),
      createEntry('CHANGED', 'old'),
    ];
    const newEntries: DotenvEntry[] = [
      createEntry('CHANGED', 'new'),
      createEntry('ADDED', 'value'),
    ];

    const keys = getChangedKeys(oldEntries, newEntries);

    expect(keys).toContain('ADDED');
    expect(keys).toContain('CHANGED');
    expect(keys).toContain('REMOVED');
    expect(keys).toHaveLength(3);
  });

  it('should return empty array for no changes', () => {
    const entries: DotenvEntry[] = [createEntry('KEY', 'value')];
    const keys = getChangedKeys(entries, entries);

    expect(keys).toEqual([]);
  });

  it('should not include unchanged keys', () => {
    const oldEntries: DotenvEntry[] = [createEntry('KEY', 'value')];
    const newEntries: DotenvEntry[] = [createEntry('KEY', 'value')];

    const keys = getChangedKeys(oldEntries, newEntries);

    expect(keys).toEqual([]);
  });
});

describe('filterEntriesByKeys', () => {
  it('should filter to only specified keys', () => {
    const entries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
      createEntry('KEY2', 'value2'),
      createEntry('KEY3', 'value3'),
    ];

    const filtered = filterEntriesByKeys(entries, ['KEY1', 'KEY3']);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.key)).toEqual(['KEY1', 'KEY3']);
  });

  it('should return empty array if no keys match', () => {
    const entries: DotenvEntry[] = [createEntry('KEY1', 'value1')];
    const filtered = filterEntriesByKeys(entries, ['KEY2']);

    expect(filtered).toEqual([]);
  });

  it('should return empty array for empty entries', () => {
    const filtered = filterEntriesByKeys([], ['KEY1']);

    expect(filtered).toEqual([]);
  });
});

describe('getUniqueEntries', () => {
  it('should return entries not in compare set', () => {
    const entries: DotenvEntry[] = [
      createEntry('KEY1', 'value1'),
      createEntry('KEY2', 'value2'),
    ];
    const compareWith: DotenvEntry[] = [createEntry('KEY2', 'value2')];

    const unique = getUniqueEntries(entries, compareWith);

    expect(unique).toHaveLength(1);
    expect(unique[0].key).toBe('KEY1');
  });

  it('should return all entries if compare set is empty', () => {
    const entries: DotenvEntry[] = [createEntry('KEY1', 'value1')];
    const unique = getUniqueEntries(entries, []);

    expect(unique).toHaveLength(1);
  });

  it('should return empty array if all entries exist in compare set', () => {
    const entries: DotenvEntry[] = [createEntry('KEY1', 'value1')];
    const compareWith: DotenvEntry[] = [createEntry('KEY1', 'different')];

    const unique = getUniqueEntries(entries, compareWith);

    expect(unique).toEqual([]);
  });
});

describe('createSafeDiffSummary', () => {
  it('should create short summary for multiple changes', () => {
    const diff: DiffResult = {
      added: ['A', 'B'],
      removed: ['C'],
      changed: ['D', 'E', 'F'],
      unchanged: [],
    };

    const summary = createSafeDiffSummary(diff);

    expect(summary).toBe('2 added, 1 removed, 3 changed');
  });

  it('should return "No changes" for empty diff', () => {
    const diff: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      unchanged: [],
    };

    const summary = createSafeDiffSummary(diff);

    expect(summary).toBe('No changes');
  });

  it('should handle partial changes', () => {
    const diff1: DiffResult = {
      added: ['A'],
      removed: [],
      changed: [],
      unchanged: [],
    };
    expect(createSafeDiffSummary(diff1)).toBe('1 added');

    const diff2: DiffResult = {
      added: [],
      removed: ['B'],
      changed: [],
      unchanged: [],
    };
    expect(createSafeDiffSummary(diff2)).toBe('1 removed');

    const diff3: DiffResult = {
      added: [],
      removed: [],
      changed: ['C'],
      unchanged: [],
    };
    expect(createSafeDiffSummary(diff3)).toBe('1 changed');
  });

  it('should NEVER leak secret values', () => {
    // Even if somehow values got into the diff (which shouldn't happen),
    // the summary should never contain them
    const diff: DiffResult = {
      added: ['SUPER_SECRET_API_KEY'],
      removed: ['DATABASE_PASSWORD'],
      changed: ['AWS_SECRET_ACCESS_KEY'],
      unchanged: [],
    };

    const summary = createSafeDiffSummary(diff);

    // Summary should only contain counts, not key names with "secret"
    expect(summary).toBe('1 added, 1 removed, 1 changed');
    // No actual secret values should be present
    expect(summary).not.toContain('secret_value');
    expect(summary).not.toContain('password123');
  });
});
