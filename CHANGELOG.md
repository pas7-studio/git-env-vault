# Changelog

All notable changes to `@pas7/git-env-vault` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Nothing yet

## [0.1.5] - 2024-01-15

### Added

- **CLI Commands**
  - `gev init` — Initialize project with config, policy, and secrets directory
  - `gev doctor` — Diagnose environment and configuration issues
  - `gev pull` — Decrypt secrets and write to `.env` files
  - `gev edit` — Edit secrets in your `$EDITOR`
  - `gev set` — Set secret values from command line
  - `gev grant` — Grant access to a user's age public key
  - `gev revoke` — Revoke access from a user
  - `gev updatekeys` — Update encryption keys for secrets
  - `gev rotate` — Rotate data encryption keys
  - `gev ci-verify` — Verify policy and signatures in CI

- **Interactive TUI**
  - `gev tui` — Launch interactive terminal UI
  - `gev` — Default command launches TUI
  - Arrow key navigation and Enter to select

- **Security**
  - SOPS + age encryption for secrets at rest
  - ed25519 signatures for policy integrity
  - Per-environment, per-service access control
  - Safe-by-default diff (no secret values in output)

- **Configuration**
  - `gev.config.json` — Service-to-env mapping
  - `gev.policy.json` — Access control policy (signed)
  - `.sops.yaml` — SOPS configuration

- **Testing**
  - Unit tests with Vitest
  - Integration tests for CLI commands
  - E2E tests for encryption/decryption
  - Test coverage reporting

- **Documentation**
  - README with quick start guide
  - Security model documentation
  - Architecture overview
  - API reference for programmatic use

- **CI/CD**
  - GitHub Actions workflow
  - Automated testing on push and PR
  - npm publishing on tag release

### Security

- Initial security model implementation
- Policy signing with master admin key
- Safe diff output (no secret exposure)

## [0.1.0] - 2024-01-01

### Added

- Initial project structure
- Basic CLI framework with Commander.js
- Core modules for config, policy, SOPS, git, fs operations
- Type definitions and error handling
- Project scaffolding and build configuration

---

## Release Notes

### Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — Breaking changes
- **MINOR** — New features, backwards compatible
- **PATCH** — Bug fixes, backwards compatible

During initial development (0.x.x), minor versions may include breaking changes.

### Upgrade Guide

#### From 0.1.x to 0.2.x (future)

When 0.2.0 is released, check this section for migration instructions.

---

## Roadmap

### v0.2.0 (Planned)

- [ ] Environment inheritance in policy
- [ ] Batch operations for multiple services
- [ ] Secret import/export functionality
- [ ] Improved error messages with suggestions

### v0.3.0 (Planned)

- [ ] Plugin system for custom encryption providers
- [ ] Web UI for policy management
- [ ] Audit log export
- [ ] Team/role-based access control

### v1.0.0 (Future)

- [ ] Stable API guarantee
- [ ] Full documentation coverage
- [ ] Security audit
- [ ] Performance benchmarks

---

[unreleased]: https://github.com/pas7-studio/git-env-vault/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/pas7-studio/git-env-vault/compare/v0.1.0...v0.1.5
[0.1.0]: https://github.com/pas7-studio/git-env-vault/releases/tag/v0.1.0
