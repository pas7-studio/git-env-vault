# Optimization Guide

This guide provides performance tips for using `@pas7/git-env-vault` effectively, especially in large monorepos.

---

## Overview

`git-env-vault` is designed for performance, but large monorepos with many services and environments can benefit from optimization strategies.

### When to Optimize

Consider optimization if:

- Your monorepo has **50+ services**
- You have **10+ environments**
- Secret files are **larger than 100KB**
- CI pipelines take **more than 2 minutes** on secret operations
- You have **100+ recipients** in your policy

---

## CI/CD Optimization

### 1. Caching

Cache SOPS decryption between runs:

#### GitHub Actions

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    steps:
      - name: Cache SOPS
        uses: actions/cache@v4
        with:
          path: ~/.cache/sops
          key: sops-${{ runner.os }}-${{ hashFiles('secrets/**/*.sops.yaml') }}
          restore-keys: |
            sops-${{ runner.os }}-

      - name: Pull secrets
        run: gev pull --env dev --no-write
        env:
          SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
variables:
  SOPS_CACHE_DIR: "$CI_PROJECT_DIR/.cache/sops"

cache:
  paths:
    - .cache/sops/

build:
  script:
    - mkdir -p .cache/sops
    - gev pull --env dev --no-write
```

### 2. Selective Decryption

Only decrypt what you need:

```bash
# ❌ Slow: Decrypts all services
gev pull --env dev

# ✅ Fast: Decrypts only required service
gev pull --env dev --service api

# ✅ Fastest: Decrypt to memory, no file write
gev pull --env dev --service api --no-write
```

### 3. Parallel Processing

Decrypt multiple services in parallel:

```yaml
# .github/workflows/deploy.yml
jobs:
  decrypt:
    strategy:
      matrix:
        service: [api, worker, scheduler]
    steps:
      - name: Decrypt ${{ matrix.service }}
        run: gev pull --env prod --service ${{ matrix.service }} --no-write
        env:
          SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

### 4. Early Verification

Fail fast with policy verification:

```yaml
# .github/workflows/ci.yml
jobs:
  verify:
    steps:
      # Run verification before expensive operations
      - name: Verify policy
        run: gev ci-verify

      - name: Build
        run: npm run build

      - name: Decrypt secrets
        run: gev pull --env ${{ vars.ENV }} --no-write
```

---

## Monorepo Optimization

### 1. Service Grouping

Group related services to reduce file count:

```json
// gev.config.json
{
  "version": 1,
  "services": {
    // ❌ Anti-pattern: Too granular
    "api-users": { "envOutput": "apps/api/users/.env" },
    "api-products": { "envOutput": "apps/api/products/.env" },
    "api-orders": { "envOutput": "apps/api/orders/.env" },

    // ✅ Better: Grouped
    "api": { "envOutput": "apps/api/.env" },
    "worker": { "envOutput": "apps/worker/.env" }
  }
}
```

### 2. Shared Secrets

Use shared secrets for common values:

```json
// gev.config.json
{
  "version": 1,
  "services": {
    "shared": { "envOutput": "shared/.env" },
    "api": { "envOutput": "apps/api/.env" },
    "worker": { "envOutput": "apps/worker/.env" }
  }
}
```

```bash
# Set shared secrets once
gev set --env dev --service shared DATABASE_URL=postgres://... REDIS_URL=redis://...

# Reference in service configs (application-level)
# apps/api/.env: source ../shared/.env
```

### 3. Environment Hierarchy

Use inheritance for environment-specific overrides:

```json
// gev.policy.json
{
  "version": 1,
  "environments": {
    "base": {
      "services": {
        "api": { "recipients": ["age1...shared"] }
      }
    },
    "dev": {
      "extends": "base",
      "services": {
        "api": { "recipients": ["age1...dev-team"] }
      }
    }
  }
}
```

---

## Batch Operations

### 1. Bulk Grant

Grant access to multiple services at once:

```bash
# Grant access to all services in an environment
for service in $(jq -r '.services | keys[]' gev.config.json); do
  gev grant --env dev --service "$service" --recipient age1newuser...
done
```

### 2. Bulk Rotate

Rotate all services in an environment:

```bash
# Rotate after team member leaves
for service in $(jq -r '.services | keys[]' gev.config.json); do
  gev rotate --env prod --service "$service"
done
```

### 3. Script Common Operations

Create helper scripts:

