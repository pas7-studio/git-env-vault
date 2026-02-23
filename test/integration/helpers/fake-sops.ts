import { chmod, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export async function writeFakeSopsBin(binDir: string): Promise<void> {
  await mkdir(binDir, { recursive: true })

  if (process.platform === 'win32') {
    const cmdPath = join(binDir, 'sops.cmd')
    const content = `@echo off
if "%~1"=="--version" (
  echo sops 3.8.1
  goto :eof
)
if "%~1"=="-d" (
  type "%~2"
  goto :eof
)
if "%~1"=="-e" (
  REM no-op fake encryption for tests
  goto :eof
)
if "%~1"=="updatekeys" (
  goto :eof
)
if "%~1"=="rotate" (
  goto :eof
)
exit /b 1
`
    await writeFile(cmdPath, content, 'utf-8')
    return
  }

  const shPath = join(binDir, 'sops')
  const content = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "sops 3.8.1"
  exit 0
fi
if [ "$1" = "-d" ]; then
  cat "$2"
  exit 0
fi
if [ "$1" = "-e" ]; then
  # no-op fake encryption for tests
  exit 0
fi
if [ "$1" = "updatekeys" ] || [ "$1" = "rotate" ]; then
  exit 0
fi
exit 1
`
  await writeFile(shPath, content, 'utf-8')
  await chmod(shPath, 0o755)
}

export function withFakeSopsPath(binDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
  }
}

