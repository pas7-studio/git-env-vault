# git-env-vault

[![npm version](https://img.shields.io/npm/v/git-env-vault?logo=npm&label=version)](https://www.npmjs.com/package/git-env-vault)
[![npm downloads](https://img.shields.io/npm/dm/git-env-vault?logo=npm&label=downloads)](https://www.npmjs.com/package/git-env-vault)
[![Release](https://img.shields.io/github/v/release/pas7-studio/git-env-vault?logo=github&label=release)](https://github.com/pas7-studio/git-env-vault/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/pas7-studio/git-env-vault/ci.yml?logo=github&label=CI)](https://github.com/pas7-studio/git-env-vault/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/git-env-vault?logo=mit&label=license)](https://github.com/pas7-studio/git-env-vault/blob/main/LICENSE)

Encrypted `.env` secrets in Git for monorepos: CLI + TUI, SOPS + age, safer local/CI workflows.

`git-env-vault` now supports:
- easy onboarding (`pull`) even without system `sops` (JS fallback)
- full production workflow with system `sops` + `age`
- safer local sync (`diff`, `push`, `status`, `pull --confirm`)
- CI payloads (`ci-seal` / `ci-unseal`)

## Start Here (5 minutes)

If you only need to **pull secrets locally** and start coding:

1. Install package
```bash
npm i -D git-env-vault
# or run without install:
npx git-env-vault@latest doctor
bunx git-env-vault@latest doctor
```

2. Initialize project (once per repo)
```bash
envvault init
```

3. Pull local `.env`
```bash
envvault pull --env dev
```

Notes:
- If system `sops` is missing, `pull` can use the JS backend automatically (`cryptoBackend: "auto"`).
- For `edit/set/grant/revoke/updatekeys/rotate`, install system `sops` + `age` (see Full Setup below).

## What It Solves (simple)

- Keep encrypted secrets in Git instead of sending `.env` files in chat
- Pull decrypted `.env` files per service
- Track changes safely (diff by keys, confirm before overwrite)
- Manage access with recipients (via SOPS/age)
- Support CI without leaking raw secrets in repo

## Install / Run Options

### Local project dependency (recommended)

```bash
npm i -D git-env-vault
```

### Global install

```bash
npm i -g git-env-vault
envvault --version
```

### One-off usage (`npx` / `bunx`)

```bash
npx git-env-vault@latest pull --env dev
bunx git-env-vault@latest pull --env dev
```

## Full Setup (for team admins / production maintenance)

Install system tools if you need write/key-management commands:
- `edit`
- `set`
- `grant`
- `revoke`
- `updatekeys`
- `rotate`
- `push` (encrypt local `.env` back into secret)

### Windows (winget)

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id Mozilla.SOPS -e
winget install --id FiloSottile.age -e
```

### macOS (Homebrew)

```bash
brew install node git
brew install sops age
```

### Linux (examples)

```bash
# Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y nodejs npm git sops age

# Fedora/RHEL
sudo dnf install -y nodejs npm git sops age

# Arch
sudo pacman -S --needed nodejs npm git sops age
```

### Generate age key

```bash
# Linux/macOS
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$env:APPDATA\\sops\\age" | Out-Null
age-keygen -o "$env:APPDATA\\sops\\age\\keys.txt"
```

Use built-in helpers:

```bash
envvault doctor
envvault setup
envvault doctor --fix
```

## Quick Daily Usage (developer)

### Pull secrets safely

```bash
envvault pull --env dev
envvault pull --env dev --service api --confirm
envvault pull --env dev --service api --confirm --yes
```

Preview without writing:

```bash
envvault pull --env dev --service api --plan
envvault pull --env dev --service api --json
```

Batch pull:

```bash
envvault pull --env dev --all-services
envvault pull --env dev --service-pattern "core-*"
```

### Compare local `.env` vs vault

```bash
envvault diff --env dev --service api
envvault diff --env dev --service api --plan
envvault diff --env dev --service api --json
```

### See drift status (what is out of sync)

```bash
envvault status --env dev
envvault status --env dev --json
```

### Push local `.env` back to encrypted secret (requires system `sops`)

```bash
envvault push --env dev --service api --dry-run
envvault push --env dev --service api --confirm
envvault push --env dev --service api --confirm --yes
```

## Monorepo Setup / Rescan (easy mode for big repos)

Use `refresh` / `sync` when you changed `.env` files directly and want `envvault` to rescan services/schema.

```bash
envvault refresh --dry-run
envvault sync --dry-run     # alias
envvault refresh
```

Useful options:

```bash
envvault refresh --dry-run --exclude "apps/legacy/**"
envvault refresh --dry-run --name-strategy dirname
envvault refresh --dry-run --merge-config --merge-schema
envvault refresh --write-secrets   # requires system sops
```

Also manage `.gitignore` automatically:

```bash
envvault gitignore check
envvault gitignore fix
envvault gitignore fix --dry-run
```

## CI (simple and safe)

### Option A: normal CI validation

```bash
envvault ci-verify --allow-unsigned
```

`ci-verify` also checks for uncommitted `.env*` changes (for example `.env.local`) in git status.

### Option B: CI payloads with a dedicated CI key

Use a dedicated CI key (GitHub Actions secret) to encrypt/decrypt a payload:

- `ENVVAULT_CI_KEY` (secret)
- `ENVVAULT_CI_BLOB` (secret/variable)

Create payload (locally or in trusted automation):

```bash
envvault ci-seal --env prod --service api > ci-api-prod.payload
```

Decode in CI:

```bash
envvault ci-unseal --out apps/api/.env --validate-dotenv
```

With one-off runners:

```bash
npx git-env-vault@latest ci-unseal --out apps/api/.env --validate-dotenv
bunx git-env-vault@latest ci-unseal --out apps/api/.env --validate-dotenv
```

## Local Tokens / Placeholders (important)

This project supports two protections for developer-specific secrets like `BOT_TOKEN`.

### 1) `localProtection` (explicit protected keys)

If a key is in `localProtection`, then:
- `pull`: local value is preserved
- `push`: local value is not written into encrypted secret

### 2) Placeholder-safe `pull` (default)

If schema generates a placeholder (for example `__MISSING__`) and a developer already has a local value, `pull` keeps the local value instead of overwriting it with the placeholder.

This is useful when:
- CI gets real values from GitHub Actions `secrets`
- new developers should see placeholders
- existing developers should keep their working local tokens

## Minimal Config Example (recommended defaults)

`envvault.config.json`

```json
{
  "version": 1,
  "secretsDir": "secrets",
  "cryptoBackend": "auto",
  "placeholderPolicy": {
    "preserveExistingOnPlaceholder": true,
    "patterns": ["__MISSING__", "CHANGEME*", "*PLACEHOLDER*", "TODO_*", "<set-me>*"]
  },
  "localProtection": {
    "global": ["BOT_TOKEN", "TELEGRAM_BOT_TOKEN"],
    "services": {
      "core-bot": ["BOT_TOKEN"]
    }
  },
  "services": {
    "api": { "envOutput": "apps/api/.env" }
  }
}
```

## Easy vs Full Mode (important)

### Easy mode (JS backend fallback)

Good for:
- onboarding
- local `pull`
- read-only decrypt flows

Works without system `sops` in many cases.

### Full mode (system `sops` + `age`)

Required for:
- `edit`
- `set`
- `grant`
- `revoke`
- `updatekeys`
- `rotate`
- `push`

## Learning Path (docs in order)

Start here:
1. [Getting Started](docs/GETTING-STARTED.md)
2. [Workflows](docs/WORKFLOWS.md)

Then use as reference:
3. [CLI Reference](docs/CLI-REFERENCE.md)
4. [Configuration](docs/CONFIGURATION.md)

Advanced / operations:
5. [Security Guide](docs/SECURITY-GUIDE.md)
6. [Security Model](docs/SECURITY-MODEL.md)
7. [Troubleshooting](docs/TROUBLESHOOTING.md)
8. [Optimization Guide](docs/OPTIMIZATION-GUIDE.md)

## Command Overview

Core:
- `envvault init`
- `envvault pull`
- `envvault diff`
- `envvault status`
- `envvault push`
- `envvault refresh` / `envvault sync`
- `envvault doctor`
- `envvault setup`
- `envvault ci-verify`
- `envvault ci-seal`
- `envvault ci-unseal`

Access control:
- `envvault grant`
- `envvault revoke`
- `envvault updatekeys`
- `envvault rotate`

Utilities:
- `envvault gitignore check|fix`
- `envvault hooks ...`
- `envvault tui`
- `envvault up`
- `envvault wizard`

## Development

```bash
npm install
npm run build
npm run test
npm run lint
```

## Support

- [Support Guide](SUPPORT.md)
- [Open an issue](https://github.com/pas7-studio/git-env-vault/issues)
- [Security Policy](SECURITY.md)
- [Website](https://pas7.com.ua)

## License

MIT. See [LICENSE](LICENSE).

