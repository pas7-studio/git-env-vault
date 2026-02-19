# git-env-vault

[![npm version](https://img.shields.io/npm/v/git-env-vault?logo=npm&label=version)](https://www.npmjs.com/package/git-env-vault)
[![npm downloads](https://img.shields.io/npm/dm/git-env-vault?logo=npm&label=downloads)](https://www.npmjs.com/package/git-env-vault)
[![Release](https://img.shields.io/github/v/release/pas7-studio/git-env-vault?logo=github&label=release)](https://github.com/pas7-studio/git-env-vault/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/pas7-studio/git-env-vault/ci.yml?logo=github&label=CI)](https://github.com/pas7-studio/git-env-vault/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/git-env-vault?logo=mit&label=license)](https://github.com/pas7-studio/git-env-vault/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/git-env-vault?logo=node.js&label=node)](https://nodejs.org/)

Encrypted `.env` secrets in Git for monorepos. `SOPS + age`, policy-based access control, CLI, and interactive TUI.

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
- [SOPS](https://github.com/getsops/sops) `3.8+`
- [age](https://github.com/FiloSottile/age) `1.1+`

## Installation

```bash
# project dependency (recommended)
npm i -D git-env-vault

# global install
npm i -g git-env-vault
```

## Quick start

### 1) Install SOPS and age

```bash
# macOS
brew install sops age

# Windows (winget)
winget install sops
winget install age
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

### 4) Grant access

```bash
envvault grant --env dev --service api --recipient age1...
```

### 5) Work with secrets

```bash
# interactive mode
envvault tui

# or direct commands
envvault edit --env dev --service api
envvault pull --env dev
```

### 6) CI check

```bash
envvault ci-verify
```

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

## License

MIT. See [LICENSE](LICENSE).
