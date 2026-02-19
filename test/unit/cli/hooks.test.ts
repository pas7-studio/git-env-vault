import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm, readFile, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'
import {
  installHook,
  uninstallHook,
  checkHooksStatus
} from '../../../src/cli/commands/hooks.js'

describe('Git Hooks Commands', () => {
  const testDir = join(process.cwd(), '.test-hooks-dir')
  const gitDir = join(testDir, '.git')
  const hooksDir = join(gitDir, 'hooks')

  beforeEach(async () => {
    await mkdir(hooksDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('installHook', () => {
    it('should return error if not a git repository', async () => {
      const nonGitDir = join(process.cwd(), '.test-non-git')
      await mkdir(nonGitDir, { recursive: true })
      
      const result = await installHook({ type: 'pre-push', cwd: nonGitDir })
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Not a git repository')
      
      await rm(nonGitDir, { recursive: true, force: true })
    })

    it('should create pre-push hook with gev content', async () => {
      const result = await installHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Successfully installed')
      expect(result.path).toBe(join(hooksDir, 'pre-push'))
      
      // Verify content
      const content = await readFile(join(hooksDir, 'pre-push'), 'utf-8')
      expect(content).toContain('# >>> gev:managed')
      expect(content).toContain('# <<< gev:managed')
      expect(content).toContain('npx gev verify')
    })

    it('should create pre-commit hook with gev content', async () => {
      const result = await installHook({ type: 'pre-commit', cwd: testDir })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Successfully installed')
      
      const content = await readFile(join(hooksDir, 'pre-commit'), 'utf-8')
      expect(content).toContain('# >>> gev:managed')
      expect(content).toContain('npx gev verify')
    })

    it('should make hook file executable', async () => {
      await installHook({ type: 'pre-push', cwd: testDir })
      
      const hookPath = join(hooksDir, 'pre-push')
      await expect(access(hookPath, constants.X_OK)).resolves.toBeUndefined()
    })

    it('should not duplicate gev content if already installed', async () => {
      // First install
      await installHook({ type: 'pre-push', cwd: testDir })
      
      // Second install
      const result = await installHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('already contains gev')
      
      // Verify no duplicate markers
      const content = await readFile(join(hooksDir, 'pre-push'), 'utf-8')
      const markerCount = (content.match(/# >>> gev:managed/g) || []).length
      expect(markerCount).toBe(1)
    })

    it('should preserve existing hook content', async () => {
      // Create existing hook
      const existingContent = `#!/bin/sh
# Existing hook
echo "Running existing hook"
`
      await writeFile(join(hooksDir, 'pre-push'), existingContent)
      
      const result = await installHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(true)
      
      const content = await readFile(join(hooksDir, 'pre-push'), 'utf-8')
      expect(content).toContain('Running existing hook')
      expect(content).toContain('# >>> gev:managed')
    })

    it('should generate POSIX-compatible shebang', async () => {
      await installHook({ type: 'pre-push', cwd: testDir })
      
      const content = await readFile(join(hooksDir, 'pre-push'), 'utf-8')
      expect(content).toMatch(/^#!/)
    })
  })

  describe('uninstallHook', () => {
    it('should return error if hook does not contain gev content', async () => {
      await writeFile(join(hooksDir, 'pre-push'), '#!/bin/sh\necho "test"\n')
      
      const result = await uninstallHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('does not contain gev managed content')
    })

    it('should remove only gev content from hook, preserving other content', async () => {
      // Create hook with both gev and custom content
      const content = `#!/bin/sh
# Custom hook logic
echo "Custom logic"

# >>> gev:managed (do not edit this block)
npx gev verify || exit 1
# <<< gev:managed (end)
`
      await writeFile(join(hooksDir, 'pre-push'), content)
      
      const result = await uninstallHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('preserved existing hook')
      
      const remaining = await readFile(join(hooksDir, 'pre-push'), 'utf-8')
      expect(remaining).toContain('Custom logic')
      expect(remaining).not.toContain('gev:managed')
    })

    it('should remove entire file if it only contains gev content', async () => {
      // Create hook with only gev content (no shebang - generated by our tool)
      const content = `# >>> gev:managed (do not edit this block)
# gev pre-push hook - auto-generated by envvault
# Run 'envvault hooks uninstall --type pre-push' to remove
npx gev verify || { echo "gev verify failed. pre-push aborted."; exit 1; }
# <<< gev:managed (end)
`
      await writeFile(join(hooksDir, 'pre-push'), content)
      
      const result = await uninstallHook({ type: 'pre-push', cwd: testDir })
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('Removed pre-push hook')
      
      // File should be deleted
      await expect(access(join(hooksDir, 'pre-push'))).rejects.toThrow()
    })

    it('should return error for non-git directory', async () => {
      const nonGitDir = join(process.cwd(), '.test-non-git')
      await mkdir(nonGitDir, { recursive: true })
      
      const result = await uninstallHook({ type: 'pre-push', cwd: nonGitDir })
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Not a git repository')
      
      await rm(nonGitDir, { recursive: true, force: true })
    })
  })

  describe('checkHooksStatus', () => {
    it('should return all false when no hooks installed', async () => {
      const status = await checkHooksStatus({ cwd: testDir })
      
      expect(status.prePush).toBe(false)
      expect(status.preCommit).toBe(false)
    })

    it('should detect installed pre-push hook', async () => {
      await installHook({ type: 'pre-push', cwd: testDir })
      
      const status = await checkHooksStatus({ cwd: testDir })
      
      expect(status.prePush).toBe(true)
      expect(status.preCommit).toBe(false)
      expect(status.prePushPath).toBe(join(hooksDir, 'pre-push'))
    })

    it('should detect installed pre-commit hook', async () => {
      await installHook({ type: 'pre-commit', cwd: testDir })
      
      const status = await checkHooksStatus({ cwd: testDir })
      
      expect(status.prePush).toBe(false)
      expect(status.preCommit).toBe(true)
      expect(status.preCommitPath).toBe(join(hooksDir, 'pre-commit'))
    })

    it('should detect both hooks when installed', async () => {
      await installHook({ type: 'pre-push', cwd: testDir })
      await installHook({ type: 'pre-commit', cwd: testDir })
      
      const status = await checkHooksStatus({ cwd: testDir })
      
      expect(status.prePush).toBe(true)
      expect(status.preCommit).toBe(true)
    })

    it('should not detect hook without gev content', async () => {
      await writeFile(join(hooksDir, 'pre-push'), '#!/bin/sh\necho "test"\n')
      
      const status = await checkHooksStatus({ cwd: testDir })
      
      expect(status.prePush).toBe(false)
    })

    it('should return all false for non-git directory', async () => {
      const nonGitDir = join(process.cwd(), '.test-non-git')
      await mkdir(nonGitDir, { recursive: true })
      
      const status = await checkHooksStatus({ cwd: nonGitDir })
      
      expect(status.prePush).toBe(false)
      expect(status.preCommit).toBe(false)
      
      await rm(nonGitDir, { recursive: true, force: true })
    })
  })
})

describe('Hook Script Content Generation', () => {
  it('should contain correct verify command for pre-push', async () => {
    const testDir = join(process.cwd(), '.test-hook-content')
    const gitDir = join(testDir, '.git', 'hooks')
    await mkdir(gitDir, { recursive: true })
    
    await installHook({ type: 'pre-push', cwd: testDir })
    
    const content = await readFile(join(gitDir, 'pre-push'), 'utf-8')
    expect(content).toContain('npx gev verify')
    expect(content).toContain('pre-push aborted')
    
    await rm(testDir, { recursive: true, force: true })
  })

  it('should contain correct abort message for pre-commit', async () => {
    const testDir = join(process.cwd(), '.test-hook-content')
    const gitDir = join(testDir, '.git', 'hooks')
    await mkdir(gitDir, { recursive: true })
    
    await installHook({ type: 'pre-commit', cwd: testDir })
    
    const content = await readFile(join(gitDir, 'pre-commit'), 'utf-8')
    expect(content).toContain('npx gev verify')
    expect(content).toContain('pre-commit aborted')
    
    await rm(testDir, { recursive: true, force: true })
  })
})
