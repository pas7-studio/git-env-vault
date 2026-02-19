# CLI Reference

This document describes all available `envvault` CLI commands.

## Global usage

```bash
envvault [command] [options]
```

Common flags:

- `-h, --help`
- `-V, --version`

When run without arguments, `envvault` starts `tui` mode.

## Core commands

### `envvault init`

Initialize envvault in the current repository.

```bash
envvault init [--secrets-dir <dir>]
```

Options:

- `--secrets-dir <dir>`: directory for encrypted files (default: `secrets`).

### `envvault pull`

Decrypt service secrets and write local `.env` output files.

```bash
envvault pull --env <env> [options]
```

Options:

- `--service <service>`: only one service.
- `--dry-run`: print planned actions without writing.
- `--no-write`: validate/decrypt only.
- `--strict`: fail when schema required keys are missing.
- `--backup`: create backup for overwritten `.env` files.
- `--show-diff`: show safe key-level diff.

### `envvault edit`

Edit a service secret file in your editor.

```bash
envvault edit --env <env> --service <service> [options]
```

Options:

- `--editor <editor>`: editor binary (default from `$EDITOR` / `$VISUAL`).
- `--unsafe-show-values`: show value-level diff (use with caution).
- `--no-commit`: skip auto-commit.

### `envvault set`

Set one or more key/value pairs.

```bash
envvault set --env <env> --service <service> KEY=VALUE [KEY=VALUE ...] [options]
```

Options:

- `--unsafe-show-values`: show value-level diff.
- `--no-commit`: skip auto-commit.

### `envvault doctor`

Run environment diagnostics (SOPS, age key variables, Git, config).

```bash
envvault doctor
```

### `envvault ci-verify`

Validate policy/signature and encryption state for CI.

```bash
envvault ci-verify [--allow-unsigned]
```

Options:

- `--allow-unsigned`: do not fail if policy signature is missing.

## Access control

### `envvault grant`

Grant recipient access to one environment/service.

```bash
envvault grant --env <env> --service <service> --recipient <age-public-key> [--no-commit]
```

### `envvault revoke`

Revoke recipient access from one environment/service.

```bash
envvault revoke --env <env> --service <service> --recipient <age-public-key> [--no-commit]
```

### `envvault updatekeys`

Rewrite `.sops.yaml` from policy and update recipients in encrypted files.

```bash
envvault updatekeys [--env <env>] [--service <service>] [--no-commit]
```

### `envvault rotate`

Rotate the data encryption key for one environment (optionally service-scoped).

```bash
envvault rotate --env <env> [--service <service>] [--no-commit]
```

## Local overrides

### `envvault promote`

Promote one local override key into shared encrypted secrets.

```bash
envvault promote --env <env> --service <service> --key <key> [--commit]
```

### `envvault promote-all`

Promote all local override keys for one environment/service.

```bash
envvault promote-all --env <env> --service <service> [--commit]
```

## Hooks

### `envvault hooks install`

```bash
envvault hooks install [--type pre-push|pre-commit]
```

### `envvault hooks uninstall`

```bash
envvault hooks uninstall [--type pre-push|pre-commit]
```

### `envvault hooks status`

```bash
envvault hooks status
```

## Project helpers

### `envvault wizard`

Auto-detect project services and generate config/schema drafts.

```bash
envvault wizard
```

### `envvault up`

Verify environment, pull secrets, then run `docker compose up`.

```bash
envvault up --env <env> [options]
```

Options:

- `-f, --compose-file <files...>`
- `--no-build`
- `--no-detach`
- `--dry-run`
- `-v, --verbose`

### `envvault tui`

Start interactive terminal UI.

```bash
envvault tui
```

## Examples

```bash
# initialize
envvault init

# grant recipient
envvault grant --env dev --service api --recipient age1alice...

# edit secrets
envvault edit --env dev --service api

# pull secrets
envvault pull --env dev --show-diff

# CI check
envvault ci-verify --allow-unsigned
```

## See also

- [Getting Started](./GETTING-STARTED.md)
- [Configuration](./CONFIGURATION.md)
- [Workflows](./WORKFLOWS.md)
- [Security Guide](./SECURITY-GUIDE.md)
