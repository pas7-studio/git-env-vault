# Architecture Interfaces

This file documents key runtime contracts (conceptual interfaces) used across the project.

## Config contract

`envvault.config.json` must provide:

- `version: number`
- `secretsDir: string`
- `services: Record<string, { envOutput: string }>`
- optional `repo: { name: string }`

## Policy contract

`envvault.policy.json` must provide:

- `version: number`
- `environments: Record<string, { services: Record<string, { recipients: string[] }> }>`

## SOPS adapter contract

Core operations expected from adapter:

- `isAvailable(): Promise<boolean>`
- `getVersion(): Promise<string>`
- `decrypt(path)`
- `encrypt(path)`
- `encryptData(path, data)`
- `updateKeys(path)`
- `rotate(path)`

## Git adapter contract

Core operations expected from adapter:

- `isRepo()`
- `status()`
- `commit({ message, add })`
- `addToGitignore(pattern)`

## Env processing contract

Expected capabilities:

- parse dotenv to key/value entries
- render dotenv from key/value entries
- produce safe key-level diffs
- support local override lookup/promotion

## Filesystem safety contract

- atomic writes for critical files
- process-level locking for mutation commands
- temporary-file cleanup on success/failure

## CLI command contract

Each command should:

- validate required options
- fail clearly with actionable errors
- avoid printing secret values unless explicitly requested
- return non-zero exit code on failure

## CI verification contract

`ci-verify` should enforce:

- policy signature validity (or explicit unsigned allowance)
- `.sops.yaml` policy sync
- encrypted secret file integrity
- plaintext `.env` detection in repository

## TUI contract

TUI should call the same core operations as CLI and preserve the same security behavior.
