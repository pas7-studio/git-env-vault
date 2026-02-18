import * as crypto from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { canonicalizeJson } from './canonical-json.js'
import { EnvVaultPolicy } from '../types/index.js'

const ALGORITHM = 'ed25519'
const SIGNATURE_FILE = 'envvault.policy.sig'
const PRIVATE_KEY_FILE = '.envvault/master-key'

/**
 * Generate a new ed25519 keypair for policy signing
 */
export async function generateMasterKeyPair(): Promise<{
  publicKey: string
  privateKey: string
}> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(ALGORITHM, {
    format: 'pem',
  })

  return {
    publicKey: publicKey.toString(),
    privateKey: privateKey.toString(),
  }
}

/**
 * Sign policy with master private key
 */
export function signPolicy(policy: EnvVaultPolicy, privateKeyPem: string): string {
  const canonical = canonicalizeJson(policy)
  const sign = crypto.createSign('SHA256')
  sign.update(canonical)
  sign.end()

  const signature = sign.sign(privateKeyPem, 'base64')
  return signature
}

/**
 * Verify policy signature
 */
export function verifyPolicySignature(
  policy: EnvVaultPolicy,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const canonical = canonicalizeJson(policy)
    const verify = crypto.createVerify('SHA256')
    verify.update(canonical)
    verify.end()

    return verify.verify(publicKeyPem, signature, 'base64')
  } catch {
    return false
  }
}

/**
 * Load master public key from project
 */
export async function loadMasterPublicKey(
  projectDir: string
): Promise<string | null> {
  const keyPath = join(projectDir, '.envvault', 'master-key.pub')
  try {
    return await readFile(keyPath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Load master private key (admin only, stored encrypted)
 */
export async function loadMasterPrivateKey(
  projectDir: string
): Promise<string | null> {
  const keyPath = join(projectDir, PRIVATE_KEY_FILE)
  try {
    const encrypted = await readFile(keyPath, 'utf-8')
    // TODO: Decrypt with password
    return encrypted
  } catch {
    return null
  }
}

/**
 * Save policy signature
 */
export async function savePolicySignature(
  projectDir: string,
  signature: string
): Promise<void> {
  const sigPath = join(projectDir, SIGNATURE_FILE)
  await writeFile(sigPath, signature, 'utf-8')
}

/**
 * Save master public key
 */
export async function saveMasterPublicKey(
  projectDir: string,
  publicKey: string
): Promise<void> {
  const keyDir = join(projectDir, '.envvault')
  await mkdir(keyDir, { recursive: true })
  const keyPath = join(keyDir, 'master-key.pub')
  await writeFile(keyPath, publicKey, 'utf-8')
}

/**
 * Save master private key (should be encrypted before saving)
 */
export async function saveMasterPrivateKey(
  projectDir: string,
  privateKey: string
): Promise<void> {
  const keyDir = join(projectDir, '.envvault')
  await mkdir(keyDir, { recursive: true })
  const keyPath = join(keyDir, 'master-key')
  await writeFile(keyPath, privateKey, { mode: 0o600 })
}
