import { input, confirm } from '@inquirer/prompts'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { TuiContext } from '../run.js'
import {
  SopsAdapter, GitAdapter, diffEnv, formatSafeDiff, withLock
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'
import ora from 'ora'

export async function runSetFlow(
  ctx: TuiContext,
  env: string,
  service: string
): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  const spinner = ora()
  
  const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
  
  // Collect key-value pairs
  const updates: Record<string, string> = {}
  
  console.log('\nEnter key-value pairs (empty key to finish):\n')
  
  while (true) {
    const key = await input({
      message: 'Key (or empty to finish):',
    })
    
    if (!key) break
    
    const value = await input({
      message: `Value for ${key}:`,
    })
    
    updates[key] = value
  }
  
  if (Object.keys(updates).length === 0) {
    console.log('❌ No keys provided')
    return
  }
  
  // Load existing
  let existingData: Record<string, string> = {}
  
  try {
    spinner.start('Decrypting current secrets...')
    const { data } = await sops.decrypt(secretPath)
    existingData = data
    spinner.stop()
  } catch {
    spinner.stop()
    // File doesn't exist
  }
  
  // Apply updates
  const newData = { ...existingData, ...updates }
  
  // Show diff
  const diff = diffEnv(existingData, newData)
  console.log('\nChanges:')
  console.log(formatSafeDiff(diff))
  
  // Confirm
  const shouldSave = await confirm({
    message: 'Save changes?',
    default: true
  })
  
  if (!shouldSave) {
    console.log('❌ Changes discarded')
    return
  }
  
  // Save
  spinner.start('Encrypting and saving...')
  
  await withLock(ctx.cwd, async () => {
    const yamlContent = stringifyYaml(newData)
    await writeFile(secretPath, yamlContent, 'utf-8')
    await sops.encrypt(secretPath)
  })
  
  spinner.succeed(`Saved ${secretPath}`)
  
  // Commit?
  if (await git.isRepo()) {
    const shouldCommit = await confirm({
      message: 'Create git commit?',
      default: true
    })
    
    if (shouldCommit) {
      const commitHash = await git.commit({
        message: `chore(secrets): set keys in ${env}/${service}`,
        add: [secretPath]
      })
      console.log(`✅ Committed: ${commitHash}`)
    }
  }
}