```bash
#!/bin/bash
# scripts/grant-all.sh

ENV=$1
RECIPIENT=$2

if [ -z "$ENV" ] || [ -z "$RECIPIENT" ]; then
  echo "Usage: ./grant-all.sh <env> <recipient>"
  exit 1
fi

for service in $(jq -r '.services | keys[]' gev.config.json); do
  echo "Granting $RECIPIENT access to $ENV/$service..."
  gev grant --env "$ENV" --service "$service" --recipient "$RECIPIENT"
done

echo "Done! Commit the changes."
```

---

## File Size Optimization

### 1. Secret File Size

Keep individual secret files small:

```bash
# ❌ Anti-pattern: One giant file
secrets/
  dev/
    all-services.sops.yaml  # 500KB, slow to decrypt

# ✅ Better: Split by service
secrets/
  dev/
    api.sops.yaml      # 50KB
    worker.sops.yaml   # 30KB
    scheduler.sops.yaml # 20KB
```

### 2. Remove Unused Secrets

Regularly audit and remove unused variables:

```bash
# Find secrets not referenced in code
grep -r "process.env" apps/ | grep -oE "[A-Z_]+" | sort -u > used-vars.txt

# Compare with secrets file
gev pull --env dev --dry-run | grep -oE "^[A-Z_]+" | sort -u > secret-vars.txt

# Find unused
comm -23 secret-vars.txt used-vars.txt
```

### 3. Compress Large Values

For large secrets (certificates, keys), consider compression:

```bash
# Compress before storing
CERT=$(cat certificate.pem | gzip | base64 -w0)
gev set --env prod --service api "CERT_GZ=$CERT"

# Decompress in application
# const cert = zlib.gunzipSync(Buffer.from(process.env.CERT_GZ, 'base64'));
```

---

## Network Optimization

### 1. Local Caching

Cache decrypted values locally during development:

```bash
# First pull is slow, subsequent are fast
gev pull --env dev

# Use cached values
gev pull --env dev --use-cache
```

### 2. Git LFS for Large Secrets

For very large secret files, consider Git LFS:

```bash
# Track large secret files
git lfs track "secrets/**/*.pem.sops.yaml"
git lfs track "secrets/**/*large*.sops.yaml"
```

---

## Policy Optimization

### 1. Recipient Management

Keep recipient lists manageable:

```bash
# Check policy size
jq '.environments | to_entries | map(.value.services | to_entries | length) | add' gev.policy.json

# If too many recipients, consider:
# 1. Group keys (age1...shared-key)
# 2. Environment-specific teams
# 3. Role-based access
```

### 2. Policy File Size

Split large policies by environment:

```json
// gev.config.json
{
  "version": 1,
  "policyFiles": {
    "dev": "gev.policy.dev.json",
    "staging": "gev.policy.staging.json",
    "prod": "gev.policy.prod.json"
  }
}
```

---

## Performance Benchmarks

### Typical Performance

| Operation | Small (10 vars) | Medium (50 vars) | Large (200 vars) |
|-----------|-----------------|------------------|------------------|
| `gev pull` | ~500ms | ~1.5s | ~4s |
| `gev edit` | ~300ms | ~800ms | ~2s |
| `gev grant` | ~1s | ~3s | ~8s |
| `gev rotate` | ~2s | ~5s | ~15s |

### Optimization Impact

| Optimization | Improvement |
|--------------|-------------|
| Selective decryption | 5-10x faster |
| CI caching | 2-3x faster |
| Service grouping | 20-30% fewer files |
| Shared secrets | 50% less duplication |

---

## Monitoring Performance

### Profile Operations

```bash
# Time operations
time gev pull --env dev

# Detailed profiling
DEBUG=gev:* time gev pull --env dev
```

### Monitor CI Duration

Track secret-related CI time:

```yaml
# .github/workflows/ci.yml
- name: Pull secrets
  run: |
    echo "::group::Pull secrets timing"
    time gev pull --env dev --no-write
    echo "::endgroup::"
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

---

## Best Practices Summary

| Practice | Benefit |
|----------|---------|
| Use `--service` flag | Faster decryption |
| Use `--no-write` in CI | Faster, safer |
| Cache in CI | Avoid redundant decryption |
| Group related services | Fewer files |
| Use shared secrets | Less duplication |
| Audit unused secrets | Smaller files |
| Parallel processing | Faster multi-service CI |

---

## Need Help?

If you're experiencing performance issues not covered here:

1. Run `gev doctor --verbose` to diagnose
2. Check your secret file sizes
3. Review your policy complexity
4. [Open an issue](https://github.com/pas7-studio/git-env-vault/issues) with details
