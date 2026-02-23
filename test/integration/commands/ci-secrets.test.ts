import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('ci-seal / ci-unseal', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'envvault-ci-secrets-'))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('round-trips a plaintext file via CI payload', async () => {
    await writeFile(join(testDir, 'sample.env'), 'A=1\nB=two\n', 'utf-8')

    const seal = await execa(
      'node',
      [CLI_PATH, 'ci-seal', '--from-file', 'sample.env'],
      {
        cwd: testDir,
        env: { ...process.env, ENVVAULT_CI_KEY: 'test-ci-key' },
      }
    )

    expect(seal.stdout.trim().length).toBeGreaterThan(20)

    const unseal = await execa(
      'node',
      [CLI_PATH, 'ci-unseal', '--payload', seal.stdout.trim(), '--validate-dotenv'],
      {
        cwd: testDir,
        env: { ...process.env, ENVVAULT_CI_KEY: 'test-ci-key' },
      }
    )

    expect(unseal.stdout).toContain('A=1')
    expect(unseal.stdout).toContain('B=two')
  })

  it('can seal from vault secret and write decoded dotenv to file', async () => {
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await mkdir(join(testDir, '.bin'), { recursive: true })
    await writeFakeSopsBin(join(testDir, '.bin'))

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
      ),
      'utf-8'
    )
    // Fake sops decrypts by cat'ing file, so plaintext YAML works for test.
    await writeFile(join(testDir, 'secrets', 'dev', 'api.sops.yaml'), 'TOKEN: abc123\nDEBUG: "true"\n', 'utf-8')

    const seal = await execa(
      'node',
      [CLI_PATH, 'ci-seal', '--env', 'dev', '--service', 'api', '--json'],
      {
        cwd: testDir,
        env: { ...withFakeSopsPath(join(testDir, '.bin')), ENVVAULT_CI_KEY: 'vault-ci-key' },
      }
    )

    const payload = JSON.parse(seal.stdout) as { payload: string }
    expect(payload.payload).toBeTruthy()

    const outPath = 'apps/api/.env'
    const unseal = await execa(
      'node',
      [CLI_PATH, 'ci-unseal', '--payload', payload.payload, '--out', outPath, '--validate-dotenv', '--json'],
      {
        cwd: testDir,
        env: { ...process.env, ENVVAULT_CI_KEY: 'vault-ci-key' },
      }
    )

    const outMeta = JSON.parse(unseal.stdout) as { output: string | null }
    expect(outMeta.output).toBe(outPath)
    const fileContent = await readFile(join(testDir, outPath), 'utf-8')
    expect(fileContent).toContain('TOKEN=abc123')
    expect(fileContent).toContain('DEBUG=true')
  })
})

