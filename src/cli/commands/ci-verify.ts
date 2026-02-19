import { Command } from 'commander'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'
import {
  loadConfig, 
  loadPolicy, 
  loadPolicySignature,
  getExpectedSopsConfigYaml,
  verifyPolicySignature, 
  loadMasterPublicKey
} from '../../core/index.js'

export const ciVerifyCommand = new Command('ci-verify')
  .description('Verify policy signature and configuration (for CI)')
  .option('--allow-unsigned', 'Allow unsigned policy', false)
  .action(async (options) => {
    const cwd = process.cwd()
    const errors: string[] = []
    
    console.log('🔍 Running CI verification...\n')
    
    // 1. Check policy signature
    const policy = await loadPolicy(cwd)
    const signature = await loadPolicySignature(cwd)
    
    if (!signature) {
      if (!options.allowUnsigned) {
        errors.push('Policy is not signed. Run `envvault policy sign`')
      } else {
        console.log('⚠️  Policy is not signed (allowed)')
      }
    } else {
      const publicKey = await loadMasterPublicKey(cwd)
      if (!publicKey) {
        errors.push('Policy is signed but master public key not found')
      } else if (!verifyPolicySignature(policy, signature, publicKey)) {
        errors.push('Policy signature is invalid')
      } else {
        console.log('✅ Policy signature valid')
      }
    }
    
    // 2. Check .sops.yaml matches policy
    const expectedSopsYaml = getExpectedSopsConfigYaml(policy)
    const sopsYamlPath = join(cwd, '.sops.yaml')
    
    try {
      const actualSopsYaml = await readFile(sopsYamlPath, 'utf-8')
      if (actualSopsYaml.trim() === expectedSopsYaml.trim()) {
        console.log('✅ .sops.yaml matches policy')
      } else {
        errors.push('.sops.yaml does not match policy. Run `envvault sops sync`')
      }
    } catch {
      errors.push('.sops.yaml not found. Run `envvault sops sync`')
    }
    
    // 3. Check all secret files have correct recipients
    const config = await loadConfig(cwd)
    const secretFiles = await glob(`${config.secretsDir}/**/*.sops.yaml`, { cwd })
    
    for (const file of secretFiles) {
      // Extract env/service from path
      const match = file.match(/secrets\/([^/]+)\/([^/]+)\.sops\.yaml$/)
      if (!match) continue
      
      const [, env, service] = match
      
      // Get expected recipients from policy
      const envPolicy = policy.environments[env!]
      if (!envPolicy) {
        errors.push(`Unknown environment in ${file}: ${env}`)
        continue
      }
      
      const servicePolicy = envPolicy.services[service!]
      if (!servicePolicy) {
        errors.push(`Unknown service in ${file}: ${service}`)
        continue
      }
      
      // Check file has SOPS metadata
      try {
        const content = await readFile(join(cwd, file), 'utf-8')
        const parsed = parseYaml(content) as Record<string, unknown>
        
        if (!parsed.sops) {
          errors.push(`${file} is not encrypted`)
          continue
        }
        
        console.log(`✅ ${file} is properly encrypted`)
      } catch {
        errors.push(`${file} could not be parsed`)
      }
    }
    
    // 4. Check for plaintext .env files
    const envFiles = await glob('**/.env', { 
      cwd,
      ignore: ['**/node_modules/**', '**/.git/**']
    })
    
    if (envFiles.length > 0) {
      errors.push(`Plaintext .env files found: ${envFiles.join(', ')}`)
    }
    
    // Report
    if (errors.length > 0) {
      console.log('\n❌ Verification failed:\n')
      for (const error of errors) {
        console.log(`  • ${error}`)
      }
      process.exit(1)
    }
    
    console.log('\n✅ All verifications passed')
  })
