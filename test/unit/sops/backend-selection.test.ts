import { describe, expect, it } from 'vitest'
import {
  resolveCryptoBackend,
  buildCapabilityMatrix,
  type CryptoBackend,
  type CryptoCapability,
  type CryptoBackendStatus,
  CryptoBackendSelectionError,
} from '../../../src/core/sops/index.js'
import type { DecryptedData } from '../../../src/core/sops/sops-adapter.js'

class FakeBackend implements CryptoBackend {
  constructor(
    public readonly id: 'system-sops' | 'js',
    private readonly available: boolean,
    private readonly supportedCapabilities: CryptoCapability[]
  ) {}

  get displayName(): string {
    return `Fake ${this.id}`
  }

  async isAvailable(): Promise<boolean> {
    return this.available
  }

  supports(capability: CryptoCapability): boolean {
    return this.supportedCapabilities.includes(capability)
  }

  async decrypt(_filePath: string): Promise<DecryptedData> {
    return { data: { KEY: 'value' }, metadata: { lastmodified: '', mac: '' } }
  }

  async decryptToString(_filePath: string): Promise<string> {
    return 'KEY=value\n'
  }
}

describe('resolveCryptoBackend', () => {
  const system = (available: boolean) =>
    new FakeBackend('system-sops', available, [
      'decrypt',
      'pull',
      'edit',
      'set',
      'grant',
      'revoke',
      'updatekeys',
      'rotate',
    ])

  const js = (available: boolean) =>
    new FakeBackend('js', available, ['decrypt', 'pull'])

  it('prefers system SOPS in auto mode', async () => {
    const result = await resolveCryptoBackend({
      preference: 'auto',
      capability: 'pull',
      backends: [system(true), js(true)],
    })

    expect(result.backend.id).toBe('system-sops')
    expect(result.fallbackUsed).toBe(false)
  })

  it('falls back to JS backend in auto mode for pull', async () => {
    const result = await resolveCryptoBackend({
      preference: 'auto',
      capability: 'pull',
      backends: [system(false), js(true)],
    })

    expect(result.backend.id).toBe('js')
    expect(result.fallbackUsed).toBe(true)
  })

  it('fails with clear message when system backend is explicitly requested and unavailable', async () => {
    await expect(
      resolveCryptoBackend({
        preference: 'system-sops',
        capability: 'pull',
        backends: [system(false), js(true)],
      })
    ).rejects.toThrow(CryptoBackendSelectionError)

    await expect(
      resolveCryptoBackend({
        preference: 'system-sops',
        capability: 'pull',
        backends: [system(false), js(true)],
      })
    ).rejects.toThrow('Requested crypto backend "system-sops" is unavailable')
  })

  it('fails with clear message when no backend is available', async () => {
    await expect(
      resolveCryptoBackend({
        preference: 'auto',
        capability: 'pull',
        backends: [system(false), js(false)],
      })
    ).rejects.toThrow('No crypto backend is available for decryption')
  })
})

describe('buildCapabilityMatrix', () => {
  it('reports pull via JS backend when system SOPS is unavailable', () => {
    const statuses: CryptoBackendStatus[] = [
      { id: 'system-sops', available: false, displayName: 'System SOPS CLI' },
      { id: 'js', available: true, displayName: 'JS SOPS+age' },
    ]

    const matrix = buildCapabilityMatrix(statuses)
    const pull = matrix.find((row) => row.capability === 'pull')
    const rotate = matrix.find((row) => row.capability === 'rotate')

    expect(pull).toMatchObject({ status: 'ok', via: 'js' })
    expect(rotate).toMatchObject({ status: 'fail', via: 'none' })
  })
})
