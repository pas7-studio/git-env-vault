# LLM.md

Guidance file for Large Language Models (LLMs) working with this repository.

## Goals

When helping users with this project, you should:

1. **Help with CLI usage** — Explain `gev` commands and options
2. **Debug configuration issues** — Help diagnose config/policy problems
3. **Explain concepts** — Describe SOPS, age, encryption, access control
4. **Suggest workflows** — Recommend best practices for team secret management
5. **Write documentation** — Help improve docs, README, comments
6. **Review code** — Identify bugs, security issues, code smells

## Non-Goals

Do NOT:

1. **Print secret values** — Never output, log, or display secret values
2. **Modify policy without understanding** — Don't suggest policy changes that could compromise security
3. **Generate private keys** — Never generate or suggest age private keys
4. **Bypass security** — Don't suggest workarounds that defeat security features
5. **Modify source code** — This is a documentation/config-only context

## Invariants

These rules must ALWAYS be followed:

1. **No secret values in output** — Use placeholders like `***`, `<REDACTED>`, or `your-secret-here`
2. **No private keys in examples** — Use fake keys like `age1...` or `AGE-SECRET-KEY-...`
3. **Preserve `.gitignore` entries** — Ensure age keys are never committed
4. **Validate policy changes** — Any policy modification requires signature discussion
5. **Safe defaults** — Always prefer safe-by-default behavior

## Project Context

### Package Info

- **Name:** `@pas7/git-env-vault`
- **CLI:** `gev`
- **Repo:** `pas7-studio/git-env-vault`
- **Node:** 20+

### Key Files

| File | Purpose |
|------|---------|
| `gev.config.json` | Service-to-env mapping |
| `gev.policy.json` | Access control (signed) |
| `.sops.yaml` | SOPS configuration |
| `secrets/**/*.sops.yaml` | Encrypted secrets |

### Commands

```bash
gev init              # Initialize project
gev doctor            # Diagnose environment
gev grant --env <e> --service <s> --recipient <key>  # Add access
gev revoke --env <e> --service <s> --recipient <key> # Remove access
gev edit --env <e> --service <s>                     # Edit secrets
gev pull --env <e>               # Decrypt to .env
gev tui                          # Interactive mode
gev ci-verify                    # CI validation
```

### Security Model

1. **Encryption:** SOPS encrypts values, age manages keys
2. **Access Control:** Policy defines who can decrypt what
3. **Integrity:** Policy signed with master admin key (ed25519)
4. **Safe Output:** Diff never shows secret values

## How to Run

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# E2E tests (requires sops + age)
npm run test:e2e

# Lint
npm run lint

# Run CLI locally
node dist/cli/index.js --help
```

## Example Responses

### Good: Explaining without secrets

```
To add a database URL to your dev environment:

1. Run: gev edit --env dev --service api
2. Add: DATABASE_URL=postgres://user:pass@host:5432/db
3. Save and close your editor

The value will be encrypted automatically.
```

### Bad: Showing secrets

```
❌ Don't do this:
Your secret is: postgres://admin:s3cr3t@db.example.com:5432/prod
```

### Good: Safe placeholder

```
✅ Do this instead:
Your DATABASE_URL has been set. Run `gev pull --env dev` to decrypt.
```

## Common Tasks

### Diagnose Issues

1. Run `gev doctor` first
2. Check SOPS installation: `sops --version`
3. Check age installation: `age --version`
4. Verify SOPS_AGE_KEY environment variable

### Add New User

1. User generates key: `age-keygen -o ~/.config/sops/age/keys.txt`
2. User shares public key (starts with `age1...`)
3. Admin runs: `gev grant --env <env> --service <svc> --recipient age1...`

### Revoke Access

1. Admin runs: `gev revoke --env <env> --service <svc> --recipient age1...`
2. Admin runs: `gev rotate --env <env> --service <svc>`
3. Old key can no longer decrypt

---

*This file guides LLMs to work safely with this secrets management tool.*
