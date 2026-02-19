/**
 * Tests for .env file renderer
 */

import { describe, it, expect } from 'vitest';
import {
  renderEntry,
  renderDotenv,
  renderManagedBlock,
  insertManagedBlock,
  removeManagedBlock,
  renderEntriesSimple,
  createEntry,
  updateEntryValue,
} from '../../../src/core/env/render-dotenv';
import { parseDotenv, MANAGED_BLOCK_START, MANAGED_BLOCK_END } from '../../../src/core/env/parse-dotenv';
import { DotenvEntry, DotenvFile } from '../../../src/core/env/types';

describe('renderEntry', () => {
  it('should render simple KEY=value', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'value' };
    expect(renderEntry(entry)).toBe('KEY=value');
  });

  it('should render export KEY=value', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'value', hasExport: true };
    expect(renderEntry(entry)).toBe('export KEY=value');
  });

  it('should render KEY="value" with double quotes', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'value', quote: 'double' };
    expect(renderEntry(entry)).toBe('KEY="value"');
  });

  it('should render KEY=\'value\' with single quotes', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'value', quote: 'single' };
    expect(renderEntry(entry)).toBe("KEY='value'");
  });

  it('should render export with quotes', () => {
    const entry: DotenvEntry = {
      key: 'KEY',
      value: 'value',
      hasExport: true,
      quote: 'double',
    };
    expect(renderEntry(entry)).toBe('export KEY="value"');
  });

  it('should escape newlines in double-quoted values', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'line1\nline2', quote: 'double' };
    expect(renderEntry(entry)).toBe('KEY="line1\\nline2"');
  });

  it('should escape tabs in double-quoted values', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'col1\tcol2', quote: 'double' };
    expect(renderEntry(entry)).toBe('KEY="col1\\tcol2"');
  });

  it('should escape double quotes in double-quoted values', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'say "hello"', quote: 'double' };
    expect(renderEntry(entry)).toBe('KEY="say \\"hello\\""');
  });

  it('should escape backslashes in double-quoted values', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'path\\to\\file', quote: 'double' };
    expect(renderEntry(entry)).toBe('KEY="path\\\\to\\\\file"');
  });

  it('should auto-quote values with spaces', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'has spaces' };
    expect(renderEntry(entry)).toBe('KEY="has spaces"');
  });

  it('should auto-quote values with equals', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'a=b' };
    expect(renderEntry(entry)).toBe('KEY="a=b"');
  });

  it('should auto-quote values with hash', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'value#comment' };
    expect(renderEntry(entry)).toBe('KEY="value#comment"');
  });

  it('should not auto-quote simple values', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'simple_value-123' };
    expect(renderEntry(entry)).toBe('KEY=simple_value-123');
  });

  it('should render empty value', () => {
    const entry: DotenvEntry = { key: 'KEY', value: '' };
    expect(renderEntry(entry)).toBe('KEY=');
  });
});

describe('renderDotenv', () => {
  it('should render entries to string', () => {
    const file: DotenvFile = {
      entries: [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ],
      rawLines: [],
    };

    const result = renderDotenv(file);
    expect(result).toContain('KEY1=value1');
    expect(result).toContain('KEY2=value2');
  });

  it('should include comments before entries', () => {
    const file: DotenvFile = {
      entries: [{ key: 'KEY', value: 'value', comment: 'This is a comment' }],
      rawLines: [],
    };

    const result = renderDotenv(file);
    expect(result).toContain('# This is a comment');
    expect(result).toContain('KEY=value');
  });

  it('should include multi-line comments', () => {
    const file: DotenvFile = {
      entries: [
        { key: 'KEY', value: 'value', comment: 'Line 1\nLine 2' },
      ],
      rawLines: [],
    };

    const result = renderDotenv(file);
    expect(result).toContain('# Line 1');
    expect(result).toContain('# Line 2');
  });
});

