import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('grant command', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-grant-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir })

    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          services: { api: { envOutput: 'apps/api/.env' } },
        },
        null,
        2
      )
    )
    await writeFile(
      join(testDir, 'envvault.policy.json'),
      JSON.stringify(
        {
          version: 1,
          environments: { dev: { services: { api: { recipients: [] } } } },
        },
        null,
        2
      )
    )
    await writeFile(join(testDir, '.sops.yaml'), 'creation_rules: []\n')

    await execa('git', ['add', '.'], { cwd: testDir })
    await execa('git', ['commit', '-m', 'init'], { cwd: testDir })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('does not fail when secret file is missing and commit is enabled', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'grant', '--env', 'dev', '--service', 'api', '--recipient', 'age1test'],
      { cwd: testDir, reject: false }
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No existing secret file')
  })
})

