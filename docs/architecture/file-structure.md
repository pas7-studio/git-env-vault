# Git Env Vault - Структура Файлів

## Огляд структури проекту

```
git-env-vault/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts              # Vitest конфігурація
├── tsup.config.ts              # Build конфігурація
├── README.md
├── LICENSE
├── CHANGELOG.md
│
├── src/
│   ├── index.ts                # Public API exports
│   │
│   ├── cli/
│   │   ├── index.ts            # CLI entry point
│   │   ├── parser.ts           # Argument parser setup
│   │   ├── output.ts           # Console output formatting
│   │   │
│   │   └── commands/
│   │       ├── index.ts        # Commands registry
│   │       ├── init.ts         # git-env-vault init
│   │       ├── pull.ts         # git-env-vault pull
│   │       ├── edit.ts         # git-env-vault edit
│   │       ├── set.ts          # git-env-vault set
│   │       ├── doctor.ts       # git-env-vault doctor
│   │       ├── ci-verify.ts    # git-env-vault ci verify
│   │       ├── grant.ts        # git-env-vault grant
│   │       ├── revoke.ts       # git-env-vault revoke
│   │       ├── rotate.ts       # git-env-vault rotate
│   │       └── updatekeys.ts   # git-env-vault updatekeys
│   │
│   ├── tui/
│   │   ├── index.ts            # TUI entry point
│   │   ├── run.ts              # Main TUI runner
│   │   ├── components/         # Reusable TUI components
│   │   │   ├── index.ts
│   │   │   ├── select.ts       # Arrow-key select
│   │   │   ├── input.ts        # Text input
│   │   │   ├── confirm.ts      # Yes/No confirm
│   │   │   ├── table.ts        # Table display
│   │   │   ├── diff.ts         # Diff viewer
│   │   │   └── spinner.ts      # Loading spinner
│   │   │
│   │   └── flows/
│   │       ├── index.ts
│   │       ├── editor-flow.ts      # Secrets editor flow
│   │       ├── user-mgmt-flow.ts   # User management flow
│   │       ├── setup-wizard.ts     # Initial setup wizard
│   │       └── confirm-flow.ts     # Confirmation dialogs
│   │
│   ├── core/
│   │   ├── index.ts            # Core module exports
│   │   │
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   ├── loader.ts       # Config loading
│   │   │   ├── schema.ts       # JSON Schema validation
│   │   │   ├── defaults.ts     # Default values
│   │   │   └── types.ts        # Config-related types
│   │   │
│   │   ├── env/
│   │   │   ├── index.ts
│   │   │   ├── parser.ts       # .env parser
│   │   │   ├── serializer.ts   # .env serializer
│   │   │   ├── validator.ts    # Env var validation
│   │   │   ├── mapping.ts      # Service-to-path mapping
│   │   │   └── types.ts        # Env-related types
│   │   │
│   │   ├── sops/
│   │   │   ├── index.ts
│   │   │   ├── adapter.ts      # SOPS binary adapter
│   │   │   ├── encrypt.ts      # Encryption logic
│   │   │   ├── decrypt.ts      # Decryption logic
│   │   │   ├── metadata.ts     # SOPS metadata handling
│   │   │   ├── keys.ts         # age key management
│   │   │   └── types.ts        # SOPS-related types
│   │   │
│   │   ├── policy/
│   │   │   ├── index.ts
│   │   │   ├── loader.ts       # Policy loading
│   │   │   ├── signer.ts       # ed25519 signing
│   │   │   ├── verifier.ts     # Signature verification
│   │   │   ├── access.ts       # Access control logic
│   │   │   └── types.ts        # Policy-related types
│   │   │
│   │   ├── git/
│   │   │   ├── index.ts
│   │   │   ├── adapter.ts      # Git binary adapter
│   │   │   ├── diff.ts         # Safe diff generation
│   │   │   ├── commit.ts       # Commit operations
│   │   │   ├── hooks.ts        # Git hooks management
│   │   │   └── types.ts        # Git-related types
│   │   │
│   │   └── fs/
│   │       ├── index.ts
│   │       ├── operations.ts   # File operations
│   │       ├── temp.ts         # Temp file handling
│   │       ├── permissions.ts  # Cross-platform perms
│   │       └── types.ts        # FS-related types
│   │
│   └── utils/
│       ├── index.ts
│       ├── logger.ts           # Logging utilities
│       ├── platform.ts         # Platform detection
│       ├── exec.ts             # Child process utils
│       ├── crypto.ts           # Crypto utilities
│       ├── yaml.ts             # YAML parsing
│       └── errors.ts           # Error classes
│
├── test/
│   ├── setup.ts                # Test setup
│   ├── fixtures/               # Test fixtures
│   │   ├── configs/            # Sample configs
│   │   ├── policies/           # Sample policies
│   │   ├── secrets/            # Encrypted test secrets
│   │   └── keys/               # Test age keys
│   │
│   ├── unit/
│   │   ├── cli/
│   │   │   └── commands/
│   │   │       ├── init.test.ts
│   │   │       ├── pull.test.ts
│   │   │       └── ...
│   │   │
│   │   ├── core/
│   │   │   ├── config/
│   │   │   ├── env/
│   │   │   ├── sops/
│   │   │   ├── policy/
│   │   │   ├── git/
│   │   │   └── fs/
│   │   │
│   │   └── utils/
│   │
│   ├── integration/
│   │   ├── full-workflow.test.ts
│   │   ├── crypto-flow.test.ts
│   │   └── git-integration.test.ts
│   │
│   └── e2e/
│       ├── cli.test.ts         # Full CLI tests
│       ├── tui.test.ts         # TUI interaction tests
│       └── ci-mode.test.ts     # CI mode tests
│
├── docs/
│   ├── README.md
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── modules.md
│   │   ├── file-structure.md
│   │   ├── security-model.md
│   │   └── interfaces.md
│   │
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── managing-secrets.md
│   │   ├── access-control.md
│   │   ├── ci-integration.md
│   │   └── troubleshooting.md
│   │
│   └── reference/
│       ├── cli.md              # CLI reference
│       ├── config.md           # Config file reference
│       └── policy.md           # Policy file reference
│
├── scripts/
│   ├── build.ts                # Build script
│   ├── release.ts              # Release automation
│   └── generate-docs.ts        # Docs generation
│
└── .github/
    └── workflows/
        ├── ci.yml              # CI pipeline
        ├── release.yml         # Release workflow
        └── security.yml        # Security audit
```

