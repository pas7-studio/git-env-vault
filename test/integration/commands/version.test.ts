import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { resolve } from 'path'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('version output', () => {
  it('matches package.json version', async () => {
    const result = await execa('node', [CLI_PATH, '--version'])
    const pkg = (await import('../../../package.json', { with: { type: 'json' } })).default
    expect(result.stdout.trim()).toBe(pkg.version)
  })
})

