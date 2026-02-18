# Git Env Vault - Модулі та Команди

## Огляд модульної структури

```mermaid
graph TB
    subgraph Entry Points
        CLI[CLI Index]
        TUI[TUI Entry]
    end
    
    subgraph Commands
        INIT[init]
        PULL[pull]
        EDIT[edit]
        SET[set]
        DOCTOR[doctor]
        CI[ci verify]
        GRANT[grant]
        REVOKE[revoke]
        ROTATE[rotate]
        UPDATE[updatekeys]
    end
    
    subgraph TUI Flows
        TF1[Secrets Editor Flow]
        TF2[User Management Flow]
        TF3[Setup Wizard Flow]
    end
    
    subgraph Core Modules
        CONFIG[Config]
        ENV[Env]
        SOPS[SopsAdapter]
        POLICY[Policy]
        GIT[GitAdapter]
        FS[FileSystem]
    end
    
    CLI --> Commands
    CLI --> TUI
    TUI --> TF1
    TUI --> TF2
    TUI --> TF3
    
    Commands --> Core Modules
    TUI Flows --> Core Modules
```

---

## CLI Commands

### 1. `git-env-vault init`

Ініціалізація проекту git-env-vault.

```bash
git-env-vault init [options]

Options:
  --interactive    Запустити інтерактивний wizard
  --envs <list>    Список середовищ (dev,uat,prod)
  --services <list> Список сервісів
  --force          Перезаписати існуючу конфігурацію
```

**Алгоритм:**

```mermaid
flowchart TD
    A[Start init] --> B{Config exists?}
    B -->|Yes| C{Force flag?}
    C -->|No| D[Error: Already initialized]
    C -->|Yes| E[Backup old config]
    B -->|No| E
    E --> F{Interactive mode?}
    F -->|Yes| G[Launch TUI Wizard]
    F -->|No| H[Parse CLI options]
    G --> I[Collect project info]
    H --> I
    I --> J[Generate .git-env-vault.yaml]
    J --> K[Generate .git-env-vault.policy.yaml]
    K --> L[Create secrets/ directory structure]
    L --> M[Generate .gitignore rules]
    M --> N[Success]
```

**Файлові операції:**
- Створює `.git-env-vault.yaml`
- Створює `.git-env-vault.policy.yaml` (порожній, підписаний)
- Створює `secrets/{env}/` директорії
- Оновлює `.gitignore`

---

### 2. `git-env-vault pull`

Розкладає зашифровані секрети по .env файлах монорепозиторію.

```bash
git-env-vault pull <environment> [options]

Arguments:
  environment      Цільове середовище (dev, uat, prod)

Options:
  --service <name> Пуллити тільки конкретний сервіс
  --dry-run        Показати що буде зроблено без виконання
  --overwrite      Перезаписати існуючі .env файли
  --format <type>  Формат виводу (dotenv, json, yaml)
```

**Алгоритм:**

```mermaid
flowchart TD
    A[Start pull] --> B[Load config]
    B --> C[Load mapping]
    C --> D{Service specified?}
    D -->|Yes| E[Filter services]
    D -->|No| F[Get all services for env]
    E --> G[Loop services]
    F --> G
    
    G --> H[Read secrets/env/service.sops.yaml]
    H --> I[Decrypt via SOPS]
    I --> J[Transform to .env format]
    J --> K{Target exists?}
    K -->|Yes| L{Overwrite flag?}
    L -->|No| M[Skip with warning]
    L -->|Yes| N[Write .env with 0600]
    K -->|No| N
    N --> O{More services?}
    O -->|Yes| G
    O -->|No| P[Success summary]
```

**Приклад виводу:**

```
✓ Pulled 3 secrets for environment 'dev'
  services/api/.env      (12 variables)
  services/worker/.env   (8 variables)
  apps/web/.env.local    (5 variables)
```

---

### 3. `git-env-vault edit`

Інтерактивне редагування секретів з workflow: decrypt → edit → validate → encrypt → diff → commit.

```bash
git-env-vault edit <environment> <service> [options]

Arguments:
  environment      Середовище (dev, uat, prod)
  service          Назва сервісу

Options:
  --editor <cmd>   Редактор (default: $EDITOR or nano)
  --no-commit      Не робити автокоміт
  --no-diff        Не показувати diff
```

