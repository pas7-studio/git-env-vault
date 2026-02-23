import { Command } from 'commander'
import { glob } from 'glob'
import { dirname, join, relative, sep } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import {
  getDefaultConfig,
  loadConfig,
  loadSchema,
  generateConfigJson,
  generateSchemaYaml,
  type EnvVaultConfig,
  type Schema,
  parseDotenv,
  SopsAdapter,
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'

interface ScannedEnvFile {
  relPath: string
  serviceName: string
  keys: string[]
  envObject: Record<string, string>
}

function normalizeRelPath(p: string): string {
  return p.split(sep).join('/')
}

function slugifyPathToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'service'
}

function deriveServiceName(
  relPath: string,
  strategy: 'path' | 'dirname' | 'fullpath-slug' = 'dirname'
): string {
  const normalized = normalizeRelPath(relPath)
  if (strategy === 'fullpath-slug') {
    return slugifyPathToken(normalized)
  }
  const parts = normalized.split('/')
  const file = parts.pop() ?? normalized
  const dir = parts.join('-')
  const dirBase = parts.length > 0 ? parts[parts.length - 1]! : ''

  let fileToken = file
  if (fileToken === '.env' || fileToken.startsWith('.env.')) {
    fileToken = 'env'
  } else if (fileToken.endsWith('.env')) {
    fileToken = fileToken.slice(0, -4)
  }

  if (strategy === 'dirname') {
    if (dirBase) return slugifyPathToken(dirBase)
    // Root-level .env.local etc fallback
    if (file.startsWith('.env.')) return 'api'
    return fileToken === 'env' ? 'root-env' : slugifyPathToken(fileToken)
  }

  return [dir || undefined, fileToken || undefined].filter(Boolean).join('-') || 'root-env'
}

function buildSchemaFromScans(scans: ScannedEnvFile[]): Schema {
  const services: Schema['services'] = {}
  for (const scan of scans) {
    services[scan.serviceName] = {
      required: [...new Set(scan.keys)].sort(),
      optional: [],
    }
  }
  return { version: 1, services }
}

function diffServiceMaps(
  oldMap: Record<string, { envOutput: string }>,
  newMap: Record<string, { envOutput: string }>
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const [name, cfg] of Object.entries(newMap)) {
    if (!oldMap[name]) added.push(name)
    else if (oldMap[name].envOutput !== cfg.envOutput) changed.push(name)
  }
  for (const name of Object.keys(oldMap)) {
    if (!newMap[name]) removed.push(name)
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() }
}

