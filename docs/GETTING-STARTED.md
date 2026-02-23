# Getting Started

This guide is the fastest path to set up `git-env-vault` and start using it safely.

Read this first. Then continue with:
- [Workflows](./WORKFLOWS.md) for real team/CI scenarios
- [CLI Reference](./CLI-REFERENCE.md) for full command options

## Quick Path (developer, local usage)

If you only need to pull local `.env` files and start working:

1. Install package
```bash
npm i -D git-env-vault
```

2. Initialize repo (once)
```bash
envvault init
```

3. Pull secrets
```bash
envvault pull --env dev
```

If system `sops` is not installed, `pull` can use the JS backend fallback in many cases.

## Install Options

### Local dependency (recommended)

```bash
npm i -D git-env-vault
```

### Run without installing (`npx` / `bunx`)

```bash
npx git-env-vault@latest doctor
bunx git-env-vault@latest doctor
```

### Global install (optional)

```bash
npm i -g git-env-vault
envvault --version
```

## Full Setup (admins / write access / production maintenance)

Install system `sops` + `age` if you need:
- `edit`
- `set`
- `grant`
- `revoke`
- `updatekeys`
- `rotate`
- `push`

### OS install commands

```bash
# macOS
brew install sops age

# Linux (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y sops age

# Linux (Fedora/RHEL)
sudo dnf install -y sops age

# Linux (Arch)
sudo pacman -S --needed sops age
```

```powershell
# Windows
winget install --id Mozilla.SOPS -e
winget install --id FiloSottile.age -e
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

Use built-in checks:

```bash
envvault doctor
envvault setup
```

## First Project Setup (once per repo)

```bash
envvault init
```

This creates:
- `envvault.config.json`
- `envvault.policy.json`
- `.sops.yaml`
- `secrets/`

## Configure Services

Map each service to where decrypted `.env` should be written.

Example `envvault.config.json`:

```json
{
  "version": 1,
  "secretsDir": "secrets",
  "cryptoBackend": "auto",
  "services": {
    "api": { "envOutput": "apps/api/.env" },
    "worker": { "envOutput": "apps/worker/.env" }
  }
}
```

## Daily Commands (most users)

### Pull secrets

```bash
envvault pull --env dev
envvault pull --env dev --service api --confirm
```

Preview only:

```bash
envvault pull --env dev --service api --plan
envvault pull --env dev --service api --json
```

### Compare before writing

```bash
envvault diff --env dev --service api
```

### Check drift

```bash
envvault status --env dev
```

## Writing Back to Vault (requires system `sops`)

### Edit in editor

```bash
envvault edit --env dev --service api
```

### Set one value

```bash
envvault set --env dev --service api DATABASE_URL=postgres://localhost:5432/app
```

### Push local `.env` file (service-level)

```bash
envvault push --env dev --service api --dry-run
envvault push --env dev --service api --confirm
```

## Monorepo Helpers (recommended)

If `.env` files were changed directly and you want envvault config/schema to catch up:

```bash
envvault refresh --dry-run
envvault sync --dry-run
envvault refresh
```

`.gitignore` helpers:

```bash
envvault gitignore check
envvault gitignore fix
```

## CI (minimal)

```bash
envvault ci-verify --allow-unsigned
```

`ci-verify` also checks for uncommitted `.env*` changes in git status.

## Important Safety Behavior (local secrets)

### `localProtection`

Use `localProtection` to preserve local-only keys (for example `BOT_TOKEN`) during `pull` and to prevent pushing them into encrypted secrets.

### Placeholder-safe `pull` (default)

If schema generates a placeholder like `__MISSING__`, `pull` will not overwrite an existing local non-empty value with that placeholder.

This is useful when:
- new developers should see placeholders
- existing developers already have local working tokens
- CI receives real values from GitHub secrets

## Next Steps

1. [Workflows](./WORKFLOWS.md) for team/CI/admin examples
2. [CLI Reference](./CLI-REFERENCE.md) for all flags
3. [Configuration](./CONFIGURATION.md) for `localProtection`, `placeholderPolicy`, and backend settings

