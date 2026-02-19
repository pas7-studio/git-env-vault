# Getting Started

This guide walks you through setting up `git-env-vault` in a new or existing repository.

## Prerequisites

- Node.js `18+`
- Git `2+`
- [SOPS](https://github.com/getsops/sops) `3.8+`
- [age](https://github.com/FiloSottile/age) `1.1+`

## 1) Install dependencies

```bash
npm i -D git-env-vault
```

Install external tools:

```bash
# macOS
brew install sops age

# Windows
winget install sops
winget install age

# Linux (example)
sudo apt install sops age
```

## 2) Generate an age key

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

Show your public key:

```bash
grep "public key" ~/.config/sops/age/keys.txt
```

## 3) Initialize envvault

```bash
envvault init
```

This creates:

- `envvault.config.json`
- `envvault.policy.json`
- `.sops.yaml`
- `secrets/`

## 4) Configure services

Edit `envvault.config.json` and map each service to its output `.env` file.

Example:

```json
{
  "version": 1,
  "secretsDir": "secrets",
  "services": {
    "api": { "envOutput": "apps/api/.env" },
    "worker": { "envOutput": "apps/worker/.env" }
  }
}
```

## 5) Grant access recipients

Add one or more recipients for each environment/service:

```bash
envvault grant --env dev --service api --recipient age1alice...
envvault grant --env dev --service worker --recipient age1alice...
```

## 6) Add or edit secrets

```bash
# interactive editor
envvault edit --env dev --service api

# direct update
envvault set --env dev --service api DATABASE_URL=postgres://localhost:5432/app
```

## 7) Pull secrets locally

```bash
envvault pull --env dev
envvault pull --env dev --service api --show-diff
```

## 8) Verify setup

```bash
envvault doctor
envvault ci-verify --allow-unsigned
```

## 9) Team workflow basics

- New developer generates an age key and shares only the public key.
- Admin grants access with `envvault grant`.
- Developer runs `git pull && envvault pull --env <env>`.
- For access removal, run `envvault revoke` and then `envvault rotate`.

## Common first-week commands

```bash
envvault tui
envvault pull --env dev
envvault edit --env dev --service api
envvault hooks install --type pre-push
```

## Next docs

- [CLI Reference](./CLI-REFERENCE.md)
- [Configuration](./CONFIGURATION.md)
- [Workflows](./WORKFLOWS.md)
- [Security Guide](./SECURITY-GUIDE.md)