**Алгоритм:**

```mermaid
flowchart TD
    A[Start edit] --> B[Check if secrets file exists]
    B -->|No| C[Create new from template]
    B -->|Yes| D[Decrypt secrets]
    D --> E[Create temp file 0600]
    E --> F[Open editor]
    F --> G[Wait for editor close]
    G --> H[Read temp file]
    H --> I[Validate YAML + env vars]
    I -->|Invalid| J[Show errors]
    J --> K{Retry?}
    K -->|Yes| F
    K -->|No| L[Cleanup and exit]
    I -->|Valid| M[Encrypt with SOPS]
    M --> N[Write to secrets file]
    N --> O[Generate safe diff]
    O --> P{Confirm changes?}
    P -->|No| Q[Revert changes]
    P -->|Yes| R{Auto-commit?}
    R -->|Yes| S[Git commit]
    R -->|No| T[Stage changes only]
    S --> U[Cleanup temp file]
    T --> U
    Q --> U
    L --> U
```

**Валідація:**
- YAML синтаксис
- Коректні імена змінних (A-Z_, 0-9)
- Відсутність вкладених структур у data
- Попередження про потенційні проблеми (дублікати, порожні значення)

---

### 4. `git-env-vault set`

Швидке встановлення окремої змінної без відкриття редактора.

```bash
git-env-vault set <environment> <service> <key=value> [options]

Arguments:
  environment      Середовище
  service          Сервіс
  key=value        Змінна у форматі KEY=VALUE

Options:
  --from-file <path>  Взяти значення з файлу
  --from-stdin        Взяти значення з stdin
  --delete           Видалити змінну
```

**Приклади:**

```bash
# Встановити змінну
git-env-vault set dev api DATABASE_URL=postgres://localhost:5432/dev

# Взяти значення з файлу
git-env-vault set prod api PRIVATE_KEY --from-file ./key.pem

# Видалити змінну
git-env-vault set dev api OLD_VAR --delete
```

---

### 5. `git-env-vault doctor`

Діагностика проблем з конфігурацією та середовищем.

```bash
git-env-vault doctor [options]

Options:
  --fix            Автоматично виправити проблеми
  --verbose        Детальний вивід
  --json           JSON формат виводу
```

**Перевірки:**

| Check | Опис | Auto-fix |
|-------|------|----------|
| `sops-binary` | SOPS встановлений та доступний | Ні |
| `age-keys` | age ключі наявні та валідні | Ні |
| `config-file` | .git-env-vault.yaml існує та валідний | Так |
| `policy-file` | .policy.yaml підписаний | Ні |
| `secrets-dir` | Структура директорій коректна | Так |
| `gitignore` | .env файли в .gitignore | Так |
| `permissions` | Права доступу до файлів | Ні |

**Приклад виводу:**

```
Running diagnostics...

✓ SOPS binary found: v3.8.1
✓ age keys found: 2 keys
✓ Config file valid
✓ Policy file signed
✓ Secrets directory structure OK
⚠ .gitignore missing .env entries
  → Run with --fix to add

6 passed, 1 warning
```

---

### 6. `git-env-vault ci verify`

Перевірка цілісності для CI/CD пайплайнів.

```bash
git-env-vault ci verify [options]

Options:
  --environment <env>  Перевірити конкретне середовище
  --strict             Помилка при будь-яких warnings
  --json               JSON вивід для парсингу
  --check-recipients   Перевірити що всі recipients у policy
```

**Алгоритм:**

```mermaid
flowchart TD
    A[Start CI verify] --> B[Load config]
    B --> C[Load policy]
    C --> D[Verify policy signature]
    D -->|Invalid| E[FAIL: Policy not signed]
    D -->|Valid| F[Scan secrets directory]
    F --> G[Loop: each .sops.yaml file]
    G --> H[Parse YAML]
    H --> I{Valid SOPS format?}
    I -->|No| J[FAIL: Invalid SOPS format]
    I -->|Yes| K[Verify SOPS metadata]
    K --> L{All recipients in policy?}
    L -->|No| M[FAIL: Unknown recipient]
    L -->|Yes| N[Verify MAC]
    N --> O{MAC valid?}
    O -->|No| P[FAIL: MAC mismatch]
    O -->|Yes| Q{More files?}
    Q -->|Yes| G
    Q -->|No| R[Generate report]
    R --> S[Exit with code]
```

