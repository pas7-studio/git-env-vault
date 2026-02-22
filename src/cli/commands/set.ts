import { Command } from 'commander'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import {
  loadConfig, 
  SopsAdapter, 
  GitAdapter,
  diffEnv, 
  formatSafeDiff,
  formatUnsafeDiff,
  withLock
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'

export const setCommand = new Command('set')
  .description('Set one or more environment variables')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .requiredOption('--service <service>', 'Service name')
  .argument('<key=value...>', 'Key-value pairs to set')
  .option('--unsafe-show-values', 'Show values in diff', false)
  .option('--confirm', 'Confirm before writing secret file')
  .option('--yes', 'Apply without prompt (for CI/non-interactive)', false)
  .option('--no-commit', 'Skip git commit')
  .action(async (keyValues, options) => {
    const cwd = process.cwd()
    
    const config = await loadConfig(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)
    
    const secretPath = join(cwd, config.secretsDir, options.env, `${options.service}.sops.yaml`)
    
    // Parse key=value pairs
    const updates: Record<string, string> = {}
    for (const kv of keyValues) {
      const eqIndex = kv.indexOf('=')
      if (eqIndex === -1) {
        console.error(`❌ Invalid format: ${kv}. Expected KEY=value`)
        process.exit(1)
      }
      const key = kv.slice(0, eqIndex)
      const value = kv.slice(eqIndex + 1)
      updates[key!] = value!
    }
    
    await withLock(cwd, async () => {
      // Load existing
      let existingData: Record<string, string> = {}
      try {
        const { data } = await sops.decrypt(secretPath)
        existingData = data
      } catch {
        // File doesn't exist
      }
      
      // Apply updates
      const newData = { ...existingData, ...updates }
      
      // Show diff
      const diff = diffEnv(existingData, newData)
      console.log('\nChanges:')
      console.log(
        options.unsafeShowValues
          ? formatUnsafeDiff(diff, existingData, newData)
          : formatSafeDiff(diff)
      )

      if (options.confirm) {
        if (!options.yes) {
          if (!process.stdin.isTTY) {
            console.error('вќЊ Confirmation requested but stdin is not interactive. Use --yes.')
            process.exit(1)
          }
          const answer = await new Promise<string>((resolve) => {
            process.stdout.write('Apply changes to secret file? [y/N]: ')
            process.stdin.resume()
            process.stdin.setEncoding('utf8')
            process.stdin.once('data', (chunk) => resolve(String(chunk).trim().toLowerCase()))
          })
          if (answer !== 'y' && answer !== 'yes') {
            console.log('в„№пёЏ  Cancelled')
            return
          }
        }
      }
      
      // Save
      const yamlContent = stringifyYaml(newData)
      await writeFile(secretPath, yamlContent, 'utf-8')
      await sops.encrypt(secretPath)
      
      console.log(`\n✅ Updated ${secretPath}`)
      
      if (options.commit && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `chore(secrets): set keys in ${options.env}/${options.service}`,
          add: [secretPath]
        })
        console.log(`✅ Committed: ${commitHash}`)
      }
    })
  })
