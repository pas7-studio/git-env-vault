import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, access, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { parse as parseYaml } from 'yaml'

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('refresh command', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-refresh-${Date.now()}`)
    await mkdir(join(testDir, 'apps', 'api'), { recursive: true })
    await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(testDir, 'apps', 'api', '.env'), 'A=1\nB=2\n', 'utf-8')
    await writeFile(join(testDir, 'node_modules', 'pkg', '.env'), 'SHOULD_IGNORE=1\n', 'utf-8')
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('supports dry-run and does not write config files', async () => {
    const result = await execa('node', [CLI_PATH, 'refresh', '--dry-run'], {
      cwd: testDir,
      reject: false,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Scanned 1 env file')
    expect(result.stdout).toContain('Dry-run: no files written.')
    await expect(access(join(testDir, 'envvault.config.json'))).rejects.toThrow()
    await expect(access(join(testDir, 'envvault.schema.yaml'))).rejects.toThrow()
  })

  it('supports name-strategy dirname and merge flags', async () => {
    await writeFile(
      join(testDir, 'envvault.config.json'),
      JSON.stringify(
        {
          version: 1,
          secretsDir: 'secrets',
          cryptoBackend: 'auto',
          services: { existing: { envOutput: 'legacy/.env' } },
        },
        null,
        2
      )
    )
    await writeFile(
      join(testDir, 'envvault.schema.yaml'),
      'version: 1\nservices:\n  existing:\n    required: [LEGACY]\n    optional: []\n'
    )

    const result = await execa(
      'node',
      [
        CLI_PATH,
        'refresh',
        '--name-strategy',
        'dirname',
        '--merge-config',
        '--merge-schema',
      ],
      {
        cwd: testDir,
        reject: false,
      }
    )

    expect(result.exitCode).toBe(0)
    const config = JSON.parse(await readFile(join(testDir, 'envvault.config.json'), 'utf-8'))
    expect(config.services.existing).toBeDefined()
    expect(config.services.api).toBeDefined()

    const schema = parseYaml(await readFile(join(testDir, 'envvault.schema.yaml'), 'utf-8')) as {
      services: Record<string, unknown>
    }
    expect(schema.services.existing).toBeDefined()
    expect(schema.services.api).toBeDefined()
  })
})