**Exit codes:**
- `0` — всі перевірки пройшли
- `1` — критичні помилки
- `2` — warnings в strict режимі

**JSON вивід приклад:**

```json
{
  "status": "passed",
  "checks": {
    "policySignature": "valid",
    "secretsFormat": "valid",
    "recipientsMatch": "valid",
    "macVerification": "valid"
  },
  "files": 12,
  "errors": [],
  "warnings": []
}
```

---

### 7. `git-env-vault grant`

Надання доступу користувачу.

```bash
git-env-vault grant <identity> [options]

Arguments:
  identity         age public key або email

Options:
  --admin          Надати admin права
  --envs <list>    Обмежити середовищами
  --services <list> Обмежити сервісами
  --expires <date> Термін дії доступу
```

**Вимоги:**
- Потрібен master admin підпис для виконання
- Або поточний користувач має admin права

**Алгоритм:**

```mermaid
flowchart TD
    A[Start grant] --> B[Load policy]
    B --> C[Verify admin rights]
    C -->|No| D[FAIL: Permission denied]
    C -->|Yes| E[Parse identity]
    E --> F{Valid age key?}
    F -->|No| G[FAIL: Invalid identity]
    F -->|Yes| H[Check if already granted]
    H -->|Yes| I[Update existing entry]
    H -->|No| J[Add new entry]
    I --> K[Sign updated policy]
    J --> K
    K --> L[Write policy file]
    L --> M{Re-encrypt secrets?}
    M -->|Yes| N[Run updatekeys]
    M -->|No| O[Success]
    N --> O
```

---

### 8. `git-env-vault revoke`

Відкликання доступу користувача.

```bash
git-env-vault revoke <identity> [options]

Arguments:
  identity         age public key або email користувача

Options:
  --rotate         Автоматично rotate всі секрети
  --force          Пропустити підтвердження
```

**Критично:** Після revoke обов'язковий rotate, бо відкликаний користувач міг скопіювати ключі шифрування.

---

### 9. `git-env-vault rotate**

Перешифрування всіх секретів з новими ключами.

```bash
git-env-vault rotate [options]

Options:
  --env <name>     Тільки конкретне середовище
  --service <name> Тільки конкретний сервіс
  --dry-run        Показати план без виконання
```

**Алгоритм:**

```mermaid
flowchart TD
    A[Start rotate] --> B[Load policy]
    B --> C[Get active recipients]
    C --> D{Dry run?}
    D -->|Yes| E[Show plan and exit]
    D -->|No| F[Loop: each secrets file]
    F --> G[Decrypt with old keys]
    G --> H[Generate new data key]
    H --> I[Encrypt for new recipients]
    I --> J[Write updated file]
    J --> K{More files?}
    K -->|Yes| F
    K -->|No| L[Generate report]
    L --> M[Success]
```

---

### 10. `git-env-vault updatekeys`

Оновлення ключів шифрування без rotate (додавання нових recipients).

```bash
git-env-vault updatekeys [options]

Options:
  --env <name>     Тільки конкретне середовище
  --service <name> Тільки конкретний сервіс
```

Використовується коли новий користувач отримав доступ через `grant` і потрібно зашифрувати data key для нього.

---

## TUI Flows

### Secrets Editor Flow

```mermaid
stateDiagram-v2
    [*] --> SelectEnv: Launch TUI
    SelectEnv --> SelectService: Choose environment
    SelectService --> ViewSecrets: Choose service
    ViewSecrets --> EditMode: Press E
    EditMode --> ViewSecrets: Save
    ViewSecrets --> AddSecret: Press A
    AddSecret --> ViewSecrets: Confirm
    ViewSecrets --> DeleteConfirm: Press D
    DeleteConfirm --> ViewSecrets: Confirm/Cancel
    ViewSecrets --> DiffView: Press P for preview
    DiffView --> CommitConfirm: Review
    CommitConfirm --> [*]: Commit
    ViewSecrets --> [*]: Quit with Q
```

### User Management Flow

