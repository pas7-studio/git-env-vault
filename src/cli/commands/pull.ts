import { Command } from 'commander'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { 
  loadConfig, 
  loadSchema,
  validateAgainstSchema,
  generateWithPlaceholders,
  SopsAdapter, 
  renderEntriesSimple,
  createEntry,
  ConfigError, 
  SopsError,
  atomicWriteFile,
  diffSecretsFiles,
  formatDiffSummaryWithOptions,
  hasChanges
} from '../../core/index.js'
import type { DotenvEntry } from '../../core/env/types.js'
import type { EnvObject } from '../../core/types/index.js'

/**
 * Convert EnvObject (Record<string, string>) to DotenvEntry[]
 */
function envObjectToEntries(obj: EnvObject): DotenvEntry[] {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
  }));
}

/**
 * Convert DotenvEntry[] to EnvObject (Record<string, string>)
 */
function entriesToEnvObject(entries: DotenvEntry[]): EnvObject {
  const obj: EnvObject = {};
  for (const entry of entries) {
    obj[entry.key] = entry.value;
  }
  return obj;
}

export const pullCommand = new Command('pull')
  .description('Decrypt and write .env files to services')
  .requiredOption('--env <env>', 'Environment (dev, uat, prod)')
  .option('--service <service>', 'Specific service (default: all)')
  .option('--dry-run', 'Show what would change without writing')
  .option('--no-write', 'Validate only, do not write files')
  .option('--strict', 'Fail if required keys are missing (requires schema)')
  .option('--backup', 'Create backup of existing .env files')
  .option('--show-diff', 'Show diff summary of changes')
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
    
    // Load schema if exists
    let schema
    try {
      schema = await loadSchema(cwd)
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to load schema: ${(error as Error).message}`)
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
    let hasMissingKeys = false
    
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      const secretPath = join(cwd, config.secretsDir, env, `${serviceName}.sops.yaml`)
      const outputPath = join(cwd, serviceConfig!.envOutput)
      
      console.log(`\n📦 Processing ${serviceName}...`)
      
      try {
        // Decrypt
        const { data } = await sops.decrypt(secretPath)
        
        // Convert to DotenvEntry array
        const newEntries: DotenvEntry[] = envObjectToEntries(data)
        
        // Schema validation if available
        if (schema?.services[serviceName]) {
          const serviceSchema = schema.services[serviceName]
          const validation = validateAgainstSchema(newEntries, serviceSchema)
          
          if (validation.missing.length > 0) {
            console.log(`   ⚠️  Missing required keys: ${validation.missing.join(', ')}`)
            hasMissingKeys = true
            
            if (options.strict) {
              console.error(`   ❌ Strict mode: missing required keys`)
              hasErrors = true
              continue
            }
            
            // Generate with placeholders
            const entriesWithPlaceholders = generateWithPlaceholders(newEntries, serviceSchema)
            if (!options.dryRun && !options.noWrite) {
              // Use entries with placeholders for output
              const envContent = renderEntriesSimple(entriesWithPlaceholders)
              
              // Show diff if requested
              if (options.showDiff) {
                let oldEntries: DotenvEntry[] = []
                try {
                  const oldContent = await readFile(outputPath, 'utf-8')
                  const { parseDotenv } = await import('../../core/env/parse-dotenv.js')
                  const parsedOld = parseDotenv(oldContent)
                  oldEntries = parsedOld.entries
                } catch {
                  // File doesn't exist
                }
                
                const diff = diffSecretsFiles(oldEntries, entriesWithPlaceholders)
                if (hasChanges(diff)) {
                  console.log('\n   Changes:')
                  console.log(formatDiffSummaryWithOptions(diff, { colorize: true }).split('\n').map(l => '   ' + l).join('\n'))
                }
              }
              
              // Write with atomic operation and optional backup
              const writeOptions: { backup?: boolean } = {}
              if (options.backup) {
                writeOptions.backup = true
              }
              
              await atomicWriteFile(outputPath, envContent, writeOptions)
              console.log(`   ✅ Wrote ${outputPath} (with placeholders for missing keys)`)
            }
            continue
          }
          
          if (validation.extra.length > 0) {
            console.log(`   ℹ️  Extra keys not in schema: ${validation.extra.join(', ')}`)
          }
        }
        
        // Normal processing without schema or when all required keys present
        const envContent = renderEntriesSimple(newEntries)
        
        if (options.dryRun) {
          console.log(`   Would write to: ${outputPath}`)
          console.log(`   Keys: ${Object.keys(data).join(', ') || '(empty)'}`)
          continue
        }
        
        if (options.noWrite) {
          console.log(`   ✓ Decryption successful (${Object.keys(data).length} keys)`)
          continue
        }
        
        // Show diff if requested
        if (options.showDiff) {
          let oldEntries: DotenvEntry[] = []
          try {
            const oldContent = await readFile(outputPath, 'utf-8')
            const { parseDotenv } = await import('../../core/env/parse-dotenv.js')
            const parsedOld = parseDotenv(oldContent)
            oldEntries = parsedOld.entries
          } catch {
            // File doesn't exist
          }
          
          const diff = diffSecretsFiles(oldEntries, newEntries)
          if (hasChanges(diff)) {
            console.log('\n   Changes:')
            console.log(formatDiffSummaryWithOptions(diff, { colorize: true }).split('\n').map(l => '   ' + l).join('\n'))
          } else {
            console.log('   No changes detected')
          }
        }
        
        // Write with atomic operation and optional backup
        const writeOptions: { backup?: boolean } = {}
        if (options.backup) {
          writeOptions.backup = true
        }
        
        await mkdir(dirname(outputPath), { recursive: true })
        await atomicWriteFile(outputPath, envContent, writeOptions)
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
    
    if (hasMissingKeys && !options.strict) {
      console.log('\n⚠️  Some required keys were missing. Placeholders were generated.')
      console.log('   Run with --strict to fail on missing keys.')
    }
    
    console.log('\n✅ Pull complete')
  })
