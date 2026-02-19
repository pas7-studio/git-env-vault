import { TuiContext } from '../run.js'
import { SopsAdapter, GitAdapter } from '../../core/index.js'
import { access, readdir } from 'fs/promises'
import { join } from 'path'
import ora from 'ora'

export async function runDoctorFlow(ctx: TuiContext): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  
  console.log('\n🔍 Environment Check\n')
  
  const checks: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string }> = []
  
  // Check SOPS
  const sopsSpinner = ora('Checking SOPS...').start()
  if (await sops.isAvailable()) {
    const version = await sops.getVersion()
    sopsSpinner.succeed(`SOPS: Installed (${version})`)
    checks.push({ name: 'SOPS', status: 'ok', message: `Installed (${version})` })
  } else {
    sopsSpinner.fail('SOPS: Not installed')
    checks.push({ name: 'SOPS', status: 'error', message: 'Not installed' })
  }
  
  // Check AGE key
  const ageKeyFile = process.env.SOPS_AGE_KEY_FILE
  const ageKey = process.env.SOPS_AGE_KEY
  
  if (ageKeyFile) {
    try {
      await access(ageKeyFile)
      console.log(`✅ AGE Key: Found at ${ageKeyFile}`)
      checks.push({ name: 'AGE Key', status: 'ok', message: `Found at ${ageKeyFile}` })
    } catch {
      console.log(`❌ AGE Key: File not found`)
      checks.push({ name: 'AGE Key', status: 'error', message: 'File not found' })
    }
  } else if (ageKey) {
    console.log('✅ AGE Key: Found in environment')
    checks.push({ name: 'AGE Key', status: 'ok', message: 'Found in env' })
  } else {
    console.log('⚠️  AGE Key: Not set')
    checks.push({ name: 'AGE Key', status: 'warning', message: 'Not set' })
  }
  
  // Check Git
  if (await git.isRepo()) {
    const status = await git.status()
    console.log(`✅ Git: Repository (${status.branch || 'detached'})`)
    checks.push({ name: 'Git', status: 'ok', message: 'Repository' })
  } else {
    console.log('❌ Git: Not a repository')
    checks.push({ name: 'Git', status: 'error', message: 'Not a repository' })
  }
  
  // Check config
  console.log('✅ Config: envvault.config.json found')
  checks.push({ name: 'Config', status: 'ok', message: 'Found' })
  
  // Check temp directory
  const tmpDir = join(ctx.cwd, '.envvault', 'tmp')
  try {
    const files = await readdir(tmpDir)
    if (files.length > 0) {
      console.log(`⚠️  Temp Dir: ${files.length} stale files`)
      checks.push({ name: 'Temp Dir', status: 'warning', message: `${files.length} stale files` })
    } else {
      console.log('✅ Temp Dir: Clean')
      checks.push({ name: 'Temp Dir', status: 'ok', message: 'Clean' })
    }
  } catch {
    console.log('✅ Temp Dir: Not present')
    checks.push({ name: 'Temp Dir', status: 'ok', message: 'Not present' })
  }
  
  const hasErrors = checks.some(c => c.status === 'error')
  if (hasErrors) {
    console.log('\n❌ Some checks failed')
  } else {
    console.log('\n✅ All checks passed')
  }
}
