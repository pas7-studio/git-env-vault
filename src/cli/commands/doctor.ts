import { Command } from 'commander'
import { access, readdir } from 'fs/promises'
import { join } from 'path'
import { SopsAdapter, GitAdapter, loadConfig } from '../../core/index.js'

interface CheckResult {
  name: string
  status: 'ok' | 'warning' | 'error'
  message: string
}

export const doctorCommand = new Command('doctor')
  .description('Check environment and configuration')
  .action(async () => {
    const cwd = process.cwd()
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)
    
    const checks: CheckResult[] = []
    
    // Check SOPS
    if (await sops.isAvailable()) {
      const version = await sops.getVersion()
      checks.push({ name: 'SOPS', status: 'ok', message: `Installed (${version})` })
    } else {
      checks.push({ name: 'SOPS', status: 'error', message: 'Not installed. Install from https://github.com/getsops/sops' })
    }
    
    // Check AGE key
    const ageKeyFile = process.env.SOPS_AGE_KEY_FILE
    const ageKey = process.env.SOPS_AGE_KEY
    
    if (ageKeyFile) {
      try {
        await access(ageKeyFile)
        checks.push({ name: 'AGE Key', status: 'ok', message: `Found at ${ageKeyFile}` })
      } catch {
        checks.push({ name: 'AGE Key', status: 'error', message: `SOPS_AGE_KEY_FILE set but file not found: ${ageKeyFile}` })
      }
    } else if (ageKey) {
      checks.push({ name: 'AGE Key', status: 'ok', message: 'Found in SOPS_AGE_KEY env var' })
    } else {
      checks.push({ name: 'AGE Key', status: 'warning', message: 'No SOPS_AGE_KEY_FILE or SOPS_AGE_KEY set' })
    }
    
    // Check Git repo
    if (await git.isRepo()) {
      const status = await git.status()
      checks.push({ name: 'Git', status: 'ok', message: `Repository (${status.branch || 'detached'})` })
    } else {
      checks.push({ name: 'Git', status: 'error', message: 'Not a git repository' })
    }
    
    // Check config
    try {
      const config = await loadConfig(cwd)
      checks.push({ name: 'Config', status: 'ok', message: 'envvault.config.json found' })
      
      // Check secrets dir
      const secretsDir = join(cwd, config.secretsDir)
      try {
        await access(secretsDir)
        checks.push({ name: 'Secrets Dir', status: 'ok', message: config.secretsDir })
      } catch {
        checks.push({ name: 'Secrets Dir', status: 'warning', message: `${config.secretsDir} not found` })
      }
    } catch {
      checks.push({ name: 'Config', status: 'warning', message: 'envvault.config.json not found. Run `envvault init`' })
    }
    
    // Check temp directory
    const tmpDir = join(cwd, '.envvault', 'tmp')
    try {
      const files = await readdir(tmpDir)
      if (files.length > 0) {
        checks.push({ name: 'Temp Dir', status: 'warning', message: `.envvault/tmp has ${files.length} stale files` })
      } else {
        checks.push({ name: 'Temp Dir', status: 'ok', message: 'Clean' })
      }
    } catch {
      checks.push({ name: 'Temp Dir', status: 'ok', message: 'Not present (will be created on demand)' })
    }
    
    // Print results
    console.log('\n🔍 Environment Check\n')
    
    for (const check of checks) {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
      console.log(`${icon} ${check.name}: ${check.message}`)
    }
    
    const hasErrors = checks.some(c => c.status === 'error')
    if (hasErrors) {
      console.log('\n❌ Some checks failed')
      process.exit(1)
    }
    
    console.log('\n✅ All checks passed')
  })
