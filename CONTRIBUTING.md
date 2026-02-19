# Contributing to git-env-vault

Thank you for your interest in contributing to `@pas7/git-env-vault`! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Security](#security)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@pas7.com.ua](mailto:conduct@pas7.com.ua).

---

## Development Setup

### Prerequisites

- **Node.js** 20+ (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- **npm** 10+ (comes with Node.js)
- **Git** 2.x
- **SOPS** 3.8+ — [Installation guide](https://github.com/getsops/sops#install)
- **age** 1.1+ — [Installation guide](https://github.com/FiloSottile/age#installation)

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/git-env-vault.git
   cd git-env-vault
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Generate your age key (for E2E tests)**

   ```bash
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   chmod 600 ~/.config/sops/age/keys.txt
   ```

4. **Run tests**

   ```bash
   npm test
   npm run test:e2e  # Requires sops + age
   ```

5. **Build the project**

   ```bash
   npm run build
   ```

6. **Run CLI locally**

   ```bash
   node dist/cli/index.js --help
   ```

---

## Project Structure

```
git-env-vault/
├── src/
│   ├── index.ts              # Main entry point
│   ├── cli/
│   │   ├── index.ts          # CLI entry point
│   │   └── commands/         # CLI commands
│   ├── core/
│   │   ├── config/           # Configuration loading
│   │   ├── env/              # Environment variable handling
│   │   ├── fs/               # File system utilities
│   │   ├── git/              # Git operations
│   │   ├── policy/           # Policy signing/verification
│   │   ├── sops/             # SOPS integration
│   │   └── types/            # TypeScript types
│   └── tui/
│       ├── index.ts          # TUI entry point
│       ├── run.ts            # TUI runner
│       └── flows/            # Interactive flows
├── test/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── docs/
│   ├── architecture/         # Architecture docs
│   ├── SECURITY-MODEL.md     # Security documentation
│   ├── TROUBLESHOOTING.md    # Troubleshooting guide
│   └── OPTIMIZATION-GUIDE.md # Performance tips
├── .github/
│   ├── workflows/            # GitHub Actions
│   └── ISSUE_TEMPLATE/       # Issue templates
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build config
└── vitest.config.ts          # Test config
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write code following our [Code Standards](#code-standards)
- Add tests for new functionality
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm run test:watch

# Run E2E tests (requires sops + age)
npm run test:e2e

# Check test coverage
npm run test:coverage
```

### 4. Lint and Type Check

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run typecheck
```

### 5. Build

```bash
npm run build
```

### 6. Commit Changes

Follow our [Commit Guidelines](#commit-guidelines).

### 7. Push and Create PR

```bash
git push origin your-branch-name
```

Then create a Pull Request on GitHub.

---

## Code Standards

### TypeScript

- Use **strict mode** (enabled in `tsconfig.json`)
- Prefer **explicit types** over `any`
- Use **ES modules** (`import`/`export`)
- Document public APIs with **JSDoc comments**

### Code Style

We use **ESLint** and **Prettier**:

```bash
# Check style
npm run lint

# Fix style issues
npm run lint:fix
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `loadConfig.ts` |
| Classes | PascalCase | `SopsAdapter` |
| Functions | camelCase | `loadConfig()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase | `Config` |
| Types | PascalCase | `EnvValue` |

### File Organization

```typescript
// 1. Imports (grouped)
import { something } from 'external';      // External
import { internal } from '../internal';    // Internal
import { local } from './local';           // Local

// 2. Types/Interfaces
interface Options {
  // ...
}

// 3. Constants
const DEFAULT_VALUE = 'default';

// 4. Functions/Classes
export function doSomething(): void {
  // ...
}

// 5. Helper functions (not exported)
function helper(): void {
  // ...
}
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Examples

```bash
feat(cli): add `gev export` command
fix(sops): handle missing age key gracefully
docs(readme): update installation instructions
test(policy): add signature verification tests
chore(deps): update dependencies
```

### Breaking Changes

```bash
feat(api)!: change `loadConfig` return type

BREAKING CHANGE: `loadConfig` now returns a Promise
```

---

## Pull Request Process

### Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow conventions

### PR Template

Fill out the PR template completely:

1. **Description** — What does this PR do?
2. **Type of Change** — Bug fix, feature, breaking change?
3. **Checklist** — Confirm all items
4. **Testing** — How was this tested?
5. **Breaking Changes** — Any migration needed?

### Review Process

1. Automated checks must pass (CI)
2. At least one maintainer review required
3. Address all review feedback
4. Squash commits before merge (optional)

### After Merge

- Delete your feature branch
- Your contribution will appear in the next release

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific file
npm test -- src/core/config/load-config.test.ts

# Watch mode
npm run test:watch
```

### E2E Tests

E2E tests require `sops` and `age` to be installed:

```bash
npm run test:e2e
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage

We aim for high test coverage. Check current coverage:

```bash
npm run test:coverage
```

---

## Documentation

### When to Update Docs

- New features or commands
- API changes
- Bug fixes that affect user-facing behavior
- New configuration options

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Getting started, CLI reference |
| `docs/SECURITY-MODEL.md` | Security documentation |
| `docs/TROUBLESHOOTING.md` | Common issues |
| `docs/OPTIMIZATION-GUIDE.md` | Performance tips |
| `docs/architecture/*.md` | Technical details |

### Code Comments

- Use JSDoc for public APIs
- Explain **why**, not **what**
- Keep comments up-to-date

```typescript
/**
 * Loads and validates the gev configuration file.
 * 
 * @param configPath - Path to gev.config.json (defaults to cwd)
 * @returns Parsed and validated configuration
 * @throws {ConfigError} If the file is invalid or missing
 */
export function loadConfig(configPath?: string): Config {
  // ...
}
```

---

## Security

### Reporting Vulnerabilities

**Do NOT open public issues for security vulnerabilities.**

Instead, email [security@pas7.com.ua](mailto:security@pas7.com.ua) with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### Security Guidelines

- Never commit secret values or private keys
- Validate all user inputs
- Follow the principle of least privilege
- Keep dependencies updated

---

## Getting Help

- **Documentation:** [README](README.md) and [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/pas7-studio/git-env-vault/issues)
- **Discussions:** [GitHub Discussions](https://github.com/pas7-studio/git-env-vault/discussions)
- **Email:** [support@pas7.com.ua](mailto:support@pas7.com.ua)

---

## Recognition

Contributors are recognized in:

- Git commit history
- Release notes for significant contributions
- Our gratitude! 🙏

---

Thank you for contributing to `@pas7/git-env-vault`! 🎉