describe('renderManagedBlock', () => {
  it('should render a managed block with markers', () => {
    const entries: DotenvEntry[] = [
      { key: 'API_KEY', value: 'secret123' },
      { key: 'API_URL', value: 'https://api.example.com' },
    ];

    const result = renderManagedBlock('dev', 'api', entries);

    expect(result).toContain(`${MANAGED_BLOCK_START} env=dev service=api`);
    expect(result).toContain(`${MANAGED_BLOCK_END}`);
    expect(result).toContain('API_KEY=secret123');
    expect(result).toContain('API_URL=https://api.example.com');
  });

  it('should sort entries alphabetically', () => {
    const entries: DotenvEntry[] = [
      { key: 'ZEBRA', value: 'z' },
      { key: 'APPLE', value: 'a' },
      { key: 'MANGO', value: 'm' },
    ];

    const result = renderManagedBlock('dev', 'api', entries);
    const lines = result.split('\n');

    // Find the entry lines (skip markers)
    const entryLines = lines.filter(
      (l) => !l.startsWith('#') && l.includes('=')
    );

    expect(entryLines[0]).toContain('APPLE');
    expect(entryLines[1]).toContain('MANGO');
    expect(entryLines[2]).toContain('ZEBRA');
  });

  it('should handle empty entries', () => {
    const result = renderManagedBlock('dev', 'api', []);

    expect(result).toContain(`${MANAGED_BLOCK_START} env=dev service=api`);
    expect(result).toContain(`${MANAGED_BLOCK_END}`);
  });
});

