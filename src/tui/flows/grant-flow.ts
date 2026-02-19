import { input, confirm } from '@inquirer/prompts'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { TuiContext } from '../run.js'
import {
  SopsAdapter, GitAdapter, generatePolicyJson,
  writeSopsConfig
} from '../../core/index.js'
import ora from 'ora'

export async function runGrantFlow(
  ctx: TuiContext,
  env: string,
  service: string
): Promise<void> {
  const sops = new SopsAdapter()
  const git = new GitAdapter(ctx.cwd)
  const spinner = ora()
  
  // Get recipient
  const recipient = await input({
    message: 'Enter age public key (age1...):',
    validate: (value) => {
      if (!value.startsWith('age1')) {
        return 'Key must start with "age1"'
      }
      return true
    }
  })
  
  // Check if already exists
  const envPolicy = ctx.policy.environments[env]
  const servicePolicy = envPolicy?.services[service]
  
  if (servicePolicy?.recipients.includes(recipient)) {
    console.log('⚠️  Recipient already has access')
    return
  }
  
  // Update policy
  if (!ctx.policy.environments[env]) {
    ctx.policy.environments[env] = { services: {} }
  }
  if (!ctx.policy.environments[env]!.services[service]) {
    ctx.policy.environments[env]!.services[service] = { recipients: [] }
  }
  
  ctx.policy.environments[env]!.services[service]!.recipients.push(recipient)
  
  // Save policy
  spinner.start('Updating policy...')
  const policyPath = join(ctx.cwd, 'envvault.policy.json')
  await writeFile(policyPath, generatePolicyJson(ctx.policy), 'utf-8')
  spinner.succeed('Policy updated')
  
  // Update .sops.yaml
  spinner.start('Updating .sops.yaml...')
  await writeSopsConfig(ctx.cwd, ctx.policy)
  spinner.succeed('.sops.yaml updated')
  
  // Update keys on secret file
  const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
  
  try {
    spinner.start('Updating encryption keys...')
    await sops.updateKeys(secretPath)
    spinner.succeed('Encryption keys updated')
  } catch {
    spinner.warn('Could not update keys (file may not exist yet)')
  }
  
  // Commit?
  if (await git.isRepo()) {
    const shouldCommit = await confirm({
      message: 'Create git commit?',
      default: true
    })
    
    if (shouldCommit) {
      const commitHash = await git.commit({
        message: `chore(policy): grant access to ${env}/${service}`,
        add: [policyPath, '.sops.yaml', secretPath]
      })
      console.log(`✅ Committed: ${commitHash}`)
    }
  }
}
