# Troubleshooting Guide

This guide covers common issues and their solutions when using `@pas7/git-env-vault`.

## Quick Diagnostics

Run the built-in diagnostic tool first:

```bash
gev doctor
```

This checks:
- ✅ Node.js version (requires 20+)
- ✅ SOPS installation and version
- ✅ age installation and version
- ✅ Git repository status
- ✅ Configuration file validity
- ✅ Policy file integrity
- ✅ age key presence

---

## Common Issues

### Table of Contents

1. [SOPS not found](#sops-not-found)
2. [age not found](#age-not-found)
3. [Permission denied](#permission-denied)
4. [Policy invalid](#policy-invalid)
5. [Decryption failed](#decryption-failed)
6. [No age key configured](#no-age-key-configured)
7. [Configuration errors](#configuration-errors)
8. [Git-related issues](#git-related-issues)
9. [CI/CD issues](#cicd-issues)
10. [TUI issues](#tui-issues)

---

## SOPS not found

### Error Message

```
Error: sops: command not found
Error: Failed to run sops: spawn sops ENOENT
```

### Cause

SOPS is not installed or not in your PATH.

### Solution

#### macOS

```bash
brew install sops
```

#### Windows (winget)

```bash
winget install sops
```

#### Windows (scoop)

```bash
scoop install sops
```

#### Linux

```bash
# Download latest release
curl -LO https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64

# Move to PATH
sudo mv sops-v3.8.1.linux.amd64 /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops
```

#### Verify Installation

```bash
sops --version
# Should output: sops 3.x.x
```

---

## age not found

### Error Message

```
Error: age-keygen: command not found
Error: Failed to generate age key
```

### Cause

age is not installed or not in your PATH.

### Solution

#### macOS

```bash
brew install age
```

#### Windows (winget)

```bash
winget install age
```

#### Windows (scoop)

```bash
scoop install age
```

#### Linux

```bash
# Download latest release
curl -LO https://github.com/FiloSottile/age/releases/download/v1.1.1/age-v1.1.1-linux-amd64.tar.gz

# Extract and install
tar -xzf age-v1.1.1-linux-amd64.tar.gz
sudo mv age/age /usr/local/bin/
sudo mv age/age-keygen /usr/local/bin/
sudo chmod +x /usr/local/bin/age /usr/local/bin/age-keygen
```

#### Verify Installation

```bash
age --version
# Should output: age 1.x.x

age-keygen --version
# Should output: age-keygen 1.x.x
```

---

## Permission denied

### Error Message

```
Error: EACCES: permission denied, open '/path/to/file'
Error: Failed to write secrets: permission denied
```

### Cause

Insufficient file system permissions.

### Solution

#### Check File Permissions

```bash
# Check current permissions
ls -la secrets/
ls -la gev.config.json
ls -la gev.policy.json
```

#### Fix Permissions

```bash
# Fix directory permissions
chmod 755 secrets/

# Fix file permissions
chmod 644 secrets/**/*.sops.yaml
chmod 644 gev.config.json gev.policy.json
```

#### Fix Ownership (if needed)

```bash
# Take ownership
sudo chown -R $USER:$USER secrets/
sudo chown $USER:$USER gev.config.json gev.policy.json
```

#### Check for Lock Files

```bash
# Remove stale lock files
rm -f secrets/*.lock
rm -f .gev.lock
```

---

## Policy invalid

### Error Message

```
Error: Invalid policy: missing signature
Error: Policy signature verification failed
Error: Policy version mismatch
```

### Cause

Policy file is corrupted, tampered with, or improperly modified.

### Solution

#### Check Policy Structure

```bash
# View policy file
cat gev.policy.json | jq .

# Check for required fields
jq 'keys' gev.policy.json
# Should contain: version, environments, signature
```

#### Verify Signature

```bash
gev ci-verify
```

#### Regenerate Signature (Admin only)

If you have the master admin key:

```bash
# Re-sign the policy
gev sign-policy
```

#### Restore from Git

```bash
# Check history
git log -- gev.policy.json

# Restore last known good version
git checkout HEAD~1 -- gev.policy.json
```

#### Reset Policy (Last resort)

```bash
# This will remove all recipients!
# Backup first
cp gev.policy.json gev.policy.json.bak

# Reinitialize
gev init --force
```

---

## Decryption failed

### Error Message

```
Error: Failed to decrypt: no matching identity found
Error: sops: error decrypting: no identity matched any of the file's recipients
Error: Cannot decrypt: age identity not in recipients list
```

### Cause

Your age key is not in the recipients list for this secret.

### Solution

#### Verify Your Public Key

```bash
# Show your public key
cat ~/.config/sops/age/keys.txt | grep "public key:" | awk '{print $3}'
```

#### Check Recipients

```bash
# Check if you're in the policy
cat gev.policy.json | jq '.environments.dev.services.api.recipients'
```

#### Request Access

Ask an administrator to add your public key:

```bash
# Admin runs:
gev grant --env <env> --service <service> --recipient age1yourpublickey...
```

#### Verify SOPS_AGE_KEY (CI)

For CI environments:

```bash
# Check if env var is set
echo $SOPS_AGE_KEY | head -c 20

# Should output something like:
# # created: 2024-01-01...
```

---

## No age key configured

### Error Message

```
Error: No age identity found
Error: SOPS_AGE_KEY not set
Error: age key file not found at ~/.config/sops/age/keys.txt
```

### Cause

age key not generated or not accessible.

### Solution

#### Generate New Key

```bash
# Create directory
mkdir -p ~/.config/sops/age

# Generate key
age-keygen -o ~/.config/sops/age/keys.txt

# Set permissions
chmod 600 ~/.config/sops/age/keys.txt
```

#### Verify Key File

```bash
cat ~/.config/sops/age/keys.txt
# Should show:
# # created: YYYY-MM-DD...
# # public key: age1...
# AGE-SECRET-KEY-...
```

#### For CI Environments

Set the `SOPS_AGE_KEY` environment variable:

```yaml
# GitHub Actions
env:
  SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}

# GitLab CI
variables:
  SOPS_AGE_KEY: $CI_SOPS_AGE_KEY
```

---

## Configuration errors

### Error Message

```
Error: Invalid gev.config.json: missing required field "services"
Error: Service "api" not found in config
Error: Environment "staging" not found in policy
```

### Cause

Configuration file is malformed or inconsistent.

### Solution

#### Validate Config Structure

```bash
# Check config
cat gev.config.json | jq .

# Required fields
jq 'keys' gev.config.json
# Should contain: version, services, secretsDir
```

#### Check Service Mapping

```bash
# List services
jq '.services | keys' gev.config.json
```

#### Check Environment Exists

```bash
# List environments
jq '.environments | keys' gev.policy.json
```

#### Regenerate Config

```bash
# Backup
cp gev.config.json gev.config.json.bak

# Reinitialize
gev init --force
```

---

## Git-related issues

### Error Message

```
Error: Not a git repository
Error: Git worktree detected
Error: Uncommitted changes detected
```

### Cause

Git repository is in unexpected state.

### Solution

#### Initialize Git

```bash
git init
git add .
git commit -m "Initial commit"
```

#### Check Status

```bash
git status
```

#### Commit or Stash Changes

```bash
# Commit changes
git add -A
git commit -m "WIP"

# Or stash
git stash
```

---

## CI/CD issues

### Error Message

```
Error: SOPS_AGE_KEY is not set
Error: CI verification failed
Error: Policy signature invalid in CI
```

### Cause

Missing or incorrect CI configuration.

### Solution

#### GitHub Actions

```yaml
# .github/workflows/deploy.yml
- name: Pull secrets
  run: gev pull --env prod --no-write
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
deploy:
  script:
    - gev pull --env prod --no-write
  variables:
    SOPS_AGE_KEY: $CI_SOPS_AGE_KEY
```

#### Verify CI Secret

Ensure the `SOPS_AGE_KEY` secret is set correctly:

1. Copy your age private key content
2. Add as a secret in your CI platform
3. Ensure no extra whitespace or newlines

#### Debug CI Issues

```bash
# Run locally with CI key
SOPS_AGE_KEY="$(cat ~/.config/sops/age/keys.txt)" gev pull --env prod --dry-run
```

---

## TUI issues

### Error Message

```
Error: Terminal not interactive
Error: TUI not supported in this environment
```

### Cause

TUI requires an interactive terminal.

### Solution

#### Use CLI Commands

Non-interactive environments should use CLI commands:

```bash
# Instead of: gev tui
gev pull --env dev

# Instead of: gev (default TUI)
gev pull --env dev --service api
```

#### Force Interactive Mode

```bash
# Force TTY allocation (SSH)
ssh -t user@host "gev tui"

# Docker with TTY
docker run -it ... gev tui
```

---

## Performance Issues

### Large Monorepo Slow

```bash
# Use specific environment/service
gev pull --env dev --service api

# Instead of pulling everything
gev pull --env dev  # Pulls all services
```

### Many Recipients

```bash
# Check number of recipients
jq '[.environments[].services[].recipients | length] | add' gev.policy.json

# Consider grouping if too many
```

---

## Getting Help

### Run Diagnostics

```bash
gev doctor --verbose
```

### Enable Debug Logging

```bash
DEBUG=gev:* gev pull --env dev
```

### Check Logs

```bash
# Look for error details
gev pull --env dev 2>&1 | tee gev-debug.log
```

### Ask for Help

1. [Troubleshooting Guide](docs/TROUBLESHOOTING.md) (this document)
2. [GitHub Issues](https://github.com/pas7-studio/git-env-vault/issues)
3. [GitHub Discussions](https://github.com/pas7-studio/git-env-vault/discussions)
4. Email: [support@pas7.com.ua](mailto:support@pas7.com.ua)

---

## Common Commands Reference

| Task | Command |
|------|---------|
| Diagnose issues | `gev doctor` |
| Check SOPS version | `sops --version` |
| Check age version | `age --version` |
| View your public key | `cat ~/.config/sops/age/keys.txt \| grep "public key:"` |
| Verify policy | `gev ci-verify` |
| Check config | `cat gev.config.json \| jq .` |
| Check policy | `cat gev.policy.json \| jq .` |
| Test decryption | `gev pull --env dev --dry-run` |

---

*Still having issues? [Open an issue](https://github.com/pas7-studio/git-env-vault/issues/new?template=bug_report.yml) with your `gev doctor` output.*
