import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { SopsAdapter } from '../../../src/core/sops/sops-adapter.js'
import { SopsError } from '../../../src/core/types/errors.js'

describe('SopsAdapter', () => {
  const testDir = join(process.cwd(), '.test-sops-adapter')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('constructor', () => {
    it('should use default sops path', () => {
      const adapter = new SopsAdapter()
      // Internal property, but we can verify behavior
      expect(adapter).toBeInstanceOf(SopsAdapter)
    })

    it('should accept custom sops path', () => {
      const adapter = new SopsAdapter({ sopsPath: '/custom/sops' })
      expect(adapter).toBeInstanceOf(SopsAdapter)
    })

    it('should accept age key file option', () => {
      const adapter = new SopsAdapter({ ageKeyFile: '/path/to/key' })
      expect(adapter).toBeInstanceOf(SopsAdapter)
    })

    it('should accept custom env', () => {
      const adapter = new SopsAdapter({ env: { CUSTOM_VAR: 'value' } })
      expect(adapter).toBeInstanceOf(SopsAdapter)
    })
  })

  describe('isAvailable', () => {
    it('should return boolean', async () => {
      const adapter = new SopsAdapter()
      const available = await adapter.isAvailable()
      expect(typeof available).toBe('boolean')
    })

    it('should return false for non-existent sops path', async () => {
      const adapter = new SopsAdapter({ sopsPath: '/nonexistent/sops' })
      const available = await adapter.isAvailable()
      expect(available).toBe(false)
    })
  })

  describe('getVersion', () => {
    it('should return null for non-existent sops', async () => {
      const adapter = new SopsAdapter({ sopsPath: '/nonexistent/sops' })
      const version = await adapter.getVersion()
      expect(version).toBeNull()
    })
  })

  describe('isEncrypted', () => {
    it('should return true for SOPS-encrypted file', async () => {
      const encryptedFile = join(testDir, 'encrypted.yaml')
      await writeFile(encryptedFile, `
key: value
sops:
  lastmodified: "2024-01-01T00:00:00Z"
  mac: "abc123"
`)
      
      const adapter = new SopsAdapter()
      const isEncrypted = await adapter.isEncrypted(encryptedFile)
      
      expect(isEncrypted).toBe(true)
    })

    it('should return false for non-encrypted file', async () => {
      const plainFile = join(testDir, 'plain.yaml')
      await writeFile(plainFile, 'key: value\n')
      
      const adapter = new SopsAdapter()
      const isEncrypted = await adapter.isEncrypted(plainFile)
      
      expect(isEncrypted).toBe(false)
    })

    it('should return false for file without sops field', async () => {
      const noSopsFile = join(testDir, 'no-sops.yaml')
      await writeFile(noSopsFile, 'key: value\nother: data\n')
      
      const adapter = new SopsAdapter()
      const isEncrypted = await adapter.isEncrypted(noSopsFile)
      
      expect(isEncrypted).toBe(false)
    })

    it('should return false for invalid YAML', async () => {
      const invalidFile = join(testDir, 'invalid.yaml')
      await writeFile(invalidFile, 'not: valid: yaml: :::\n')
      
      const adapter = new SopsAdapter()
      const isEncrypted = await adapter.isEncrypted(invalidFile)
      
      expect(isEncrypted).toBe(false)
    })

    it('should return false for non-existent file', async () => {
      const adapter = new SopsAdapter()
      const isEncrypted = await adapter.isEncrypted('/nonexistent/file.yaml')
      
      expect(isEncrypted).toBe(false)
    })
  })

  describe('decrypt', () => {
    it('should throw SopsError for non-existent file', async () => {
      const adapter = new SopsAdapter()
      
      await expect(adapter.decrypt('/nonexistent/file.yaml')).rejects.toThrow(SopsError)
    })

    it('should throw SopsError for invalid sops path', async () => {
      const adapter = new SopsAdapter({ sopsPath: '/nonexistent/sops' })
      const testFile = join(testDir, 'test.yaml')
      await writeFile(testFile, 'key: value\n')
      
      await expect(adapter.decrypt(testFile)).rejects.toThrow(SopsError)
    })
  })

  describe('decryptToString', () => {
    it('should throw SopsError for non-existent file', async () => {
      const adapter = new SopsAdapter()
      
      await expect(adapter.decryptToString('/nonexistent/file.yaml')).rejects.toThrow(SopsError)
    })
  })

  describe('encrypt', () => {
    it('should throw SopsError for non-existent file', async () => {
      const adapter = new SopsAdapter()
      
      await expect(adapter.encrypt('/nonexistent/file.yaml')).rejects.toThrow(SopsError)
    })

    it('should throw SopsError for invalid sops path', async () => {
      const adapter = new SopsAdapter({ sopsPath: '/nonexistent/sops' })
      const testFile = join(testDir, 'test.yaml')
      await writeFile(testFile, 'key: value\n')
      
      await expect(adapter.encrypt(testFile)).rejects.toThrow(SopsError)
    })
  })

  describe('encryptData', () => {
    it('should throw SopsError for invalid sops path', async () => {
      const adapter = new SopsAdapter({ sopsPath: '/nonexistent/sops' })
      const testFile = join(testDir, 'test.yaml')
      
      await expect(adapter.encryptData(testFile, { KEY: 'value' })).rejects.toThrow(SopsError)
    })
  })

  describe('updateKeys', () => {
    it('should throw SopsError for non-existent file', async () => {
      const adapter = new SopsAdapter()
      
      await expect(adapter.updateKeys('/nonexistent/file.yaml')).rejects.toThrow(SopsError)
    })
  })

  describe('rotate', () => {
    it('should throw SopsError for non-existent file', async () => {
      const adapter = new SopsAdapter()
      
      await expect(adapter.rotate('/nonexistent/file.yaml')).rejects.toThrow(SopsError)
    })
  })
})

describe('SopsAdapter with mock SOPS', () => {
  const testDir = join(process.cwd(), '.test-sops-mock')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  // These tests would work if sops is installed
  describe('integration tests (require sops)', () => {
    it('should check sops availability', async () => {
      const adapter = new SopsAdapter()
      const available = await adapter.isAvailable()
      
      // If sops is installed, this should be true
      if (available) {
        const version = await adapter.getVersion()
        expect(version).not.toBeNull()
        expect(typeof version).toBe('string')
      }
    })
  })
})
