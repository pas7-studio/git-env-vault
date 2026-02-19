import { Command } from 'commander'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { 
  loadConfig, 
  SopsAdapter, 
  renderDotenv, 
  ConfigError, 
  SopsError 
} from '../../core/index.js'

export const pullCommand = new Command('pull')
  .description('Decrypt and write .env files to services')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .option('--service <service>', 'Specific service (default: all)')
  .option('--dry-run', 'Show what would change without writing')
  .option('--no-write', 'Validate only, do not write files')
  .action(async (options) => {
    const cwd = process.cwd()
    
    let config
    try {
      config = await loadConfig(cwd)
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(`❌ ${error.message}`)
        process.exit(1)
      }
      throw error
    }
    
    const sops = new SopsAdapter()
    
    // Check sops availability
    if (!(await sops.isAvailable())) {
      console.error('❌ SOPS binary not found. Install SOPS first.')
      console.log('   https://github.com/getsops/sops#install')
      process.exit(1)
    }
    
    const env = options.env
    const services = options.service
      ? { [options.service]: config.services[options.service] }
      : config.services
    
    if (!services || Object.keys(services).length === 0) {
      console.error('❌ No services configured')
      process.exit(1)
    }
    
    let hasErrors = false
    
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      const secretPath = join(cwd, config.secretsDir, env, `${serviceName}.sops.yaml`)
      const outputPath = join(cwd, serviceConfig!.envOutput)
      
      console.log(`\n📦 Processing ${serviceName}...`)
      
      try {
        // Decrypt
        const { data } = await sops.decrypt(secretPath)
        const envContent = renderDotenv(data)
        
        if (options.dryRun) {
          console.log(`   Would write to: ${outputPath}`)
          console.log(`   Keys: ${Object.keys(data).join(', ') || '(empty)'}`)
          continue
        }
        
        if (options.noWrite) {
          console.log(`   ✓ Decryption successful (${Object.keys(data).length} keys)`)
          continue
        }
        
        // Write .env
        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, envContent, 'utf-8')
        console.log(`   ✅ Wrote ${outputPath}`)
      } catch (error) {
        if (error instanceof SopsError) {
          console.error(`   ❌ Failed: ${error.message}`)
          hasErrors = true
        } else {
          throw error
        }
      }
    }
    
    if (hasErrors) {
      process.exit(1)
    }
    
    console.log('\n✅ Pull complete')
  })
