# Git Env Vault - TypeScript Інтерфейси

## Огляд

Цей документ визначає всі критичні TypeScript інтерфейси та типи для git-env-vault. Всі інтерфейси розроблені з урахуванням:
- Строгої типізації (strict mode)
- Immutable даних де можливо
- Зрозумілості та документації
- Serializable структур (YAML/JSON)

---

## Config Types

### [`EnvVaultConfig`](src/core/config/types.ts)

Головна конфігурація проекту.

```typescript
/**
 * Головна конфігурація git-env-vault
 * Зберігається в .git-env-vault.yaml
 */
export interface EnvVaultConfig {
  /** Версія схеми конфігурації */
  readonly version: 1;
  
  /** Назва проекту */
  readonly project: string;
  
  /** Мапінг сервісів до шляхів */
  readonly services: Record<string, ServiceConfig>;
  
  /** Налаштування середовищ */
  readonly environments: Record<EnvironmentName, EnvironmentConfig>;
  
  /** Налаштування SOPS */
  readonly sops: SopsConfig;
  
  /** Налаштування Git */
  readonly git?: GitConfig;
  
  /** Додаткові налаштування */
  readonly hooks?: HooksConfig;
}

/**
 * Конфігурація окремого сервісу
 */
export interface ServiceConfig {
  /** Шлях до директорії сервісу (відносно кореня проекту) */
  readonly path: string;
  
  /** Назва .env файлу (default: .env) */
  readonly envFile?: string;
  
  /** Опис сервісу */
  readonly description?: string;
  
  /** Залежності від інших сервісів */
  readonly dependsOn?: readonly string[];
  
  /** Чи сервіс активний */
  readonly enabled?: boolean;
}

/**
 * Конфігурація середовища
 */
export interface EnvironmentConfig {
  /** Чи середовище обов'язкове для наявності секретів */
  readonly required: boolean;
  
  /** Список сервісів для цього середовища */
  readonly services: readonly string[];
  
  /** Налаштування специфічні для середовища */
  readonly overrides?: Record<string, unknown>;
}

export type EnvironmentName = 'dev' | 'uat' | 'prod' | string;

/**
 * Налаштування SOPS
 */
export interface SopsConfig {
  /** Тип шифрування */
  readonly type: 'age';
  
  /** Шлях до директорії з публічними ключами */
  readonly keyDir?: string;
  
  /** Шлях до SOPS binary (default: sops) */
  readonly binary?: string;
  
  /** Додаткові аргументи для SOPS */
  readonly extraArgs?: readonly string[];
}

/**
 * Налаштування Git інтеграції
 */
export interface GitConfig {
  /** Автоматичний коміт після змін */
  readonly autoCommit?: boolean;
  
  /** Шаблон повідомлення коміту */
  readonly commitMessageTemplate?: string;
  
  /** Встановити pre-commit hook */
  readonly installHooks?: boolean;
}

/**
 * Hook конфігурації
 */
export interface HooksConfig {
  /** Виконати перед розшифруванням */
  readonly preDecrypt?: readonly string[];
  
  /** Виконати після розшифрування */
  readonly postDecrypt?: readonly string[];
  
  /** Виконати перед шифруванням */
  readonly preEncrypt?: readonly string[];
  
  /** Виконати після шифрування */
  readonly postEncrypt?: readonly string[];
}
```

---

## Policy Types

### [`EnvVaultPolicy`](src/core/policy/types.ts)

Політика доступу користувачів.

