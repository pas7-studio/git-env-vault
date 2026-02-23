import { Command } from 'commander'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { glob } from 'glob'
import { execa } from 'execa'
import { parse as parseYaml } from 'yaml'
import {
  loadConfig,
  loadPolicy,
  loadPolicySignature,
  getExpectedSopsConfigYaml,
  verifyPolicySignature,
  loadMasterPublicKey,
} from '../../core/index.js'

function isEnvLikePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  if (
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('.git/') ||
    normalized.startsWith('dist/') ||
    normalized.startsWith('.envvault/') ||
    normalized.startsWith('secrets/')
  ) {
    return false
  }
  if (normalized === '.env.example') return false
  const base = normalized.split('/').pop() ?? normalized
  return base === '.env' || base.startsWith('.env.') || base.endsWith('.env')
}

async function getDirtyEnvFiles(cwd: string): Promise<string[]> {
  const result = await execa('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd,
    reject: false,
  })
  if (result.exitCode !== 0) return []

  const dirty = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      const body = line.slice(3).trim()
      if (body.includes(' -> ')) {
        const [, toPath] = body.split(' -> ')
        return [toPath ?? body]
      }
      return [body]
    })
    .filter(isEnvLikePath)

  return [...new Set(dirty)]
}

export const ciVerifyCommand = new Command('ci-verify')
  .description('Verify policy signature, encryption state, and CI safety checks')
  .option('--allow-unsigned', 'Allow unsigned policy', false)
  .option('--allow-dirty-env', 'Allow uncommitted .env* changes in git status', false)
  .action(async (options) => {
    const cwd = process.cwd()
    const errors: string[] = []

    console.log('Running CI verification...\n')

    // 1. Check policy signature
    const policy = await loadPolicy(cwd)
    const signature = await loadPolicySignature(cwd)

    if (!signature) {
      if (!options.allowUnsigned) {
        errors.push('Policy is not signed. Run `envvault policy sign`')
      } else {
        console.log('[WARN] Policy is not signed (allowed)')
      }
    } else {
      const publicKey = await loadMasterPublicKey(cwd)
      if (!publicKey) {
        errors.push('Policy is signed but master public key not found')
      } else if (!verifyPolicySignature(policy, signature, publicKey)) {
        errors.push('Policy signature is invalid')
      } else {
        console.log('[OK] Policy signature valid')
      }
    }

    // 2. Check .sops.yaml matches policy
    const expectedSopsYaml = getExpectedSopsConfigYaml(policy)
    const sopsYamlPath = join(cwd, '.sops.yaml')

    try {
      const actualSopsYaml = await readFile(sopsYamlPath, 'utf-8')
      if (actualSopsYaml.trim() === expectedSopsYaml.trim()) {
        console.log('[OK] .sops.yaml matches policy')
      } else {
        errors.push('.sops.yaml does not match policy. Run `envvault updatekeys` or regenerate policy sync.')
      }
    } catch {
      errors.push('.sops.yaml not found. Run `envvault init` or regenerate SOPS config.')
    }

    // 3. Check encrypted secret files parse as SOPS docs
    const config = await loadConfig(cwd)
    const secretFiles = await glob(`${config.secretsDir}/**/*.sops.yaml`, { cwd })

    for (const file of secretFiles) {
      const normalized = file.replace(/\\/g, '/')
      const match = normalized.match(/([^/]+)\/([^/]+)\.sops\.yaml$/)
      if (!match) continue

      const [, env, service] = match
      const envPolicy = policy.environments[env!]
      if (!envPolicy) {
        errors.push(`Unknown environment in ${file}: ${env}`)
        continue
      }
      const servicePolicy = envPolicy.services[service!]
      if (!servicePolicy) {
        errors.push(`Unknown service in ${file}: ${service}`)
        continue
      }

      try {
        const content = await readFile(join(cwd, file), 'utf-8')
        const parsed = parseYaml(content) as Record<string, unknown>
        if (!parsed.sops) {
          errors.push(`${file} is not encrypted`)
          continue
        }
        console.log(`[OK] ${file} is properly encrypted`)
      } catch {
        errors.push(`${file} could not be parsed`)
      }
    }

    // 4. Check for plaintext .env files (strict baseline)
    const plaintextEnvFiles = await glob('**/.env', {
      cwd,
      ignore: ['**/node_modules/**', '**/.git/**'],
    })
    if (plaintextEnvFiles.length > 0) {
      errors.push(`Plaintext .env files found: ${plaintextEnvFiles.join(', ')}`)
    }

    // 5. Check for dirty env-like files in git status
    if (!options.allowDirtyEnv) {
      try {
        const dirtyEnvFiles = await getDirtyEnvFiles(cwd)
        if (dirtyEnvFiles.length > 0) {
          errors.push(`Uncommitted .env changes detected: ${dirtyEnvFiles.join(', ')}`)
        }
      } catch {
        // non-git directory or git unavailable; skip
      }
    }

    if (errors.length > 0) {
      console.log('\nVerification failed:\n')
      for (const error of errors) {
        console.log(`- ${error}`)
      }
      process.exit(1)
    }

    console.log('\n[OK] All verifications passed')
  })

