import { writeFile, mkdir, rm, chmod, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { TempFile } from '../types/index.js'

const TMP_DIR = '.envvault'
const TMP_PREFIX = 'tmp-'

/**
 * Create a temporary file with secure permissions (0600)
 * Automatically cleans up on process exit
 */
export async function createSecureTempFile(
  content: string,
  options: { prefix?: string; suffix?: string } = {}
): Promise<TempFile> {
  const { prefix = TMP_PREFIX, suffix = '' } = options

  // Ensure temp directory exists
  const baseDir = join(process.cwd(), TMP_DIR, 'tmp')
  await mkdir(baseDir, { recursive: true })

  // Generate random filename
  const id = randomBytes(8).toString('hex')
  const filename = `${prefix}${id}${suffix}`
  const filepath = join(baseDir, filename)

  // Write with secure permissions
  await writeFile(filepath, content, { mode: 0o600 })

  let cleaned = false

  const cleanup = async (): Promise<void> => {
    if (cleaned) return
    cleaned = true
    try {
      await rm(filepath, { force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  // Register cleanup on exit
  const exitHandler = (): void => {
    cleanup().catch(() => {})
  }
  process.on('exit', exitHandler)
  process.on('SIGINT', exitHandler)
  process.on('SIGTERM', exitHandler)

  return { path: filepath, cleanup }
}

/**
 * Create a temp directory
 */
export async function createTempDir(prefix = 'envvault-'): Promise<string> {
  const id = randomBytes(8).toString('hex')
  const dirpath = join(tmpdir(), `${prefix}${id}`)
  await mkdir(dirpath, { recursive: true, mode: 0o700 })
  return dirpath
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/**
 * Check if a file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}
