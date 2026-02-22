import { Command } from 'commander'

interface PlatformInstallHints {
  osLabel: string
  commands: string[]
}

function getPlatformInstallHints(): PlatformInstallHints {
  switch (process.platform) {
    case 'win32':
      return {
        osLabel: 'Windows',
        commands: [
          'winget install --id Mozilla.SOPS -e',
          'winget install --id FiloSottile.age -e',
        ],
      }
    case 'darwin':
      return {
        osLabel: 'macOS',
        commands: ['brew install sops age'],
      }
    default:
      return {
        osLabel: 'Linux',
        commands: [
          'sudo apt-get update && sudo apt-get install -y sops age',
          'sudo dnf install sops age',
          'sudo pacman -S sops age',
        ],
      }
  }
}

export function printSetupInstructions(): void {
  const hints = getPlatformInstallHints()

  console.log('envvault setup')
  console.log('')
  console.log(`Detected OS: ${hints.osLabel}`)
  console.log('')
  console.log('Modes:')
  console.log('- JS mode: works for pull/decrypt (no system SOPS required if JS backend is available)')
  console.log('- system-sops mode: required for edit/set/grant/revoke/updatekeys/rotate')
  console.log('')
  console.log('Install commands for system SOPS + age:')
  for (const cmd of hints.commands) {
    console.log(`  ${cmd}`)
  }
  console.log('')
  console.log('Backend preference in envvault.config.json:')
  console.log('  "cryptoBackend": "auto"      // default: system-sops first, then JS fallback')
  console.log('  "cryptoBackend": "system-sops"')
  console.log('  "cryptoBackend": "js"        // basic mode only (pull/decrypt)')
}

export const setupCommand = new Command('setup')
  .description('Show OS-specific setup guidance for JS/system crypto backends')
  .action(async () => {
    printSetupInstructions()
  })
