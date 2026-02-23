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

    if (
      config.cryptoBackend !== undefined &&
      !['auto', 'system-sops', 'js'].includes(config.cryptoBackend)
    ) {
      throw new ConfigError(
        'cryptoBackend must be one of: auto, system-sops, js'
      )
    }

    if (config.localProtection !== undefined) {
      if (typeof config.localProtection !== 'object' || config.localProtection === null) {
        throw new ConfigError('localProtection must be an object')
      }
      if (
        config.localProtection.global !== undefined &&
        !Array.isArray(config.localProtection.global)
      ) {
        throw new ConfigError('localProtection.global must be an array of strings')
      }
      if (
        config.localProtection.services !== undefined &&
        (typeof config.localProtection.services !== 'object' ||
          config.localProtection.services === null)
      ) {
        throw new ConfigError('localProtection.services must be an object')
      }
    }

    if (config.placeholderPolicy !== undefined) {
      if (typeof config.placeholderPolicy !== 'object' || config.placeholderPolicy === null) {
        throw new ConfigError('placeholderPolicy must be an object')
      }
      if (
        config.placeholderPolicy.preserveExistingOnPlaceholder !== undefined &&
        typeof config.placeholderPolicy.preserveExistingOnPlaceholder !== 'boolean'
      ) {
        throw new ConfigError('placeholderPolicy.preserveExistingOnPlaceholder must be a boolean')
      }
      if (
        config.placeholderPolicy.patterns !== undefined &&
        !Array.isArray(config.placeholderPolicy.patterns)
      ) {
        throw new ConfigError('placeholderPolicy.patterns must be an array of strings')
      }
      if (
        Array.isArray(config.placeholderPolicy.patterns) &&
        config.placeholderPolicy.patterns.some((p) => typeof p !== 'string')
      ) {
        throw new ConfigError('placeholderPolicy.patterns must be an array of strings')
      }
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
    cryptoBackend: 'auto',
    localProtection: {
      global: [],
      services: {},
    },
    placeholderPolicy: {
      preserveExistingOnPlaceholder: true,
      patterns: ['__MISSING__', 'CHANGEME*', '*PLACEHOLDER*', 'TODO_*', '<set-me>*'],
    },
    services: {},
  }
}

export function generateConfigJson(config: EnvVaultConfig): string {
  return JSON.stringify(config, null, 2)
}
