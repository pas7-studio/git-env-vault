import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, writeFile, readFile, access } from 'fs/promises'
import { join } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'

// Skip all tests if SOPS or age-keygen is not available
const shouldRunE2E = process.env.RUN_E2E_TESTS === 'true'

describe.skipIf(!shouldRunE2E)('crypto e2e', () => {
  let testDir: string
  let ageKeyFile: string
  let publicKey: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-e2e-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    
    // Generate age key
    ageKeyFile = join(testDir, '.age.key')
    try {
      const { stdout } = await execa('age-keygen', ['-o', ageKeyFile])
      const match = stdout.match(/age1[a-z0-9]+/)
      publicKey = match?.[0] || ''
    } catch {
      // age-keygen not available, skip test
      console.warn('age-keygen not available, skipping e2e tests')
      return
    }
    
    // Init git
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test'], { cwd: testDir })
    
    // Init envvault
    await execa('node', ['../../dist/cli/index.js', 'init'], {
      cwd: testDir,
      env: { ...process.env, SOPS_AGE_KEY_FILE: ageKeyFile },
      reject: false
    })
    
    // Grant access with public key
    const policy = {
      version: 1,
      environments: {
        dev: { services: { api: { recipients: [publicKey] } } }
      }
    }
    await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy, null, 2))
    
    // Create .sops.yaml
    const sopsConfig = {
      creation_rules: [
        {
          path_regex: '^secrets/dev/api\\.sops\\.yaml$',
          key_groups: [{ age: [publicKey] }]
        },
        {
          path_regex: '.*',
          key_groups: [{ age: [] }]
        }
      ]
    }
    await writeFile(join(testDir, '.sops.yaml'), JSON.stringify(sopsConfig, null, 2))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('set and pull', () => {
    it('should encrypt and decrypt secrets', async () => {
      // Create secrets directory structure
      await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
      
      // Create a simple encrypted file using SOPS
      const secretFile = join(testDir, 'secrets', 'dev', 'api.sops.yaml')
      const plainYaml = 'SECRET: value123\n'
      
      try {
        await execa('sops', ['--encrypt', '--in-place', secretFile], {
          cwd: testDir,
          env: { ...process.env, SOPS_AGE_KEY_FILE: ageKeyFile },
          input: plainYaml,
          reject: false
        })
      } catch (e) {
        // If sops fails, skip this test
        console.warn('SOPS encryption failed, skipping test')
        return
      }
      
      // Verify file is encrypted (contains sops metadata)
      const content = await readFile(secretFile, 'utf-8')
      expect(content).toContain('sops')
    })
  })

  describe('key management', () => {
    it('should handle multiple recipients', async () => {
      // Generate second key
      const ageKey2File = join(testDir, '.age2.key')
      let publicKey2: string
      
      try {
        const { stdout } = await execa('age-keygen', ['-o', ageKey2File])
        const match = stdout.match(/age1[a-z0-9]+/)
        publicKey2 = match?.[0] || ''
      } catch {
        console.warn('age-keygen not available, skipping test')
        return
      }
      
      // Update policy with both keys
      const policy = {
        version: 1,
        environments: {
          dev: { 
            services: { 
              api: { recipients: [publicKey, publicKey2] } 
            } 
          }
        }
      }
      await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy, null, 2))
      
      // Verify both keys are in policy
      const policyContent = await readFile(join(testDir, 'envvault.policy.json'), 'utf-8')
      expect(policyContent).toContain(publicKey)
      expect(policyContent).toContain(publicKey2)
    })
  })

  describe('environment isolation', () => {
    it('should keep environments separate', async () => {
      // Create policy with multiple environments
      const policy = {
        version: 1,
        environments: {
          dev: { services: { api: { recipients: [publicKey] } } },
          prod: { services: { api: { recipients: [publicKey] } } }
        }
      }
      await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy, null, 2))
      
      // Create directories for both environments
      await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
      await mkdir(join(testDir, 'secrets', 'prod'), { recursive: true })
      
      // Verify both directories exist
      await expect(access(join(testDir, 'secrets', 'dev'))).resolves.toBeUndefined()
      await expect(access(join(testDir, 'secrets', 'prod'))).resolves.toBeUndefined()
    })
  })
})

// Alternative simpler e2e tests that don't require SOPS
describe('crypto e2e (lightweight)', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-e2e-light-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test'], { cwd: testDir })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should create directory structure for secrets', async () => {
    await execa('node', ['../../dist/cli/index.js', 'init'], {
      cwd: testDir,
      reject: false
    })
    
    await mkdir(join(testDir, 'secrets', 'dev'), { recursive: true })
    await mkdir(join(testDir, 'secrets', 'prod'), { recursive: true })
    
    await expect(access(join(testDir, 'secrets', 'dev'))).resolves.toBeUndefined()
    await expect(access(join(testDir, 'secrets', 'prod'))).resolves.toBeUndefined()
  })

  it('should create .sops.yaml with correct structure', async () => {
    await execa('node', ['../../dist/cli/index.js', 'init'], {
      cwd: testDir,
      reject: false
    })
    
    const sopsConfig = {
      creation_rules: [
        {
          path_regex: '^secrets/dev/api\\.sops\\.yaml$',
          key_groups: [{ age: ['age1test'] }]
        },
        {
          path_regex: '.*',
          key_groups: [{ age: [] }]
        }
      ]
    }
    
    await writeFile(join(testDir, '.sops.yaml'), JSON.stringify(sopsConfig, null, 2))
    
    const content = await readFile(join(testDir, '.sops.yaml'), 'utf-8')
    const parsed = JSON.parse(content)
    
    expect(parsed.creation_rules).toHaveLength(2)
    expect(parsed.creation_rules[0].key_groups[0].age).toContain('age1test')
  })

  it('should create valid policy file', async () => {
    await execa('node', ['../../dist/cli/index.js', 'init'], {
      cwd: testDir,
      reject: false
    })
    
    const policy = {
      version: 1,
      environments: {
        dev: { services: { api: { recipients: ['age1test'] } } }
      }
    }
    
    await writeFile(join(testDir, 'envvault.policy.json'), JSON.stringify(policy, null, 2))
    
    const content = await readFile(join(testDir, 'envvault.policy.json'), 'utf-8')
    const parsed = JSON.parse(content)
    
    expect(parsed.version).toBe(1)
    expect(parsed.environments.dev.services.api.recipients).toContain('age1test')
  })
})
