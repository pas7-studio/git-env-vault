import { Command } from 'commander'
import { join, dirname } from 'path'
import { mkdir, readFile } from 'fs/promises'
import {
  loadConfig,
  SopsAdapter,
  GitAdapter,
  parseDotenv,
  diffEnv,
  formatSafeDiff,
  formatUnsafeDiff,
  withLock,
  SopsError,
} from '../../core/index.js'

function parseCsvList(raw: unknown): string[] {
  if (!raw) return []
  const values = Array.isArray(raw) ? raw : [raw]
  return values
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}

function getProtectedLocalKeysFromConfig(
  config: {
    localProtection?: {
      global?: string[]
      services?: Record<string, string[]>
    }
  },
  serviceName: string
): string[] {
  return [
    ...new Set([
      ...(config.localProtection?.global ?? []),
      ...(config.localProtection?.services?.[serviceName] ?? []),
    ]),
  ]
}

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

function createPlanObject(service: string, env: string, diff: ReturnType<typeof diffEnv>) {
  return {
    command: 'push',
    env,
    service,
    summary: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
    },
    diff,
  }
}

export const pushCommand = new Command('push')
  .description('Push local envOutput into encrypted secret file')
  .requiredOption('--env <env>', 'Environment')
  .requiredOption('--service <service>', 'Service name')
  .option('--dry-run', 'Preview changes without writing encrypted secret')
  .option('--confirm', 'Confirm before encrypting secret')
  .option('--yes', 'Apply without prompt (for CI/non-interactive)', false)
  .option(
    '--preserve-local <keys>',
    'Do not push specified keys from local env (comma-separated or repeatable)',
    (value, prev: string[]) => {
      prev.push(value)
      return prev
    },
    []
  )
  .option(
    '--exclude-keys <keys>',
    'Exclude keys from local->secret sync (comma-separated or repeatable)',
    (value, prev: string[]) => {
      prev.push(value)
      return prev
    },
    []
  )
  .option('--unsafe-show-values', 'Show values in diff', false)
  .option('--plan', 'Print machine-readable plan summary')
  .option('--json', 'Print JSON output (implies --plan for summary)')
  .option('--no-commit', 'Skip git commit')
  .action(async (options) => {
    const cwd = process.cwd()
    const config = await loadConfig(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)

    if (!(await sops.isAvailable())) {
      console.error('Error: System SOPS binary not found.')
      console.error('`envvault push` requires system SOPS for encryption.')
      console.error('Run `envvault setup` for install instructions.')
      process.exit(1)
    }

    const serviceConfig = config.services[options.service]
    if (!serviceConfig) {
      console.error(`Error: Service '${options.service}' not found in config`)
      process.exit(1)
    }

    const localPath = join(cwd, serviceConfig.envOutput)
    const secretPath = join(cwd, config.secretsDir, options.env, `${options.service}.sops.yaml`)

    let localContent: string
    try {
      localContent = await readFile(localPath, 'utf-8')
    } catch {
      console.error(`Error: Local env file not found: ${localPath}`)
      process.exit(1)
    }

    const localEnv = parseDotenv(localContent).env
    let existingSecret: Record<string, string> = {}
    try {
      existingSecret = (await sops.decrypt(secretPath)).data
    } catch {
      existingSecret = {}
    }

    const protectedKeys = [
      ...new Set([
        ...getProtectedLocalKeysFromConfig(config, options.service),
        ...parseCsvList(options.preserveLocal),
        ...parseCsvList(options.excludeKeys),
      ]),
    ]

    const nextSecret = { ...localEnv }
    for (const key of protectedKeys) {
      if (key in nextSecret) {
        if (key in existingSecret) {
          nextSecret[key] = existingSecret[key]!
        } else {
          delete nextSecret[key]
        }
      }
    }

    const diff = diffEnv(existingSecret, nextSecret)
    const planObj = createPlanObject(options.service, options.env, diff)

    if (options.json) {
      console.log(JSON.stringify(planObj, null, 2))
      if (options.dryRun || options.plan) return
    } else if (options.plan) {
      console.log(`Plan: push ${options.env}/${options.service}`)
      console.log(`  +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`)
      if (protectedKeys.length) {
        console.log(`  protected: ${protectedKeys.join(', ')}`)
      }
      if (options.dryRun) return
    }

    console.log(`\nPushing local env -> secret for ${options.env}/${options.service}`)
    if (protectedKeys.length) {
      console.log(`Protected/excluded keys: ${protectedKeys.join(', ')}`)
    }
    console.log('\nChanges:')
    console.log(
      options.unsafeShowValues
        ? formatUnsafeDiff(diff, existingSecret, nextSecret)
        : formatSafeDiff(diff)
    )

    if (options.dryRun) {
      console.log('\nDry-run: no files written.')
      return
    }

    if (options.confirm) {
      const ok = await confirmYesNo('Apply changes to encrypted secret?', options.yes)
      if (!ok) {
        console.log('Cancelled')
        return
      }
    }

    try {
      await withLock(cwd, async () => {
        await mkdir(dirname(secretPath), { recursive: true })
        await sops.encryptData(secretPath, nextSecret)
        console.log(`\nUpdated ${secretPath}`)

        if (options.commit && (await git.isRepo())) {
          const commitHash = await git.commit({
            message: `chore(secrets): push local env to ${options.env}/${options.service}`,
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

