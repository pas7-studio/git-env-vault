# Security Model

This document provides a detailed explanation of the security model behind `@pas7/git-env-vault`.

## Overview

`git-env-vault` provides secure secret management through:

1. **Encryption at rest** — Secrets stored encrypted in Git
2. **Access control** — Fine-grained permissions per environment/service
3. **Integrity verification** — Cryptographic signatures on policies
4. **Audit trail** — All changes tracked in Git history

---

## Encryption

### SOPS (Secrets OPerationS)

We use [SOPS](https://github.com/getsops/sops) for encrypting secret values:

- **Industry standard** — Used by Mozilla, Shopify, and thousands of organizations
- **Selective encryption** — Only values encrypted, keys remain readable
- **Multiple key types** — Supports age, GPG, KMS, cloud key management

### age Encryption

We use [age](https://github.com/FiloSottile/age) for asymmetric encryption:

- **Modern design** — Built by a Go security team member
- **Simple and secure** — No complex keyrings or configuration
- **X25519** — Uses Curve25519 for key exchange
- **ChaCha20-Poly1305** — Authenticated encryption

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECRET ENCRYPTION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User runs: gev edit --env dev --service api                 │
│                                                                 │
│  2. Editor opens with decrypted values (in temp file)           │
│                                                                 │
│  3. On save, SOPS encrypts:                                     │
│     - Generates random data key                                 │
│     - Encrypts data key with each recipient's age public key    │
│     - Encrypts each value with the data key                     │
│                                                                 │
│  4. Encrypted file stored:                                      │
│     - Keys in plaintext (readable)                              │
│     - Values encrypted (base64 encoded)                         │
│     - Metadata contains encrypted data keys                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Encrypted File Structure

```yaml
# secrets/dev/api.sops.yaml
DATABASE_URL: ENC[AES256_GCM,data:abc123...,tag:xyz==,type:str]
API_KEY: ENC[AES256_GCM,data:def456...,tag:uvw==,type:str]
sops:
  kms: []
  gcp_kms: []
  azure_kv: []
  hc_vault: []
  age:
    - recipient: age1alice...
      enc: |
        -----BEGIN AGE ENCRYPTED FILE-----
        ...
        -----END AGE ENCRYPTED FILE-----
    - recipient: age1bob...
      enc: |
        -----BEGIN AGE ENCRYPTED FILE-----
        ...
        -----END AGE ENCRYPTED FILE-----
  lastmodified: "2024-01-15T10:30:00Z"
  mac: ENC[AES256_GCM,data:signature...,type:str]
  pgp: []
  encrypted_regex: ^(DATABASE_URL|API_KEY)$
  version: 3.8.1
```

---

## Access Control

### Policy File

The `gev.policy.json` file defines who can access which secrets:

```json
{
  "version": 1,
  "environments": {
    "dev": {
      "services": {
        "api": {
          "recipients": [
            "age1alicezyxwvutsrqponmlkjihgfedcba1234567890",
            "age1bobzyxwvutsrqponmlkjihgfedcba0987654321"
          ]
        },
        "worker": {
          "recipients": [
            "age1alicezyxwvutsrqponmlkjihgfedcba1234567890"
          ]
        }
      }
    },
    "prod": {
      "services": {
        "api": {
          "recipients": [
            "age1leadzyxwvutsrqponmlkjihgfedcba5678901234"
          ]
        }
      }
    }
  },
  "signature": "..."
}
```

### Permission Model

| Permission | Description |
|------------|-------------|
| **Decrypt** | User can decrypt secrets for their assigned services |
| **Encrypt** | User with decrypt access can also encrypt (modify secrets) |
| **Grant** | Admin only — Add recipients to policy |
| **Revoke** | Admin only — Remove recipients from policy |
| **Rotate** | Admin only — Re-encrypt with new data key |

### Granting Access

```bash
gev grant --env dev --service api --recipient age1newuser...
```

This:
1. Adds the recipient to the policy
2. Re-signs the policy with the master admin key
3. Re-encrypts all secrets in `dev/api` with the new recipient's key

### Revoking Access

```bash
gev revoke --env dev --service api --recipient age1olduser...
gev rotate --env dev --service api
```

This:
1. Removes the recipient from the policy
2. Re-signs the policy
3. Generates a new data key
4. Re-encrypts all secrets with only remaining recipients

**Critical:** Without rotation, revoked users can still decrypt old commits!

---

## Policy Signing

### Master Admin Key

The master admin key (ed25519) ensures policy integrity:

- **Private key** — Kept secure by administrators
- **Public key** — Stored in project for verification
- **Signature** — Every policy change is signed

### Signature Verification

```bash
gev ci-verify
```

This verifies:
1. Policy signature matches the master admin key
2. All secret files have valid SOPS metadata
3. Recipients in secrets match policy

### Signature Format

The signature in `gev.policy.json` is an ed25519 signature over the canonical JSON:

```
signature = ed25519_sign(privateKey, canonicalJson(policy))
```

Canonical JSON rules:
- No whitespace
- Sorted keys
- No trailing commas
- UTF-8 encoding

---

## Revocation and Rotation

### When to Rotate

Rotate secrets immediately when:
- A team member leaves
- A private key is compromised
- Access patterns change significantly

### Rotation Process

```bash
# 1. Revoke access
gev revoke --env prod --service api --recipient age1...

# 2. Rotate encryption
gev rotate --env prod --service api

# 3. Commit changes
git add secrets/ gev.policy.json
git commit -m "security: revoke access and rotate prod/api secrets"
```

### What Rotation Does

```
┌─────────────────────────────────────────────────────────────────┐
│                      KEY ROTATION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Before:                                                        │
│  ┌─────────────────┐                                            │
│  │ Encrypted Data  │◄─── Data Key #1                           │
│  └─────────────────┘     │                                      │
│                          ├─── age1alice (still has access)      │
│                          └─── age1bob (revoked!)                │
│                                                                 │
│  After:                                                         │
│  ┌─────────────────┐                                            │
│  │ Encrypted Data  │◄─── Data Key #2 (NEW!)                    │
│  └─────────────────┘     │                                      │
│                          └─── age1alice (only remaining)        │
│                                                                 │
│  age1bob can no longer decrypt!                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Audit Trail

### Git History

All changes are tracked in Git:

```bash
# View policy changes
git log -- gev.policy.json

# View secret changes (encrypted)
git log -- secrets/dev/api.sops.yaml
```

### Safe Diff

`git-env-vault` never shows secret values in diffs:

```bash
gev pull --env dev --dry-run
```

```
Changes:
  + NEW_API_KEY
  - OLD_DATABASE_URL
  ~ UPDATED_SECRET
```

Values require explicit `--unsafe-show-values` flag.

### CI Verification

```yaml
# .github/workflows/deploy.yml
- name: Verify policy integrity
  run: gev ci-verify
```

This ensures:
- Policy hasn't been tampered with
- All required signatures are valid
- Secret files are properly encrypted

---

## Security Considerations

### What We Protect Against

| Threat | Mitigation |
|--------|------------|
| Repository compromise | Encrypted secrets, no plaintext in Git |
| Unauthorized access | age encryption, per-service recipients |
| Policy tampering | ed25519 signatures, CI verification |
| Insider threat | Fine-grained access control |
| Key compromise | Revocation + rotation workflow |
| Secret exposure in logs | Safe-by-default output |

### What We Do NOT Protect Against

| Threat | Mitigation |
|--------|------------|
| Compromised developer machine | Protect your age private key! |
| CI secret injection | Secure your CI secrets |
| Memory dumps during use | Use ephemeral environments |
| Social engineering | Train your team |

### Best Practices

#### For Developers

1. **Protect your age key** — Never commit `keys.txt` to Git
2. **Use strong passwords** — If your age key is password-protected
3. **Report incidents** — If your key is compromised, notify admin immediately
4. **Verify commits** — Check policy changes before pulling

#### For Administrators

1. **Secure the master key** — Store offline, multiple backups
2. **Principle of least privilege** — Grant minimum required access
3. **Regular audits** — Review policy and access logs periodically
4. **Rotation schedule** — Consider regular rotation for production secrets
5. **CI isolation** — Use separate CI keys per environment

#### For CI/CD

1. **Secure secrets** — Never log `SOPS_AGE_KEY`
2. **Ephemeral keys** — Rotate CI keys regularly
3. **Verify policies** — Run `gev ci-verify` before deployment
4. **Limit access** — Production secrets in separate pipelines

---

## Threat Model

### Assumptions

- Git repository may be public or compromised
- Developer machines are trusted (keys are protected)
- CI/CD systems are trusted (secrets are protected)
- Network communication is not trusted

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  TRUSTED ZONE                                                   │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ Developer       │  │ CI/CD           │                      │
│  │ Machine         │  │ Runner          │                      │
│  │ (age key)       │  │ (SOPS_AGE_KEY)  │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Encrypted traffic
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  UNTRUSTED ZONE                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ Git Repository  │  │ Network         │                      │
│  │ (encrypted)     │  │ (passive)       │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Attack Scenarios

| Attack | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Git repo breached | Medium | Low | Encrypted secrets |
| Private key stolen | Low | High | Revoke + rotate |
| Policy tampered | Low | High | Signature verification |
| MITM on clone | Low | Low | Encrypted content |

---

## Compliance

### SOC 2 Type II

git-env-vault supports SOC 2 compliance:
- **Encryption at rest** — CC6.1
- **Access control** — CC6.1, CC6.2
- **Audit logging** — CC7.2
- **Key management** — CC6.1

### GDPR

For handling personal data in secrets:
- **Data minimization** — Only encrypt what's needed
- **Access control** — Need-to-know basis
- **Audit trail** — Track who accessed what

### PCI DSS

For payment card data:
- **Encryption** — Strong cryptography (SOPS + age)
- **Key management** — Secure key storage and rotation
- **Access control** — Limit access to cardholder data

---

## Summary

`git-env-vault` provides enterprise-grade secret management with:

1. **Strong encryption** — SOPS + age, industry-standard
2. **Fine-grained access** — Per environment, per service
3. **Integrity verification** — Signed policies, CI checks
4. **Safe operations** — No secret exposure in logs/diffs
5. **Audit capability** — Git history, access tracking

For questions or security concerns, contact [security@pas7.com.ua](mailto:security@pas7.com.ua).
