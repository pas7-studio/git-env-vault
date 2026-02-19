import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, access, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { createSecureTempFile, createTempDir, ensureDir, fileExists } from '../../../src/core/fs/safe-tmp.js'

describe('createSecureTempFile', () => {
  const testCwd = process.cwd()
  const tmpDir = join(testCwd, '.envvault', 'tmp')

  beforeEach(async () => {
    // Clean up any existing temp files
    await rm(tmpDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should create temp file with content', async () => {
    const content = 'test content'
    const tempFile = await createSecureTempFile(content)
    
    const fileContent = await readFile(tempFile.path, 'utf-8')
    expect(fileContent).toBe(content)
    
    await tempFile.cleanup()
  })

  it('should create file in .envvault/tmp directory', async () => {
    const tempFile = await createSecureTempFile('test')
    
    expect(tempFile.path).toContain('.envvault')
    expect(tempFile.path).toContain('tmp')
    
    await tempFile.cleanup()
  })

  it('should create file with random name', async () => {
    const tempFile1 = await createSecureTempFile('test1')
    const tempFile2 = await createSecureTempFile('test2')
    
    expect(tempFile1.path).not.toBe(tempFile2.path)
    
    await tempFile1.cleanup()
    await tempFile2.cleanup()
  })

  it('should support custom prefix', async () => {
    const tempFile = await createSecureTempFile('test', { prefix: 'custom-' })
    
    const filename = tempFile.path.split(/[/\\]/).pop()!
    expect(filename.startsWith('custom-')).toBe(true)
    
    await tempFile.cleanup()
  })

  it('should support custom suffix', async () => {
    const tempFile = await createSecureTempFile('test', { suffix: '.yaml' })
    
    expect(tempFile.path.endsWith('.yaml')).toBe(true)
    
    await tempFile.cleanup()
  })

  it('should cleanup file on cleanup() call', async () => {
    const tempFile = await createSecureTempFile('test')
    
    // File should exist
    await expect(access(tempFile.path)).resolves.toBeUndefined()
    
    await tempFile.cleanup()
    
    // File should be removed
    await expect(access(tempFile.path)).rejects.toThrow()
  })

  it('should be safe to call cleanup multiple times', async () => {
    const tempFile = await createSecureTempFile('test')
    
    await tempFile.cleanup()
    await tempFile.cleanup() // Should not throw
    
    await expect(access(tempFile.path)).rejects.toThrow()
  })

  it('should have secure permissions (0600) on Unix', async () => {
    // Skip on Windows as permissions work differently
    if (process.platform === 'win32') {
      return
    }
    
    const tempFile = await createSecureTempFile('test')
    
    const stats = await stat(tempFile.path)
    const mode = stats.mode & 0o777
    
    expect(mode).toBe(0o600)
    
    await tempFile.cleanup()
  })
})

describe('createTempDir', () => {
  const createdDirs: string[] = []

  afterEach(async () => {
    // Clean up created directories
    for (const dir of createdDirs) {
      try {
        await rm(dir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    }
    createdDirs.length = 0
  })

  it('should create a directory', async () => {
    const dir = await createTempDir()
    createdDirs.push(dir)
    
    await expect(access(dir)).resolves.toBeUndefined()
  })

  it('should use default prefix', async () => {
    const dir = await createTempDir()
    createdDirs.push(dir)
    
    expect(dir).toContain('envvault-')
  })

  it('should support custom prefix', async () => {
    const dir = await createTempDir('custom-')
    createdDirs.push(dir)
    
    expect(dir).toContain('custom-')
  })

  it('should create unique directories', async () => {
    const dir1 = await createTempDir()
    const dir2 = await createTempDir()
    createdDirs.push(dir1, dir2)
    
    expect(dir1).not.toBe(dir2)
  })

  it('should have secure permissions (0700) on Unix', async () => {
    // Skip on Windows as permissions work differently
    if (process.platform === 'win32') {
      return
    }
    
    const dir = await createTempDir()
    createdDirs.push(dir)
    
    const stats = await stat(dir)
    const mode = stats.mode & 0o777
    
    expect(mode).toBe(0o700)
  })
})

describe('ensureDir', () => {
  const testDir = join(process.cwd(), '.test-ensure-dir')

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should create directory if not exists', async () => {
    await ensureDir(testDir)
    
    await expect(access(testDir)).resolves.toBeUndefined()
  })

  it('should not fail if directory exists', async () => {
    await ensureDir(testDir)
    await ensureDir(testDir) // Should not throw
    
    await expect(access(testDir)).resolves.toBeUndefined()
  })

  it('should create nested directories', async () => {
    const nestedDir = join(testDir, 'a', 'b', 'c')
    
    await ensureDir(nestedDir)
    
    await expect(access(nestedDir)).resolves.toBeUndefined()
  })
})

describe('fileExists', () => {
  const testDir = join(process.cwd(), '.test-file-exists')
  const testFile = join(testDir, 'test.txt')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should return true for existing file', async () => {
    const { writeFile } = await import('fs/promises')
    await writeFile(testFile, 'content')
    
    const exists = await fileExists(testFile)
    expect(exists).toBe(true)
  })

  it('should return false for non-existing file', async () => {
    const exists = await fileExists('/nonexistent/file.txt')
    expect(exists).toBe(false)
  })

  it('should return true for existing directory', async () => {
    const exists = await fileExists(testDir)
    expect(exists).toBe(true)
  })

  it('should return false for non-existing path', async () => {
    const exists = await fileExists('/nonexistent/path')
    expect(exists).toBe(false)
  })
})