```mermaid
stateDiagram-v2
    [*] --> UserList: Launch user management
    UserList --> AddUser: Press A
    AddUser --> EnterKey: Choose type
    EnterKey --> SetPermissions: Enter age key
    SetPermissions --> ConfirmGrant: Select envs/services
    ConfirmGrant --> UserList: Confirm
    
    UserList --> SelectUser: Select user
    SelectUser --> ConfirmRevoke: Press R
    ConfirmRevoke --> RotatePrompt: Confirm
    RotatePrompt --> UserList: Rotate complete
    
    UserList --> [*]: Quit with Q
```

### Setup Wizard Flow

```mermaid
stateDiagram-v2
    [*] --> Welcome: init --interactive
    Welcome --> ProjectName: Continue
    ProjectName --> SelectEnvs: Enter name
    SelectEnvs --> DefineServices: Select environments
    DefineServices --> ServiceDetails: List services
    ServiceDetails --> ServiceMapping: Enter service name
    ServiceMapping --> MoreServices: Define path
    MoreServices --> DefineServices: Yes
    MoreServices --> KeySetup: No
    KeySetup --> ConfigPreview: Generate or import age key
    ConfigPreview --> FinalConfirm: Review config
    FinalConfirm --> [*]: Create files
```

---

## Core Modules

### Config Module

**Відповідальність:** Зчитування, валідація та управління конфігурацією проекту.

```typescript
// Основні функції
export interface ConfigModule {
  load(): Promise<EnvVaultConfig>;
  save(config: EnvVaultConfig): Promise<void>;
  validate(config: unknown): ValidationResult;
  getDefaultPaths(): ConfigPaths;
}
```

**Ключові операції:**
- Завантаження `.git-env-vault.yaml`
- Мержинг з дефолтними значеннями
- Валідація схеми конфігурації
- Резолв шляхів (відносні → абсолютні)

---

### Env Module

**Відповідальність:** Робота зі змінними середовища та мапінгами.

```typescript
export interface EnvModule {
  // Парсинг .env файлів
  parseDotenv(content: string): EnvVars;
  
  // Серіалізація у .env формат
  toDotenv(vars: EnvVars): string;
  
  // Трансформація з YAML у env формат
  fromYaml(yaml: SecretsYaml): EnvVars;
  
  // Валідація імен змінних
  validateVarName(name: string): boolean;
  
  // Мапінг сервісів на шляхи
  resolveServicePath(service: string, env: string): string;
}
```

**Підтримувані формати:**
- `.env` — стандартний dotenv
- `.env.local` — локальні перевизначення
- JSON — для програмного доступу
- YAML — для складних структур

---

### SOPS Module

**Відповідальність:** Інтеграція з SOPS binary для шифрування/розшифрування.

```typescript
export interface SopsModule {
  // Розшифрування файлу
  decrypt(filePath: string): Promise<DecryptedContent>;
  
  // Шифрування контенту
  encrypt(content: object, recipients: AgeRecipient[]): Promise<string>;
  
  // Оновлення recipients без перешифрування даних
  updateKeys(filePath: string, recipients: AgeRecipient[]): Promise<void>;
  
  // Отримання metadata
  getMetadata(filePath: string): Promise<SopsMetadata>;
  
  // Перевірка чи файл зашифрований
  isEncrypted(filePath: string): Promise<boolean>;
}
```

**Інтеграція з SOPS:**

```mermaid
sequenceDiagram
    participant App as git-env-vault
    participant SopsModule as SopsModule
    participant SOPS as SOPS Binary
    participant Keys as age Keys
    
    App->>SopsModule: decrypt file
    SopsModule->>SOPS: exec sops --decrypt
    SOPS->>Keys: load age identity
    Keys-->>SOPS: private key
    SOPS-->>SopsModule: decrypted YAML
    SopsModule-->>App: parsed content
```

---

### Policy Module

**Відповідальність:** Управління доступами та криптографічні підписи.

```typescript
export interface PolicyModule {
  // Завантаження policy
  load(): Promise<EnvVaultPolicy>;
  
  // Збереження з підписом
  save(policy: EnvVaultPolicy, signature: Signature): Promise<void>;
  
  // Перевірка підпису
  verifySignature(policy: EnvVaultPolicy): Promise<boolean>;
  
  // Перевірка прав доступу
  checkAccess(user: string, resource: Resource): Promise<boolean>;
  
  // Додавання користувача
  grantAccess(identity: UserIdentity, rights: AccessRights): Promise<void>;
  
  // Відкликання доступу
  revokeAccess(identity: string): Promise<void>;
}
```

