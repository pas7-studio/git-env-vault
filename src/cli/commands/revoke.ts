import { Command } from 'commander'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import {
  loadConfig,
  loadPolicy,
  SopsAdapter,
  GitAdapter,
  writeSopsConfig,
  withLock
} from '../../core/index.js'

export const revokeCommand = new Command('revoke')
  .description('Revoke a user access from secrets for an environment/service')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .requiredOption('--service <service>', 'Service name')
  .requiredOption('--recipient <age>', 'Age public key recipient to revoke')
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
    
    // Validate service policy exists
    if (!policy.environments[env].services[service]) {
      console.error(`❌ Service '${service}' not configured for environment '${env}'`)
      process.exit(1)
    }
    
    // Check if recipient has access
    const recipients = policy.environments[env].services[service].recipients
    const recipientIndex = recipients.indexOf(recipient)
    
    if (recipientIndex === -1) {
      console.log(`ℹ️  Recipient does not have access to ${env}/${service}`)
      return
    }
    
    await withLock(cwd, async () => {
      // Remove recipient from policy
      recipients.splice(recipientIndex, 1)
      
      // Save updated policy
      const policyPath = join(cwd, 'envvault.policy.json')
      await writeFile(policyPath, JSON.stringify(policy, null, 2), 'utf-8')
      console.log(`✅ Removed recipient from policy`)
      
      // Update .sops.yaml
      await writeSopsConfig(cwd, policy)
      console.log(`✅ Updated .sops.yaml`)
      
      // Re-encrypt existing secrets without the revoked recipient
      const secretPath = join(cwd, config.secretsDir, env, `${service}.sops.yaml`)
      try {
        await sops.updateKeys(secretPath)
        console.log(`✅ Re-encrypted secrets (recipient revoked)`)
      } catch {
        console.log(`ℹ️  No existing secrets to re-encrypt`)
      }
      
      // Commit changes
      if (options.commit && (await git.isRepo())) {
        const commitHash = await git.commit({
          message: `chore(policy): revoke access from ${env}/${service}`,
          add: [
            policyPath,
            join(cwd, '.sops.yaml'),
            secretPath
          ]
        })
        console.log(`✅ Committed: ${commitHash}`)
      }
    })
    
    console.log(`\n🔒 Revoked access from ${env}/${service}`)
    console.log(`⚠️  WARNING: The revoked user may still have access to old secret versions in git history.`)
    console.log(`   Consider rotating secrets if this is a security concern.`)
  })
