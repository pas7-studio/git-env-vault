import { Command } from 'commander'
import { join } from 'path'
import { glob } from 'glob'
import {
  loadConfig,
  loadPolicy,
  SopsAdapter,
  GitAdapter,
  writeSopsConfig,
  withLock
} from '../../core/index.js'

export const updatekeysCommand = new Command('updatekeys')
  .description('Update encryption keys to match current policy recipients')
  .option('--env <env>', 'Specific environment (default: all)')
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
    
    // First, update .sops.yaml to match policy
    console.log('📝 Updating .sops.yaml...')
    await writeSopsConfig(cwd, policy)
    console.log('✅ Updated .sops.yaml\n')
    
    // Find all secret files
    const pattern = options.env
      ? `${config.secretsDir}/${options.env}/**/*.sops.yaml`
      : `${config.secretsDir}/**/*.sops.yaml`
    
    const secretFiles = await glob(pattern, { cwd })
    
    if (secretFiles.length === 0) {
      console.log('ℹ️  No secret files found')
      return
    }
    
    const filesToCommit: string[] = [join(cwd, '.sops.yaml')]
    let updated = 0
    let skipped = 0
    
    await withLock(cwd, async () => {
      for (const file of secretFiles) {
        // Extract env/service from path
        const match = file.match(/secrets\/([^/]+)\/([^/]+)\.sops\.yaml$/)
        if (!match) {
          console.log(`⏭️  Skipping ${file} (unexpected path format)`)
          skipped++
          continue
        }
        
        const [, env, service] = match
        
        // Filter by service if specified
        if (options.service && service !== options.service) {
          skipped++
          continue
        }
        
        const secretPath = join(cwd, file)
        
        console.log(`🔑 Updating keys for ${env}/${service}...`)
        
        try {
          await sops.updateKeys(secretPath)
          console.log(`   ✅ Updated ${file}`)
          filesToCommit.push(secretPath)
          updated++
        } catch (error) {
          console.error(`   ❌ Failed: ${(error as Error).message}`)
        }
      }
      
      // Commit changes
      if (options.commit && filesToCommit.length > 1 && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `chore(secrets): update encryption keys`,
          add: filesToCommit
        })
        console.log(`\n✅ Committed: ${commitHash}`)
      }
    })
    
    console.log(`\n📊 Summary:`)
    console.log(`   Updated: ${updated} files`)
    console.log(`   Skipped: ${skipped} files`)
  })
