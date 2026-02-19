import { select, confirm } from '@inquirer/prompts'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { TuiContext } from '../run.js'
import {
  SopsAdapter, GitAdapter, generatePolicyJson,
  writeSopsConfig
} from '../../core/index.js'
import ora from 'ora'

export async function runRevokeFlow(
  ctx: TuiContext,
  env: string,
  service: string
): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  const spinner = ora()
  
  // Get current recipients
  const envPolicy = ctx.policy.environments[env]
  const servicePolicy = envPolicy?.services[service]
  
  if (!servicePolicy || servicePolicy.recipients.length === 0) {
    console.log('❌ No recipients configured for this service')
    return
  }
  
  // Select recipient to revoke
  const recipient = await select({
    message: 'Select recipient to revoke:',
    choices: servicePolicy.recipients.map((r) => ({
      name: `${r.slice(0, 20)}...`,
      value: r,
      description: r
    }))
  })
  
  // Confirm
  const shouldRevoke = await confirm({
    message: `Revoke access for ${recipient.slice(0, 30)}...?`,
    default: false
  })
  
  if (!shouldRevoke) {
    console.log('❌ Cancelled')
    return
  }
  
  // Update policy
  const index = servicePolicy.recipients.indexOf(recipient)
  if (index > -1) {
    servicePolicy.recipients.splice(index, 1)
  }
  
  // Save policy
  spinner.start('Updating policy...')
  const policyPath = join(ctx.cwd, 'envvault.policy.json')
  await writeFile(policyPath, generatePolicyJson(ctx.policy), 'utf-8')
  spinner.succeed('Policy updated')
  
  // Update .sops.yaml
  spinner.start('Updating .sops.yaml...')
  await writeSopsConfig(ctx.cwd, ctx.policy)
  spinner.succeed('.sops.yaml updated')
  
  // Rotate keys
  const shouldRotate = await confirm({
    message: 'Rotate encryption keys? (Recommended after revoke)',
    default: true
  })
  
  if (shouldRotate) {
    const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
    
    try {
      spinner.start('Rotating encryption keys...')
      await sops.updateKeys(secretPath)
      await sops.rotate(secretPath)
      spinner.succeed('Keys rotated')
    } catch {
      spinner.warn('Could not rotate keys (file may not exist)')
    }
  }
  
  // Commit?
  if (await git.isRepo()) {
    const shouldCommit = await confirm({
      message: 'Create git commit?',
      default: true
    })
    
    if (shouldCommit) {
      const commitHash = await git.commit({
        message: `chore(policy): revoke access from ${env}/${service}`,
        add: [policyPath, '.sops.yaml']
      })
      console.log(`✅ Committed: ${commitHash}`)
    }
  }
}
