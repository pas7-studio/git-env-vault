# Architecture Security Model

Technical security model for `git-env-vault`.

## Security assumptions

- SOPS and age binaries are trusted and correctly installed.
- Repository access controls are managed by Git hosting platform.
- Private age keys are protected by the key owner.

## Trust boundaries

- Secret plaintext is local-only and transient during operations.
- Encrypted secret files are safe to commit.
- Access policy controls recipient membership per env/service.
- CI verifies policy and encryption integrity before deployment.

## Encryption design

- Secret values are encrypted by SOPS.
- Recipient public keys (`age1...`) define who can decrypt.
- Recipient changes are propagated via `updatekeys`/`grant`/`revoke`.
- Data-key rotation uses `rotate` to invalidate prior encryption state.

## Policy integrity

Optional signed-policy mode provides tamper detection.

- Policy signature is validated by `ci-verify`.
- Public verification key is stored in repo.
- Private signing key must remain outside the repo.

## Safe output policy

Default command output must avoid leaking secret values.

- Diffs should show key names and change types.
- Value display should require explicit unsafe flag.

## Plaintext handling

- Plaintext `.env` files should be gitignored.
- Temporary files should be short-lived and cleaned.
- File writes should be atomic to avoid partial-state leaks.

## Revocation model

Revocation is two-step for strong effect:

1. Remove recipient from policy (`revoke`).
2. Rotate data key (`rotate`) for affected scope.

This limits access to previously shared encrypted material.

## CI enforcement

Recommended required checks on protected branches:

- `envvault ci-verify`
- tests and lint

`ci-verify` should fail on:

- invalid/missing required policy signature
- policy and `.sops.yaml` mismatch
- unencrypted secret files
- plaintext `.env` files in repository

## Incident response baseline

- compromised developer key: revoke + rotate affected scopes
- compromised CI key: revoke CI recipient + rotate + replace CI secret
- suspected policy tampering: block deployment until verified and remediated

## Out of scope

- host-level compromise on developer workstation
- compromised upstream binaries or supply chain attacks
- memory forensics during local plaintext processing

## Recommended controls

- short-lived least-privilege recipients
- separate keys for dev/prod/CI/admin
- mandatory peer review for policy changes
- routine access audits and periodic rotation
