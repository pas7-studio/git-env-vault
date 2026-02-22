import { Command } from 'commander'
import { access, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  loadConfig,
  loadPolicy,
  SopsAdapter,
  GitAdapter,
  writeSopsConfig,
  withLock,
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

    if (!policy.environments[env]) {
      console.error(`Error: Environment '${env}' not found in policy`)
      process.exit(1)
    }

    if (!config.services[service]) {
      console.error(`Error: Service '${service}' not found in config`)
      process.exit(1)
    }

    if (!policy.environments[env].services[service]) {
      policy.environments[env].services[service] = { recipients: [] }
    }

    if (policy.environments[env].services[service].recipients.includes(recipient)) {
      console.log(`Recipient already has access to ${env}/${service}`)
      return
    }

    await withLock(cwd, async () => {
      policy.environments[env]!.services[service]!.recipients.push(recipient)

      const policyPath = join(cwd, 'envvault.policy.json')
      await writeFile(policyPath, JSON.stringify(policy, null, 2), 'utf-8')
      console.log('Added recipient to policy')

      await writeSopsConfig(cwd, policy)
      console.log('Updated .sops.yaml')

      const secretPath = join(cwd, config.secretsDir, env, `${service}.sops.yaml`)
      let secretExists = false
      try {
        await access(secretPath)
        secretExists = true
      } catch {
        secretExists = false
      }

      if (secretExists) {
        try {
          await sops.updateKeys(secretPath)
          console.log('Re-encrypted secrets with new recipient')
        } catch {
          console.log('Warning: Could not re-encrypt existing secret file')
        }
      } else {
        console.log('No existing secret file to re-encrypt (policy updated only)')
      }

      if (options.commit && (await git.isRepo())) {
        const filesToAdd = [policyPath, join(cwd, '.sops.yaml')]
        if (secretExists) {
          filesToAdd.push(secretPath)
        }

        const commitHash = await git.commit({
          message: `chore(policy): grant access to ${env}/${service}`,
          add: filesToAdd,
        })
        console.log(`Committed: ${commitHash}`)
      }
    })

    console.log(`\nGranted access to ${env}/${service}`)
  })
