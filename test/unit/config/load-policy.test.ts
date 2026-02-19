import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm, access } from 'fs/promises'
import { join } from 'path'
import { 
  loadPolicy, 
  loadPolicySignature, 
  policySignatureExists, 
  getDefaultPolicy, 
  generatePolicyJson 
} from '../../../src/core/config/load-policy.js'
import { ConfigError } from '../../../src/core/types/errors.js'

describe('loadPolicy', () => {
  const testDir = join(process.cwd(), '.test-policy-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('successful loading', () => {
    it('should load valid policy', async () => {
      const policy = getDefaultPolicy()
      await writeFile(join(testDir, 'envvault.policy.json'), generatePolicyJson(policy))
      
      const loaded = await loadPolicy(testDir)
      expect(loaded.version).toBe(1)
      expect(loaded.environments).toBeDefined()
    })

    it('should load policy with environments', async () => {
      const policy = {
        version: 1 as const,
        environments: {
          dev: { services: { api: { recipients: ['age1abc'] } } },
          prod: { services: { api: { recipients: ['age1prod'] } } }
        }
      }
      await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy))
      
      const loaded = await loadPolicy(testDir)
      expect(loaded.environments.dev).toBeDefined()
      expect(loaded.environments.prod).toBeDefined()
    })

    it('should load policy with multiple services', async () => {
      const policy = {
        version: 1 as const,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc'] },
              web: { recipients: ['age1def'] },
              worker: { recipients: ['age1ghi'] }
            }
          }
        }
      }
      await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy))
      
      const loaded = await loadPolicy(testDir)
      expect(loaded.environments.dev.services.api).toBeDefined()
      expect(loaded.environments.dev.services.web).toBeDefined()
      expect(loaded.environments.dev.services.worker).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should throw ConfigError if file not found', async () => {
      await expect(loadPolicy(testDir)).rejects.toThrow(ConfigError)
      await expect(loadPolicy(testDir)).rejects.toThrow('not found')
    })

    it('should throw ConfigError on invalid JSON', async () => {
      await writeFile(join(testDir, 'envvault.policy.json'), 'not json')
      await expect(loadPolicy(testDir)).rejects.toThrow(ConfigError)
      await expect(loadPolicy(testDir)).rejects.toThrow('Invalid JSON')
    })

    it('should throw ConfigError on unsupported version', async () => {
      await writeFile(join(testDir, 'envvault.policy.json'), '{"version":2,"environments":{}}')
      await expect(loadPolicy(testDir)).rejects.toThrow(ConfigError)
      await expect(loadPolicy(testDir)).rejects.toThrow('Unsupported policy version')
    })

    it('should throw ConfigError on version 0', async () => {
      await writeFile(join(testDir, 'envvault.policy.json'), '{"version":0,"environments":{}}')
      await expect(loadPolicy(testDir)).rejects.toThrow('Unsupported policy version')
    })
  })
})

describe('loadPolicySignature', () => {
  const testDir = join(process.cwd(), '.test-sig-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should load signature file', async () => {
    const signature = 'abc123signature'
    await writeFile(join(testDir, 'envvault.policy.sig'), signature)
    
    const loaded = await loadPolicySignature(testDir)
    expect(loaded).toBe(signature)
  })

  it('should return null if signature file not found', async () => {
    const loaded = await loadPolicySignature(testDir)
    expect(loaded).toBeNull()
  })
})

describe('policySignatureExists', () => {
  const testDir = join(process.cwd(), '.test-sig-exists-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should return true if signature file exists', async () => {
    await writeFile(join(testDir, 'envvault.policy.sig'), 'signature')
    
    const exists = await policySignatureExists(testDir)
    expect(exists).toBe(true)
  })

  it('should return false if signature file does not exist', async () => {
    const exists = await policySignatureExists(testDir)
    expect(exists).toBe(false)
  })
})

describe('getDefaultPolicy', () => {
  it('should return valid default policy', () => {
    const policy = getDefaultPolicy()
    
    expect(policy.version).toBe(1)
    expect(policy.environments).toBeDefined()
    expect(policy.environments.dev).toBeDefined()
    expect(policy.environments.uat).toBeDefined()
  })

  it('should return consistent defaults', () => {
    const policy1 = getDefaultPolicy()
    const policy2 = getDefaultPolicy()
    
    expect(policy1).toEqual(policy2)
  })

  it('should have empty services by default', () => {
    const policy = getDefaultPolicy()
    
    expect(policy.environments.dev.services).toEqual({})
    expect(policy.environments.uat.services).toEqual({})
  })
})

describe('generatePolicyJson', () => {
  it('should generate valid JSON string', () => {
    const policy = getDefaultPolicy()
    const json = generatePolicyJson(policy)
    
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('should generate formatted JSON with 2-space indent', () => {
    const policy = getDefaultPolicy()
    const json = generatePolicyJson(policy)
    
    expect(json).toContain('  "version"')
    expect(json).toContain('  "environments"')
  })

  it('should include all policy fields', () => {
    const policy = {
      version: 1 as const,
      environments: {
        dev: { services: { api: { recipients: ['age1abc'] } } }
      }
    }
    const json = generatePolicyJson(policy)
    const parsed = JSON.parse(json)
    
    expect(parsed.version).toBe(1)
    expect(parsed.environments.dev.services.api.recipients).toContain('age1abc')
  })

  it('should generate round-trippable JSON', () => {
    const policy = getDefaultPolicy()
    const json = generatePolicyJson(policy)
    const parsed = JSON.parse(json)
    
    expect(parsed).toEqual(policy)
  })
})
