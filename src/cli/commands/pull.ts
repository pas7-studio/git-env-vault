import { Command } from 'commander'
import { mkdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  loadConfig,
  loadSchema,
  validateAgainstSchema,
  generateWithPlaceholders,
  resolveCryptoBackend,
  CryptoBackendSelectionError,
  renderEntriesSimple,
  ConfigError,
  SopsError,
  atomicWriteFile,
  diffSecretsFiles,
  formatDiffSummaryWithOptions,
  hasChanges,
  type CryptoBackend,
} from '../../core/index.js'
import type { DotenvEntry } from '../../core/env/types.js'
import type { EnvObject } from '../../core/types/index.js'

function envObjectToEntries(obj: EnvObject): DotenvEntry[] {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
  }))
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
  .action(async (options) => {
    const cwd = process.cwd()

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
        console.log(
          'Full mode: install system SOPS + age for edit/set/grant/revoke/updatekeys/rotate.'
        )
        console.log('Run `envvault setup` for platform-specific instructions.')
        process.exit(1)
      }
      throw error
    }

    const env = options.env
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
        const newEntries: DotenvEntry[] = envObjectToEntries(data)

        if (schema?.services[serviceName]) {
          const serviceSchema = schema.services[serviceName]
          const validation = validateAgainstSchema(newEntries, serviceSchema)

          if (validation.missing.length > 0) {
            console.log(`   Missing required keys: ${validation.missing.join(', ')}`)
            hasMissingKeys = true

            if (options.strict) {
              console.error('   Error: Strict mode: missing required keys')
              hasErrors = true
              continue
            }

            const entriesWithPlaceholders = generateWithPlaceholders(
              newEntries,
              serviceSchema
            )
            if (!options.dryRun && !options.noWrite) {
              const envContent = renderEntriesSimple(entriesWithPlaceholders)

              if (options.showDiff) {
                let oldEntries: DotenvEntry[] = []
                try {
                  const oldContent = await readFile(outputPath, 'utf-8')
                  const { parseDotenv } = await import('../../core/env/parse-dotenv.js')
                  oldEntries = parseDotenv(oldContent).entries
                } catch {
                  // File doesn't exist
                }

                const diff = diffSecretsFiles(oldEntries, entriesWithPlaceholders)
                if (hasChanges(diff)) {
                  console.log('\n   Changes:')
                  console.log(
                    formatDiffSummaryWithOptions(diff, { colorize: true })
                      .split('\n')
                      .map((line) => `   ${line}`)
                      .join('\n')
                  )
                }
              }

              const writeOptions: { backup?: boolean } = {}
              if (options.backup) {
                writeOptions.backup = true
              }

              await atomicWriteFile(outputPath, envContent, writeOptions)
              console.log(
                `   Wrote ${outputPath} (with placeholders for missing keys)`
              )
            }
            continue
          }

          if (validation.extra.length > 0) {
            console.log(`   Extra keys not in schema: ${validation.extra.join(', ')}`)
          }
        }

        const envContent = renderEntriesSimple(newEntries)

        if (options.dryRun) {
          console.log(`   Would write to: ${outputPath}`)
          console.log(`   Keys: ${Object.keys(data).join(', ') || '(empty)'}`)
          continue
        }

        if (options.noWrite) {
          console.log(`   Decryption successful (${Object.keys(data).length} keys)`)
          continue
        }

        if (options.showDiff) {
          let oldEntries: DotenvEntry[] = []
          try {
            const oldContent = await readFile(outputPath, 'utf-8')
            const { parseDotenv } = await import('../../core/env/parse-dotenv.js')
            oldEntries = parseDotenv(oldContent).entries
          } catch {
            // File doesn't exist
          }

          const diff = diffSecretsFiles(oldEntries, newEntries)
          if (hasChanges(diff)) {
            console.log('\n   Changes:')
            console.log(
              formatDiffSummaryWithOptions(diff, { colorize: true })
                .split('\n')
                .map((line) => `   ${line}`)
                .join('\n')
            )
          } else {
            console.log('   No changes detected')
          }
        }

        const writeOptions: { backup?: boolean } = {}
        if (options.backup) {
          writeOptions.backup = true
        }

        await mkdir(dirname(outputPath), { recursive: true })
        await atomicWriteFile(outputPath, envContent, writeOptions)
        console.log(`   Wrote ${outputPath}`)
      } catch (error) {
        if (error instanceof SopsError) {
          console.error(`   Failed: ${error.message}`)
          hasErrors = true
        } else {
          throw error
        }
      }
    }

    if (hasErrors) {
      process.exit(1)
    }

    if (hasMissingKeys && !options.strict) {
      console.log('\nSome required keys were missing. Placeholders were generated.')
      console.log('Run with --strict to fail on missing keys.')
    }

    console.log('\nPull complete')
  })
