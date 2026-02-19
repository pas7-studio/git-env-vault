import { confirm } from '@inquirer/prompts'
import { join } from 'path'
import { TuiContext } from '../run.js'
import { SopsAdapter, GitAdapter, withLock } from '../../core/index.js'
import ora from 'ora'

export async function runRotateFlow(
  ctx: TuiContext,
  env: string,
  services: string[]
): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  const spinner = ora()
  
  const shouldUpdateKeys = await confirm({
    message: 'Also update recipients? (after .sops.yaml changes)',
    default: false
  })
  
  const filesToCommit: string[] = []
  
  for (const service of services) {
    const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
    
    spinner.start(`Rotating ${env}/${service}...`)
    
    try {
      await withLock(ctx.cwd, async () => {
        if (shouldUpdateKeys) {
          await sops.updateKeys(secretPath)
        }
        await sops.rotate(secretPath)
      })
      
      spinner.succeed(`Rotated ${env}/${service}`)
      filesToCommit.push(secretPath)
    } catch (error) {
      spinner.fail(`Failed to rotate ${env}/${service}`)
      console.error(`   ${(error as Error).message}`)
    }
  }
  
  // Commit?
  if (filesToCommit.length > 0 && await git.isRepo()) {
    const shouldCommit = await confirm({
      message: 'Create git commit?',
      default: true
    })
    
    if (shouldCommit) {
      const commitHash = await git.commit({
        message: `chore(secrets): rotate keys for ${env}`,
        add: filesToCommit
      })
      console.log(`✅ Committed: ${commitHash}`)
    }
  }
}
