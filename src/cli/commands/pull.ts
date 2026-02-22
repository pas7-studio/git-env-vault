import { Command } from 'commander'
import { mkdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createInterface } from 'node:readline/promises'
import {
  loadConfig,
  loadSchema,
  validateAgainstSchema,
  generateWithPlaceholders,
  resolveCryptoBackend,
  CryptoBackendSelectionError,
  renderEntriesSimple,
  parseDotenv,
  diffEnvEntries,
  diffEnv,
  formatSafeDiff,
  formatUnsafeDiff,
  ConfigError,
  SopsError,
  atomicWriteFile,
  hasChanges,
  type CryptoBackend,
  type DotenvEntry,
  type EnvObject,
} from '../../core/index.js'

function envObjectToEntries(obj: EnvObject): DotenvEntry[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }))
}

function entriesToEnvObject(entries: DotenvEntry[]): EnvObject {
  const out: EnvObject = {}
  for (const entry of entries) out[entry.key] = entry.value
  return out
}

async function loadExistingEntries(outputPath: string): Promise<DotenvEntry[]> {
  try {
    const oldContent = await readFile(outputPath, 'utf-8')
    return parseDotenv(oldContent).entries
  } catch {
    return []
  }
}

export function applySelectedKeys(
  oldEntries: DotenvEntry[],
  nextEntries: DotenvEntry[],
  selectedKeys: string[]
): DotenvEntry[] {
  const selected = new Set(selectedKeys)
  const nextMap = new Map(nextEntries.map((e) => [e.key, e] as const))
  const merged = new Map(oldEntries.map((e) => [e.key, e] as const))

  for (const key of selected) {
    const next = nextMap.get(key)
    if (next) merged.set(key, next)
    else merged.delete(key)
  }

  return Array.from(merged.values()).sort((a, b) => a.key.localeCompare(b.key))
}

async function promptLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(prompt)
    return answer.trim()
  } finally {
    rl.close()
  }
}

async function maybeConfirmPullWrite(options: {
  confirm?: boolean
  yes?: boolean
  unsafeShowValues?: boolean
  selectKeys?: string
  serviceName: string
  oldEntries: DotenvEntry[]
  nextEntries: DotenvEntry[]
}): Promise<{ proceed: boolean; entriesToWrite: DotenvEntry[] }> {
  const { confirm, yes, unsafeShowValues, selectKeys, serviceName, oldEntries, nextEntries } = options
  if (!confirm) return { proceed: true, entriesToWrite: nextEntries }

  const oldEnv = entriesToEnvObject(oldEntries)
  const nextEnv = entriesToEnvObject(nextEntries)
  const diff = diffEnv(oldEnv, nextEnv)

  console.log(`   Pending changes for ${serviceName}:`)
  console.log(
    unsafeShowValues ? formatUnsafeDiff(diff, oldEnv, nextEnv, { indent: '   ' }) : formatSafeDiff(diff, { indent: '   ' })
  )

  if (!hasChanges(diff)) {
    return { proceed: true, entriesToWrite: nextEntries }
  }

  const selectable = [...diff.added, ...diff.changed, ...diff.removed].sort()
  if (selectKeys) {
    const selected = selectKeys
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((k) => selectable.includes(k))
    if (selected.length === 0) {
      return { proceed: false, entriesToWrite: oldEntries }
    }
    return { proceed: true, entriesToWrite: applySelectedKeys(oldEntries, nextEntries, selected) }
  }

  if (yes) {
    return { proceed: true, entriesToWrite: nextEntries }
  }

  const action = (await promptLine('   Apply changes? [a]pply all / [s]elect keys / [c]ancel: ')).toLowerCase()
  if (action === 'c' || action === 'cancel' || action === '') {
    return { proceed: false, entriesToWrite: oldEntries }
  }
  if (action === 's' || action === 'select') {
    console.log(`   Selectable keys: ${selectable.join(', ')}`)
    const raw = await promptLine('   Enter comma-separated keys to apply: ')
    const selected = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((k) => selectable.includes(k))
    if (selected.length === 0) {
      console.log('   No valid keys selected. Operation cancelled.')
      return { proceed: false, entriesToWrite: oldEntries }
    }
    const partial = applySelectedKeys(oldEntries, nextEntries, selected)
    return { proceed: true, entriesToWrite: partial }
  }
  return { proceed: true, entriesToWrite: nextEntries }
}

function printDiffSummary(oldEntries: DotenvEntry[], newEntries: DotenvEntry[]): void {
  const diff = diffEnvEntries(oldEntries, newEntries)
  if (!hasChanges(diff)) {
    console.log('   No changes detected')
    return
  }
  console.log('   Changes:')
  for (const line of formatSafeDiff(diff).split('\n')) {
    console.log(`   ${line}`)
  }
}

export async function resolvePullCryptoBackend(
  preferredBackend: 'auto' | 'system-sops' | 'js' = 'auto'
): Promise<CryptoBackend> {
  const resolved = await resolveCryptoBackend({
    preference: preferredBackend,
    capability: 'pull',
  })
  const fallbackNote = resolved.fallbackUsed ? ' (fallback from auto)' : ''
  console.log(`Crypto backend: ${resolved.backend.id}${fallbackNote}`)
  return resolved.backend
}

