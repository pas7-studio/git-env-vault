import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('pull localProtection presets', () => {
  let testDir: string
  let binDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-pull-protection-${Date.now()}`)
    binDir = join(testDir, 'bin')
    await writeFakeSopsBin(binDir)
    await mkdir(join(testDir, 'apps', 'core-bot'), { recursive: true })
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          cryptoBackend: 'system-sops',
          localProtection: {
            global: ['BOT_TOKEN'],
            services: { 'core-bot': ['LOCAL_ONLY'] },
          },
          services: { 'core-bot': { envOutput: 'apps/core-bot/.env' } },
        },
        null,
        2
      )
    )
    await writeFile(join(testDir, 'apps', 'core-bot', '.env'), 'BOT_TOKEN=local\nLOCAL_ONLY=keep\nA=1\n')
    await writeFile(
      join(testDir, 'secrets', 'dev', 'core-bot.sops.yaml'),
      'BOT_TOKEN: "vault"\nLOCAL_ONLY: "vault-local"\nA: "2"\nsops:\n  lastmodified: ""\n  mac: ""\n'
    )
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('preserves configured protected keys without explicit flag', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'core-bot', '--confirm', '--yes'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const envContent = await readFile(join(testDir, 'apps', 'core-bot', '.env'), 'utf-8')
    expect(envContent).toContain('BOT_TOKEN=local')
    expect(envContent).toContain('LOCAL_ONLY=keep')
    expect(envContent).toContain('A=2')
  })

  it('does not overwrite existing local value with generated placeholder', async () => {
    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          cryptoBackend: 'system-sops',
          placeholderPolicy: {
            preserveExistingOnPlaceholder: true,
            patterns: ['__MISSING__'],
          },
          services: { 'core-bot': { envOutput: 'apps/core-bot/.env' } },
        },
        null,
        2
      )
    )
    await writeFile(join(testDir, 'apps', 'core-bot', '.env'), 'BOT_TOKEN=already-known\nA=1\n')
    await writeFile(
      join(testDir, 'secrets', 'dev', 'core-bot.sops.yaml'),
      'A: "2"\nsops:\n  lastmodified: ""\n  mac: ""\n'
    )
    await writeFile(
      join(testDir, 'envvault.schema.yaml'),
      [
        'version: 1',
        'services:',
        '  core-bot:',
        '    required: [BOT_TOKEN, A]',
        '    optional: []',
        '',
      ].join('\n'),
      'utf-8'
    )

    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'core-bot', '--confirm', '--yes'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)

    const envContent = await readFile(join(testDir, 'apps', 'core-bot', '.env'), 'utf-8')
    expect(envContent).toContain('BOT_TOKEN=already-known')
    expect(envContent).toContain('A=2')
    expect(envContent).not.toContain('BOT_TOKEN=__MISSING__')
  })
})
