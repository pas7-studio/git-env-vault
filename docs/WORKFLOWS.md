# Workflows

This guide shows practical flows in increasing complexity:

1. Daily developer usage
2. Team/admin secret management
3. Monorepo sync flows
4. CI/CD flows
5. Maintenance/security routines

If you are new, read [Getting Started](./GETTING-STARTED.md) first.

## 1) Daily Developer Flow (most common)

### Start your day

```bash
git pull
envvault pull --env dev
```

Safer version (preview/confirm):

```bash
envvault diff --env dev --service api
envvault pull --env dev --service api --confirm
```

Batch pull for multiple services:

```bash
envvault pull --env dev --service-pattern "core-*"
```

### Check what is out of sync

```bash
envvault status --env dev
```

### If you changed local `.env` directly and want envvault to rescan

```bash
envvault sync --dry-run
envvault sync
```

## 2) Local Secret Safety (BOT_TOKEN, API keys)

### Keep developer-only keys local

Use `localProtection` in `envvault.config.json`:

```json
{
  "localProtection": {
    "global": ["BOT_TOKEN", "TELEGRAM_BOT_TOKEN"],
    "services": {
      "core-bot": ["BOT_TOKEN"]
    }
  }
}
```

Behavior:
- `pull`: local protected values are preserved
- `push`: protected keys are not written to encrypted secret

### Placeholder-safe pull (default)

If schema generates placeholders (for example `__MISSING__`), `pull` will keep an existing local non-empty value instead of replacing it with the placeholder.

This is especially useful when:
- CI injects real values from GitHub Actions secrets
- developers already have local tokens
- placeholders are used for onboarding

## 3) Team Admin Flow (full mode: system `sops` + `age`)

### Onboard a new developer

Developer:

```bash
age-keygen -o ~/.config/sops/age/keys.txt
```

Share the public key only.

Admin:

```bash
envvault grant --env dev --service api --recipient age1newdev...
```

Developer after merge:

```bash
git pull
envvault pull --env dev
```

### Update a shared secret

Interactive:

```bash
envvault edit --env dev --service api
```

Direct:

```bash
envvault set --env dev --service api DATABASE_URL=postgres://new-host:5432/app
```

Or push a local file:

```bash
envvault push --env dev --service api --dry-run
envvault push --env dev --service api --confirm
```

### Revoke access safely

```bash
envvault revoke --env dev --service api --recipient age1former...
envvault rotate --env dev --service api
```

## 4) Monorepo Maintenance Flow

### Rescan env files and refresh config/schema

```bash
envvault refresh --dry-run
envvault refresh --merge-config --merge-schema
envvault refresh --name-strategy dirname
```

### Generate encrypted snapshots from discovered env files

```bash
envvault refresh --write-secrets
```

Requires system `sops`.

### Keep `.gitignore` correct

```bash
envvault gitignore check
envvault gitignore fix
```

## 5) CI/CD Flow

## A. Validation-only CI

```bash
envvault ci-verify --allow-unsigned
envvault pull --env prod --no-write
```

`ci-verify` checks:
- policy/signature (unless `--allow-unsigned`)
- `.sops.yaml` consistency
- encrypted secret file structure
- plaintext `.env` files (`.env`)
- uncommitted `.env*` git changes (for example `.env.local`)

## B. CI payload flow (dedicated CI key)

Use when you want CI to receive an encrypted dotenv payload via CI secrets/vars.

Create payload in a trusted environment:

```bash
envvault ci-seal --env prod --service api > ci-api-prod.payload
```

Store in CI:
- `ENVVAULT_CI_KEY` (secret)
- `ENVVAULT_CI_BLOB` (secret or secure variable)

Decode inside CI:

```bash
envvault ci-unseal --out apps/api/.env --validate-dotenv
```

Using `npx` / `bunx`:

```bash
npx git-env-vault@latest ci-unseal --out apps/api/.env --validate-dotenv
bunx git-env-vault@latest ci-unseal --out apps/api/.env --validate-dotenv
```

## 6) Docker Compose Bootstrap

```bash
envvault up --env dev
```

Useful flags:

```bash
envvault up --env dev --dry-run
envvault up --env dev --no-build --no-detach
```

## 7) Routine Maintenance / Security

### Regular checks

```bash
envvault doctor
envvault updatekeys
envvault ci-verify --allow-unsigned
```

### High-risk changes / offboarding

```bash
envvault rotate --env prod
```

## See Also

- [Getting Started](./GETTING-STARTED.md)
- [CLI Reference](./CLI-REFERENCE.md)
- [Configuration](./CONFIGURATION.md)
- [Security Guide](./SECURITY-GUIDE.md)

