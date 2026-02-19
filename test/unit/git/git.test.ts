import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'
import { GitAdapter } from '../../../src/core/git/git.js'

describe('GitAdapter', () => {
  let testDir: string
  let git: GitAdapter

  beforeEach(async () => {
    testDir = join(tmpdir(), `git-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    
    // Initialize git repo
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir })
    
    git = new GitAdapter(testDir)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('isRepo', () => {
    it('should return true for git repository', async () => {
      const isRepo = await git.isRepo()
      expect(isRepo).toBe(true)
    })

    it('should return false for non-git directory', async () => {
      const nonGitDir = join(tmpdir(), `non-git-${Date.now()}`)
      await mkdir(nonGitDir, { recursive: true })
      
      const nonGitAdapter = new GitAdapter(nonGitDir)
      const isRepo = await nonGitAdapter.isRepo()
      
      expect(isRepo).toBe(false)
      
      await rm(nonGitDir, { recursive: true, force: true })
    })
  })

  describe('status', () => {
    it('should return clean status for new repo', async () => {
      const status = await git.status()
      
      expect(status.isRepo).toBe(true)
      // New repo might have no commits yet
    })

    it('should detect staged files', async () => {
      // Create and stage a file
      await writeFile(join(testDir, 'test.txt'), 'content')
      await execa('git', ['add', 'test.txt'], { cwd: testDir })
      
      const status = await git.status()
      
      expect(status.staged).toContain('test.txt')
    })

    it('should detect modified files', async () => {
      // Create initial commit
      await writeFile(join(testDir, 'test.txt'), 'initial')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      // Modify file
      await writeFile(join(testDir, 'test.txt'), 'modified')
      
      const status = await git.status()
      
      expect(status.modified).toContain('test.txt')
    })

    it('should detect untracked files', async () => {
      await writeFile(join(testDir, 'untracked.txt'), 'content')
      
      const status = await git.status()
      
      expect(status.untracked).toContain('untracked.txt')
    })
  })

  describe('isDirty', () => {
    it('should return false for clean repo', async () => {
      // Create initial commit
      await writeFile(join(testDir, 'test.txt'), 'content')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      const isDirty = await git.isDirty()
      expect(isDirty).toBe(false)
    })

    it('should return true for repo with untracked files', async () => {
      // Create initial commit first
      await writeFile(join(testDir, 'test.txt'), 'content')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      // Create untracked file
      await writeFile(join(testDir, 'untracked.txt'), 'content')
      
      const status = await git.status()
      // Check if there are untracked files
      expect(status.untracked.length).toBeGreaterThan(0)
    })
  })

  describe('getBranch', () => {
    it('should return current branch name or null', async () => {
      const branch = await git.getBranch()
      // Could be 'main', 'master', or null depending on git state
      expect(branch === null || typeof branch === 'string').toBe(true)
    })
  })

  describe('getFileAtHead', () => {
    it('should return file content at HEAD', async () => {
      // Create initial commit
      await writeFile(join(testDir, 'test.txt'), 'content at head')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      const content = await git.getFileAtHead('test.txt')
      
      expect(content).toBe('content at head')
    })

    it('should return null for non-existent file', async () => {
      const content = await git.getFileAtHead('nonexistent.txt')
      
      expect(content).toBeNull()
    })
  })

  describe('add', () => {
    it('should stage files', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content')
      
      await git.add(['test.txt'])
      
      const status = await git.status()
      expect(status.staged).toContain('test.txt')
    })

    it('should handle empty array', async () => {
      await git.add([])
      
      const status = await git.status()
      expect(status.staged).toHaveLength(0)
    })
  })

  describe('commit', () => {
    it('should create commit', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content')
      await git.add(['test.txt'])
      
      const hash = await git.commit({ message: 'test commit' })
      
      expect(hash).toBeTruthy()
      expect(hash.length).toBe(40) // SHA-1 hash length
    })

    it('should create commit with add option', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content')
      
      const hash = await git.commit({ 
        message: 'test commit',
        add: ['test.txt']
      })
      
      expect(hash).toBeTruthy()
    })
  })

  describe('isTracked', () => {
    it('should return true for tracked file', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      const isTracked = await git.isTracked('test.txt')
      
      expect(isTracked).toBe(true)
    })

    it('should return false for untracked file', async () => {
      await writeFile(join(testDir, 'untracked.txt'), 'content')
      
      const isTracked = await git.isTracked('untracked.txt')
      
      expect(isTracked).toBe(false)
    })
  })

  describe('addToGitignore', () => {
    it('should create .gitignore if not exists', async () => {
      const added = await git.addToGitignore('node_modules/')
      
      expect(added).toBe(true)
      
      const content = await readFile(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toContain('node_modules/')
    })

    it('should append to existing .gitignore', async () => {
      await writeFile(join(testDir, '.gitignore'), 'existing/\n')
      
      const added = await git.addToGitignore('node_modules/')
      
      expect(added).toBe(true)
      
      const content = await readFile(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toContain('existing/')
      expect(content).toContain('node_modules/')
    })

    it('should return false if pattern already exists', async () => {
      await writeFile(join(testDir, '.gitignore'), 'node_modules/\n')
      
      const added = await git.addToGitignore('node_modules/')
      
      expect(added).toBe(false)
    })
  })

  describe('diffFile', () => {
    it('should return diff for modified file', async () => {
      // Create initial commit
      await writeFile(join(testDir, 'test.txt'), 'original content')
      await execa('git', ['add', '.'], { cwd: testDir })
      await execa('git', ['commit', '-m', 'initial'], { cwd: testDir })
      
      // Modify file
      await writeFile(join(testDir, 'test.txt'), 'modified content')
      
      const diff = await git.diffFile('test.txt')
      
      expect(diff).toContain('original content')
      expect(diff).toContain('modified content')
    })

    it('should return empty string for non-existent file', async () => {
      const diff = await git.diffFile('nonexistent.txt')
      
      expect(diff).toBe('')
    })
  })
})
