import type { EnvObject } from '../types/index.js'
import type { CryptoBackend, CryptoCapability } from './crypto-backend.js'
import {
  SopsAdapter,
  type DecryptedData,
  type SopsAdapterOptions,
} from './sops-adapter.js'

export class SystemSopsBackend implements CryptoBackend {
  readonly id = 'system-sops' as const
  readonly displayName = 'System SOPS CLI'

  constructor(private readonly adapter = new SopsAdapter()) {}

  static fromOptions(options: SopsAdapterOptions = {}): SystemSopsBackend {
    return new SystemSopsBackend(new SopsAdapter(options))
  }

  isAvailable(): Promise<boolean> {
    return this.adapter.isAvailable()
  }

  decrypt(filePath: string): Promise<DecryptedData> {
    return this.adapter.decrypt(filePath)
  }

  decryptToString(filePath: string): Promise<string> {
    return this.adapter.decryptToString(filePath)
  }

  encrypt(filePath: string): Promise<void> {
    return this.adapter.encrypt(filePath)
  }

  encryptData(filePath: string, data: EnvObject): Promise<void> {
    return this.adapter.encryptData(filePath, data)
  }

  updateKeys(filePath: string): Promise<void> {
    return this.adapter.updateKeys(filePath)
  }

  rotate(filePath: string): Promise<void> {
    return this.adapter.rotate(filePath)
  }

  supports(_capability: CryptoCapability): boolean {
    return true
  }
}
