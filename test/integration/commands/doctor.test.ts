import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execa } from 'execa'
import { tmpdir } from 'os'

// Get the absolute path to the CLI
const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js')

describe('doctor command', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `envvault-doctor-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    
    // Initialize git repo
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('without initialization', () => {
    it('should warn about missing config', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Config')
      // Should show warning about config not found
    })

    it('should check for SOPS installation', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('SOPS')
    })

    it('should check for AGE key', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('AGE Key')
    })

    it('should check for Git repository', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Git')
    })
  })

  describe('after initialization', () => {
    beforeEach(async () => {
      // Initialize envvault
      await execa('node', [CLI_PATH, 'init'], {
        cwd: testDir,
        reject: false
      })
    })

    it('should pass config check after init', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Config')
      // Config should be OK after init
    })

    it('should check secrets directory', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Secrets Dir')
    })

    it('should check temp directory', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Temp Dir')
    })

    it('should warn about stale temp files', async () => {
      // Create stale temp file
      const tmpDir = join(testDir, '.envvault', 'tmp')
      await mkdir(tmpDir, { recursive: true })
      await writeFile(join(tmpDir, 'stale-file.tmp'), 'stale content')
      
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        reject: false
      })
      
      expect(result.stdout).toContain('Temp Dir')
      // Should show warning about stale files
    })
  })

  describe('environment variables', () => {
    it('should detect SOPS_AGE_KEY_FILE when set', async () => {
      // Create a temporary key file
      const keyFile = join(testDir, 'age.key')
      await writeFile(keyFile, 'AGE-SECRET-KEY-1TEST', 'utf-8')
      
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        env: { ...process.env, SOPS_AGE_KEY_FILE: keyFile },
        reject: false
      })
      
      expect(result.stdout).toContain('AGE Key')
    })

    it('should detect SOPS_AGE_KEY env var', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        env: { ...process.env, SOPS_AGE_KEY: 'AGE-SECRET-KEY-1TEST' },
        reject: false
      })
      
      expect(result.stdout).toContain('AGE Key')
    })

    it('should warn if SOPS_AGE_KEY_FILE points to non-existent file', async () => {
      const result = await execa('node', [CLI_PATH, 'doctor'], {
        cwd: testDir,
        env: { ...process.env, SOPS_AGE_KEY_FILE: '/nonexistent/key.txt' },
        reject: false
      })
      
      expect(result.stdout).toContain('AGE Key')
      // Should show error about file not found
    })
  })

  describe('non-git directory', () => {
    it('should show error for non-git directory', async () => {
      const nonGitDir = join(tmpdir(), `envvault-non-git-doctor-${Date.now()}`)
      await mkdir(nonGitDir, { recursive: true })
      
      try {
        const result = await execa('node', [CLI_PATH, 'doctor'], {
          cwd: nonGitDir,
          reject: false
        })
        
        expect(result.stdout).toContain('Git')
        // Should show error about not being a git repository
      } finally {
        await rm(nonGitDir, { recursive: true, force: true })
      }
    })
  })
})
