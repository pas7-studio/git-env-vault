# Security Policy

## Supported Versions

We actively support the following versions of `@pas7/git-env-vault` with security updates:

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅ Active development |
| < 0.1   | ❌ Not supported |

As we approach a stable 1.0 release, we will establish a formal LTS support policy.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them through one of the following channels:

- **Email:** [security@pas7.com.ua](mailto:security@pas7.com.ua)
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/pas7-studio/git-env-vault/security/advisories/new)

### What to include in your report

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** of the vulnerability
4. **Suggested fix** (if any)
5. Your **contact information** for follow-up

### Response timeline

- **Initial response:** Within 48 hours
- **Triage and assessment:** Within 7 days
- **Fix development:** Depends on severity and complexity
- **Disclosure:** After fix is released, following coordinated disclosure

## Security Model Overview

### Encryption

`git-env-vault` uses industry-standard encryption tools:

- **SOPS (Secrets OPerationS)** — Encrypts secret values while keeping keys readable
- **age** — Modern, secure asymmetric encryption for key management
- **ed25519** — Digital signatures for policy verification

### Key Management

- Each user/CI system has their own **age keypair**
- Public keys (`age1...`) are stored in the policy file
- Private keys never leave the user's machine
- Master admin key signs all policy changes

### Access Control

- **Policy-based access** defines which users can decrypt which secrets
- **Per-environment, per-service** granularity
- **Signed policies** prevent unauthorized modifications
- Access can be **revoked** with automatic key rotation

### Safe by Default

- Diff output **never shows secret values**
- Policy changes require **signature verification**
- CI mode verifies policy integrity before deployment
- No secrets in logs, errors, or debug output

### Audit Trail

- All changes are tracked in Git history
- Policy changes are signed and verifiable
- `gev ci-verify` validates integrity in CI pipelines

## Best Practices

### For Users

1. **Never commit your private age key** to the repository
2. **Use `gev doctor`** to verify your setup
3. **Rotate keys** immediately when someone leaves the team
4. **Review policy changes** before merging PRs

### For CI/CD

1. Store `SOPS_AGE_KEY` as a **secure secret** in your CI platform
2. Use `gev ci-verify` to **validate policies** before deployment
3. **Limit access** to production secrets in CI

### For Administrators

1. **Protect the master admin key** — it controls policy integrity
2. **Review grant requests** before adding new recipients
3. **Monitor Git history** for unusual policy changes
4. **Document your access control** policies internally

## Security Considerations

### What this tool does

- Encrypts secrets at rest in your Git repository
- Manages access control through age recipients
- Provides audit trail through Git history
- Enables safe secret rotation

### What this tool does NOT do

- Replace a full secrets management system (Vault, etc.)
- Provide runtime secret injection
- Manage secrets across multiple repositories
- Protect against compromised age keys

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized decryption | age encryption + policy control |
| Policy tampering | ed25519 signatures |
| Insider threat | Per-service access control |
| Key compromise | Revoke + rotate workflow |
| Secret exposure in logs | Safe-by-default output |

## Disclosure Policy

We follow **coordinated disclosure**:

1. Report received and acknowledged
2. Vulnerability confirmed and assessed
3. Fix developed and tested privately
4. Security advisory prepared
5. Fix released and advisory published
6. CVE requested (if applicable)

## Contact

For security concerns, contact:

- **Email:** [security@pas7.com.ua](mailto:security@pas7.com.ua)
- **PGP Key:** Available upon request
