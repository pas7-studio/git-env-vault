import { readFile } from 'fs/promises'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { SopsError, type EnvObject } from '../types/index.js'
import type { CryptoBackend, CryptoCapability } from './crypto-backend.js'
import type { DecryptedData, SopsMetadata } from './sops-adapter.js'

type DecryptSopsFn = (options: { path: string }) => Promise<unknown>

export class JsSopsAgeBackend implements CryptoBackend {
  readonly id = 'js' as const
  readonly displayName = 'JS SOPS+age (sops-age)'

  private cachedDecryptFn: DecryptSopsFn | null = null
  private importAttempted = false

  supports(capability: CryptoCapability): boolean {
    return capability === 'decrypt' || capability === 'pull'
  }

  async isAvailable(): Promise<boolean> {
    const decryptFn = await this.loadDecryptFn()
    return decryptFn !== null
  }

  async decrypt(filePath: string): Promise<DecryptedData> {
    const decryptFn = await this.loadDecryptFn()
    if (!decryptFn) {
      throw new SopsError(
        'JS crypto backend is not available. Install optional dependency "sops-age".'
      )
    }

    try {
      const decryptedRaw = await decryptFn({ path: filePath })
      const data = this.toEnvObject(decryptedRaw)
      const metadata = await this.readMetadata(filePath)
      return { data, metadata }
    } catch (error) {
      throw new SopsError(`JS backend decryption error: ${(error as Error).message}`)
    }
  }

  async decryptToString(filePath: string): Promise<string> {
    const { data } = await this.decrypt(filePath)
    return stringifyYaml(data)
  }

  private async loadDecryptFn(): Promise<DecryptSopsFn | null> {
    if (this.importAttempted) {
      return this.cachedDecryptFn
    }
    this.importAttempted = true

    try {
      const mod = (await import('sops-age')) as { decryptSops?: DecryptSopsFn }
      this.cachedDecryptFn = typeof mod.decryptSops === 'function' ? mod.decryptSops : null
      return this.cachedDecryptFn
    } catch {
      this.cachedDecryptFn = null
      return null
    }
  }

  private async readMetadata(filePath: string): Promise<SopsMetadata> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const parsed = parseYaml(content) as Record<string, unknown>
      const sopsMeta = ((parsed?.sops as Record<string, unknown>) ?? {}) as Record<
        string,
        unknown
      >
      const metadata: SopsMetadata = {
        lastmodified: String(sopsMeta.lastmodified ?? ''),
        mac: String(sopsMeta.mac ?? ''),
      }
      if (sopsMeta.encrypted_regex !== undefined) {
        metadata.encrypted_regex = String(sopsMeta.encrypted_regex)
      }
      if (Array.isArray(sopsMeta.recipient_hashes)) {
        metadata.recipient_hashes = sopsMeta.recipient_hashes.map(String)
      }
      return metadata
    } catch {
      return { lastmodified: '', mac: '' }
    }
  }

  private toEnvObject(value: unknown): EnvObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Unsupported decrypted payload shape (expected object)')
    }

    const out: EnvObject = {}
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (entryValue !== null && entryValue !== undefined) {
        out[key] = String(entryValue)
      }
    }
    return out
  }
}
