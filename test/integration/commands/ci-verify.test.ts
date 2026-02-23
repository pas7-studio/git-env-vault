import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { getExpectedSopsConfigYaml, type EnvVaultPolicy } from '../../../src/core/index.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('ci-verify', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'envvault-ci-verify-'))
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir })

    const policy: EnvVaultPolicy = {
      version: 1,
      environments: {
        dev: {
          services: {
            api: {
              recipients: ['age1testrecipientxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
            },
          },
        },
      },
    }

    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          services: {
            api: { envOutput: 'apps/api/.env' },
          },
        },
        null,
        2
      ),
      'utf-8'
    )
    await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy, null, 2), 'utf-8')
    await writeFile(join(testDir, '.sops.yaml'), getExpectedSopsConfigYaml(policy), 'utf-8')

    await execa('git', ['add', '.'], { cwd: testDir })
    await execa('git', ['commit', '-m', 'init'], { cwd: testDir })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('fails on uncommitted .env-like changes', async () => {
    await writeFile(join(testDir, '.env.local'), 'BOT_TOKEN=abc\n', 'utf-8')

    const result = await execa('node', [CLI_PATH, 'ci-verify', '--allow-unsigned'], {
      cwd: testDir,
      reject: false,
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stdout + result.stderr).toContain('Uncommitted .env changes detected')
    expect(result.stdout + result.stderr).toContain('.env.local')
  })

  it('can allow dirty env changes via flag', async () => {
    await writeFile(join(testDir, '.env.local'), 'BOT_TOKEN=abc\n', 'utf-8')

    const result = await execa(
      'node',
      [CLI_PATH, 'ci-verify', '--allow-unsigned', '--allow-dirty-env'],
      {
        cwd: testDir,
        reject: false,
      }
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('All verifications passed')
  })
})
