import { Command } from 'commander'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import {
  loadConfig,
  loadPolicy,
  SopsAdapter,
  GitAdapter,
  writeSopsConfig,
  withLock
} from '../../core/index.js'

export const grantCommand = new Command('grant')
  .description('Grant a user access to secrets for an environment/service')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .requiredOption('--service <service>', 'Service name')
  .requiredOption('--recipient <age>', 'Age public key recipient')
  .option('--no-commit', 'Skip git commit')
  .action(async (options) => {
    const cwd = process.cwd()
    
    const config = await loadConfig(cwd)
    const policy = await loadPolicy(cwd)
    const sops = new SopsAdapter()
    const git = new GitAdapter(cwd)
    
    const { env, service, recipient } = options
    
    // Validate environment exists
    if (!policy.environments[env]) {
      console.error(`❌ Environment '${env}' not found in policy`)
      process.exit(1)
    }
    
    // Validate service exists in config
    if (!config.services[service]) {
      console.error(`❌ Service '${service}' not found in config`)
      process.exit(1)
    }
    
    // Initialize service policy if not exists
    if (!policy.environments[env].services[service]) {
      policy.environments[env].services[service] = { recipients: [] }
    }
    
    // Check if recipient already has access
    if (policy.environments[env].services[service].recipients.includes(recipient)) {
      console.log(`ℹ️  Recipient already has access to ${env}/${service}`)
      return
    }
    
    await withLock(cwd, async () => {
      // Add recipient to policy
      policy.environments[env]!.services[service]!.recipients.push(recipient)
      
      // Save updated policy
      const policyPath = join(cwd, 'envvault.policy.json')
      await writeFile(policyPath, JSON.stringify(policy, null, 2), 'utf-8')
      console.log(`✅ Added recipient to policy`)
      
      // Update .sops.yaml
      await writeSopsConfig(cwd, policy)
      console.log(`✅ Updated .sops.yaml`)
      
      // Re-encrypt existing secrets with new recipient
      const secretPath = join(cwd, config.secretsDir, env, `${service}.sops.yaml`)
      try {
        await sops.updateKeys(secretPath)
        console.log(`✅ Re-encrypted secrets with new recipient`)
      } catch {
        console.log(`ℹ️  No existing secrets to re-encrypt`)
      }
      
      // Commit changes
      if (options.commit && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `chore(policy): grant access to ${env}/${service}`,
          add: [
            policyPath,
            join(cwd, '.sops.yaml'),
            secretPath
          ]
        })
        console.log(`✅ Committed: ${commitHash}`)
      }
    })
    
    console.log(`\n🎉 Granted access to ${env}/${service}`)
  })
