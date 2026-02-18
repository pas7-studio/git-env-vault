import { readFile, access } from 'fs/promises'
import { join } from 'path'
import { EnvVaultPolicy, ConfigError } from '../types/index.js'

const POLICY_FILE = 'envvault.policy.json'
const SIGNATURE_FILE = 'envvault.policy.sig'

export async function loadPolicy(projectDir: string): Promise<EnvVaultPolicy> {
  const policyPath = join(projectDir, POLICY_FILE)
  try {
    const content = await readFile(policyPath, 'utf-8')
    const policy = JSON.parse(content) as EnvVaultPolicy

    if (policy.version !== 1) {
      throw new ConfigError(`Unsupported policy version: ${policy.version}`)
    }

    return policy
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError(
        `${POLICY_FILE} not found. Run 'envvault init' first.`
      )
    }
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in ${POLICY_FILE}`)
    }
    throw error
  }
}

export async function loadPolicySignature(
  projectDir: string
): Promise<string | null> {
  const sigPath = join(projectDir, SIGNATURE_FILE)
  try {
    return await readFile(sigPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function policySignatureExists(
  projectDir: string
): Promise<boolean> {
  const sigPath = join(projectDir, SIGNATURE_FILE)
  try {
    await access(sigPath)
    return true
  } catch {
    return false
  }
}

export function getDefaultPolicy(): EnvVaultPolicy {
  return {
    version: 1,
    environments: {
      dev: { services: {} },
      uat: { services: {} },
    },
  }
}

export function generatePolicyJson(policy: EnvVaultPolicy): string {
  return JSON.stringify(policy, null, 2)
}