---

## Детальний опис ключових файлів

### Entry Points

#### [`src/index.ts`](src/index.ts)

```typescript
// Public API для програмного використання
export * from './core/config';
export * from './core/env';
export * from './core/sops';
export * from './core/policy';
export * from './core/git';
export * from './core/fs';

// Типи
export type * from './core/config/types';
export type * from './core/env/types';
export type * from './core/sops/types';
export type * from './core/policy/types';
export type * from './core/git/types';
export type * from './core/fs/types';
```

#### [`src/cli/index.ts`](src/cli/index.ts)

```typescript
#!/usr/bin/env node
import { parseArgs } from './parser';
import { runCommand } from './commands';
import { logger } from '../utils/logger';

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runCommand(args);
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

main();
```

---

### CLI Commands

#### [`src/cli/commands/init.ts`](src/cli/commands/init.ts)

```typescript
import { Command } from 'commander';
import { ConfigModule } from '../../core/config';
import { PolicyModule } from '../../core/policy';
import { FsModule } from '../../core/fs';
import { runSetupWizard } from '../../tui/flows/setup-wizard';

interface InitOptions {
  interactive: boolean;
  envs: string;
  services: string;
  force: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // 1. Check existing config
  // 2. If interactive, run TUI wizard
  // 3. Generate config files
  // 4. Create directory structure
  // 5. Setup git hooks
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize git-env-vault in the project')
    .option('-i, --interactive', 'Run interactive setup wizard')
    .option('--envs <list>', 'Comma-separated list of environments')
    .option('--services <list>', 'Comma-separated list of services')
    .option('--force', 'Overwrite existing configuration')
    .action(initCommand);
}
```

#### [`src/cli/commands/pull.ts`](src/cli/commands/pull.ts)

