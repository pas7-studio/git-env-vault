import { Command } from 'commander'
import { spawn } from 'child_process'
import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import {
  loadConfig, 
  SopsAdapter, 
  GitAdapter,
  parseDotenv, 
  renderDotenv, 
  diffEnv, 
  formatSafeDiff,
  createSecureTempFile, 
  withLock,
  ConfigError, 
  SopsError
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'

export const editCommand = new Command('edit')
  .description('Edit secrets in an interactive editor')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .requiredOption('--service <service>', 'Service name')
  .option('--editor <editor>', 'Editor to use', process.env.EDITOR || process.env.VISUAL || 'notepad')
  .option('--unsafe-show-values', 'Show values in diff', false)
  .option('--no-commit', 'Skip git commit')
  .action(async (options) => {
    const cwd = process.cwd()
    
    // Load config
    const config = await loadConfig(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)
    
    // Check prerequisites
    if (!(await sops.isAvailable())) {
      console.error('❌ SOPS binary not found')
      process.exit(1)
    }
    
    const secretPath = join(cwd, config.secretsDir, options.env, `${options.service}.sops.yaml`)
    
    // Load existing data
    let existingData: Record<string, string> = {}
    let order: string[] = []
    
    try {
      await access(secretPath)
      const { data } = await sops.decrypt(secretPath)
      existingData = data
      order = Object.keys(data)
    } catch {
      // File doesn't exist, will create new
    }
    
    // Create temp file with current data
    const envContent = renderDotenv(existingData, { order })
    const tempFile = await createSecureTempFile(envContent, { suffix: '.env' })
    
    try {
      // Open editor
      console.log(`📝 Opening editor for ${options.env}/${options.service}...`)
      
      const editor = spawn(options.editor, [tempFile.path], {
        stdio: 'inherit',
        shell: true
      })
      
      await new Promise<void>((resolve, reject) => {
        editor.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Editor exited with code ${code}`))
        })
        editor.on('error', reject)
      })
      
      // Read edited content
      const editedContent = await readFile(tempFile.path, 'utf-8')
      const { env: newData, order: newOrder } = parseDotenv(editedContent)
      
      // Compute diff
      const diff = diffEnv(existingData, newData)
      
      if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        console.log('ℹ️  No changes detected')
        return
      }
      
      // Show diff
      console.log('\nChanges:')
      if (options.unsafeShowValues) {
        const { formatUnsafeDiff } = await import('../../core/env/diff-env.js')
        console.log(formatUnsafeDiff(diff, existingData, newData))
      } else {
        console.log(formatSafeDiff(diff))
      }
      
      // Convert to YAML and encrypt
      await withLock(cwd, async () => {
        const yamlContent = stringifyYaml(newData)
        await writeFile(secretPath, yamlContent, 'utf-8')
        await sops.encrypt(secretPath)
      })
      
      console.log(`\n✅ Encrypted ${secretPath}`)
      
      // Commit if requested
      if (options.commit && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `chore(secrets): update ${options.env}/${options.service}`,
          add: [secretPath]
        })
        console.log(`✅ Committed: ${commitHash}`)
      }
    } finally {
      await tempFile.cleanup()
    }
  })