```typescript
/**
 * Політика доступу до секретів
 * Зберігається в .git-env-vault.policy.yaml
 */
export interface EnvVaultPolicy {
  /** Версія схеми */
  readonly version: 1;
  
  /** Час генерації/оновлення */
  readonly generated: ISODateString;
  
  /** Master admin конфігурація */
  readonly masterKey: MasterKeyConfig;
  
  /** Список адміністраторів */
  readonly admins: readonly AdminUser[];
  
  /** Список звичайних користувачів */
  readonly users: readonly PolicyUser[];
  
  /** ed25519 підпис policy контенту */
  readonly signature: Signature;
}

/**
 * Master admin ключ
 */
export interface MasterKeyConfig {
  /** age публічний ключ для шифрування */
  readonly agePublicKey: AgePublicKey;
  
  /** ed25519 публічний ключ для верифікації підписів */
  readonly verifyPublicKey: Ed25519PublicKey;
  
  /** Відбиток ключа */
  readonly fingerprint: string;
}

/**
 * Адміністратор з повними правами
 */
export interface AdminUser {
  /** age публічний ключ */
  readonly identity: AgePublicKey;
  
  /** Відображуване ім'я */
  readonly name: string;
  
  /** Email */
  readonly email?: string;
  
  /** Дата додавання */
  readonly addedAt: ISODateString;
  
  /** Додано ким */
  readonly addedBy?: AgePublicKey;
}

/**
 * Користувач з обмеженим доступом
 */
export interface PolicyUser {
  /** age публічний ключ */
  readonly identity: AgePublicKey;
  
  /** Відображуване ім'я */
  readonly name: string;
  
  /** Email */
  readonly email?: string;
  
  /** Права доступу */
  readonly access: readonly AccessRule[];
  
  /** Дата додавання */
  readonly addedAt: ISODateString;
  
  /** Додано ким */
  readonly addedBy?: AgePublicKey;
  
  /** Термін дії доступу */
  readonly expiresAt?: ISODateString;
}

/**
 * Правило доступу до конкретного ресурсу
 */
export interface AccessRule {
  /** Середовище */
  readonly env: EnvironmentName;
  
  /** Список сервісів або * для всіх */
  readonly services: readonly ServiceName[] | '*';
  
  /** Рівень доступу */
  readonly level?: AccessLevel;
  
  /** Умови доступу */
  readonly conditions?: AccessConditions;
}

export type AccessLevel = 'read' | 'write' | 'admin';

export type ServiceName = string;

/**
 * Умови доступу
 */
export interface AccessConditions {
  /** Тільки з певних IP */
  readonly allowedIps?: readonly string[];
  
  /** Тільки в певний час */
  readonly timeRestrictions?: TimeRestriction;
  
  /** Вимагати MFA */
  readonly requireMfa?: boolean;
}

export interface TimeRestriction {
  readonly startHour?: number;
  readonly endHour?: number;
  readonly timezone?: string;
  readonly weekdays?: readonly number[];
}

// Type aliases для криптографічних ключів
export type AgePublicKey = string & { readonly _brand: unique symbol };
export type Ed25519PublicKey = string & { readonly _brand: unique symbol };
export type Signature = string;
export type ISODateString = string & { readonly _brand: unique symbol };
```

---

## SOPS Types

### [`SopsAdapter`](src/core/sops/types.ts)

Адаптер для роботи з SOPS binary.

