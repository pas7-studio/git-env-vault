import { Command } from 'commander'
import { access, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const REQUIRED_GITIGNORE_RULES = ['.envvault/', '.env', '.env.*', '!.env.example'] as const

export interface GitignoreCheckResult {
  path: string
  existingLines: string[]
  missingLines: string[]
}

export async function checkGitignore(cwd: string): Promise<GitignoreCheckResult> {
  const gitignorePath = join(cwd, '.gitignore')
  let content = ''
  try {
    await access(gitignorePath)
    content = await readFile(gitignorePath, 'utf-8')
  } catch {
    content = ''
  }

  const existingLines = content.split(/\r?\n/)
  const lineSet = new Set(existingLines)
  const missingLines = REQUIRED_GITIGNORE_RULES.filter((rule) => !lineSet.has(rule))
  return { path: gitignorePath, existingLines, missingLines }
}

export function formatGitignoreDiffSummary(result: GitignoreCheckResult): string {
  if (result.missingLines.length === 0) {
    return 'No missing .gitignore rules.'
  }
  return result.missingLines.map((line) => `+ ${line}`).join('\n')
}

export async function fixGitignore(
  cwd: string,
  options: { dryRun?: boolean } = {}
): Promise<{ changed: boolean; result: GitignoreCheckResult }> {
  const result = await checkGitignore(cwd)
  if (result.missingLines.length === 0) {
    return { changed: false, result }
  }

  if (options.dryRun) {
    return { changed: true, result }
  }

  const existingContent = result.existingLines.join('\n')
  const base = existingContent.trim()
  const nextContent = base
    ? `${base}\n${result.missingLines.join('\n')}\n`
    : `${result.missingLines.join('\n')}\n`
  await writeFile(result.path, nextContent, 'utf-8')
  return { changed: true, result }
}

export const gitignoreCommand = new Command('gitignore').description(
  'Check/fix required .gitignore rules for envvault'
)

gitignoreCommand
  .command('check')
  .description('Check that required .gitignore rules are present')
  .action(async () => {
    const result = await checkGitignore(process.cwd())
    if (result.missingLines.length === 0) {
      console.log('All required .gitignore rules are present.')
      return
    }
    console.log('Missing .gitignore rules:')
    console.log(formatGitignoreDiffSummary(result))
    process.exit(1)
  })

gitignoreCommand
  .command('fix')
  .description('Add missing envvault-safe .gitignore rules')
  .option('--dry-run', 'Preview changes without writing')
  .action(async (options) => {
    const { changed, result } = await fixGitignore(process.cwd(), {
      dryRun: options.dryRun,
    })
    if (!changed) {
      console.log('No changes needed. .gitignore already contains required rules.')
      return
    }

    console.log(options.dryRun ? 'Would add .gitignore rules:' : 'Added .gitignore rules:')
    console.log(formatGitignoreDiffSummary(result))
  })

