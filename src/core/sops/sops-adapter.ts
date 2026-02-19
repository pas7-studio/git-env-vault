import { execa } from 'execa'
import { readFile, writeFile } from 'fs/promises'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { SopsError, EnvObject } from '../types/index.js'

export interface SopsAdapterOptions {
  sopsPath?: string
  ageKeyFile?: string
  env?: NodeJS.ProcessEnv
}

export interface DecryptedData {
  data: EnvObject
  metadata: SopsMetadata
}

export interface SopsMetadata {
  lastmodified: string
  mac: string
  recipient_hashes?: string[]
  encrypted_regex?: string
}

export class SopsAdapter {
  private sopsPath: string
  private ageKeyFile: string | undefined
  private env: NodeJS.ProcessEnv

  constructor(options: SopsAdapterOptions = {}) {
    this.sopsPath = options.sopsPath ?? 'sops'
    this.ageKeyFile = options.ageKeyFile ?? process.env.SOPS_AGE_KEY_FILE
    this.env = { ...process.env, ...options.env }
    
    // Set SOPS_AGE_KEY_FILE if provided
    const keyFile = this.ageKeyFile
    if (keyFile !== undefined) {
      this.env.SOPS_AGE_KEY_FILE = keyFile
    }
  }

  /**
   * Check if sops binary is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await execa(this.sopsPath, ['--version'], {
        env: this.env,
        reject: false
      })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  /**
   * Get sops version
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await execa(this.sopsPath, ['--version'], {
        env: this.env,
        reject: false
      })
      if (result.exitCode === 0) {
        const match = result.stdout.match(/sops (\d+\.\d+\.\d+)/)
        return match ? match[1]! : null
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Decrypt a SOPS-encrypted YAML file
   */
  async decrypt(filepath: string): Promise<DecryptedData> {
    try {
      const result = await execa(this.sopsPath, ['-d', filepath], {
        env: this.env,
        reject: false
      })

      if (result.exitCode !== 0) {
        throw new SopsError(
          `Failed to decrypt ${filepath}: ${result.stderr}`,
          result.exitCode
        )
      }

      const parsed = parseYaml(result.stdout) as Record<string, unknown>
      
      // Extract SOPS metadata
      const sopsMeta = (parsed.sops as Record<string, unknown>) || {}
      delete parsed.sops

      const metadata: SopsMetadata = {
        lastmodified: String(sopsMeta.lastmodified ?? ''),
        mac: String(sopsMeta.mac ?? '')
      }
      
      if (sopsMeta.recipient_hashes !== undefined && sopsMeta.recipient_hashes !== null) {
        metadata.recipient_hashes = sopsMeta.recipient_hashes as string[]
      }

      return {
        data: this.recordToEnvObject(parsed),
        metadata
      }
    } catch (error) {
      if (error instanceof SopsError) throw error
      throw new SopsError(`Decryption error: ${(error as Error).message}`)
    }
  }

  /**
   * Decrypt and return as string (for external use)
   */
  async decryptToString(filepath: string): Promise<string> {
    try {
      const result = await execa(this.sopsPath, ['-d', filepath], {
        env: this.env,
        reject: false
      })

      if (result.exitCode !== 0) {
        throw new SopsError(
          `Failed to decrypt ${filepath}: ${result.stderr}`,
          result.exitCode
        )
      }

      return result.stdout
    } catch (error) {
      if (error instanceof SopsError) throw error
      throw new SopsError(`Decryption error: ${(error as Error).message}`)
    }
  }

  /**
   * Encrypt a YAML file in place
   */
  async encrypt(filepath: string): Promise<void> {
    try {
      const result = await execa(this.sopsPath, ['-e', '-i', filepath], {
        env: this.env,
        reject: false
      })

      if (result.exitCode !== 0) {
        throw new SopsError(
          `Failed to encrypt ${filepath}: ${result.stderr}`,
          result.exitCode
        )
      }
    } catch (error) {
      if (error instanceof SopsError) throw error
      throw new SopsError(`Encryption error: ${(error as Error).message}`)
    }
  }

  /**
   * Encrypt data and write to file
   */
  async encryptData(filepath: string, data: EnvObject): Promise<void> {
    // Write plaintext YAML first (without sops field)
    const yaml = stringifyYaml({ ...data })
    await writeFile(filepath, yaml, 'utf-8')
    
    // Then encrypt
    await this.encrypt(filepath)
  }

  /**
   * Update keys (re-encrypt with current .sops.yaml recipients)
   */
  async updateKeys(filepath: string): Promise<void> {
    try {
      const result = await execa(this.sopsPath, ['updatekeys', '-i', filepath], {
        env: this.env,
        reject: false
      })

      if (result.exitCode !== 0) {
        throw new SopsError(
          `Failed to update keys for ${filepath}: ${result.stderr}`,
          result.exitCode
        )
      }
    } catch (error) {
      if (error instanceof SopsError) throw error
      throw new SopsError(`Update keys error: ${(error as Error).message}`)
    }
  }

  /**
   * Rotate data key (re-encrypt with new data key)
   */
  async rotate(filepath: string): Promise<void> {
    try {
      const result = await execa(this.sopsPath, ['rotate', '-i', filepath], {
        env: this.env,
        reject: false
      })

      if (result.exitCode !== 0) {
        throw new SopsError(
          `Failed to rotate ${filepath}: ${result.stderr}`,
          result.exitCode
        )
      }
    } catch (error) {
      if (error instanceof SopsError) throw error
      throw new SopsError(`Rotate error: ${(error as Error).message}`)
    }
  }

  /**
   * Check if a file is SOPS-encrypted
   */
  async isEncrypted(filepath: string): Promise<boolean> {
    try {
      const content = await readFile(filepath, 'utf-8')
      const parsed = parseYaml(content) as Record<string, unknown>
      return 'sops' in parsed && parsed.sops !== null
    } catch {
      return false
    }
  }

  /**
   * Convert Record to EnvObject (string values only)
   */
  private recordToEnvObject(record: Record<string, unknown>): EnvObject {
    const result: EnvObject = {}
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && value !== undefined) {
        result[key] = String(value)
      }
    }
    return result
  }
}