```typescript
/**
 * Адаптер для SOPS binary
 */
export interface SopsAdapter {
  /**
   * Розшифрувати файл
   * @throws SopsError якщо розшифрування невдале
   */
  decrypt(filePath: string, options?: DecryptOptions): Promise<DecryptedContent>;
  
  /**
   * Зашифрувати контент
   * @throws SopsError якщо шифрування невдале
   */
  encrypt(content: string, recipients: readonly AgeRecipient[], options?: EncryptOptions): Promise<EncryptedContent>;
  
  /**
   * Оновити recipients без перешифрування даних
   */
  updateKeys(filePath: string, recipients: readonly AgeRecipient[]): Promise<void>;
  
  /**
   * Отримати метадані SOPS файлу
   */
  getMetadata(filePath: string): Promise<SopsMetadata>;
  
  /**
   * Перевірити чи файл зашифрований SOPS
   */
  isEncrypted(filePath: string): Promise<boolean>;
  
  /**
   * Валідувати цілісність файлу
   */
  verify(filePath: string): Promise<VerificationResult>;
}

/**
 * Отримувач age ключа
 */
export interface AgeRecipient {
  /** age публічний ключ */
  readonly publicKey: AgePublicKey;
  
  /** Коментар (ім'я користувача) */
  readonly comment?: string;
}

/**
 * Опції розшифрування
 */
export interface DecryptOptions {
  /** Формат вхідних даних */
  readonly inputType?: 'yaml' | 'json' | 'binary';
  
  /** Формат вихідних даних */
  readonly outputType?: 'yaml' | 'json' | 'binary';
  
  /** Шлях до age identity файлу */
  readonly identityFile?: string;
  
  /** Виводити в stdout замість модифікації файлу */
  readonly toStdout?: boolean;
}

/**
 * Опції шифрування
 */
export interface EncryptOptions {
  /** Формат вхідних даних */
  readonly inputType?: 'yaml' | 'json' | 'binary';
  
  /** Формат вихідних даних */
  readonly outputType?: 'yaml' | 'json' | 'binary';
  
  /** Unencrypted header fields */
  readonly unencryptedSuffix?: string;
  
  /** Unencrypted regex pattern */
  readonly unencryptedRegex?: string;
}

/**
 * Розшифрований контент
 */
export interface DecryptedContent {
  /** Вміст файлу */
  readonly data: string;
  
  /** Метадані SOPS */
  readonly metadata: SopsMetadata;
  
  /** Шлях до оригінального файлу */
  readonly sourcePath: string;
}

/**
 * Зашифрований контент
 */
export interface EncryptedContent {
  /** Зашифрований YAML контент */
  readonly data: string;
  
  /** Метадані SOPS */
  readonly metadata: SopsMetadata;
}

/**
 * SOPS метадані
 */
export interface SopsMetadata {
  /** Версія SOPS */
  readonly version: string;
  
  /** Остання модифікація */
  readonly lastmodified: ISODateString;
  
  /** MAC для цілісності */
  readonly mac: string;
  
  /** age recipients */
  readonly age: readonly AgeEncryptionInfo;
  
  /** KMS keys (якщо використовуються) */
  readonly kms?: readonly KmsEncryptionInfo[];
  
  /** GCP KMS keys */
  readonly gcp_kms?: readonly GcpKmsEncryptionInfo[];
  
  /** Azure Key Vault keys */
  readonly azure_kv?: readonly AzureKvEncryptionInfo[];
}

export interface AgeEncryptionInfo {
  readonly recipient: AgePublicKey;
  readonly enc: string;
}

export interface KmsEncryptionInfo {
  readonly arn: string;
  readonly created_at: ISODateString;
  readonly enc: string;
}

export interface GcpKmsEncryptionInfo {
  readonly resource_id: string;
  readonly created_at: ISODateString;
  readonly enc: string;
}

export interface AzureKvEncryptionInfo {
  readonly vault_url: string;
  readonly key: string;
  readonly version: string;
  readonly created_at: ISODateString;
  readonly enc: string;
}

/**
 * Результат верифікації
 */
export interface VerificationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
```

---

## Env Types

### [`EnvModule`](src/core/env/types.ts)

Робота зі змінними середовища.

```typescript
/**
 * Модуль для роботи з .env файлами
 */
export interface EnvModule {
  /**
   * Парсити .env контент
   */
  parseDotenv(content: string): EnvVars;
  
  /**
   * Серіалізувати в .env формат
   */
  toDotenv(vars: EnvVars): string;
  
  /**
   * Трансформувати YAML секрети в env формат
   */
  fromYaml(yaml: SecretsYaml): EnvVars;
  
  /**
   * Валідувати ім'я змінної
   */
  validateVarName(name: string): ValidationResult;
  
  /**
   * Валідувати значення змінної
   */
  validateVarValue(value: string): ValidationResult;
  
  /**
   * Резолвнути шлях для сервісу
   */
  resolveServicePath(service: string, env: EnvironmentName): string;
  
  /**
   * Мержити змінні з пріоритетом
   */
  mergeVars(base: EnvVars, override: EnvVars): EnvVars;
}

/**
 * Змінні середовища (ключ-значення)
 */
export type EnvVars = Record<string, string>;

/**
 * Структура YAML файлу з секретами
 */
export interface SecretsYaml {
  /** API версія */
  readonly apiVersion: 'git-env-vault/v1';
  
  /** Тип ресурсу */
  readonly kind: 'Secrets';
  
  /** Метадані */
  readonly metadata: SecretsMetadata;
  
  /** Зашифровані дані (розшифровані при парсингу) */
  readonly data: EnvVars;
  
  /** SOPS метадані (присутні тільки в зашифрованих файлах) */
  readonly sops?: SopsMetadata;
}

/**
 * Метадані секретів
 */
export interface SecretsMetadata {
  /** Назва сервісу */
  readonly service: string;
  
  /** Середовище */
  readonly environment: EnvironmentName;
  
  /** Версія */
  readonly version?: string;
  
  /** Теги */
  readonly tags?: readonly string[];
  
  /** Опис */
  readonly description?: string;
}

/**
 * Мапінг сервісів
 */
export interface ServiceMapping {
  /** Назва сервісу */
  readonly service: string;
  
  /** Шлях до .env файлу */
  readonly targetPath: string;
  
  /** Формат файлу */
  readonly format: 'dotenv' | 'json' | 'yaml';
  
  /** Перетворення ключів */
  readonly keyTransform?: KeyTransform;
}

export interface KeyTransform {
  /** Префікс для додавання */
  readonly prefix?: string;
  
  /** Regex для фільтрації */
  readonly include?: string;
  
  /** Regex для виключення */
  readonly exclude?: string;
  
  /** Мапінг ключів */
  readonly rename?: Record<string, string>;
}

/**
 * Результат валідації
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}
```

