import { readFile } from 'fs/promises'
import { join } from 'path'
import { EnvVaultConfig, ConfigError } from '../types/index.js'

const CONFIG_FILE = 'envvault.config.json'

export async function loadConfig(projectDir: string): Promise<EnvVaultConfig> {
  const configPath = join(projectDir, CONFIG_FILE)
  try {
    const content = await readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as EnvVaultConfig

    if (config.version !== 1) {
      throw new ConfigError(`Unsupported config version: ${config.version}`)
    }

    if (!config.secretsDir || typeof config.secretsDir !== 'string') {
      throw new ConfigError('secretsDir is required')
    }

    if (!config.services || typeof config.services !== 'object') {
      throw new ConfigError('services is required')
    }

    return config
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError(
        `${CONFIG_FILE} not found. Run 'envvault init' first.`
      )
    }
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in ${CONFIG_FILE}`)
    }
    throw error
  }
}

export function getDefaultConfig(): EnvVaultConfig {
  return {
    version: 1,
    secretsDir: 'secrets',
    services: {},
  }
}

export function generateConfigJson(config: EnvVaultConfig): string {
  return JSON.stringify(config, null, 2)
}