```typescript
import { Command } from 'commander';
import { ConfigModule } from '../../core/config';
import { SopsModule } from '../../core/sops';
import { EnvModule } from '../../core/env';
import { FsModule } from '../../core/fs';

interface PullOptions {
  service?: string;
  dryRun: boolean;
  overwrite: boolean;
  format: 'dotenv' | 'json' | 'yaml';
}

export async function pullCommand(
  environment: string,
  options: PullOptions
): Promise<void> {
  // 1. Load config and mapping
  // 2. Filter services if --service specified
  // 3. For each service:
  //    a. Decrypt secrets/env/service.sops.yaml
  //    b. Transform to target format
  //    c. Write to service path with 0600 perms
  // 4. Show summary
}

export function registerPullCommand(program: Command): void {
  program
    .command('pull <environment>')
    .description('Pull secrets to .env files')
    .option('-s, --service <name>', 'Pull only specific service')
    .option('--dry-run', 'Show what would be done')
    .option('--overwrite', 'Overwrite existing .env files')
    .option('-f, --format <type>', 'Output format', 'dotenv')
    .action(pullCommand);
}
```

---

### TUI Components

#### [`src/tui/components/select.ts`](src/tui/components/select.ts)

```typescript
import ink from 'ink';
import { useState, useEffect } from 'react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  defaultValue?: T;
  placeholder?: string;
  onSelect: (value: T) => void;
  onCancel?: () => void;
}

// Arrow-key навігація, Enter для вибору
export function Select<T>(props: SelectProps<T>): JSX.Element {
  // Implementation with ink
}
```

#### [`src/tui/flows/editor-flow.ts`](src/tui/flows/editor-flow.ts)

```typescript
import { SopsModule } from '../../core/sops';
import { FsModule } from '../../core/fs';
import { GitModule } from '../../core/git';
import { openEditor } from '../../utils/editor';

interface EditorFlowOptions {
  environment: string;
  service: string;
  editor?: string;
}

export async function runEditorFlow(options: EditorFlowOptions): Promise<void> {
  // 1. Decrypt existing or create new
  // 2. Create temp file with 0600
  // 3. Open editor
  // 4. Validate on save
  // 5. Show diff preview
  // 6. Confirm and commit
}
```

---

### Core Modules

#### [`src/core/config/loader.ts`](src/core/config/loader.ts)

```typescript
import { readFile } from '../fs';
import { validateConfig } from './schema';
import { applyDefaults } from './defaults';
import type { EnvVaultConfig } from './types';

const CONFIG_FILE = '.git-env-vault.yaml';

export async function loadConfig(
  cwd: string = process.cwd()
): Promise<EnvVaultConfig> {
  const configPath = join(cwd, CONFIG_FILE);
  
  // Read and parse YAML
  const raw = await readFile(configPath);
  const parsed = parseYaml(raw);
  
  // Validate schema
  const validation = validateConfig(parsed);
  if (!validation.valid) {
    throw new ConfigError(validation.errors);
  }
  
  // Apply defaults
  return applyDefaults(parsed);
}
```

#### [`src/core/sops/adapter.ts`](src/core/sops/adapter.ts)

```typescript
import { execFile } from '../../utils/exec';
import type { SopsResult, SopsOptions } from './types';

const SOPS_BINARY = 'sops';

export class SopsAdapter {
  constructor(private options: SopsOptions) {}
  
  async decrypt(filePath: string): Promise<string> {
    const result = await execFile(SOPS_BINARY, [
      '--decrypt',
      '--input-type', 'yaml',
      '--output-type', 'yaml',
      filePath
    ], {
      env: {
        ...process.env,
        SOPS_AGE_KEY_FILE: this.options.ageKeyFile
      }
    });
    
    return result.stdout;
  }
  
  async encrypt(content: string, recipients: string[]): Promise<string> {
    // Build recipient args
    const recipientArgs = recipients.flatMap(r => 
      ['--age', r]
    );
    
    const result = await execFile(SOPS_BINARY, [
      '--encrypt',
      '--input-type', 'yaml',
      '--output-type', 'yaml',
      ...recipientArgs
    ], {
      input: content
    });
    
    return result.stdout;
  }
  
  // ... more methods
}
```

#### [`src/core/policy/signer.ts`](src/core/policy/signer.ts)