---

## Git Types

### [`GitAdapter`](src/core/git/types.ts)

Адаптер для Git операцій.

```typescript
/**
 * Адаптер для Git операцій
 */
export interface GitAdapter {
  /**
   * Перевірити чи поточна директорія є git репозиторією
   */
  isGitRepo(): Promise<boolean>;
  
  /**
   * Отримати поточну гілку
   */
  getCurrentBranch(): Promise<string>;
  
  /**
   * Отримати статус
   */
  getStatus(): Promise<GitStatus>;
  
  /**
   * Стейджити файли
   */
  stage(files: readonly string[]): Promise<void>;
  
  /**
   * Зробити коміт
   */
  commit(message: string, options?: CommitOptions): Promise<CommitResult>;
  
  /**
   * Отримати diff
   */
  diff(options?: DiffOptions): Promise<string>;
  
  /**
   * Встановити hook
   */
  installHook(hook: GitHook): Promise<void>;
  
  /**
   * Видалити hook
   */
  uninstallHook(hookName: string): Promise<void>;
  
  /**
   * Перевірити чи є незафіксовані зміни
   */
  hasUncommittedChanges(): Promise<boolean>;
  
  /**
   * Отримати список змінених файлів
   */
  getChangedFiles(): Promise<readonly string[]>;
}

/**
 * Git статус
 */
export interface GitStatus {
  /** Поточна гілка */
  readonly branch: string;
  
  /** Стейджені файли */
  readonly staged: readonly string[];
  
  /** Нестейджені зміни */
  readonly modified: readonly string[];
  
  ** Невідстежувані файли */
  readonly untracked: readonly string[];
  
  /** Конфлікти */
  readonly conflicts: readonly string[];
  
  /** Чи чистий репозиторій */
  readonly isClean: boolean;
}

/**
 * Опції коміту
 */
export interface CommitOptions {
  /** Author override */
  readonly author?: {
    readonly name: string;
    readonly email: string;
  };
  
  /** GPG sign */
  readonly gpgSign?: boolean;
  
  /** No verify (skip hooks) */
  readonly noVerify?: boolean;
}

/**
 * Результат коміту
 */
export interface CommitResult {
  /** SHA коміту */
  readonly sha: string;
  
  /** Повідомлення */
  readonly message: string;
  
  /** Author */
  readonly author: string;
  
  /** Час */
  readonly timestamp: ISODateString;
}

/**
 * Опції diff
 */
export interface DiffOptions {
  /** Базова гілка/коміт */
  readonly base?: string;
  
  /** Цільова гілка/коміт */
  readonly head?: string;
  
  ** Тільки певні файли */
  readonly files?: readonly string[];
  
  /** Формат виводу */
  readonly format?: 'patch' | 'name-only' | 'name-status';
}

/**
 * Git hook
 */
export interface GitHook {
  /** Назва hook */
  readonly name: 'pre-commit' | 'pre-push' | 'commit-msg';
  
  /** Вміст скрипта */
  readonly script: string;
  
  /** Виконуваний */
  readonly executable?: boolean;
}
```

