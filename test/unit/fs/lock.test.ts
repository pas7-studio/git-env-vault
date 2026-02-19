import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, access, readFile } from 'fs/promises'
import { join } from 'path'
import { FileLock, withLock } from '../../../src/core/fs/lock.js'
import { LockError } from '../../../src/core/types/errors.js'

describe('FileLock', () => {
  const testDir = join(process.cwd(), '.test-lock-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('acquire', () => {
    it('should acquire lock successfully', async () => {
      const lock = new FileLock(testDir)
      
      await lock.acquire(1000)
      
      // Lock file should exist
      await expect(access(join(testDir, '.envvault', 'lock'))).resolves.toBeUndefined()
      
      // Cleanup
      await lock.release()
    })

    it('should write PID to lock file', async () => {
      const lock = new FileLock(testDir)
      
      await lock.acquire(1000)
      
      const content = await readFile(join(testDir, '.envvault', 'lock'), 'utf-8')
      expect(content).toBe(`${process.pid}`)
      
      await lock.release()
    })

    it('should throw LockError on timeout', async () => {
      const lock1 = new FileLock(testDir)
      const lock2 = new FileLock(testDir)
      
      // First lock acquisition
      await lock1.acquire(1000)
      
      // Second should timeout
      await expect(lock2.acquire(100)).rejects.toThrow(LockError)
      await expect(lock2.acquire(100)).rejects.toThrow('timeout')
      
      await lock1.release()
    })

    it('should track locked state', async () => {
      const lock = new FileLock(testDir)
      
      await lock.acquire(1000)
      
      // Release should work
      await lock.release()
      // Second release should be safe
      await lock.release()
    })
  })

  describe('release', () => {
    it('should release lock successfully', async () => {
      const lock = new FileLock(testDir)
      
      await lock.acquire(1000)
      await lock.release()
      
      // Lock file should be removed
      await expect(access(join(testDir, '.envvault', 'lock'))).rejects.toThrow()
    })

    it('should be safe to release without acquire', async () => {
      const lock = new FileLock(testDir)
      
      // Should not throw
      await lock.release()
    })

    it('should allow re-acquiring after release', async () => {
      const lock = new FileLock(testDir)
      
      await lock.acquire(1000)
      await lock.release()
      
      // Should be able to acquire again
      await lock.acquire(1000)
      await lock.release()
    })
  })
})

describe('withLock', () => {
  const testDir = join(process.cwd(), '.test-withlock-dir')

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should execute function with lock', async () => {
    const result = await withLock(testDir, async () => {
      return 'test-result'
    })
    
    expect(result).toBe('test-result')
  })

  it('should release lock after successful execution', async () => {
    await withLock(testDir, async () => {
      return 'done'
    })
    
    // Lock should be released
    await expect(access(join(testDir, '.envvault', 'lock'))).rejects.toThrow()
  })

  it('should release lock after error', async () => {
    await expect(
      withLock(testDir, async () => {
        throw new Error('test error')
      })
    ).rejects.toThrow('test error')
    
    // Lock should still be released
    await expect(access(join(testDir, '.envvault', 'lock'))).rejects.toThrow()
  })

  it('should return function result', async () => {
    const result = await withLock(testDir, async () => {
      return { data: 'test' }
    })
    
    expect(result).toEqual({ data: 'test' })
  })

  it('should accept custom timeout', async () => {
    const result = await withLock(
      testDir, 
      async () => 'done',
      5000
    )
    
    expect(result).toBe('done')
  })
})