describe('insertManagedBlock', () => {
  it('should insert a new block at bottom by default', () => {
    const content = 'EXISTING=value\n';
    const entries: DotenvEntry[] = [{ key: 'NEW_KEY', value: 'new_value' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries);

    expect(result).toContain('EXISTING=value');
    expect(result).toContain(`${MANAGED_BLOCK_START} env=dev service=api`);
    expect(result).toContain('NEW_KEY=new_value');
  });

  it('should insert a new block at top when position is top', () => {
    const content = 'EXISTING=value\n';
    const entries: DotenvEntry[] = [{ key: 'NEW_KEY', value: 'new_value' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries, {
      position: 'top',
    });

    const lines = result.split('\n');
    expect(lines[0]).toContain(MANAGED_BLOCK_START);
  });

  it('should update existing block', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
OLD_KEY=old_value
${MANAGED_BLOCK_END}`;

    const entries: DotenvEntry[] = [{ key: 'NEW_KEY', value: 'new_value' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries);

    expect(result).not.toContain('OLD_KEY');
    expect(result).toContain('NEW_KEY=new_value');
  });

  it('should preserve content outside the block', () => {
    const content = `BEFORE=before
${MANAGED_BLOCK_START}dev service=api
KEY=value
${MANAGED_BLOCK_END}
AFTER=after`;

    const entries: DotenvEntry[] = [{ key: 'NEW', value: 'new' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries);

    expect(result).toContain('BEFORE=before');
    expect(result).toContain('AFTER=after');
  });

  it('should handle multiple managed blocks', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
API_KEY=old
${MANAGED_BLOCK_END}
${MANAGED_BLOCK_START}dev service=web
WEB_KEY=old
${MANAGED_BLOCK_END}`;

    const apiEntries: DotenvEntry[] = [{ key: 'API_KEY', value: 'new' }];

    const result = insertManagedBlock(content, 'dev', 'api', apiEntries);

    // API block should be updated
    expect(result).toContain(`${MANAGED_BLOCK_START} env=dev service=api`);
    // WEB block should be preserved
    expect(result).toContain(`${MANAGED_BLOCK_START}dev service=web`);
    expect(result).toContain('WEB_KEY=old');
  });

  it('should handle empty content', () => {
    const content = '';
    const entries: DotenvEntry[] = [{ key: 'KEY', value: 'value' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries);

    expect(result).toContain(`${MANAGED_BLOCK_START} env=dev service=api`);
    expect(result).toContain('KEY=value');
  });

  it('should handle CRLF line endings', () => {
    const content = 'EXISTING=value\r\n';
    const entries: DotenvEntry[] = [{ key: 'KEY', value: 'value' }];

    const result = insertManagedBlock(content, 'dev', 'api', entries);

    expect(result).toContain('EXISTING=value');
    expect(result).toContain('KEY=value');
  });
});

describe('removeManagedBlock', () => {
  it('should remove a managed block', () => {
    const content = `BEFORE=before
${MANAGED_BLOCK_START}dev service=api
KEY=value
${MANAGED_BLOCK_END}
AFTER=after`;

    const result = removeManagedBlock(content, 'dev', 'api');

    expect(result).not.toContain(MANAGED_BLOCK_START);
    expect(result).not.toContain('KEY=value');
    expect(result).toContain('BEFORE=before');
    expect(result).toContain('AFTER=after');
  });

  it('should return unchanged content if block not found', () => {
    const content = 'KEY=value\n';
    const result = removeManagedBlock(content, 'dev', 'api');

    expect(result).toBe(content);
  });

  it('should only remove the specified block', () => {
    const content = `${MANAGED_BLOCK_START}dev service=api
API_KEY=secret
${MANAGED_BLOCK_END}
${MANAGED_BLOCK_START}dev service=web
WEB_KEY=secret
${MANAGED_BLOCK_END}`;

    const result = removeManagedBlock(content, 'dev', 'api');

    expect(result).not.toContain('API_KEY');
    expect(result).toContain('WEB_KEY');
    expect(result).toContain(`${MANAGED_BLOCK_START}dev service=web`);
  });

  it('should clean up extra empty lines', () => {
    const content = `KEY1=value1

${MANAGED_BLOCK_START}dev service=api
KEY2=value2
${MANAGED_BLOCK_END}

KEY3=value3`;

    const result = removeManagedBlock(content, 'dev', 'api');

    // Should not have multiple consecutive empty lines
    expect(result).not.toMatch(/\n\n\n/);
  });
});

describe('renderEntriesSimple', () => {
  it('should render entries in simple format', () => {
    const entries: DotenvEntry[] = [
      { key: 'ZEBRA', value: 'z' },
      { key: 'APPLE', value: 'a' },
    ];

    const result = renderEntriesSimple(entries);

    expect(result).toContain('APPLE=a');
    expect(result).toContain('ZEBRA=z');
  });

  it('should sort entries alphabetically', () => {
    const entries: DotenvEntry[] = [
      { key: 'C', value: '3' },
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ];

    const result = renderEntriesSimple(entries);
    const lines = result.split('\n');

    expect(lines[0]).toBe('A=1');
    expect(lines[1]).toBe('B=2');
    expect(lines[2]).toBe('C=3');
  });
});

describe('createEntry', () => {
  it('should create a basic entry', () => {
    const entry = createEntry('KEY', 'value');

    expect(entry.key).toBe('KEY');
    expect(entry.value).toBe('value');
    expect(entry.hasExport).toBe(false);
    expect(entry.quote).toBe('none');
  });

  it('should create entry with options', () => {
    const entry = createEntry('KEY', 'value', {
      hasExport: true,
      quote: 'double',
      comment: 'A comment',
    });

    expect(entry.hasExport).toBe(true);
    expect(entry.quote).toBe('double');
    expect(entry.comment).toBe('A comment');
  });
});

describe('updateEntryValue', () => {
  it('should update entry value', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'old' };
    const updated = updateEntryValue(entry, 'new');

    expect(updated.value).toBe('new');
    expect(updated.key).toBe('KEY');
  });

  it('should add quotes if needed', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'simple' };
    const updated = updateEntryValue(entry, 'has spaces');

    expect(updated.quote).toBe('double');
  });

  it('should preserve existing quote style', () => {
    const entry: DotenvEntry = { key: 'KEY', value: 'old', quote: 'single' };
    const updated = updateEntryValue(entry, 'new');

    expect(updated.quote).toBe('single');
  });
});

describe('round-trip parsing and rendering', () => {
  it('should preserve basic content through parse and render', () => {
    const original = `# Comment
KEY1=value1
KEY2="quoted value"
export KEY3=value3`;

    const parsed = parseDotenv(original);
    const rendered = renderDotenv(parsed);

    expect(rendered).toContain('# Comment');
    expect(rendered).toContain('KEY1=value1');
    expect(rendered).toContain('KEY2="quoted value"');
    expect(rendered).toContain('export KEY3=value3');
  });

  it('should preserve managed blocks through parse and render', () => {
    const original = `${MANAGED_BLOCK_START}dev service=api
API_KEY=secret
${MANAGED_BLOCK_END}`;

    const parsed = parseDotenv(original);
    const rendered = renderDotenv(parsed);

    // Managed block markers should be in rawLines
    expect(rendered).toContain(MANAGED_BLOCK_START);
    expect(rendered).toContain(MANAGED_BLOCK_END);
  });
});