### [`SafeDiff`](src/core/git/types.ts)

Безпечний diff без витоку секретів.

```typescript
/**
 * Генератор безпечного diff
 */
export interface SafeDiffer {
  /**
   * Згенерувати diff без значень
   */
  diff(oldFile: SecretsFile | null, newFile: SecretsFile | null): DiffResult;
  
  /**
   * Форматувати diff для виводу
   */
  format(diff: DiffResult): string;
  
  /**
   * Форматувати для консолі з кольорами
   */
  formatForConsole(diff: DiffResult): string;
}

/**
 * Файл секретів для diff
 */
export interface SecretsFile {
  /** Шлях до файлу */
  readonly path: string;
  
  /** Дані (тільки ключі для diff) */
  readonly data: EnvVars;
  
  /** Метадані */
  readonly metadata: SecretsMetadata;
}

/**
 * Результат diff (без значень!)
 */
export interface DiffResult {
  /** Додані змінні */
  readonly added: readonly string[];
  
  /** Видалені змінні */
  readonly removed: readonly string[];
  
  /** Змінені значення (але НЕ показуємо значення!) */
  readonly changed: readonly string[];
  
  /** Без змін */
  readonly unchanged: readonly string[];
  
  /** Статистика */
  readonly stats: DiffStats;
}

/**
 * Статистика diff
 */
export interface DiffStats {
  readonly additions: number;
  readonly deletions: number;
  readonly modifications: number;
  readonly unchanged: number;
  readonly total: number;
}
```

---

## FileSystem Types

### [`FsModule`](src/core/fs/types.ts)

Безпечна робота з файловою системою.

```typescript
/**
 * Модуль файлової системи
 */
export interface FsModule {
  /**
   * Читати файл
   */
  readFile(path: string): Promise<string>;
  
  /**
   * Записати файл з правами
   */
  writeFile(path: string, content: string, options?: WriteOptions): Promise<void>;
  
  /**
   * Створити директорію
   */
  mkdirp(path: string): Promise<void>;
  
  /**
   * Перевірити існування
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * Видалити файл/директорію
   */
  remove(path: string): Promise<void>;
  
  /**
   * Створити безпечний тимчасовий файл
   */
  createTempFile(prefix?: string): Promise<TempFile>;
  
  /**
   * Копіювати з правами
   */
  copy(src: string, dest: string): Promise<void>;
  
  /**
   * Перевірити права
   */
  checkPermissions(path: string): Promise<PermissionCheck>;
  
  /**
   * Встановити права
   */
  setPermissions(path: string, perms: FilePermissions): Promise<void>;
}

/**
 * Опції запису
 */
export interface WriteOptions {
  /** Режим файлу (Unix permissions) */
  readonly mode?: number;
  
  /** Кодування */
  readonly encoding?: BufferEncoding;
  
  /** Перезаписати якщо існує */
  readonly overwrite?: boolean;
  
  /** Створити директорії якщо не існують */
  readonly mkdirp?: boolean;
}

/**
 * Тимчасовий файл
 */
export interface TempFile {
  /** Шлях до файлу */
  readonly path: string;
  
  /** Записати контент */
  write(content: string): Promise<void>;
  
  /** Прочитати контент */
  read(): Promise<string>;
  
  /** Безпечно видалити */
  cleanup(): Promise<void>;
}

/**
 * Перевірка прав
 */
export interface PermissionCheck {
  /** Чи можна читати */
  readonly readable: boolean;
  
  /** Чи можна писати */
  readonly writable: boolean;
  
  /** Чи можна виконувати */
  readonly executable: boolean;
  
  /** Поточний режим (Unix) */
  readonly mode?: number;
  
  /** Owner */
  readonly owner?: string;
  
  /** Group */
  readonly group?: string;
}

/**
 * Права файлу
 */
export interface FilePermissions {
  /** Unix mode */
  readonly mode?: number;
  
  /** Windows ACL (опціонально) */
  readonly windowsAcl?: WindowsAcl;
}

/**
 * Windows ACL
 */
export interface WindowsAcl {
  readonly owner?: string;
  readonly inherit?: boolean;
  readonly rules?: readonly AclRule[];
}

export interface AclRule {
  readonly identity: string;
  readonly permissions: 'F' | 'M' | 'R' | 'W';
  readonly type: 'allow' | 'deny';
}
```

