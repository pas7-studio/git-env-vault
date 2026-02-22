import type { EnvObject } from '../types/index.js'
import type { DecryptedData } from './sops-adapter.js'

export type CryptoBackendId = 'system-sops' | 'js'
export type CryptoBackendPreference = 'auto' | CryptoBackendId
export type CryptoCapability =
  | 'decrypt'
  | 'pull'
  | 'edit'
  | 'set'
  | 'grant'
  | 'revoke'
  | 'updatekeys'
  | 'rotate'

export interface CryptoBackend {
  readonly id: CryptoBackendId
  readonly displayName: string
  isAvailable(): Promise<boolean>
  decrypt(filePath: string): Promise<DecryptedData>
  decryptToString(filePath: string): Promise<string>
  encrypt?(filePath: string): Promise<void>
  encryptData?(filePath: string, data: EnvObject): Promise<void>
  updateKeys?(filePath: string): Promise<void>
  rotate?(filePath: string): Promise<void>
  supports(capability: CryptoCapability): boolean
}

export interface CryptoBackendResolution {
  backend: CryptoBackend
  fallbackUsed: boolean
  requested: CryptoBackendPreference
}

export class CryptoBackendSelectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoBackendSelectionError'
  }
}

export interface CryptoBackendStatus {
  id: CryptoBackendId
  available: boolean
  displayName: string
}
