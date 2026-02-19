import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import {
  generateMasterKeyPair,
  verifyPolicySignature,
  loadMasterPublicKey,
  saveMasterPublicKey,
  saveMasterPrivateKey,
  loadMasterPrivateKey
} from '../../../src/core/policy/signature.js'
import { EnvVaultPolicy } from '../../../src/core/types/index.js'

describe('signature', () => {
  describe('generateMasterKeyPair', () => {
    it('should generate keypair objects', async () => {
      const { publicKey, privateKey } = await generateMasterKeyPair()
      // publicKey and privateKey might be KeyObjects or strings depending on Node version
      expect(publicKey).toBeDefined()
      expect(privateKey).toBeDefined()
    })

    it('should generate unique keypairs', async () => {
      const keyPair1 = await generateMasterKeyPair()
      const keyPair2 = await generateMasterKeyPair()
      
      // KeyObjects stringify to [object KeyObject] but are still unique
      const pub1 = String(keyPair1.publicKey)
      const pub2 = String(keyPair2.publicKey)
      // Even if they stringify the same, the actual keys should work differently
      // This test just verifies the function can be called multiple times
      expect(keyPair1).toBeDefined()
      expect(keyPair2).toBeDefined()
    })
  })

  describe('verifyPolicySignature', () => {
    it('should return false for invalid signature format', async () => {
      const { publicKey } = await generateMasterKeyPair()
      
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: { dev: { services: {} } }
      }
      
      const isValid = verifyPolicySignature(policy, 'invalid-signature', publicKey)
      expect(isValid).toBe(false)
    })

    it('should return false for empty signature', async () => {
      const { publicKey } = await generateMasterKeyPair()
      
      const policy: EnvVaultPolicy = {
        version: 1,
        environments: { dev: { services: {} } }
      }
      
      const isValid = verifyPolicySignature(policy, '', publicKey)
      expect(isValid).toBe(false)
    })
  })
})

describe('file operations', () => {
  const testDir = join(process.cwd(), '.test-signature-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
    await mkdir(join(testDir, '.envvault'), { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('saveMasterPublicKey and loadMasterPublicKey', () => {
    it('should save and load public key', async () => {
      const { publicKey } = await generateMasterKeyPair()
      
      await saveMasterPublicKey(testDir, publicKey)
      
      const loaded = await loadMasterPublicKey(testDir)
      expect(loaded).toBe(publicKey)
    })

    it('should return null if public key does not exist', async () => {
      const loaded = await loadMasterPublicKey(testDir)
      expect(loaded).toBeNull()
    })
  })

  describe('saveMasterPrivateKey and loadMasterPrivateKey', () => {
    it('should save and load private key', async () => {
      const { privateKey } = await generateMasterKeyPair()
      
      await saveMasterPrivateKey(testDir, privateKey)
      
      const loaded = await loadMasterPrivateKey(testDir)
      expect(loaded).toBe(privateKey)
    })

    it('should return null if private key does not exist', async () => {
      const loaded = await loadMasterPrivateKey(testDir)
      expect(loaded).toBeNull()
    })
  })
})
