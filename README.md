# 🔐 @pas7/git-env-vault

[![npm version](https://img.shields.io/npm/v/@pas7/git-env-vault?logo=npm&label=version)](https://www.npmjs.com/package/@pas7/git-env-vault)
[![npm downloads](https://img.shields.io/npm/dm/@pas7/git-env-vault?logo=npm&label=downloads)](https://www.npmjs.com/package/@pas7/git-env-vault)
[![Release](https://img.shields.io/github/v/release/pas7-studio/git-env-vault?logo=github&label=release)](https://github.com/pas7-studio/git-env-vault/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/pas7-studio/git-env-vault/ci.yml?logo=github&label=CI)](https://github.com/pas7-studio/git-env-vault/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@pas7/git-env-vault?logo=mit&label=license)](https://github.com/pas7-studio/git-env-vault/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/@pas7/git-env-vault?logo=node.js&label=node)](https://nodejs.org/)

**Encrypted .env secrets in Git. Built for monorepos. CLI + interactive TUI.**

Store environment secrets encrypted in your Git repository using [SOPS](https://github.com/getsops/sops) + [age](https://github.com/FiloSottile/age) encryption, with policy-based access control and safe-by-default operations.

---

## Why git-env-vault?

Managing secrets in a **monorepo with 200+ environment variables** across multiple services and environments is painful:

- ❌ Sharing `.env` files via Slack/email is insecure
- ❌ Vault/Consul adds infrastructure complexity
- ❌ Environment variables in CI settings aren't version-controlled
- ❌ Giving new team members access is manual and error-prone
- ❌ Revoking access means rotating ALL secrets manually

**git-env-vault solves this:**

- ✅ Secrets encrypted in Git alongside your code
- ✅ Per-service, per-environment access control
- ✅ One command to grant/revoke access
- ✅ Automatic re-encryption on key rotation
- ✅ Works offline, no server required

---

## Features

| Feature | Description |
|---------|-------------|
| 🔒 **Encrypted secrets in Git** | SOPS + age encryption, industry-standard cryptography |
| 🏗️ **Monorepo mapping** | Map secrets to services with `.env` output paths |
| 💻 **Interactive TUI** | Terminal UI for everyday operations |
| 🛡️ **Policy-based access control** | Define who can access which secrets |
| ✅ **Safe-by-default** | Diff shows keys only, never secret values |
| 🔄 **Revoke & Rotate** | Remove access and re-encrypt in one command |
| 🤖 **CI-friendly** | Verify policies, decrypt for deployments |

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR MONOREPO                          │
├─────────────────────────────────────────────────────────────┤
│  secrets/                                                    │
│    dev/                                                      │
│      api.sops.yaml      ← Encrypted with SOPS + age         │
│      worker.sops.yaml                                        │
│    prod/                                                     │
│      api.sops.yaml                                           │
│                                                             │
│  gev.config.json        ← Service mapping                   │
│  gev.policy.json        ← Access control (signed)           │
│  .sops.yaml             ← SOPS configuration                │
└─────────────────────────────────────────────────────────────┘
```

1. **Secrets stored as SOPS-encrypted YAML** - Only values encrypted, keys readable
2. **age recipients control access** - Each developer/CI has their own age key
3. **Policy signed with master key** - Prevents unauthorized policy changes

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| Git | 2.x |
| [SOPS](https://github.com/getsops/sops) | 3.8+ |
| [age](https://github.com/FiloSottile/age) | 1.1+ |

---

## Install

```bash
# As dev dependency (recommended)
npm i -D @pas7/git-env-vault

# Or globally
npm i -g @pas7/git-env-vault
```

---

## Quick Start

### 1. Install prerequisites

```bash
# macOS
brew install sops age

# Windows (winget)
winget install sops
winget install age

# Linux
# SOPS: https://github.com/getsops/sops#install
# age: https://github.com/FiloSottile/age#installation
```

### 2. Generate your age key

```bash
age-keygen -o ~/.config/sops/age/keys.txt
```

### 3. Initialize your project

```bash
cd your-monorepo
gev init
```

This creates:
- `gev.config.json` — Service mapping
- `gev.policy.json` — Access control policy
- `secrets/` — Directory for encrypted secrets
- `.sops.yaml` — SOPS configuration

### 4. Grant access

```bash
# Add a team member's public key
gev grant --env dev --service api --recipient age1...
```

### 5. Manage secrets

```bash
# Interactive TUI
gev tui

# Or use CLI commands directly
gev edit --env dev --service api
gev pull --env dev
```

### 6. CI/CD verification

```bash
gev ci-verify
```

---

## CLI Reference

All commands use the `gev` binary:

### Core Commands

| Command | Description |
|---------|-------------|
| `gev init` | Initialize project configuration |
| `gev pull --env <env>` | Decrypt and write `.env` files |
| `gev edit --env <env> --service <svc>` | Edit secrets in `$EDITOR` |
| `gev set --env <env> --service <svc> KEY=VALUE...` | Set secret values |
| `gev doctor` | Diagnose environment setup |

### Access Control

| Command | Description |
|---------|-------------|
| `gev grant --env <env> --service <svc> --recipient <key>` | Grant access to a user |
| `gev revoke --env <env> --service <svc> --recipient <key>` | Revoke access from a user |
| `gev updatekeys --env <env> [--service <svc>]` | Update encryption keys |
| `gev rotate --env <env> [--service <svc>]` | Rotate data encryption key |

### CI/CD

| Command | Description |
|---------|-------------|
| `gev ci-verify` | Verify policy signatures and integrity |

### Interactive Mode

| Command | Description |
|---------|-------------|
| `gev tui` | Launch interactive terminal UI |
| `gev` | Same as `gev tui` (default) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Security Model](docs/SECURITY-MODEL.md) | How encryption and access control work |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [Optimization Guide](docs/OPTIMIZATION-GUIDE.md) | Performance tips for large monorepos |
| [Architecture](docs/architecture/overview.md) | Technical architecture details |

---

## Example Workflow

### Adding a new developer

```bash
# 1. Developer generates age key
age-keygen -o ~/.config/sops/age/keys.txt

# 2. Developer shares public key (age1...)
# 3. Admin grants access
gev grant --env dev --service api --recipient age1...

# 4. Developer pulls secrets
gev pull --env dev
```

### Revoking access

```bash
# 1. Revoke the key
gev revoke --env dev --service api --recipient age1...

# 2. Rotate encryption (old key no longer works)
gev rotate --env dev --service api
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
- name: Pull secrets
  run: gev pull --env ${{ vars.ENV }} --no-write
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}

- name: Verify policy
  run: gev ci-verify
```

---

## Security Model

### Encryption

- **SOPS** encrypts values while keeping keys readable
- **age** provides asymmetric encryption for key management
- **ed25519** signs policies with master admin key

### Access Control

```json
{
  "version": 1,
  "environments": {
    "dev": {
      "services": {
        "api": { "recipients": ["age1...alice", "age1...bob"] },
        "worker": { "recipients": ["age1...alice"] }
      }
    },
    "prod": {
      "services": {
        "api": { "recipients": ["age1...lead"] }
      }
    }
  }
}
```

### Safe Diff

By default, `gev` never shows secret values:

```
Changes:
  + NEW_API_KEY
  - OLD_DATABASE_URL
  ~ UPDATED_SECRET
```

---

## Support

- 📖 [Documentation](https://github.com/pas7-studio/git-env-vault#readme)
- 🐛 [Issues](https://github.com/pas7-studio/git-env-vault/issues)
- 💬 [Discussions](https://github.com/pas7-studio/git-env-vault/discussions)
- 📧 [Email](mailto:support@pas7.com.ua)

---

## Maintained by

<p align="left">
  <a href="https://pas7.com.ua">
    <img src="https://img.shields.io/badge/PAS7-Studio-blue?style=for-the-badge" alt="PAS7 Studio" />
  </a>
</p>

**PAS7 Studio** — Building developer tools that just work.

If this project helps you manage secrets securely, consider:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20us-ff5e5b?logo=ko-fi)](https://ko-fi.com/pas7studio)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?logo=paypal)](https://www.paypal.com/ncp/payment/KDSSNKK8REDM8)

---

## License

[MIT](LICENSE) © PAS7 Studio

---

## Acknowledgments

- [SOPS](https://github.com/getsops/sops) — Secrets OPerationS
- [age](https://github.com/FiloSottile/age) — A simple, modern file encryption tool
- [tweetnacl](https://github.com/dchest/tweetnacl-js) — Fast, portable cryptographic library
