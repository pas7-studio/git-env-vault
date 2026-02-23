import { Command } from 'commander'
import { join } from 'path'
import { readFile } from 'fs/promises'
import {
  loadConfig,
  resolveCryptoBackend,
  CryptoBackendSelectionError,
  parseDotenv,
  diffEnv,
  formatSafeDiff,
  formatUnsafeDiff,
} from '../../core/index.js'

export const diffCommand = new Command('diff')
  .description('Compare local envOutput with vault secret (no writes)')
  .requiredOption('--env <env>', 'Environment')
  .requiredOption('--service <service>', 'Service')
  .option('--plan', 'Print summary plan output')
  .option('--json', 'Print JSON diff output')
  .option('--unsafe-show-values', 'Show secret values in diff', false)
  .action(async (options) => {
    const cwd = process.cwd()
    const config = await loadConfig(cwd)
    const serviceConfig = config.services[options.service]
    if (!serviceConfig) {
      console.error(`Error: Service '${options.service}' not found in config`)
      process.exit(1)
    }

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

    const secretPath = join(cwd, config.secretsDir, options.env, `${options.service}.sops.yaml`)
    const outputPath = join(cwd, serviceConfig.envOutput)

    let localEnv: Record<string, string> = {}
    try {
      localEnv = parseDotenv(await readFile(outputPath, 'utf-8')).env
    } catch {
      localEnv = {}
    }

    const { data: vaultEnv } = await backend.decrypt(secretPath)
    const diff = diffEnv(localEnv, vaultEnv)
    const payload = {
      command: 'diff',
      env: options.env,
      service: options.service,
      summary: {
        added: diff.added.length,
        removed: diff.removed.length,
        changed: diff.changed.length,
      },
      diff,
    }
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    if (options.plan) {
      console.log(`Plan: diff ${options.env}/${options.service}`)
      console.log(`  +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`)
    }
    if (options.unsafeShowValues) {
      console.log(formatUnsafeDiff(diff, localEnv, vaultEnv))
    } else {
      console.log(formatSafeDiff(diff))
    }
  })
