export class GitEnvVaultError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitEnvVaultError'
  }
}

export class AccessDeniedError extends GitEnvVaultError {
  constructor(env: string, service: string) {
    super(`Access denied to ${env}/${service}`)
    this.name = 'AccessDeniedError'
  }
}

export class SopsError extends GitEnvVaultError {
  constructor(
    message: string,
    public readonly exitCode?: number
  ) {
    super(`SOPS error: ${message}`)
    this.name = 'SopsError'
  }
}

export class ConfigError extends GitEnvVaultError {
  constructor(message: string) {
    super(`Config error: ${message}`)
    this.name = 'ConfigError'
  }
}

export class PolicySignatureError extends GitEnvVaultError {
  constructor(message: string) {
    super(`Policy signature error: ${message}`)
    this.name = 'PolicySignatureError'
  }
}

export class ParseError extends GitEnvVaultError {
  constructor(
    message: string,
    public readonly line?: number
  ) {
    super(`Parse error: ${message}`)
    this.name = 'ParseError'
  }
}

export class LockError extends GitEnvVaultError {
  constructor(message: string) {
    super(`Lock error: ${message}`)
    this.name = 'LockError'
  }
}
