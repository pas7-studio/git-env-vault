import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('push command', () => {
  let testDir: string
  let binDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-push-${Date.now()}`)
    binDir = join(testDir, 'bin')
    await mkdir(join(testDir, 'apps', 'core-bot'), { recursive: true })
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await writeFakeSopsBin(binDir)

    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          services: { 'core-bot': { envOutput: 'apps/core-bot/.env' } },
          localProtection: { global: ['BOT_TOKEN'], services: {} },
        },
        null,
        2
      ),
      'utf-8'
    )
    await writeFile(join(testDir, 'apps', 'core-bot', '.env'), 'A=2\nBOT_TOKEN=local\n', 'utf-8')
    await writeFile(
      join(testDir, 'secrets', 'dev', 'core-bot.sops.yaml'),
      'A: "1"\nBOT_TOKEN: "vault"\nsops:\n  lastmodified: ""\n  mac: ""\n',
      'utf-8'
    )
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('supports dry-run and json plan', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'push', '--env', 'dev', '--service', 'core-bot', '--dry-run', '--json'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.command).toBe('push')
    expect(payload.summary.changed).toBeGreaterThanOrEqual(1)
  })

  it('preserves protected local keys when pushing', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'push', '--env', 'dev', '--service', 'core-bot', '--confirm', '--yes'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const secretContent = await readFile(join(testDir, 'secrets', 'dev', 'core-bot.sops.yaml'), 'utf-8')
    expect(secretContent).toContain('A: "2"')
    expect(secretContent).toContain('BOT_TOKEN: vault')
    expect(secretContent).not.toContain('BOT_TOKEN: local')
  })

  it('supports exclude-keys flag', async () => {
    await writeFile(join(testDir, 'apps', 'core-bot', '.env'), 'A=9\nDEBUG=true\n', 'utf-8')
    const result = await execa(
      'node',
      [CLI_PATH, 'push', '--env', 'dev', '--service', 'core-bot', '--exclude-keys', 'DEBUG', '--confirm', '--yes'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const secretContent = await readFile(join(testDir, 'secrets', 'dev', 'core-bot.sops.yaml'), 'utf-8')
    expect(secretContent).toContain('A: "9"')
    expect(secretContent).not.toContain('DEBUG:')
  })
})

