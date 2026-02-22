import type {
  CryptoBackend,
  CryptoBackendPreference,
  CryptoBackendResolution,
  CryptoBackendStatus,
  CryptoCapability,
} from './crypto-backend.js'
import { CryptoBackendSelectionError } from './crypto-backend.js'
import { JsSopsAgeBackend } from './js-sops-age-backend.js'
import { SystemSopsBackend } from './system-sops-backend.js'

export function createDefaultCryptoBackends(): CryptoBackend[] {
  return [new SystemSopsBackend(), new JsSopsAgeBackend()]
}

export async function getCryptoBackendStatuses(
  backends: CryptoBackend[] = createDefaultCryptoBackends()
): Promise<CryptoBackendStatus[]> {
  const statuses = await Promise.all(
    backends.map(async (backend) => ({
      id: backend.id,
      displayName: backend.displayName,
      available: await backend.isAvailable(),
    }))
  )

  return statuses
}

export async function resolveCryptoBackend(options?: {
  preference?: CryptoBackendPreference
  capability?: CryptoCapability
  backends?: CryptoBackend[]
}): Promise<CryptoBackendResolution> {
  const preference = options?.preference ?? 'auto'
  const capability = options?.capability ?? 'decrypt'
  const backends = options?.backends ?? createDefaultCryptoBackends()

  const compatibleBackends = backends.filter((backend) => backend.supports(capability))

  const systemBackend = compatibleBackends.find((backend) => backend.id === 'system-sops')
  const jsBackend = compatibleBackends.find((backend) => backend.id === 'js')

  if (preference === 'system-sops') {
    if (!systemBackend || !(await systemBackend.isAvailable())) {
      throw new CryptoBackendSelectionError(
        'Requested crypto backend "system-sops" is unavailable. Install SOPS binary (and age) or switch to "auto"/"js".'
      )
    }
    return { backend: systemBackend, fallbackUsed: false, requested: preference }
  }

  if (preference === 'js') {
    if (!jsBackend || !(await jsBackend.isAvailable())) {
      throw new CryptoBackendSelectionError(
        'Requested crypto backend "js" is unavailable. Install npm package dependency "sops-age" or switch to "auto"/"system-sops".'
      )
    }
    return { backend: jsBackend, fallbackUsed: false, requested: preference }
  }

  if (systemBackend && (await systemBackend.isAvailable())) {
    return { backend: systemBackend, fallbackUsed: false, requested: preference }
  }

  if (jsBackend && (await jsBackend.isAvailable())) {
    return { backend: jsBackend, fallbackUsed: true, requested: preference }
  }

  throw new CryptoBackendSelectionError(
    'No crypto backend is available for decryption. Install system SOPS + age for full mode, or ensure JS backend dependency "sops-age" is installed for basic pull/decrypt.'
  )
}

export interface CapabilityRow {
  capability: CryptoCapability
  label: string
  status: 'ok' | 'fail'
  via: 'system-sops' | 'js' | 'both' | 'none'
  message: string
}

export function buildCapabilityMatrix(statuses: CryptoBackendStatus[]): CapabilityRow[] {
  const system = statuses.find((s) => s.id === 'system-sops')?.available ?? false
  const js = statuses.find((s) => s.id === 'js')?.available ?? false

  const pullOk = system || js
  const pullVia = system ? 'system-sops' : js ? 'js' : 'none'
  const systemOnly = (capability: CryptoCapability, label: string): CapabilityRow => ({
    capability,
    label,
    status: system ? 'ok' : 'fail',
    via: system ? 'system-sops' : 'none',
    message: system
      ? 'Requires system SOPS (available)'
      : 'Requires system SOPS binary',
  })

  return [
    {
      capability: 'pull',
      label: 'pull/decrypt',
      status: pullOk ? 'ok' : 'fail',
      via: system && js ? 'both' : pullVia,
      message: system
        ? 'OK via system SOPS'
        : js
          ? 'OK via JS backend'
          : 'No decrypt backend available',
    },
    { ...systemOnly('edit', 'edit') },
    { ...systemOnly('set', 'set') },
    { ...systemOnly('grant', 'grant') },
    { ...systemOnly('revoke', 'revoke') },
    { ...systemOnly('updatekeys', 'updatekeys') },
    { ...systemOnly('rotate', 'rotate') },
  ]
}
