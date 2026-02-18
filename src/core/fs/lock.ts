import { mkdir, rmdir, writeFile, access, unlink } from 'fs/promises'
import { join } from 'path'
import { LockError } from '../types/index.js'

const LOCK_DIR = '.envvault'
const LOCK_FILE = 'lock'

export class FileLock {
  private lockPath: string
  private locked = false

  constructor(projectDir: string) {
    this.lockPath = join(projectDir, LOCK_DIR, LOCK_FILE)
  }

  /**
   * Acquire exclusive lock
   * Creates a lock file, fails if already exists
   */
  async acquire(timeout = 5000): Promise<void> {
    const startTime = Date.now()

    while (true) {
      try {
        // Ensure lock directory exists
        const lockDir = join(this.lockPath, '..')
        await mkdir(lockDir, { recursive: true })
        
        await writeFile(this.lockPath, `${process.pid}`, { flag: 'wx' })
        this.locked = true
        return
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw new LockError(
            `Failed to acquire lock: ${(error as Error).message}`
          )
        }

        if (Date.now() - startTime >= timeout) {
          throw new LockError(
            'Lock acquisition timeout - another process is using envvault'
          )
        }

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.locked) return

    try {
      await unlink(this.lockPath)
    } catch {
      // Ignore release errors
    }
    this.locked = false
  }
}

/**
 * Run a function with an exclusive lock
 */
export async function withLock<T>(
  projectDir: string,
  fn: () => Promise<T>,
  timeout?: number
): Promise<T> {
  const lock = new FileLock(projectDir)
  await lock.acquire(timeout)
  try {
    return await fn()
  } finally {
    await lock.release()
  }
}
