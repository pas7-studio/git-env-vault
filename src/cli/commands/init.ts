import { Command } from 'commander'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { 
  getDefaultConfig, 
  generateConfigJson, 
  getDefaultPolicy, 
  generatePolicyJson,
  GitAdapter 
} from '../../core/index.js'

export const initCommand = new Command('init')
  .description('Initialize envvault in the current project')
  .option('--secrets-dir <dir>', 'Directory for secrets', 'secrets')
  .action(async (options) => {
    const cwd = process.cwd()
    const git = new GitAdapter(cwd)
    
    console.log('🚀 Initializing git-env-vault...\n')
    
    // Check if git repo
    if (!(await git.isRepo())) {
      console.error('❌ Not a git repository. Run `git init` first.')
      process.exit(1)
    }
    
    // Create config
    const config = getDefaultConfig()
    config.secretsDir = options.secretsDir
    const configPath = join(cwd, 'envvault.config.json')
    
    try {
      await writeFile(configPath, generateConfigJson(config), 'utf-8')
      console.log(`✅ Created ${configPath}`)
    } catch (error) {
      console.error(`❌ Failed to create config: ${(error as Error).message}`)
      process.exit(1)
    }
    
    // Create policy
    const policy = getDefaultPolicy()
    const policyPath = join(cwd, 'envvault.policy.json')
    
    try {
      await writeFile(policyPath, generatePolicyJson(policy), 'utf-8')
      console.log(`✅ Created ${policyPath}`)
    } catch (error) {
      console.error(`❌ Failed to create policy: ${(error as Error).message}`)
      process.exit(1)
    }
    
    // Create directories
    const secretsDir = join(cwd, options.secretsDir)
    const tmpDir = join(cwd, '.envvault', 'tmp')
    
    await mkdir(secretsDir, { recursive: true })
    await mkdir(tmpDir, { recursive: true })
    console.log(`✅ Created directory ${secretsDir}`)
    console.log(`✅ Created directory ${tmpDir}`)
    
    // Update .gitignore
    const added = await git.addToGitignore('.envvault/')
    if (added) {
      console.log('✅ Added .envvault/ to .gitignore')
    } else {
      console.log('ℹ️  .envvault/ already in .gitignore')
    }
    
    // Add *.env to gitignore (except examples)
    await git.addToGitignore('.env')
    await git.addToGitignore('.env.*')
    await git.addToGitignore('!.env.example')
    console.log('✅ Added .env patterns to .gitignore')
    
    console.log('\n🎉 Initialization complete!')
    console.log('\nNext steps:')
    console.log('1. Edit envvault.config.json to define your services')
    console.log('2. Edit envvault.policy.json to add age recipients')
    console.log('3. Run `envvault grant` to add users')
  })
