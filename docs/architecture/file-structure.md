# Architecture File Structure

Repository structure and intent.

## Top level

```text
.
|- src/
|- test/
|- docs/
|- .github/
|- README.md
|- LICENSE
|- CONTRIBUTING.md
|- SECURITY.md
|- CODE_OF_CONDUCT.md
|- SUPPORT.md
`- CHANGELOG.md
```

## Source tree

```text
src/
|- cli/
|  `- commands/
|- core/
|  |- config/
|  |- env/
|  |- fs/
|  |- git/
|  |- policy/
|  `- sops/
|- tui/
`- index.ts
```

## Documentation tree

```text
docs/
|- GETTING-STARTED.md
|- CLI-REFERENCE.md
|- CONFIGURATION.md
|- WORKFLOWS.md
|- SECURITY-GUIDE.md
|- SECURITY-MODEL.md
|- TROUBLESHOOTING.md
|- OPTIMIZATION-GUIDE.md
`- architecture/
```

## Test tree

```text
test/
|- unit/
|- integration/
`- e2e/
```

## Runtime-generated project files

When users initialize in their own repo:

```text
envvault.config.json
envvault.policy.json
.sops.yaml
secrets/<env>/<service>.sops.yaml
.envvault/
```

## Ownership guidance

- Keep command behavior in `src/core` where possible.
- Keep `src/cli` focused on input/output orchestration.
- Keep architecture docs synchronized when command surface changes.
