import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('pull plan/json and batch service selection', () => {
  let testDir: string
  let binDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-pull-plan-${Date.now()}`)
    binDir = join(testDir, 'bin')
    await writeFakeSopsBin(binDir)
    await mkdir(join(testDir, 'apps', 'core-a'), { recursive: true })
    await mkdir(join(testDir, 'apps', 'core-b'), { recursive: true })
    await mkdir(join(testDir, 'apps', 'web'), { recursive: true })
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })

    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          cryptoBackend: 'system-sops',
          services: {
            'core-a': { envOutput: 'apps/core-a/.env' },
            'core-b': { envOutput: 'apps/core-b/.env' },
            web: { envOutput: 'apps/web/.env' },
          },
        },
        null,
        2
      )
    )

    await writeFile(join(testDir, 'apps', 'core-a', '.env'), 'A=1\n')
    await writeFile(join(testDir, 'apps', 'core-b', '.env'), 'B=1\n')
    await writeFile(join(testDir, 'apps', 'web', '.env'), 'W=1\n')

    await writeFile(join(testDir, 'secrets', 'dev', 'core-a.sops.yaml'), 'A: "2"\nsops:\n  lastmodified: ""\n  mac: ""\n')
    await writeFile(join(testDir, 'secrets', 'dev', 'core-b.sops.yaml'), 'B: "1"\nC: "3"\nsops:\n  lastmodified: ""\n  mac: ""\n')
    await writeFile(join(testDir, 'secrets', 'dev', 'web.sops.yaml'), 'W: "1"\nsops:\n  lastmodified: ""\n  mac: ""\n')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('supports --plan summary mode', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'core-a', '--plan'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Pull plan summary:')
    expect(result.stdout).toContain('core-a')
  })

  it('supports --json machine-readable output', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'core-b', '--json'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.command).toBe('pull')
    expect(payload.mode).toBe('plan')
    expect(payload.services[0].service).toBe('core-b')
    expect(payload.services[0].summary.added).toBe(1)
  })

  it('filters services with --service-pattern', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service-pattern', 'core-*', '--json'],
      { cwd: testDir, env: withFakeSopsPath(binDir), reject: false }
    )
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    const services = payload.services.map((s: { service: string }) => s.service).sort()
    expect(services).toEqual(['core-a', 'core-b'])
  })
})

