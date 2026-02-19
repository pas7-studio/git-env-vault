import { Command } from 'commander'
import { join } from 'path'
import { glob } from 'glob'
import {
  loadConfig,
  loadPolicy,
  SopsAdapter,
  GitAdapter,
  withLock
} from '../../core/index.js'

export const rotateCommand = new Command('rotate')
  .description('Rotate data key for secrets (generates new encryption key)')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .option('--service <service>', 'Specific service (default: all)')
  .option('--no-commit', 'Skip git commit')
  .action(async (options) => {
    const cwd = process.cwd()
    
    const config = await loadConfig(cwd)
    const policy = await loadPolicy(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)
    
    // Check sops availability
    if (!(await sops.isAvailable())) {
      console.error('❌ SOPS binary not found')
      process.exit(1)
    }
    
    const { env, service } = options
    
    // Validate environment exists
    if (!policy.environments[env]) {
      console.error(`❌ Environment '${env}' not found in policy`)
      process.exit(1)
    }
    
    // Get services to rotate
    const services = service 
      ? [service]
      : Object.keys(policy.environments[env].services)
    
    if (services.length === 0) {
      console.log(`ℹ️  No services configured for ${env}`)
      return
    }
    
    const filesToCommit: string[] = []
    
    await withLock(cwd, async () => {
      for (const serviceName of services) {
        const secretPath = join(cwd, config.secretsDir, env, `${serviceName}.sops.yaml`)
        
        console.log(`🔄 Rotating ${env}/${serviceName}...`)
        
        try {
          await sops.rotate(secretPath)
          console.log(`   ✅ Rotated ${secretPath}`)
          filesToCommit.push(secretPath)
        } catch (error) {
          console.error(`   ❌ Failed: ${(error as Error).message}`)
        }
      }
      
      // Commit changes
      if (options.commit && filesToCommit.length > 0 && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `security(secrets): rotate data key for ${env}`,
          add: filesToCommit
        })
        console.log(`\n✅ Committed: ${commitHash}`)
      }
    })
    
    console.log(`\n✅ Rotation complete for ${env}`)
    console.log(`\n⚠️  NOTE: Old data keys are invalidated. All users will need to pull new secrets.`)
  })