**Структура policy:**

```yaml
version: 1
generated: 2024-01-15T10:00:00Z

admin:
  masterKey: age1admin...  # ed25519 для підписів
  users:
    - identity: age1alice...
      name: Alice
      email: alice@example.com

users:
  - identity: age1bob...
    name: Bob
    email: bob@example.com
    access:
      - env: dev
        services: ["*"]
      - env: uat
        services: ["api"]

signature: |
  -----BEGIN SIGNATURE-----
  ...
  -----END SIGNATURE-----
```

---

### Git Module

**Відповідальність:** Git операції та safe diff.

```typescript
export interface GitModule {
  // Перевірка чи в git репозиторії
  isGitRepo(): Promise<boolean>;
  
  // Diff без секретів
  safeDiff(oldContent: SecretsFile, newContent: SecretsFile): DiffResult;
  
  // Commit змін
  commit(files: string[], message: string): Promise<void>;
  
  // Stage змін
  stage(files: string[]): Promise<void>;
  
  // Pre-commit hook
  installHook(): Promise<void>;
  
  // Перевірка незафіксованих змін
  hasUncommittedChanges(): Promise<boolean>;
}
```

**Safe Diff алгоритм:**

```typescript
function safeDiff(old: SecretsFile, new: SecretsFile): DiffResult {
  const oldKeys = Object.keys(old.data);
  const newKeys = Object.keys(new.data);
  
  return {
    added: newKeys.filter(k => !oldKeys.includes(k)),
    removed: oldKeys.filter(k => !newKeys.includes(k)),
    changed: oldKeys.filter(k => 
      newKeys.includes(k) && !equal(old.data[k], new.data[k])
    ),
    // Значення НІКОЛИ не показуємо
    valuesExposed: false
  };
}
```

---

### FileSystem Module

**Відповідальність:** Безпечна робота з файловою системою.

```typescript
export interface FsModule {
  // Читання файлу
  readFile(path: string): Promise<string>;
  
  // Запис з правильними правами
  writeFile(path: string, content: string, perms?: FilePerms): Promise<void>;
  
  // Створення temp файлу
  createTempFile(prefix: string): Promise<TempFile>;
  
  // Безпечне видалення
  secureDelete(path: string): Promise<void>;
  
  // Копіювання з правами
  copyWithPerms(src: string, dest: string): Promise<void>;
  
  // Перевірка прав
  checkPermissions(path: string): Promise<PermissionCheck>;
}
```

**Кросплатформена робота з правами:**

```typescript
interface FilePerms {
  // Unix: mode bits (0600, 0644, etc.)
  mode?: number;
  
  // Windows: ACL (опціонально)
  acl?: WindowsAcl;
}

// Приклад: створення temp файлу для секретів
async function createTempFile(prefix: string): Promise<TempFile> {
  const path = await mktemp(prefix);
  
  if (process.platform !== 'win32') {
    await fs.chmod(path, 0o600);  // Тільки власник
  } else {
    // Windows: best effort, використовуємо %TEMP% з user permissions
  }
  
  return {
    path,
    cleanup: () => secureDelete(path)
  };
}
```

---

## Залежності між модулями

```mermaid
graph LR
    CLI[CLI Commands] --> Config
    CLI --> Policy
    CLI --> SOPS
    
    Config --> FS
    Policy --> FS
    Policy --> Crypto
    
    SOPS --> FS
    SOPS --> External[SOPS Binary]
    
    Env --> Config
    Env --> FS
    
    Git --> FS
    Git --> External[Git Binary]
    
    FS --> Platform[Platform Utils]
```

### Напрямок залежностей

1. **CLI** → Core Modules (верхній рівень)
2. **Core Modules** → FS Module (середній рівень)
3. **FS Module** → Platform Utils (нижній рівень)

### Ізоляція зовнішніх залежностей

- SOPS binary — через SopsModule adapter
- Git binary — через GitModule adapter
- age keys — через PolicyModule та SopsModule

Це дозволяє:
- Мокати зовнішні залежності в тестах
- Міняти реалізацію без зміни API
- Легко додавати нові crypto backends у майбутньому
