import { Command } from 'commander'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import {
  loadConfig,
  SopsAdapter,
  GitAdapter,
  diffEnv,
  formatSafeDiff,
  formatUnsafeDiff,
  withLock,
  SopsError,
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'

async function confirmYesNo(prompt: string, yes?: boolean): Promise<boolean> {
  if (yes) return true
  if (!process.stdin.isTTY) {
    console.error('Error: Confirmation requested but stdin is not interactive. Use --yes.')
    return false
  }
  const answer = await new Promise<string>((resolve) => {
    process.stdout.write(`${prompt} [y/N]: `)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (chunk) => resolve(String(chunk).trim().toLowerCase()))
  })
  return answer === 'y' || answer === 'yes'
}

export const setCommand = new Command('set')
  .description('Set one or more environment variables')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .requiredOption('--service <service>', 'Service name')
  .argument('<key=value...>', 'Key-value pairs to set')
  .option('--unsafe-show-values', 'Show values in diff', false)
  .option('--confirm', 'Confirm before writing secret file')
  .option('--yes', 'Apply without prompt (for CI/non-interactive)', false)
  .option('--no-commit', 'Skip git commit')
  .action(async (keyValues, options) => {
    const cwd = process.cwd()
    const config = await loadConfig(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)

    if (!(await sops.isAvailable())) {
      console.error('Error: System SOPS binary not found.')
      console.error('`envvault set` requires system SOPS (JS backend supports decrypt/pull only).')
      console.error('Run `envvault setup` for install instructions.')
      process.exit(1)
    }

    const secretPath = join(cwd, config.secretsDir, options.env, `${options.service}.sops.yaml`)

    const updates: Record<string, string> = {}
    for (const kv of keyValues as string[]) {
      const eqIndex = kv.indexOf('=')
      if (eqIndex === -1) {
        console.error(`Error: Invalid format "${kv}". Expected KEY=value`)
        process.exit(1)
      }
      updates[kv.slice(0, eqIndex)] = kv.slice(eqIndex + 1)
    }

    try {
      await withLock(cwd, async () => {
        let existingData: Record<string, string> = {}
        try {
          const { data } = await sops.decrypt(secretPath)
          existingData = data
        } catch {
          // New file path; proceed with empty object
        }

        const newData = { ...existingData, ...updates }
        const diff = diffEnv(existingData, newData)

        console.log('\nChanges:')
        console.log(
          options.unsafeShowValues
            ? formatUnsafeDiff(diff, existingData, newData)
            : formatSafeDiff(diff)
        )

        if (options.confirm) {
          const confirmed = await confirmYesNo('Apply changes to encrypted secret?', options.yes)
          if (!confirmed) {
            console.log('Cancelled')
            return
          }
        }

        await writeFile(secretPath, stringifyYaml(newData), 'utf-8')
        await sops.encrypt(secretPath)
        console.log(`\nUpdated ${secretPath}`)

        if (options.commit && (await git.isRepo())) {
          const commitHash = await git.commit({
            message: `chore(secrets): set keys in ${options.env}/${options.service}`,
            add: [secretPath],
          })
          console.log(`Committed: ${commitHash}`)
        }
      })
    } catch (error) {
      if (error instanceof SopsError) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
      }
      throw error
    }
  })
