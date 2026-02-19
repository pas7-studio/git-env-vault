import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, access } from 'fs/promises'
import { join } from 'path'
import { generateSopsConfig, renderSopsConfig, writeSopsConfig, getExpectedSopsConfigYaml } from '../../../src/core/sops/sops-config-gen.js'
import { EnvVaultPolicy } from '../../../src/core/types/index.js'

describe('generateSopsConfig', () => {
  describe('basic generation', () => {
    it('should generate config from policy with single service', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc'] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      
      expect(config.creation_rules).toHaveLength(2) // 1 service + default deny
    })

    it('should generate config from policy with multiple services', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc', 'age1def'] },
              worker: { recipients: ['age1abc'] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      
      expect(config.creation_rules).toHaveLength(3) // 2 services + default deny
    })

    it('should generate config from policy with multiple environments', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1dev'] }
            }
          },
          prod: {
            services: {
              api: { recipients: ['age1prod'] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      
      expect(config.creation_rules).toHaveLength(3) // 2 services + default deny
    })
  })

  describe('creation rules', () => {
    it('should create correct path regex for service', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              'my-service': { recipients: ['age1abc'] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      const rule = config.creation_rules.find(r => r.path_regex.includes('my-service'))
      
      expect(rule?.path_regex).toBe('^secrets/dev/my-service\\.sops\\.yaml$')
    })

    it('should include all recipients in key group', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc', 'age1def', 'age1ghi'] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      const apiRule = config.creation_rules.find(r => r.path_regex.includes('api'))
      
      expect(apiRule?.key_groups[0]?.age).toContain('age1abc')
      expect(apiRule?.key_groups[0]?.age).toContain('age1def')
      expect(apiRule?.key_groups[0]?.age).toContain('age1ghi')
    })

    it('should skip services with no recipients', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: {
            services: {
              api: { recipients: ['age1abc'] },
              empty: { recipients: [] }
            }
          }
        }
      }
      
      const config = generateSopsConfig(policy)
      
      expect(config.creation_rules).toHaveLength(2) // 1 service + default deny
      expect(config.creation_rules.find(r => r.path_regex.includes('empty'))).toBeUndefined()
    })
  })

  describe('default deny rule', () => {
    it('should include default deny rule', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: { dev: { services: {} } }
      }
      
      const config = generateSopsConfig(policy)
      const lastRule = config.creation_rules[config.creation_rules.length - 1]
      
      expect(lastRule?.path_regex).toBe('.*')
      expect(lastRule?.key_groups[0]?.age).toHaveLength(0)
    })

    it('should always add default deny rule as last rule', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {
          dev: { services: { api: { recipients: ['age1test'] } } },
          prod: { services: { api: { recipients: ['age1test'] } } }
        }
      }
      
      const config = generateSopsConfig(policy)
      const lastRule = config.creation_rules[config.creation_rules.length - 1]
      
      expect(lastRule?.path_regex).toBe('.*')
    })

    it('should include default deny rule even with no services', () => {
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: {}
      }
      
      const config = generateSopsConfig(policy)
      
      expect(config.creation_rules).toHaveLength(1)
      expect(config.creation_rules[0]?.path_regex).toBe('.*')
    })
  })
})

  describe('renderSopsConfig', () => {
    it('should render valid YAML', () => {
      const config = generateSopsConfig({
        version: 1,
        environments: {
          dev: { services: { api: { recipients: ['age1test'] } } }
        }
      })
      
      const yaml = renderSopsConfig(config)
      expect(yaml).toContain('creation_rules')
      expect(yaml).toContain('path_regex')
      expect(yaml).toContain('age')
    })

    it('should include path regex patterns', () => {
      const config = generateSopsConfig({
        version: 1,
        environments: {
          dev: { services: { api: { recipients: ['age1test'] } } }
        }
      })
      
      const yaml = renderSopsConfig(config)
      // Path regex includes backslashes for YAML escaping
      expect(yaml).toContain('secrets')
      expect(yaml).toContain('dev')
      expect(yaml).toContain('api')
    })

  it('should include age recipients', () => {
    const config = generateSopsConfig({
      version: 1,
      environments: {
        dev: { services: { api: { recipients: ['age1abc', 'age1def'] } } }
      }
    })
    
    const yaml = renderSopsConfig(config)
    expect(yaml).toContain('age1abc')
    expect(yaml).toContain('age1def')
  })

  it('should render empty key_groups for default deny', () => {
    const config = generateSopsConfig({
      version: 1,
      environments: {}
    })
    
    const yaml = renderSopsConfig(config)
    expect(yaml).toContain('age: []')
  })
})

describe('writeSopsConfig', () => {
  const testDir = join(process.cwd(), '.test-sops-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should write .sops.yaml file', async () => {
    const policy: EnvVaultPolicy = {
      version: 1,
      environments: {
        dev: { services: { api: { recipients: ['age1test'] } } }
      }
    }
    
    const filepath = await writeSopsConfig(testDir, policy)
    
    expect(filepath).toBe(join(testDir, '.sops.yaml'))
    
    const content = await readFile(filepath, 'utf-8')
    expect(content).toContain('creation_rules')
  })

  it('should overwrite existing .sops.yaml file', async () => {
    const policy1: EnvVaultPolicy = {
      version: 1,
      environments: {
        dev: { services: { api: { recipients: ['age1first'] } } }
      }
    }
    
    const policy2: EnvVaultPolicy = {
      version: 1,
      environments: {
        dev: { services: { api: { recipients: ['age1second'] } } }
      }
    }
    
    await writeSopsConfig(testDir, policy1)
    await writeSopsConfig(testDir, policy2)
    
    const content = await readFile(join(testDir, '.sops.yaml'), 'utf-8')
    expect(content).toContain('age1second')
    expect(content).not.toContain('age1first')
  })
})

describe('getExpectedSopsConfigYaml', () => {
  it('should return same result as renderSopsConfig(generateSopsConfig(policy))', () => {
    const policy: EnvVaultPolicy = {
      version: 1,
      environments: {
        dev: {
          services: {
            api: { recipients: ['age1test'] }
          }
        }
      }
    }
    
    const yaml1 = getExpectedSopsConfigYaml(policy)
    const yaml2 = renderSopsConfig(generateSopsConfig(policy))
    
    expect(yaml1).toBe(yaml2)
  })
})
