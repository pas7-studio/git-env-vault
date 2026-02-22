import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('gitignore commands', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-gitignore-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('gitignore check exits non-zero when rules are missing', async () => {
    const result = await execa('node', [CLI_PATH, 'gitignore', 'check'], {
      cwd: testDir,
      reject: false,
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toContain('Missing .gitignore rules')
  })

  it('gitignore fix is idempotent', async () => {
    const first = await execa('node', [CLI_PATH, 'gitignore', 'fix'], {
      cwd: testDir,
      reject: false,
    })
    expect(first.exitCode).toBe(0)

    const content1 = await readFile(join(testDir, '.gitignore'), 'utf-8')
    expect(content1).toContain('.envvault/')

    const second = await execa('node', [CLI_PATH, 'gitignore', 'fix'], {
      cwd: testDir,
      reject: false,
    })
    expect(second.exitCode).toBe(0)
    expect(second.stdout).toContain('No changes needed')

    const content2 = await readFile(join(testDir, '.gitignore'), 'utf-8')
    expect(content2).toBe(content1)
  })
})

