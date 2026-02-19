# Workflows

Typical day-to-day workflows for teams using `git-env-vault`.

## 1) Onboard a new developer

Developer:

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
grep "public key" ~/.config/sops/age/keys.txt
```

Admin:

```bash
envvault grant --env dev --service api --recipient age1newdev...
envvault grant --env dev --service worker --recipient age1newdev...
```

Developer after merge:

```bash
git pull
envvault pull --env dev
```

## 2) Add a new service

Update config:

```json
{
  "services": {
    "notification-service": {
      "envOutput": "apps/notification-service/.env"
    }
  }
}
```

Grant recipients:

```bash
envvault grant --env dev --service notification-service --recipient age1alice...
envvault grant --env prod --service notification-service --recipient age1lead...
```

Add secrets:

```bash
envvault edit --env dev --service notification-service
envvault edit --env prod --service notification-service
```

## 3) Update one secret value

Interactive:

```bash
envvault edit --env dev --service api
```

Direct:

```bash
envvault set --env dev --service api DATABASE_URL=postgres://new-host:5432/app
```

Review local impact:

```bash
envvault pull --env dev --service api --show-diff
```

## 4) Revoke access safely

```bash
# remove recipient from policy + re-encrypt recipients
envvault revoke --env dev --service api --recipient age1former...

# rotate data key to invalidate old data-key access
envvault rotate --env dev --service api
```

Recommended follow-up:

- Notify team to run `git pull && envvault pull --env dev`.
- If access was broad, rotate other affected services too.

## 5) Use local overrides, then promote

Use your local override mechanism in development, then publish selected keys:

```bash
envvault promote --env dev --service api --key FEATURE_FLAG_X
envvault promote-all --env dev --service api
```

## 6) Keep policy and recipients synchronized

```bash
envvault updatekeys
envvault ci-verify --allow-unsigned
```

## 7) CI/CD deployment flow

Minimal sequence:

```bash
envvault ci-verify
envvault pull --env prod --no-write
```

If your pipeline writes runtime files:

```bash
envvault pull --env prod
```

## 8) Docker compose project bootstrap

```bash
envvault up --env dev
```

This runs verification, pulls secrets, and then executes `docker compose up`.

Useful flags:

```bash
envvault up --env dev --dry-run
envvault up --env dev --no-build --no-detach
```

## 9) Routine security maintenance

Monthly/quarterly checklist:

```bash
envvault doctor
envvault updatekeys
envvault ci-verify --allow-unsigned
```

For high-risk changes:

```bash
envvault rotate --env prod
```

## See also

- [Getting Started](./GETTING-STARTED.md)
- [CLI Reference](./CLI-REFERENCE.md)
- [Security Guide](./SECURITY-GUIDE.md)