async function scanEnvFiles(
  cwd: string,
  excludes: string[],
  nameStrategy: 'path' | 'dirname' | 'fullpath-slug'
): Promise<ScannedEnvFile[]> {
  const matches = await glob(['**/.env', '**/.env.*', '**/*.env'], {
    cwd,
    dot: true,
    nodir: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/.envvault/**',
      '**/secrets/**',
      ...excludes,
    ],
  })

  const deduped = [...new Set(matches.map(normalizeRelPath))].sort()
  const usedNames = new Map<string, number>()
  const scans: ScannedEnvFile[] = []
  for (const rel of deduped) {
    const content = await readFile(join(cwd, rel), 'utf-8')
    const parsed = parseDotenv(content)
    let serviceName = deriveServiceName(rel, nameStrategy)
    const count = usedNames.get(serviceName) ?? 0
    if (count > 0) {
      serviceName = `${serviceName}-${count + 1}`
    }
    usedNames.set(deriveServiceName(rel, nameStrategy), count + 1)

    scans.push({
      relPath: rel,
      serviceName,
      keys: parsed.entries.map((e) => e.key),
      envObject: parsed.env,
    })
  }
  return scans
}

async function runRefresh(options: {
  dryRun?: boolean
  writeSecrets?: boolean
  mode?: string
  exclude?: string[]
  nameStrategy?: 'path' | 'dirname' | 'fullpath-slug'
  mergeConfig?: boolean
  mergeSchema?: boolean
}): Promise<void> {
  const cwd = process.cwd()
  const scans = await scanEnvFiles(cwd, options.exclude ?? [], options.nameStrategy ?? 'dirname')

  let baseConfig: EnvVaultConfig
  try {
    baseConfig = await loadConfig(cwd)
  } catch {
    baseConfig = getDefaultConfig()
  }

  const scannedServices: EnvVaultConfig['services'] = {}
  for (const scan of scans) {
    scannedServices[scan.serviceName] = { envOutput: scan.relPath }
  }
  const nextServices: EnvVaultConfig['services'] = options.mergeConfig
    ? { ...(baseConfig.services ?? {}), ...scannedServices }
    : scannedServices

  const nextConfig: EnvVaultConfig = {
    ...baseConfig,
    version: 1,
    services: nextServices,
  }

  const serviceDiff = diffServiceMaps(baseConfig.services ?? {}, nextServices)
  const scannedSchema = buildSchemaFromScans(scans)
  let nextSchema = scannedSchema
  if (options.mergeSchema) {
    try {
      const existingSchema = await loadSchema(cwd)
      nextSchema = {
        version: 1,
        services: {
          ...(existingSchema?.services ?? {}),
          ...scannedSchema.services,
        },
      }
    } catch {
      nextSchema = scannedSchema
    }
  }

  console.log(`Scanned ${scans.length} env file(s).`)
  if (serviceDiff.added.length) console.log(`Added services: ${serviceDiff.added.join(', ')}`)
  if (serviceDiff.changed.length) console.log(`Changed services: ${serviceDiff.changed.join(', ')}`)
  if (serviceDiff.removed.length) console.log(`Removed services: ${serviceDiff.removed.join(', ')}`)
  if (
    serviceDiff.added.length === 0 &&
    serviceDiff.changed.length === 0 &&
    serviceDiff.removed.length === 0
  ) {
    console.log('No config service changes detected.')
  }

  if (options.dryRun) {
    console.log('Dry-run: no files written.')
    return
  }

  await writeFile(join(cwd, 'envvault.config.json'), generateConfigJson(nextConfig), 'utf-8')
  await writeFile(join(cwd, 'envvault.schema.yaml'), generateSchemaYaml(nextSchema), 'utf-8')
  console.log('Updated envvault.config.json')
  console.log('Updated envvault.schema.yaml')

  if (options.writeSecrets) {
    if ((options.mode ?? 'monorepo-backup') !== 'monorepo-backup') {
      console.error(`Unsupported mode: ${options.mode}`)
      process.exit(1)
    }
    const sops = new SopsAdapter()
    if (!(await sops.isAvailable())) {
      console.error('Error: --write-secrets currently requires system SOPS installed')
      process.exit(1)
    }
    const targetEnv = 'dev'
    await mkdir(join(cwd, nextConfig.secretsDir, targetEnv), { recursive: true })
    for (const scan of scans) {
      const secretPath = join(cwd, nextConfig.secretsDir, targetEnv, `${scan.serviceName}.sops.yaml`)
      await writeFile(secretPath, stringifyYaml(scan.envObject), 'utf-8')
      await sops.encrypt(secretPath)
    }
    console.log(`Wrote encrypted secrets snapshots to ${nextConfig.secretsDir}/dev`)
  }
}

export const refreshCommand = new Command('refresh')
  .description('Rescan env files in monorepo and update envvault config/schema')
  .option('--dry-run', 'Preview changes without writing')
  .option('--write-secrets', 'Generate/update secrets snapshots from scanned env files')
  .option('--mode <mode>', 'Scan mode (supports: monorepo-backup)', 'monorepo-backup')
  .option('--name-strategy <strategy>', 'Service naming: dirname | path | fullpath-slug', 'dirname')
  .option('--merge-config', 'Merge discovered services into existing envvault.config.json instead of replacing')
  .option('--merge-schema', 'Merge discovered schema into existing envvault.schema.yaml instead of replacing')
  .option('--exclude <glob>', 'Additional exclude glob (repeatable)', (value, prev: string[]) => {
    prev.push(value)
    return prev
  }, [])
  .action(runRefresh)

export const syncCommand = new Command('sync')
  .description('Alias for `envvault refresh` (rescan env files and update envvault artifacts)')
  .option('--dry-run', 'Preview changes without writing')
  .option('--write-secrets', 'Generate/update secrets snapshots from scanned env files')
  .option('--mode <mode>', 'Scan mode (supports: monorepo-backup)', 'monorepo-backup')
  .option('--name-strategy <strategy>', 'Service naming: dirname | path | fullpath-slug', 'dirname')
  .option('--merge-config', 'Merge discovered services into existing envvault.config.json instead of replacing')
  .option('--merge-schema', 'Merge discovered schema into existing envvault.schema.yaml instead of replacing')
  .option('--exclude <glob>', 'Additional exclude glob (repeatable)', (value, prev: string[]) => {
    prev.push(value)
    return prev
  }, [])
  .action(runRefresh)
