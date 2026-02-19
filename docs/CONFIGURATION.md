# Configuration

This document explains the main `git-env-vault` configuration files.

## File overview

```text
project/
|- envvault.config.json      # service mapping + output targets
|- envvault.policy.json      # who can decrypt what
|- envvault.schema.yaml      # optional key validation rules
|- .sops.yaml                # generated SOPS creation rules
|- envvault.policy.sig       # optional policy signature
|- envvault.master.pub       # optional public key for policy verify
`- secrets/
   |- dev/
   |  `- api.sops.yaml
   `- prod/
      `- api.sops.yaml
```

## `envvault.config.json`

Defines services and where decrypted files are written.

Example:

```json
{
  "version": 1,
  "secretsDir": "secrets",
  "services": {
    "api": { "envOutput": "apps/api/.env" },
    "worker": { "envOutput": "apps/worker/.env" }
  },
  "repo": {
    "name": "my-repo-id"
  }
}
```

Fields:

- `version` (number, required): format version (`1`).
- `secretsDir` (string, required): encrypted secrets root.
- `services` (object, required): service map.
- `services.<name>.envOutput` (string, required): output `.env` path.
- `repo.name` (string, optional): stable repo id for local overrides.

## `envvault.policy.json`

Defines recipients per environment/service.

Example:

```json
{
  "version": 1,
  "environments": {
    "dev": {
      "services": {
        "api": {
          "recipients": [
            "age1alice...",
            "age1bob..."
          ]
        }
      }
    },
    "prod": {
      "services": {
        "api": {
          "recipients": [
            "age1lead...",
            "age1ci..."
          ]
        }
      }
    }
  }
}
```

Notes:

- Keep recipient lists minimal.
- Use separate keys for CI and humans.
- For revocation, run `revoke` then `rotate`.

## `.sops.yaml`

Generated rules file used by SOPS encryption/decryption.

- Generated or updated by `grant`, `revoke`, and `updatekeys`.
- Should always match `envvault.policy.json`.
- CI can enforce consistency via `envvault ci-verify`.

## `envvault.schema.yaml` (optional)

Schema validates required/optional keys during `pull`.

Example:

```yaml
version: 1
services:
  api:
    required:
      - DATABASE_URL
      - JWT_SECRET
    optional:
      - REDIS_URL
```

Use strict validation:

```bash
envvault pull --env dev --strict
```

## Secret file format

Each encrypted file is typically:

```text
secrets/<env>/<service>.sops.yaml
```

The decrypted content is key/value env data, and SOPS stores metadata in `sops` block.

## Local overrides

Local override data is separate from shared encrypted secrets and can be promoted:

- `envvault promote --env <env> --service <svc> --key <key>`
- `envvault promote-all --env <env> --service <svc>`

## Recommended `.gitignore`

Make sure these are ignored:

```gitignore
.env
.env.*
!.env.example
.envvault/
.envvault.master.key
```

## Validation checklist

- `envvault.config.json` exists and services are correct.
- `envvault.policy.json` includes only intended recipients.
- `.sops.yaml` is in sync.
- `secrets/<env>/<service>.sops.yaml` files are encrypted.
- `envvault ci-verify` passes in CI.

## See also

- [Getting Started](./GETTING-STARTED.md)
- [CLI Reference](./CLI-REFERENCE.md)
- [Security Guide](./SECURITY-GUIDE.md)