---

## Command Types

### Командні аргументи та результати

```typescript
/**
 * Базовий інтерфейс для результатів команд
 */
export interface CommandResult<T = void> {
  /** Чи успішно */
  readonly success: boolean;
  
  /** Дані результату */
  readonly data?: T;
  
  /** Повідомлення */
  readonly message?: string;
  
  ** Попередження */
  readonly warnings?: readonly string[];
  
  /** Час виконання */
  readonly duration?: number;
}

/**
 * Результат init команди
 */
export interface InitResult extends CommandResult<{
  configPath: string;
  policyPath: string;
  secretsDir: string;
}> {}

/**
 * Результат pull команди
 */
export interface PullResult extends CommandResult<{
  files: readonly PulledFile[];
  summary: PullSummary;
}> {}

export interface PulledFile {
  readonly service: string;
  readonly environment: EnvironmentName;
  readonly targetPath: string;
  readonly variablesCount: number;
  readonly size: number;
}

export interface PullSummary {
  readonly totalFiles: number;
  readonly totalVariables: number;
  readonly totalSize: number;
  readonly skipped: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Результат edit команди
 */
export interface EditResult extends CommandResult<{
  file: string;
  diff: DiffResult;
  commitSha?: string;
}> {}

/**
 * Результат set команди
 */
export interface SetResult extends CommandResult<{
  file: string;
  key: string;
  action: 'added' | 'modified' | 'deleted';
}> {}

/**
 * Результат doctor команди
 */
export interface DoctorResult extends CommandResult<{
  checks: readonly CheckResult[];
  fixable: readonly string[];
}> {}

export interface CheckResult {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warning';
  readonly message: string;
  readonly details?: unknown;
  readonly fix?: FixAction;
}

export interface FixAction {
  readonly description: string;
  readonly autoFixable: boolean;
  readonly command?: string;
}

/**
 * Результат ci verify команди
 */
export interface CiVerifyResult extends CommandResult<{
  checks: readonly CheckResult[];
  filesChecked: number;
  errors: readonly string[];
  warnings: readonly string[];
}> {}

/**
 * Результат grant команди
 */
export interface GrantResult extends CommandResult<{
  identity: AgePublicKey;
  access: readonly AccessRule[];
  requiresRotate: boolean;
}> {}

/**
 * Результат revoke команди
 */
export interface RevokeResult extends CommandResult<{
  identity: AgePublicKey;
  accessRemoved: readonly AccessRule[];
  requiresRotate: boolean;
}> {}

/**
 * Результат rotate команди
 */
export interface RotateResult extends CommandResult<{
  filesUpdated: readonly string[];
  oldRecipients: readonly AgePublicKey[];
  newRecipients: readonly AgePublicKey[];
  summary: RotateSummary;
}> {}

export interface RotateSummary {
  readonly totalFiles: number;
  readonly totalVariables: number;
  readonly duration: number;
}
```

---

## Error Types

### Помилки та винятки

```typescript
/**
 * Базова помилка git-env-vault
 */
export class GitEnvVaultError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GitEnvVaultError';
  }
}

/**
 * Помилка конфігурації
 */
export class ConfigError extends GitEnvVaultError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', 2, details);
    this.name = 'ConfigError';
  }
}

/**
 * Помилка криптографії
 */
export class CryptoError extends GitEnvVaultError {
  constructor(message: string, details?: unknown) {
    super(message, 'CRYPTO_ERROR', 3, details);
    this.name = 'CryptoError';
  }
}

/**
 * Помилка доступу
 */
export class AccessDeniedError extends GitEnvVaultError {
  constructor(
    public readonly resource: string,
    public readonly user?: AgePublicKey
  ) {
    super(
      `Access denied to ${resource}`,
      'ACCESS_DENIED',
      4
    );
    this.name = 'AccessDeniedError';
  }
}

/**
 * Помилка валідації
 */
export class ValidationError extends GitEnvVaultError {
  constructor(
    message: string,
    public readonly errors: readonly ValidationErrorInfo[]
  ) {
    super(message, 'VALIDATION_ERROR', 5, { errors });
    this.name = 'ValidationError';
  }
}

export interface ValidationErrorInfo {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Помилка SOPS
 */
export class SopsError extends GitEnvVaultError {
  constructor(
    message: string,
    public readonly sopsOutput?: string,
    public readonly exitCode_sops?: number
  ) {
    super(message, 'SOPS_ERROR', 6, { sopsOutput });
    this.name = 'SopsError';
  }
}

/**
 * Помилка Git
 */
export class GitError extends GitEnvVaultError {
  constructor(message: string, details?: unknown) {
    super(message, 'GIT_ERROR', 7, details);
    this.name = 'GitError';
  }
}

/**
 * Помилка файлу не знайдено
 */
export class FileNotFoundError extends GitEnvVaultError {
  constructor(public readonly path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND', 8);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Помилка policy підпису
 */
export class PolicySignatureError extends GitEnvVaultError {
  constructor(message: string = 'Policy signature verification failed') {
    super(message, 'POLICY_SIGNATURE_ERROR', 9);
    this.name = 'PolicySignatureError';
  }
}
```

