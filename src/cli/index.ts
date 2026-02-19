import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { pullCommand } from './commands/pull.js'
import { editCommand } from './commands/edit.js'
import { setCommand } from './commands/set.js'
import { doctorCommand } from './commands/doctor.js'
import { ciVerifyCommand } from './commands/ci-verify.js'
import { grantCommand } from './commands/grant.js'
import { revokeCommand } from './commands/revoke.js'
import { rotateCommand } from './commands/rotate.js'
import { updatekeysCommand } from './commands/updatekeys.js'
import { promoteCommand, promoteAllCommand } from './commands/promote.js'
import { hooksCommand } from './commands/hooks.js'
import { wizardCommand } from './commands/wizard.js'
import up from './commands/up.js'
import { tuiCommand } from './commands/tui.js'

const program = new Command()

program
  .name('envvault')
  .description('CLI for managing encrypted environment variables in monorepos')
  .version('0.1.0')

// Main commands
program.addCommand(initCommand)
program.addCommand(pullCommand)
program.addCommand(editCommand)
program.addCommand(setCommand)
program.addCommand(doctorCommand)
program.addCommand(ciVerifyCommand)

// Admin commands
program.addCommand(grantCommand)
program.addCommand(revokeCommand)
program.addCommand(rotateCommand)
program.addCommand(updatekeysCommand)

// Local overrides commands
program.addCommand(promoteCommand)
program.addCommand(promoteAllCommand)

// Git hooks commands
program.addCommand(hooksCommand)

// Auto-configuration wizard
program.addCommand(wizardCommand)

// Docker convenience wrapper
program.addCommand(up)

// TUI mode (default when no args)
program.addCommand(tuiCommand)

// Default to TUI if no command provided
if (process.argv.length === 2) {
  process.argv.push('tui')
}

program.parse()
