import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { writeFakeSopsBin, withFakeSopsPath } from '../helpers/fake-sops.js'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('pull confirm/no-write', () => {
  let testDir: string
  let envPath: string
  let fakeBin: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-pull-confirm-${Date.now()}`)
    fakeBin = join(testDir, 'bin')
    await mkdir(testDir, { recursive: true })
    await writeFakeSopsBin(fakeBin)

    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          cryptoBackend: 'system-sops',
          services: { api: { envOutput: 'apps/api/.env' } },
        },
        null,
        2
      ),
      'utf-8'
    )

    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await writeFile(
      join(testDir, 'secrets', 'dev', 'api.sops.yaml'),
      ['A: "2"', 'B: "1"', 'D: "1"', 'sops:', '  lastmodified: ""', '  mac: ""', ''].join('\n'),
      'utf-8'
    )

    envPath = join(testDir, 'apps', 'api', '.env')
    await mkdir(join(testDir, 'apps', 'api'), { recursive: true })
    await writeFile(envPath, 'A=1\nB=1\nC=1\n', 'utf-8')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  function testEnv() {
    return withFakeSopsPath(fakeBin)
  }

  it('does not write file with --no-write', async () => {
    const before = await readFile(envPath, 'utf-8')
    const result = await execa('node', [CLI_PATH, 'pull', '--env', 'dev', '--service', 'api', '--no-write'], {
      cwd: testDir,
      env: testEnv(),
      reject: false,
    })
    expect(result.exitCode).toBe(0)
    const after = await readFile(envPath, 'utf-8')
    expect(after).toBe(before)
  })

  it('cancels write with --confirm', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'api', '--confirm'],
      {
        cwd: testDir,
        env: testEnv(),
        input: 'c\n',
        reject: false,
      }
    )
    expect(result.exitCode).toBe(0)
    const after = await readFile(envPath, 'utf-8')
    expect(after).toBe('A=1\nB=1\nC=1\n')
    expect(result.stdout).toContain('Cancelled by user')
  })

  it('applies all changes with --confirm --yes', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'api', '--confirm', '--yes'],
      {
        cwd: testDir,
        env: testEnv(),
        reject: false,
      }
    )
    expect(result.exitCode).toBe(0)
    const after = await readFile(envPath, 'utf-8')
    expect(after).toContain('A=2')
    expect(after).toContain('B=1')
    expect(after).toContain('D=1')
    expect(after).not.toContain('C=1')
  })

  it('applies selected keys only in confirm mode', async () => {
    const result = await execa(
      'node',
      [CLI_PATH, 'pull', '--env', 'dev', '--service', 'api', '--confirm', '--select-keys', 'A,D'],
      {
        cwd: testDir,
        env: testEnv(),
        input: 'a\n',
        reject: false,
      }
    )
    expect(result.exitCode).toBe(0)
    const after = await readFile(envPath, 'utf-8')
    expect(after).toContain('A=2')
    expect(after).toContain('B=1')
    expect(after).toContain('C=1')
    expect(after).toContain('D=1')
  })
})
