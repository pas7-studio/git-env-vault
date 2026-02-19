import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { loadConfig, getDefaultConfig, generateConfigJson } from '../../../src/core/config/load-config.js'
import { ConfigError } from '../../../src/core/types/errors.js'

describe('loadConfig', () => {
  const testDir = join(process.cwd(), '.test-config-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('successful loading', () => {
    it('should load valid config', async () => {
      const config = getDefaultConfig()
      await writeFile(join(testDir, 'envvault.config.json'), generateConfigJson(config))
      
      const loaded = await loadConfig(testDir)
      expect(loaded.version).toBe(1)
      expect(loaded.secretsDir).toBe('secrets')
      expect(loaded.services).toEqual({})
    })

    it('should load config with services', async () => {
      const config = {
        version: 1 as const,
        secretsDir: 'secrets',
        services: {
          api: { envOutput: 'apps/api/.env' },
          web: { envOutput: 'apps/web/.env' }
        }
      }
      await writeFile(join(testDir, 'envvault.config.json'), JSON.stringify(config, null, 2))
      
      const loaded = await loadConfig(testDir)
      expect(loaded.services).toEqual({
        api: { envOutput: 'apps/api/.env' },
        web: { envOutput: 'apps/web/.env' }
      })
    })

    it('should load config with custom secretsDir', async () => {
      const config = {
        version: 1 as const,
        secretsDir: 'vault',
        services: {}
      }
      await writeFile(join(testDir, 'envvault.config.json'), JSON.stringify(config))
      
      const loaded = await loadConfig(testDir)
      expect(loaded.secretsDir).toBe('vault')
    })
  })

  describe('error handling', () => {
    it('should throw ConfigError if file not found', async () => {
      await expect(loadConfig(testDir)).rejects.toThrow(ConfigError)
      await expect(loadConfig(testDir)).rejects.toThrow('not found')
    })

    it('should throw ConfigError on invalid JSON', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), 'not json')
      await expect(loadConfig(testDir)).rejects.toThrow(ConfigError)
      await expect(loadConfig(testDir)).rejects.toThrow('Invalid JSON')
    })

    it('should throw ConfigError on unsupported version', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":2,"secretsDir":"secrets","services":{}}')
      await expect(loadConfig(testDir)).rejects.toThrow(ConfigError)
      await expect(loadConfig(testDir)).rejects.toThrow('Unsupported config version')
    })

    it('should throw ConfigError on version 0', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":0,"secretsDir":"secrets","services":{}}')
      await expect(loadConfig(testDir)).rejects.toThrow('Unsupported config version')
    })

    it('should throw ConfigError on missing secretsDir', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":1}')
      await expect(loadConfig(testDir)).rejects.toThrow(ConfigError)
      await expect(loadConfig(testDir)).rejects.toThrow('secretsDir is required')
    })

    it('should throw ConfigError on empty secretsDir', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":1,"secretsDir":"","services":{}}')
      await expect(loadConfig(testDir)).rejects.toThrow('secretsDir is required')
    })

    it('should throw ConfigError on null secretsDir', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":1,"secretsDir":null,"services":{}}')
      await expect(loadConfig(testDir)).rejects.toThrow('secretsDir is required')
    })

    it('should throw ConfigError on missing services', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":1,"secretsDir":"secrets"}')
      await expect(loadConfig(testDir)).rejects.toThrow(ConfigError)
      await expect(loadConfig(testDir)).rejects.toThrow('services is required')
    })

    it('should throw ConfigError on null services', async () => {
      await writeFile(join(testDir, 'envvault.config.json'), '{"version":1,"secretsDir":"secrets","services":null}')
      await expect(loadConfig(testDir)).rejects.toThrow('services is required')
    })
  })
})

describe('getDefaultConfig', () => {
  it('should return valid default config', () => {
    const config = getDefaultConfig()
    
    expect(config.version).toBe(1)
    expect(config.secretsDir).toBe('secrets')
    expect(config.services).toEqual({})
  })

  it('should return consistent defaults', () => {
    const config1 = getDefaultConfig()
    const config2 = getDefaultConfig()
    
    expect(config1).toEqual(config2)
  })
})

describe('generateConfigJson', () => {
  it('should generate valid JSON string', () => {
    const config = getDefaultConfig()
    const json = generateConfigJson(config)
    
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('should generate formatted JSON with 2-space indent', () => {
    const config = getDefaultConfig()
    const json = generateConfigJson(config)
    
    expect(json).toContain('  "version"')
    expect(json).toContain('  "secretsDir"')
    expect(json).toContain('  "services"')
  })

  it('should include all config fields', () => {
    const config = {
      version: 1 as const,
      secretsDir: 'custom-secrets',
      services: {
        api: { envOutput: '.env' }
      }
    }
    const json = generateConfigJson(config)
    const parsed = JSON.parse(json)
    
    expect(parsed.version).toBe(1)
    expect(parsed.secretsDir).toBe('custom-secrets')
    expect(parsed.services.api).toBeDefined()
  })

  it('should generate round-trippable JSON', () => {
    const config = getDefaultConfig()
    const json = generateConfigJson(config)
    const parsed = JSON.parse(json)
    
    expect(parsed).toEqual(config)
  })
})
