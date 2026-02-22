import { Command } from 'commander'
import { access, readdir } from 'fs/promises'
import { join } from 'path'
import {
  SopsAdapter,
  GitAdapter,
  loadConfig,
  getCryptoBackendStatuses,
  buildCapabilityMatrix,
  type CapabilityRow,
} from '../../core/index.js'
import { printSetupInstructions } from './setup.js'

interface CheckResult {
  name: string
  status: 'ok' | 'warning' | 'error'
  message: string
}

export function formatCapabilityRow(row: CapabilityRow): string {
  const icon = row.status === 'ok' ? 'OK' : 'FAIL'
  const via =
    row.via === 'both'
      ? 'system SOPS / JS backend'
      : row.via === 'system-sops'
        ? 'system SOPS'
        : row.via === 'js'
          ? 'JS backend'
          : 'none'
  return `${row.label}: ${icon} via ${via}`
}

export const doctorCommand = new Command('doctor')
  .description('Check environment and configuration')
  .option('--fix', 'Show setup guidance for your OS')
  .action(async (options) => {
    const cwd = process.cwd()
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)

    const checks: CheckResult[] = []

    if (await sops.isAvailable()) {
      const version = await sops.getVersion()
      checks.push({
        name: 'SOPS',
        status: 'ok',
        message: `Installed (${version ?? 'unknown version'})`,
      })
    } else {
      checks.push({
        name: 'SOPS',
        status: 'warning',
        message: 'Not installed (JS backend may still support pull/decrypt)',
      })
    }

    const ageKeyFile = process.env.SOPS_AGE_KEY_FILE
    const ageKey = process.env.SOPS_AGE_KEY

    if (ageKeyFile) {
      try {
        await access(ageKeyFile)
        checks.push({ name: 'AGE Key', status: 'ok', message: `Found at ${ageKeyFile}` })
      } catch {
        checks.push({
          name: 'AGE Key',
          status: 'error',
          message: `SOPS_AGE_KEY_FILE set but file not found: ${ageKeyFile}`,
        })
      }
    } else if (ageKey) {
      checks.push({ name: 'AGE Key', status: 'ok', message: 'Found in SOPS_AGE_KEY env var' })
    } else {
      checks.push({
        name: 'AGE Key',
        status: 'warning',
        message: 'No SOPS_AGE_KEY_FILE or SOPS_AGE_KEY set',
      })
    }

    if (await git.isRepo()) {
      const status = await git.status()
      checks.push({
        name: 'Git',
        status: 'ok',
        message: `Repository (${status.branch || 'detached'})`,
      })
    } else {
      checks.push({ name: 'Git', status: 'error', message: 'Not a git repository' })
    }

    try {
      const config = await loadConfig(cwd)
      checks.push({
        name: 'Config',
        status: 'ok',
        message: `envvault.config.json found (cryptoBackend=${config.cryptoBackend ?? 'auto'})`,
      })

      const secretsDir = join(cwd, config.secretsDir)
      try {
        await access(secretsDir)
        checks.push({ name: 'Secrets Dir', status: 'ok', message: config.secretsDir })
      } catch {
        checks.push({
          name: 'Secrets Dir',
          status: 'warning',
          message: `${config.secretsDir} not found`,
        })
      }
    } catch {
      checks.push({
        name: 'Config',
        status: 'warning',
        message: 'envvault.config.json not found. Run `envvault init`',
      })
    }

    const tmpDir = join(cwd, '.envvault', 'tmp')
    try {
      const files = await readdir(tmpDir)
      if (files.length > 0) {
        checks.push({
          name: 'Temp Dir',
          status: 'warning',
          message: `.envvault/tmp has ${files.length} stale files`,
        })
      } else {
        checks.push({ name: 'Temp Dir', status: 'ok', message: 'Clean' })
      }
    } catch {
      checks.push({
        name: 'Temp Dir',
        status: 'ok',
        message: 'Not present (will be created on demand)',
      })
    }

    console.log('\nEnvironment Check\n')
    for (const check of checks) {
      const icon =
        check.status === 'ok' ? '[OK]' : check.status === 'warning' ? '[WARN]' : '[FAIL]'
      console.log(`${icon} ${check.name}: ${check.message}`)
    }

    const backendStatuses = await getCryptoBackendStatuses()
    const capabilityMatrix = buildCapabilityMatrix(backendStatuses)

    console.log('\nCrypto Backends\n')
    for (const backend of backendStatuses) {
      console.log(
        `[${backend.available ? 'OK' : 'FAIL'}] ${backend.id}: ${backend.displayName}`
      )
    }

    console.log('\nCapability Matrix\n')
    for (const row of capabilityMatrix) {
      console.log(`- ${formatCapabilityRow(row)}`)
    }

    console.log('\nHints')
    console.log('- For basic usage, JS backend is enough for pull/decrypt.')
    console.log('- For rotate/updatekeys and other write operations, install system SOPS + age.')
    console.log(
      '- Set preferred backend in envvault.config.json with "cryptoBackend": "auto" | "system-sops" | "js".'
    )

    if (options.fix) {
      console.log('')
      printSetupInstructions()
    }

    const hasErrors = checks.some((c) => c.status === 'error')
    if (hasErrors) {
      console.log('\nSome checks failed')
      process.exit(1)
    }

    console.log('\nDoctor checks completed')
  })