export const pullCommand = new Command('pull')
  .description('Decrypt and write .env files to services')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .option('--service <service>', 'Specific service (default: all)')
  .option('--dry-run', 'Show what would change without writing')
  .option('--no-write', 'Validate only, do not write files')
  .option('--strict', 'Fail if required keys are missing (requires schema)')
  .option('--backup', 'Create backup of existing .env files')
  .option('--show-diff', 'Show diff summary of changes')
  .option('--confirm', 'Confirm before writing local env files')
  .option('--interactive', 'Alias for --confirm')
  .option('--select-keys <keys>', 'Apply only selected changed keys (comma-separated) in confirm mode')
  .option('--yes', 'Apply all changes without prompts (for non-interactive use)', false)
  .option('--unsafe-show-values', 'Show values in confirmation diff', false)
  .action(async (options) => {
    const cwd = process.cwd()
    const noWrite = options.write === false || options.noWrite === true

    let config
    try {
      config = await loadConfig(cwd)
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
      }
      throw error
    }

    let schema
    try {
      schema = await loadSchema(cwd)
    } catch (error) {
      console.warn(`Warning: Failed to load schema: ${(error as Error).message}`)
    }

    let cryptoBackend: CryptoBackend
    try {
      cryptoBackend = await resolvePullCryptoBackend(config.cryptoBackend ?? 'auto')
    } catch (error) {
      if (error instanceof CryptoBackendSelectionError) {
        console.error(`Error: ${error.message}`)
        console.log('Basic mode: JS backend supports pull/decrypt.')
        console.log('Full mode: install system SOPS + age for write/key-management commands.')
        console.log('Run `envvault setup` for platform-specific instructions.')
        process.exit(1)
      }
      throw error
    }

    const env = options.env as string
    const services = options.service
      ? { [options.service]: config.services[options.service] }
      : config.services
    if (!services || Object.keys(services).length === 0) {
      console.error('Error: No services configured')
      process.exit(1)
    }

    let hasErrors = false
    let hasMissingKeys = false

    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      const secretPath = join(cwd, config.secretsDir, env, `${serviceName}.sops.yaml`)
      const outputPath = join(cwd, serviceConfig!.envOutput)
      console.log(`\nProcessing ${serviceName}...`)

      try {
        const { data } = await cryptoBackend.decrypt(secretPath)
        let nextEntries = envObjectToEntries(data)

        if (schema?.services[serviceName]) {
          const validation = validateAgainstSchema(nextEntries, schema.services[serviceName])
          if (validation.missing.length > 0) {
            console.log(`   Missing required keys: ${validation.missing.join(', ')}`)
            hasMissingKeys = true
            if (options.strict) {
              console.error('   Error: Strict mode: missing required keys')
              hasErrors = true
              continue
            }
            nextEntries = generateWithPlaceholders(nextEntries, schema.services[serviceName])
          }
          if (validation.extra.length > 0) {
            console.log(`   Extra keys not in schema: ${validation.extra.join(', ')}`)
          }
        }

        const oldEntries = await loadExistingEntries(outputPath)
        const diff = diffEnvEntries(oldEntries, nextEntries)

        if (options.dryRun) {
          console.log(`   Would write to: ${outputPath}`)
          console.log(`   Keys: ${Object.keys(data).join(', ') || '(empty)'}`)
          if (options.showDiff || options.confirm || options.interactive) {
            printDiffSummary(oldEntries, nextEntries)
          }
          continue
        }

        if (noWrite) {
          console.log(`   Decryption successful (${Object.keys(data).length} keys)`)
          if (options.showDiff || options.confirm || options.interactive) {
            printDiffSummary(oldEntries, nextEntries)
          }
          continue
        }

        if (options.showDiff) {
          printDiffSummary(oldEntries, nextEntries)
        }

        const confirmRequested = Boolean(options.confirm || options.interactive)
        const confirmResult = await maybeConfirmPullWrite({
          confirm: confirmRequested,
          yes: options.yes,
          unsafeShowValues: options.unsafeShowValues,
          selectKeys: options.selectKeys,
          serviceName,
          oldEntries,
          nextEntries,
        })
        if (!confirmResult.proceed) {
          console.log('   Cancelled by user')
          continue
        }
        const entriesToWrite = confirmResult.entriesToWrite
        const contentToWrite = renderEntriesSimple(entriesToWrite)

        const writeOptions: { backup?: boolean } = {}
        if (options.backup) writeOptions.backup = true

        await mkdir(dirname(outputPath), { recursive: true })
        await atomicWriteFile(outputPath, contentToWrite, writeOptions)
        console.log(`   Wrote ${outputPath}`)

        if (confirmRequested && entriesToWrite !== nextEntries) {
          const finalDiff = diffEnvEntries(oldEntries, entriesToWrite)
          console.log(`   Applied selected keys only (${[...finalDiff.added, ...finalDiff.changed, ...finalDiff.removed].length} key changes)`)
        }
      } catch (error) {
        if (error instanceof SopsError) {
          console.error(`   Failed: ${error.message}`)
          hasErrors = true
        } else {
          console.error(`   Failed: ${(error as Error).message}`)
          hasErrors = true
        }
      }
    }

    if (hasErrors) process.exit(1)
    if (hasMissingKeys && !options.strict) {
      console.log('\nSome required keys were missing. Placeholders were generated.')
      console.log('Run with --strict to fail on missing keys.')
    }
    console.log('\nPull complete')
  })