---

## Utility Types

### Допоміжні типи

```typescript
/**
 * Deep readonly тип
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Partial deep
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make required
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Brand type для type safety
 */
export type Brand<T, B> = T & { readonly _brand: B };

/**
 * Результат операції
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Async результат
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Maybe тип
 */
export type Maybe<T> = T | null | undefined;

/**
 * Змінні оточення процесу
 */
export interface ProcessEnv {
  NODE_ENV?: 'development' | 'production' | 'test';
  CI?: string;
  SOPS_AGE_KEY?: string;
  SOPS_AGE_KEY_FILE?: string;
  EDITOR?: string;
  [key: string]: string | undefined;
}
```

---

## Type Guards

### Type guards для runtime перевірок

```typescript
/**
 * Type guard для EnvVaultConfig
 */
export function isEnvVaultConfig(value: unknown): value is EnvVaultConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'project' in value &&
    typeof value.project === 'string' &&
    'services' in value &&
    'environments' in value &&
    'sops' in value
  );
}

/**
 * Type guard для EnvVaultPolicy
 */
export function isEnvVaultPolicy(value: unknown): value is EnvVaultPolicy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'masterKey' in value &&
    'admins' in value &&
    'users' in value &&
    'signature' in value
  );
}

/**
 * Type guard для SecretsYaml
 */
export function isSecretsYaml(value: unknown): value is SecretsYaml {
  return (
    typeof value === 'object' &&
    value !== null &&
    'apiVersion' in value &&
    'kind' in value &&
    value.kind === 'Secrets' &&
    'data' in value
  );
}

/**
 * Type guard для age public key
 */
export function isAgePublicKey(value: string): value is AgePublicKey {
  return value.startsWith('age1') && value.length >= 58;
}

/**
 * Type guard для ISO date string
 */
export function isISODateString(value: string): value is ISODateString {
  return !isNaN(Date.parse(value));
}
```

---

## Summary

Всі інтерфейси організовані за модулями:

| Модуль | Файл | Ключові типи |
|--------|------|--------------|
| Config | [`src/core/config/types.ts`](src/core/config/types.ts) | `EnvVaultConfig`, `ServiceConfig`, `EnvironmentConfig` |
| Policy | [`src/core/policy/types.ts`](src/core/policy/types.ts) | `EnvVaultPolicy`, `PolicyUser`, `AccessRule` |
| SOPS | [`src/core/sops/types.ts`](src/core/sops/types.ts) | `SopsAdapter`, `SopsMetadata`, `AgeRecipient` |
| Env | [`src/core/env/types.ts`](src/core/env/types.ts) | `EnvVars`, `SecretsYaml`, `ServiceMapping` |
| Git | [`src/core/git/types.ts`](src/core/git/types.ts) | `GitAdapter`, `DiffResult`, `SafeDiffer` |
| FS | [`src/core/fs/types.ts`](src/core/fs/types.ts) | `FsModule`, `TempFile`, `FilePermissions` |
| Errors | [`src/utils/errors.ts`](src/utils/errors.ts) | `GitEnvVaultError`, `AccessDeniedError`, `SopsError` |
