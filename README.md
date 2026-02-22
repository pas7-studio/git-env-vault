# git-env-vault

[![npm version](https://img.shields.io/npm/v/git-env-vault?logo=npm&label=version)](https://www.npmjs.com/package/git-env-vault)
[![npm downloads](https://img.shields.io/npm/dm/git-env-vault?logo=npm&label=downloads)](https://www.npmjs.com/package/git-env-vault)
[![Release](https://img.shields.io/github/v/release/pas7-studio/git-env-vault?logo=github&label=release)](https://github.com/pas7-studio/git-env-vault/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/pas7-studio/git-env-vault/ci.yml?logo=github&label=CI)](https://github.com/pas7-studio/git-env-vault/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/git-env-vault?logo=mit&label=license)](https://github.com/pas7-studio/git-env-vault/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/git-env-vault?logo=node.js&label=node)](https://nodejs.org/)
[![Maintainer](https://img.shields.io/badge/Maintained%20by-PAS7%20Studio-ff6a00?style=for-the-badge&logo=github&logoColor=white&labelColor=111827)](https://pas7.com.ua)
[![Website](https://img.shields.io/badge/Website-pas7.com.ua-111827?style=for-the-badge&logo=googlechrome&logoColor=white)](https://pas7.com.ua)

Encrypted `.env` secrets in Git for monorepos. `SOPS + age`, policy-based access control, CLI, and interactive TUI.

Now includes a JS decrypt backend fallback for smoother onboarding (`pull`/decrypt) while keeping system `sops` + `age` as the primary full-featured workflow.

## Why git-env-vault

Managing secrets across multiple services and environments is hard:

- Sharing `.env` files in chat/email is unsafe.
- Keeping secrets in CI settings is hard to review and version.
- Onboarding and offboarding access is often manual and error-prone.
- Access revocation usually requires additional manual cleanup.

`git-env-vault` keeps encrypted secrets next to code while controlling who can decrypt each environment/service.

## Key features

- Encrypted secrets stored in Git (`*.sops.yaml`).
- Service-to-output mapping (`envvault.config.json`).
- Policy-based recipients (`envvault.policy.json` + `.sops.yaml`).
- Safe-by-default diffs (keys only, no values by default).
- Access lifecycle commands (`grant`, `revoke`, `updatekeys`, `rotate`).
- Local override promotion (`promote`, `promote-all`).
- CI validation (`ci-verify`).
- Interactive terminal UI (`envvault tui`).

## Requirements

- Node.js `18+`
- Git `2+`
- [SOPS](https://github.com/getsops/sops) `3.8+` (recommended, required for full feature set)
- [age](https://github.com/FiloSottile/age) `1.1+` (recommended, required for full feature set)

## Installation

```bash
# project dependency (recommended)
npm i -D git-env-vault

# global install
npm i -g git-env-vault
```

## Install prerequisites by OS (full mode)

Use this if you want the full feature set (`edit`, `set`, `grant`, `revoke`, `updatekeys`, `rotate`).

### Windows (winget)

```powershell
# Node.js LTS + Git
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e

# SOPS + age
winget install --id Mozilla.SOPS -e
winget install --id FiloSottile.age -e
```

### macOS (Homebrew)

```bash
# Install Homebrew first if needed: https://brew.sh

# Node.js + Git
brew install node git

# SOPS + age
brew install sops age
```

### Linux (Debian / Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm git sops age
```

### Linux (Fedora / RHEL)

```bash
sudo dnf install -y nodejs npm git sops age
```

### Linux (Arch)

```bash
sudo pacman -S --needed nodejs npm git sops age
```

### Generate age key (all OS)

```bash
# Linux/macOS
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$env:APPDATA\\sops\\age" | Out-Null
age-keygen -o "$env:APPDATA\\sops\\age\\keys.txt"
```

## Quick start (easy mode, no system SOPS required for `pull`)

### 1) Install package

```bash
npm i -D git-env-vault

# optional: prefer JS backend for basic usage
# set "cryptoBackend": "js" in envvault.config.json
```

### 2) Create your age key

```bash
age-keygen -o ~/.config/sops/age/keys.txt
```

### 3) Initialize repository config

```bash
envvault init
```

Generated files:

- `envvault.config.json`
- `envvault.policy.json`
- `.sops.yaml`
- `secrets/`

### 4) Decrypt secrets (`pull`)

```bash
envvault pull --env dev
```

If system `sops` is missing, `envvault` will try the JS backend automatically in `cryptoBackend: "auto"` mode.

### 5) Full mode (recommended for teams / production workflows)

Install system tools to enable editing and key management:

```bash
# macOS
brew install sops age

# Windows (winget)
winget install --id Mozilla.SOPS -e
winget install --id FiloSottile.age -e

# Linux examples
sudo apt-get install -y sops age
sudo dnf install sops age
sudo pacman -S sops age
```

Use built-in guidance:

```bash
envvault setup
envvault doctor --fix
```

### 6) Grant access (full mode)

```bash
envvault grant --env dev --service api --recipient age1...
```

### 7) Work with secrets

```bash
# interactive mode
envvault tui

# or direct commands
envvault edit --env dev --service api
envvault pull --env dev
envvault pull --env dev --service api --confirm
envvault diff --env dev --service api
```

### 8) CI check

```bash
envvault ci-verify
```

## Crypto backends

`envvault.config.json` supports:

```json
{
  "cryptoBackend": "auto"
}
```

- `auto` (default): try system `sops` first, then JS fallback for supported commands
- `system-sops`: require system `sops` binary
- `js`: force JS backend (basic decrypt/pull only)

### Backend capability matrix

| Command / capability | JS backend (`sops-age`) | System SOPS |
| --- | --- | --- |
| `pull` / decrypt | Yes | Yes |
| `doctor` capability detection | Yes (reported) | Yes |
| `edit` | No | Yes |
| `set` | No | Yes |
| `grant` | No | Yes |
| `revoke` | No | Yes |
| `updatekeys` | No | Yes |
| `rotate` | No | Yes |

### Limitations of JS backend

- Intended for decrypt flows (`pull`) only.
- Does not replace system `sops` for write/re-encrypt/key-rotation operations.
- Output formatting may differ from `sops -d` when using `decryptToString`.
- Best used for onboarding/local read-only workflows; keep system `sops` + `age` for production maintenance.

## Monorepo DX (v0.5.0)

### Gitignore management

```bash
envvault gitignore check
envvault gitignore fix
envvault gitignore fix --dry-run
```

### Refresh / rescan monorepo env files

```bash
# preview changes (config/schema only)
envvault refresh --dry-run

# add extra excludes
envvault refresh --dry-run --exclude "apps/legacy/**"

# write config + schema
envvault refresh

# optional: create encrypted secrets snapshots (requires system SOPS)
envvault refresh --write-secrets
```

What `refresh` updates:
- `envvault.config.json` (`services` map)
- `envvault.schema.yaml` (keys per service)

What `refresh` does not do:
- does not overwrite local `.env` files
- preserves existing `secretsDir` / `cryptoBackend` config settings

### Safe diff + confirm for pull

```bash
# preview key changes before writing local .env
envvault pull --env dev --service api --confirm

# non-interactive apply (CI/automation)
envvault pull --env dev --service api --confirm --yes

# apply only selected changed keys (comma-separated)
envvault pull --env dev --service api --confirm --select-keys DATABASE_URL,REDIS_URL

# show secret values in diff (unsafe)
envvault pull --env dev --service api --confirm --unsafe-show-values
```

By default, diffs show only key names (`added/removed/changed`), not values.

### Compare local env vs vault (no write)

```bash
envvault diff --env dev --service api
envvault diff --env dev --service api --unsafe-show-values
```

### Non-interactive flags

- `pull --confirm --yes`
- `set --confirm --yes`

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [CLI Reference](docs/CLI-REFERENCE.md)
- [Workflows](docs/WORKFLOWS.md)
- [Security Guide](docs/SECURITY-GUIDE.md)
- [Configuration](docs/CONFIGURATION.md)
- [Security Model](docs/SECURITY-MODEL.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Optimization Guide](docs/OPTIMIZATION-GUIDE.md)

## Command overview

### Core commands

- `envvault init`
- `envvault pull --env <env> [--service <service>]`
- `envvault diff --env <env> --service <service>`
- `envvault refresh [--dry-run] [--write-secrets]`
- `envvault edit --env <env> --service <service>`
- `envvault set --env <env> --service <service> KEY=VALUE...`
- `envvault doctor`

### Access control

- `envvault grant --env <env> --service <service> --recipient <age-public-key>`
- `envvault revoke --env <env> --service <service> --recipient <age-public-key>`
- `envvault updatekeys [--env <env>] [--service <service>]`
- `envvault rotate --env <env> [--service <service>]`

### Local overrides

- `envvault promote --env <env> --service <service> --key <key>`
- `envvault promote-all --env <env> --service <service>`

### Utilities

- `envvault hooks install --type pre-push|pre-commit`
- `envvault hooks uninstall --type pre-push|pre-commit`
- `envvault hooks status`
- `envvault gitignore check`
- `envvault gitignore fix [--dry-run]`
- `envvault setup`
- `envvault wizard`
- `envvault up --env <env>`
- `envvault ci-verify [--allow-unsigned]`
- `envvault tui`

## Open source readiness check

Core files are present in this repository:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `SUPPORT.md`
- `CHANGELOG.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`

## Development

```bash
npm install
npm run build
npm run test
npm run lint
```

## Cross-platform notes

- `.sops.yaml` creation rules use a path-separator-safe regex (`[\\/]`) for Windows/macOS/Linux compatibility.
- `envvault setup` prints OS-specific install commands for `sops` + `age`.

## Support

- [Support Guide](SUPPORT.md)
- [Open an issue](https://github.com/pas7-studio/git-env-vault/issues)
- [Security Policy](SECURITY.md)
- [Website](https://pas7.com.ua)

## Maintainer

Maintained by **[PAS7 Studio](https://pas7.com.ua)**.

## Funding

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/pas7studio)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/ncp/payment/KDSSNKK8REDM8)

## License

MIT. See [LICENSE](LICENSE).
