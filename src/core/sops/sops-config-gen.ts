import { writeFile } from 'fs/promises'
import { join } from 'path'
import { stringify as stringifyYaml } from 'yaml'
import { EnvVaultPolicy } from '../types/index.js'

const SOPS_CONFIG_FILE = '.sops.yaml'

export interface SopsCreationRule {
  path_regex: string
  key_groups: Array<{
    age: string[]
  }>
}

export interface SopsConfig {
  creation_rules: SopsCreationRule[]
}

/**
 * Generate .sops.yaml from envvault.policy.json
 */
export function generateSopsConfig(policy: EnvVaultPolicy): SopsConfig {
  const rules: SopsCreationRule[] = []

  for (const [envName, envConfig] of Object.entries(policy.environments)) {
    for (const [serviceName, serviceConfig] of Object.entries(envConfig.services)) {
      const recipients = serviceConfig.recipients
      if (recipients.length === 0) continue

      const pathRegex = `^secrets/${envName}/${serviceName}\\.sops\\.yaml$`
      
      rules.push({
        path_regex: pathRegex,
        key_groups: [
          {
            age: [...recipients] // Copy array
          }
        ]
      })
    }
  }

  // Add default rule at the end (deny all)
  rules.push({
    path_regex: '.*',
    key_groups: [{ age: [] }]
  })

  return { creation_rules: rules }
}

/**
 * Render SopsConfig to YAML string
 */
export function renderSopsConfig(config: SopsConfig): string {
  return stringifyYaml(config, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN'
  })
}

/**
 * Generate and write .sops.yaml
 */
export async function writeSopsConfig(
  projectDir: string,
  policy: EnvVaultPolicy
): Promise<string> {
  const config = generateSopsConfig(policy)
  const yaml = renderSopsConfig(config)
  const filepath = join(projectDir, SOPS_CONFIG_FILE)
  await writeFile(filepath, yaml, 'utf-8')
  return filepath
}

/**
 * Get the expected .sops.yaml content for verification
 */
export function getExpectedSopsConfigYaml(policy: EnvVaultPolicy): string {
  const config = generateSopsConfig(policy)
  return renderSopsConfig(config)
}
