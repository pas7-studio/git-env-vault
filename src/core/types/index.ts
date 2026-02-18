// Конфігурація проекту
export interface EnvVaultConfig {
  version: 1
  secretsDir: string
  services: Record<string, { envOutput: string }>
}

// RBAC Policy
export interface EnvVaultPolicy {
  version: 1
  environments: Record<
    string,
    {
      services: Record<string, { recipients: string[] }>
    }
  >
}

// Результат парсингу .env
export interface EnvObject {
  [key: string]: string
}

// Diff результат
export interface DiffResult {
  added: string[]
  removed: string[]
  changed: string[]
}

// Тимчасовий файл
export interface TempFile {
  path: string
  cleanup: () => Promise<void>
}

// Результат команди
export interface CommandResult {
  success: boolean
  message?: string
  error?: string
}

// Експорт помилок
export * from './errors.js'
