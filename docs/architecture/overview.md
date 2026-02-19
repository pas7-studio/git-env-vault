# Architecture Overview

This document provides a high-level map of `git-env-vault` architecture.

## Goals

- Keep secrets encrypted at rest in Git.
- Enforce recipient-based access control per environment/service.
- Provide safe and practical developer workflows (CLI + TUI).
- Support CI verification for policy and encryption integrity.

## Top-level components

- `src/cli`: command interface and user-facing flows.
- `src/core`: reusable domain logic (config, policy, SOPS, git, env files, filesystem safety).
- `src/tui`: interactive terminal UX built on top of core operations.
- `test/*`: unit, integration, and e2e test suites.

## Core runtime flow

1. Load config and policy.
2. Resolve target environment/service.
3. Decrypt with SOPS when needed.
4. Apply requested operation (edit, set, pull, grant, revoke, rotate, etc.).
5. Re-encrypt and persist atomically.
6. Optionally commit changes.

## Security boundaries

- Cryptography is delegated to SOPS/age.
- Policy controls recipients, not secret plaintext.
- CLI output avoids exposing secret values by default.
- CI verifies policy/signature and encryption state.

## Developer interfaces

- CLI command: `envvault ...`
- TUI command: `envvault tui`
- Programmatic API exports via `src/index.ts`

## Related docs

- [Modules](./modules.md)
- [Interfaces](./interfaces.md)
- [File Structure](./file-structure.md)
- [Security Model](./security-model.md)
