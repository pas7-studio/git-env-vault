# Security Guide

Practical security guidance for teams using `git-env-vault`.

## Security model at a glance

- Secret values are encrypted with SOPS.
- Access is controlled by age recipients.
- Policy can be signed and verified in CI.
- CLI output is safe-by-default (no secret values in normal diff output).

## Core principles

- Defense in depth: encryption + policy + CI checks.
- Least privilege: grant only required env/service access.
- Explicit revocation: remove recipients and rotate when needed.
- Key hygiene: private keys never leave secure storage.

## Age key management

### Generate key pair

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

### Public vs private

- Public key: starts with `age1...`, safe to share with admins.
- Private key: starts with `AGE-SECRET-KEY-`, must stay private.

### Do not

- Commit private keys to Git.
- Paste private keys in chat or issue trackers.
- Store private keys in shared plaintext storage.

### Recommended

```bash
chmod 600 ~/.config/sops/age/keys.txt
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
```

Use dedicated keys for:

- personal development,
- CI automation,
- privileged admin tasks.

## Policy signing

Signing prevents unnoticed policy tampering.

Recommended in production:

- Store signing private key outside repository.
- Commit only signature and public verification key.
- Run `envvault ci-verify` on every protected branch.

If policy is unsigned, use `--allow-unsigned` only temporarily.

## Rotation strategy

### When to rotate

- Employee offboarding with prior access.
- Suspected key compromise.
- Scheduled periodic rotation for sensitive environments.

### Operational sequence

```bash
# 1) remove recipient from policy
envvault revoke --env prod --service api --recipient age1old...

# 2) rotate data key
envvault rotate --env prod --service api

# 3) ensure recipients are synced
envvault updatekeys
```

## CI hardening

Recommended CI checks:

```bash
envvault ci-verify
```

This should fail the pipeline on:

- invalid or missing required policy signature,
- `.sops.yaml` mismatch,
- unencrypted secret files,
- plaintext `.env` files in repository.

## Git hooks

Add local safeguards before push/commit:

```bash
envvault hooks install --type pre-push
envvault hooks status
```

## Incident response playbooks

### Scenario A: developer private key leaked

```bash
envvault revoke --env dev --service api --recipient age1compromised...
envvault rotate --env dev --service api
envvault updatekeys
```

Then notify team to refresh:

```bash
git pull && envvault pull --env dev
```

### Scenario B: CI key leaked

- Revoke CI recipient everywhere it is used.
- Rotate affected environments/services.
- Generate and register a new CI key.
- Update CI secret storage immediately.

### Scenario C: policy tampering detected

- Block merge/deploy until investigation is complete.
- Verify policy signature history and reviewer trail.
- Re-issue signing key only if compromise is confirmed.

## Security checklist

- SOPS and age installed from trusted sources.
- Private age keys stored securely with restricted permissions.
- Access policy follows least privilege.
- CI runs `envvault ci-verify` on every change.
- Revocation process includes rotation for sensitive cases.
- Plaintext `.env` files are ignored and not committed.

## See also

- [Security Model](./SECURITY-MODEL.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
