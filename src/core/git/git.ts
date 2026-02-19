import { execa } from 'execa'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { GitEnvVaultError } from '../types/index.js'

export interface GitStatus {
  isRepo: boolean
  isClean: boolean
  branch: string | null
  staged: string[]
  modified: string[]
  untracked: string[]
}

export interface GitDiffOptions {
  oldFile?: string
  newFile?: string
  staged?: boolean
}

export interface CommitOptions {
  message: string
  add?: string[]
  allowEmpty?: boolean
}

export class GitAdapter {
  private cwd: string
  private env: NodeJS.ProcessEnv

  constructor(cwd: string, env: NodeJS.ProcessEnv = process.env) {
    this.cwd = cwd
    this.env = env
  }

  /**
   * Check if current directory is a git repository
   */
  async isRepo(): Promise<boolean> {
    try {
      const result = await execa('git', ['rev-parse', '--git-dir'], {
        cwd: this.cwd,
        env: this.env,
        reject: false
      })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  /**
   * Get git status
   */
  async status(): Promise<GitStatus> {
    const isRepo = await this.isRepo()
    if (!isRepo) {
      return {
        isRepo: false,
        isClean: true,
        branch: null,
        staged: [],
        modified: [],
        untracked: []
      }
    }

    const result = await execa('git', ['status', '--porcelain=v1', '-b'], {
      cwd: this.cwd,
      env: this.env
    })

    const lines = result.stdout.split('\n').filter(Boolean)
    const staged: string[] = []
    const modified: string[] = []
    const untracked: string[] = []
    let branch: string | null = null

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Branch info
        const branchMatch = line.match(/^## (\S+)/)
        if (branchMatch) {
          branch = branchMatch[1]!.split('...')[0]!
        }
        continue
      }

      const indexStatus = line[0]
      const workTreeStatus = line[1]
      const filepath = line.slice(3)

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filepath!)
      } else if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push(filepath!)
      } else if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        modified.push(filepath!)
      }
    }

    return {
      isRepo: true,
      isClean: staged.length === 0 && modified.length === 0,
      branch,
      staged,
      modified,
      untracked
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  async isDirty(): Promise<boolean> {
    const status = await this.status()
    return !status.isClean
  }

  /**
   * Get current branch name
   */
  async getBranch(): Promise<string | null> {
    try {
      const result = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.cwd,
        env: this.env
      })
      return result.stdout.trim() || null
    } catch {
      return null
    }
  }

  /**
   * Get file content at HEAD
   */
  async getFileAtHead(filepath: string): Promise<string | null> {
    try {
      const result = await execa('git', ['show', `HEAD:${filepath}`], {
        cwd: this.cwd,
        env: this.env,
        reject: false
      })
      if (result.exitCode === 0) {
        return result.stdout
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Get diff between HEAD and working tree for a file
   */
  async diffFile(filepath: string): Promise<string> {
    try {
      const result = await execa('git', ['diff', 'HEAD', '--', filepath], {
        cwd: this.cwd,
        env: this.env,
        reject: false
      })
      return result.stdout
    } catch {
      return ''
    }
  }

  /**
   * Stage files
   */
  async add(files: string[]): Promise<void> {
    if (files.length === 0) return
    await execa('git', ['add', ...files], {
      cwd: this.cwd,
      env: this.env
    })
  }

  /**
   * Create a commit
   */
  async commit(options: CommitOptions): Promise<string> {
    const { message, add = [], allowEmpty = false } = options

    if (add.length > 0) {
      await this.add(add)
    }

    const args = ['commit', '-m', message]
    if (allowEmpty) {
      args.push('--allow-empty')
    }

    try {
      await execa('git', args, {
        cwd: this.cwd,
        env: this.env
      })
      
      // Return commit hash
      const hashResult = await execa('git', ['rev-parse', 'HEAD'], {
        cwd: this.cwd,
        env: this.env
      })
      return hashResult.stdout.trim()
    } catch (error) {
      throw new GitEnvVaultError(`Git commit failed: ${(error as Error).message}`)
    }
  }

  /**
   * Check if file is tracked by git
   */
  async isTracked(filepath: string): Promise<boolean> {
    try {
      const result = await execa('git', ['ls-files', '--error-unmatch', filepath], {
        cwd: this.cwd,
        env: this.env,
        reject: false
      })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  /**
   * Add to .gitignore if not already present
   */
  async addToGitignore(pattern: string): Promise<boolean> {
    const gitignorePath = join(this.cwd, '.gitignore')
    let content = ''
    
    try {
      content = await readFile(gitignorePath, 'utf-8')
    } catch {
      // File doesn't exist, create it
    }

    const lines = content.split('\n')
    if (lines.includes(pattern)) {
      return false // Already present
    }

    const newContent = content.trim() 
      ? `${content.trim()}\n${pattern}\n`
      : `${pattern}\n`
    
    await writeFile(gitignorePath, newContent, 'utf-8')
    return true
  }
}