```typescript
import * as ed from '@noble/ed25519';
import type { Signature, PrivateKey, PublicKey } from './types';

export class PolicySigner {
  constructor(private masterKey: PrivateKey) {}
  
  async sign(data: string): Promise<Signature> {
    const message = new TextEncoder().encode(data);
    const signature = await ed.sign(message, this.masterKey);
    return Buffer.from(signature).toString('base64');
  }
  
  async verify(data: string, signature: Signature, publicKey: PublicKey): Promise<boolean> {
    const message = new TextEncoder().encode(data);
    const sigBytes = Buffer.from(signature, 'base64');
    const pubBytes = Buffer.from(publicKey, 'hex');
    
    return ed.verify(sigBytes, message, pubBytes);
  }
}
```

#### [`src/core/git/diff.ts`](src/core/git/diff.ts)

```typescript
import type { SecretsFile, DiffResult } from './types';

export class SafeDiffer {
  /**
   * Generate diff WITHOUT exposing secret values
   */
  diff(oldFile: SecretsFile | null, newFile: SecretsFile | null): DiffResult {
    const oldKeys = oldFile ? Object.keys(oldFile.data) : [];
    const newKeys = newFile ? Object.keys(newFile.data) : [];
    
    const added = newKeys.filter(k => !oldKeys.includes(k));
    const removed = oldKeys.filter(k => !newKeys.includes(k));
    const unchanged = oldKeys.filter(k => 
      newKeys.includes(k) && 
      this.valuesEqual(oldFile!.data[k], newFile!.data[k])
    );
    const changed = oldKeys.filter(k =>
      newKeys.includes(k) &&
      !this.valuesEqual(oldFile!.data[k], newFile!.data[k])
    );
    
    return {
      added,        // ['NEW_VAR']
      removed,      // ['OLD_VAR']
      unchanged,    // ['UNCHANGED_VAR']
      changed,      // ['CHANGED_VAR']
      // НІКОЛИ не повертаємо значення!
    };
  }
  
  formatDiff(diff: DiffResult): string {
    const lines: string[] = [];
    
    diff.added.forEach(k => lines.push(`+ ${k}`));
    diff.removed.forEach(k => lines.push(`- ${k}`));
    diff.changed.forEach(k => lines.push(`~ ${k}`));
    
    return lines.join('\n');
  }
}
```

#### [`src/core/fs/temp.ts`](src/core/fs/temp.ts)

```typescript
import { mkdtemp, writeFile, chmod, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface TempFile {
  path: string;
  write: (content: string) => Promise<void>;
  read: () => Promise<string>;
  cleanup: () => Promise<void>;
}

export async function createSecureTempFile(
  prefix: string = 'git-env-vault-'
): Promise<TempFile> {
  // Create temp directory
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const filePath = join(dir, 'secrets');
  
  // Set secure permissions (Unix only)
  if (process.platform !== 'win32') {
    await chmod(dir, 0o700);
  }
  
  return {
    path: filePath,
    
    async write(content: string): Promise<void> {
      await writeFile(filePath, content, { mode: 0o600 });
    },
    
    async read(): Promise<string> {
      const content = await readFile(filePath, 'utf-8');
      return content;
    },
    
    async cleanup(): Promise<void> {
      // Secure delete: overwrite with zeros first
      if (process.platform !== 'win32') {
        await writeFile(filePath, '\0'.repeat(1024));
      }
      await rm(dir, { recursive: true, force: true });
    }
  };
}
```

---

### Utilities

#### [`src/utils/logger.ts`](src/utils/logger.ts)

```typescript
import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';
  
  // НІКОЛИ не логуємо секрети!
  // Маємо спеціальний тип для позначення sensitive даних
  
  info(message: string, ...args: unknown[]): void {
    console.log(chalk.blue('ℹ'), message, ...this.sanitize(args));
  }
  
  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green('✓'), message, ...this.sanitize(args));
  }
  
  warn(message: string, ...args: unknown[]): void {
    console.log(chalk.yellow('⚠'), message, ...this.sanitize(args));
  }
  
  error(message: string, ...args: unknown[]): void {
    console.log(chalk.red('✗'), message, ...this.sanitize(args));
  }
  
  private sanitize(args: unknown[]): unknown[] {
    // Видаляємо або маскуємо potential secrets
    return args.map(arg => {
      if (typeof arg === 'string' && this.looksLikeSecret(arg)) {
        return '[REDACTED]';
      }
      return arg;
    });
  }
  
  private looksLikeSecret(value: string): boolean {
    // Евристики для виявлення secrets
    const patterns = [
      /^[A-Za-z0-9+/]{40,}={0,2}$/,  // Base64
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
    ];
    return patterns.some(p => p.test(value));
  }
}

export const logger = new Logger();
```

