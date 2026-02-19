import { Command } from 'commander'
import { spawn } from 'child_process'

interface UpCommandOptions {
  env: string
  composeFile?: string[]
  build?: boolean
  detach?: boolean
  dryRun?: boolean
  verbose?: boolean
}

/**
 * Execute a command and return result
 */
function execCommand(
  command: string,
  args: string[],
  options?: { dryRun?: boolean; verbose?: boolean; cwd?: string }
): Promise<{ success: boolean; exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    if (options?.dryRun) {
      console.log(`[DRY-RUN] ${command} ${args.join(' ')}`)
      resolve({ success: true, exitCode: 0, stdout: '', stderr: '' })
      return
    }

    if (options?.verbose) {
      console.log(`[RUN] ${command} ${args.join(' ')}`)
    }

    const proc = spawn(command, args, {
      cwd: options?.cwd ?? process.cwd(),
      stdio: 'inherit',
      shell: true
    })

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout: '',
        stderr: ''
      })
    })

    proc.on('error', (err) => {
      console.error(`Failed to execute command: ${err.message}`)
      resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: err.message
      })
    })
  })
}

/**
 * Run docker compose up with environment verification
 * 
 * Flow: verify → pull → docker compose up
 */
export async function runUpCommand(options: UpCommandOptions): Promise<void> {
  const { env, composeFile, build = true, detach = true, dryRun = false, verbose = false } = options
  const cwd = process.cwd()
  
  console.log(`🚀 Starting ${env} environment...\n`)

  // Step 1: Verify environment
  console.log('📋 Step 1/3: Verifying environment...')
  const verifyArgs = ['gev', 'verify', '--env', env]
  
  const verifyResult = await execCommand('npx', verifyArgs, { dryRun, verbose, cwd })
  
  if (!verifyResult.success) {
    console.error('\n❌ Environment verification failed')
    console.log('💡 Run "gev doctor" to diagnose issues')
    process.exit(1)
  }
  
  if (!dryRun) {
    console.log('✅ Environment verification passed\n')
  }

  // Step 2: Pull encrypted secrets
  console.log('📥 Step 2/3: Pulling secrets...')
  const pullArgs = ['gev', 'pull', '--env', env]
  
  const pullResult = await execCommand('npx', pullArgs, { dryRun, verbose, cwd })
  
  if (!pullResult.success) {
    console.error('\n❌ Failed to pull secrets')
    process.exit(1)
  }
  
  if (!dryRun) {
    console.log('✅ Secrets pulled successfully\n')
  }

  // Step 3: Docker compose up
  console.log('🐳 Step 3/3: Starting Docker containers...')
  
  const composeArgs: string[] = ['compose']
  
  // Add compose files if specified
  if (composeFile && composeFile.length > 0) {
    for (const file of composeFile) {
      composeArgs.push('-f', file)
    }
  }
  
  composeArgs.push('up')
  
  if (build) {
    composeArgs.push('--build')
  }
  
  if (detach) {
    composeArgs.push('--detach')
  }
  
  const dockerResult = await execCommand('docker', composeArgs, { dryRun, verbose, cwd })
  
  if (!dockerResult.success) {
    console.error('\n❌ Failed to start Docker containers')
    console.log('💡 Check Docker logs for details')
    process.exit(1)
  }
  
  if (!dryRun) {
    console.log('\n✅ Docker containers started successfully')
    
    // Show running containers
    if (detach) {
      console.log('\n💡 Run "docker compose ps" to see container status')
      console.log('💡 Run "docker compose logs -f" to follow logs')
    }
  }
}

// CLI Command definition
const upCommand = new Command('up')
  .description('Verify environment, pull secrets, and start Docker containers')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .option('-f, --compose-file <files...>', 'Docker compose file(s) to use')
  .option('--no-build', 'Do not build images before starting')
  .option('--no-detach', 'Run containers in foreground')
  .option('--dry-run', 'Show commands without executing')
  .option('-v, --verbose', 'Show executed commands')
  .action(async (options) => {
    await runUpCommand({
      env: options.env,
      composeFile: options.composeFile,
      build: options.build !== false, // true by default
      detach: options.detach !== false, // true by default
      dryRun: options.dryRun,
      verbose: options.verbose
    })
  })

export { upCommand }
export default upCommand
