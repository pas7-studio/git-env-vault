import { Command } from 'commander'
import { join } from 'path'
import { readFile } from 'fs/promises'
import {
  loadConfig,
  resolveCryptoBackend,
  CryptoBackendSelectionError,
  parseDotenv,
  diffEnv,
  type EnvVaultConfig,
} from '../../core/index.js'

interface ServiceStatus {
  service: string
  envOutput: string
  localFileExists: boolean
  secretFileExpected: string
  drift?: {
    added: number
    removed: number
    changed: number
  }
  error?: string
}

export const statusCommand = new Command('status')
  .description('Show local vs vault drift status for configured services')
  .requiredOption('--env <env>', 'Environment')
  .option('--service <service>', 'Specific service')
  .option('--json', 'Print JSON output')
  .action(async (options) => {
    const cwd = process.cwd()
    const config = await loadConfig(cwd)

    let backend
    try {
      backend = (
        await resolveCryptoBackend({
          preference: config.cryptoBackend ?? 'auto',
          capability: 'pull',
        })
      ).backend
    } catch (error) {
      if (error instanceof CryptoBackendSelectionError) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
      }
      throw error
    }

    const services = options.service
      ? { [options.service]: config.services[options.service] }
      : config.services

    const results: ServiceStatus[] = []
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      if (!serviceConfig) continue
      const localPath = join(cwd, serviceConfig.envOutput)
      const secretPath = join(cwd, config.secretsDir, options.env, `${serviceName}.sops.yaml`)

      try {
        const localContent = await readFile(localPath, 'utf-8').catch(() => null)
        const localEnv = localContent ? parseDotenv(localContent).env : {}
        const { data: vaultEnv } = await backend.decrypt(secretPath)
        const diff = diffEnv(localEnv, vaultEnv)
        results.push({
          service: serviceName,
          envOutput: serviceConfig.envOutput,
          localFileExists: localContent !== null,
          secretFileExpected: join(config.secretsDir, options.env, `${serviceName}.sops.yaml`),
          drift: {
            added: diff.added.length,
            removed: diff.removed.length,
            changed: diff.changed.length,
          },
        })
      } catch (error) {
        results.push({
          service: serviceName,
          envOutput: serviceConfig.envOutput,
          localFileExists: true,
          secretFileExpected: join(config.secretsDir, options.env, `${serviceName}.sops.yaml`),
          error: (error as Error).message,
        })
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ command: 'status', env: options.env, services: results }, null, 2))
      return
    }

    console.log(`Status for env=${options.env}\n`)
    for (const item of results) {
      if (item.error) {
        console.log(`[FAIL] ${item.service}: ${item.error}`)
        continue
      }
      const drift = item.drift ?? { added: 0, removed: 0, changed: 0 }
      const total = drift.added + drift.removed + drift.changed
      console.log(
        `${total === 0 ? '[OK]' : '[DRIFT]'} ${item.service}: +${drift.added} -${drift.removed} ~${drift.changed} (${item.envOutput})`
      )
    }
  })