#### [`src/utils/errors.ts`](src/utils/errors.ts)

```typescript
export class GitEnvVaultError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'GitEnvVaultError';
  }
}

export class ConfigError extends GitEnvVaultError {
  constructor(message: string, public details?: unknown) {
    super(message, 'CONFIG_ERROR', 2);
  }
}

export class CryptoError extends GitEnvVaultError {
  constructor(message: string) {
    super(message, 'CRYPTO_ERROR', 3);
  }
}

export class AccessDeniedError extends GitEnvVaultError {
  constructor(resource: string) {
    super(`Access denied to ${resource}`, 'ACCESS_DENIED', 4);
  }
}

export class ValidationError extends GitEnvVaultError {
  constructor(message: string, public errors: string[]) {
    super(message, 'VALIDATION_ERROR', 5);
  }
}

export class SopsError extends GitEnvVaultError {
  constructor(message: string, public sopsOutput?: string) {
    super(message, 'SOPS_ERROR', 6);
  }
}
```

---

## Конфігураційні файли

### [`package.json`](package.json)

```json
{
  "name": "git-env-vault",
  "version": "0.1.0",
  "description": "Encrypted environment variables management for monorepos",
  "type": "module",
  "bin": {
    "git-env-vault": "./dist/cli/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "release": "tsx scripts/release.ts"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "secrets",
    "env",
    "encryption",
    "sops",
    "monorepo",
    "git"
  ],
  "license": "MIT",
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "@noble/ed25519": "^2.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsup": "^8.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

### [`tsconfig.json`](tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### [`tsup.config.ts`](tsup.config.ts)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts'
  },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  dts: true,
  sourcemap: true,
  minify: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  },
  external: ['sops', 'git']  // Зовнішні бінарники
});
```

### [`vite.config.ts`](vite.config.ts) (Vitest)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],  // E2E окремо
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['test/**', 'scripts/**']
    },
    setupFiles: ['test/setup.ts']
  }
});
```

---

## Структура для зберігання секретів (runtime)

```
<project-root>/
├── secrets/
│   ├── .git-env-vault.yaml          # Конфігурація
│   ├── .git-env-vault.policy.yaml   # Політика (підписана)
│   │
│   ├── dev/
│   │   ├── api.sops.yaml
│   │   ├── worker.sops.yaml
│   │   └── shared.sops.yaml
│   │
│   ├── uat/
│   │   ├── api.sops.yaml
│   │   └── worker.sops.yaml
│   │
│   └── prod/
│       ├── api.sops.yaml
│       └── worker.sops.yaml
│
├── .age-keys/                        # Публічні ключі (в git)
│   ├── alice.age
│   └── bob.age
│
└── .gitignore                        # Важливо!
```

### `.gitignore` правила

```gitignore
# Пріоритет: ніколи не комітити розшифровані файли
.env
.env.local
.env.*.local
*.env

# Але зашифровані файли комітимо
!secrets/**/*.sops.yaml

# Приватні ключі ніколи в git
*.age.key
.age-keys-private/
```

---

## Зборка та дистрибуція

### Build output

```
dist/
├── index.js          # ESM entry
├── index.d.ts        # Types
├── cli/
│   └── index.js      # CLI entry (з шебангом)
├── core/
│   ├── config/
│   ├── env/
│   ├── sops/
│   ├── policy/
│   ├── git/
│   └── fs/
├── tui/
└── utils/
```

### NPM package contents

```
git-env-vault-0.1.0.tgz
├── package.json
├── README.md
├── LICENSE
├── dist/
│   ├── index.js
│   ├── index.d.ts
│   └── cli/
│       └── index.js
```

### Bin install locations

```bash
# Глобальна інсталяція
npm install -g git-env-vault
# → /usr/local/bin/git-env-vault

# Локальна інсталяція
npm install git-env-vault
# → ./node_modules/.bin/git-env-vault

# npx
npx git-env-vault init
```
