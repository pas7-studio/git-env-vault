# Architecture Modules

This document describes major modules and responsibilities.

## `src/cli`

Command registration and option parsing.

Primary command files:

- `init`, `pull`, `edit`, `set`, `doctor`, `ci-verify`
- `grant`, `revoke`, `updatekeys`, `rotate`
- `promote`, `promote-all`
- `hooks`, `wizard`, `up`, `tui`

## `src/core/config`

- Load and validate `envvault.config.json`.
- Load and validate `envvault.policy.json`.
- Produce default config/policy data where needed.

## `src/core/sops`

Wrapper around SOPS binary interactions:

- availability/version checks
- decrypt/encrypt
- update recipients
- rotate data keys

## `src/core/policy`

Policy-specific logic:

- canonical JSON serialization
- digital signature verification helpers

## `src/core/env`

Environment and dotenv handling:

- parsing/rendering
- safe diffing
- local override support

## `src/core/git`

Git adapter for repository operations:

- repo checks
- status/branch
- commit helper
- `.gitignore` updates

## `src/core/fs`

Filesystem safety utilities:

- atomic file writes
- lock files
- secure temporary file handling

## `src/tui`

Interactive flows for common operations:

- select env/service/action
- execute the same core operations as CLI

## Testing layout

- `test/unit`: isolated module behavior
- `test/integration`: command-level flows
- `test/e2e`: external-tool-backed scenarios

## Design notes

- Keep CLI thin, core reusable.
- Keep security-sensitive behavior centralized in core modules.
- Keep I/O boundaries explicit for testability.
