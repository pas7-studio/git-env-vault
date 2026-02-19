import { confirm } from '@inquirer/prompts'
import { spawn } from 'child_process'
import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import { TuiContext } from '../run.js'
import {
  SopsAdapter, GitAdapter, renderDotenv, parseDotenv,
  diffEnv, formatSafeDiff, formatUnsafeDiff,
  createSecureTempFile, withLock
} from '../../core/index.js'
import { stringify as stringifyYaml } from 'yaml'
import ora from 'ora'

export async function runEditFlow(
  ctx: TuiContext,
  env: string,
  service: string
): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  const spinner = ora()
  
  const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
  
  // Load existing data
  let existingData: Record<string, string> = {}
  let order: string[] = []
  
  try {
    await access(secretPath)
    spinner.start('Decrypting current secrets...')
    const { data } = await sops.decrypt(secretPath)
    existingData = data
    order = Object.keys(data)
    spinner.stop()
  } catch {
    // File doesn't exist, will create new
  }
  
  // Create temp file
  const envContent = renderDotenv(existingData, { order })
  const tempFile = await createSecureTempFile(envContent, { suffix: '.env' })
  
  try {
    // Open editor
    console.log(`\n📝 Opening editor for ${env}/${service}...\n`)
    
    const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano')
    
    const child = spawn(editor, [tempFile.path], {
      stdio: 'inherit',
      shell: true
    })
    
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Editor exited with code ${code}`))
      })
      child.on('error', reject)
    })
    
    // Read edited content
    const editedContent = await readFile(tempFile.path, 'utf-8')
    const { env: newData } = parseDotenv(editedContent)
    
    // Compute diff
    const diff = diffEnv(existingData, newData)
    
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
      console.log('ℹ️  No changes detected')
      return
    }
    
    // Show diff
    console.log('\nChanges:')
    console.log(formatSafeDiff(diff))
    
    const showValues = await confirm({
      message: 'Show values in diff?',
      default: false
    })
    
    if (showValues) {
      console.log('\n' + formatUnsafeDiff(diff, existingData, newData))
    }
    
    // Confirm save
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
          message: `chore(secrets): update ${env}/${service}`,
          add: [secretPath]
        })
        console.log(`✅ Committed: ${commitHash}`)
      }
    }
  } finally {
    await tempFile.cleanup()
  }
}
