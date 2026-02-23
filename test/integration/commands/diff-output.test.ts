import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('diff command output modes', () => {
  let testDir: string
  let binDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-diff-${Date.now()}`)
    binDir = join(testDir, 'bin')
    await writeFakeSopsBin(binDir)
    await mkdir(join(testDir, 'apps', 'api'), { recursive: true })
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify({
        version: 1,
        secretsDir: 'secrets',
        cryptoBackend: 'system-sops',
        services: { api: { envOutput: 'apps/api/.env' } },
      })
    )
    await writeFile(join(testDir, 'apps', 'api', '.env'), 'A=1\n')
    await writeFile(
      join(testDir, 'secrets', 'dev', 'api.sops.yaml'),
      'A: "2"\nsops:\n  lastmodified: ""\n  mac: ""\n'
    )
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('supports --plan', async () => {
    const result = await execa('node', [CLI_PATH, 'diff', '--env', 'dev', '--service', 'api', '--plan'], {
      cwd: testDir,
      env: withFakeSopsPath(binDir),
      reject: false,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Plan: diff dev/api')
  })

  it('supports --json', async () => {
    const result = await execa('node', [CLI_PATH, 'diff', '--env', 'dev', '--service', 'api', '--json'], {
      cwd: testDir,
      env: withFakeSopsPath(binDir),
      reject: false,
    })
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.command).toBe('diff')
    expect(payload.summary.changed).toBe(1)
  })
})

