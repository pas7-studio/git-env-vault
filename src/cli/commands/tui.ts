import { Command } from 'commander'
import { runTui } from '../../tui/index.js'

export const tuiCommand = new Command('tui')
  .description('Run interactive TUI mode')
  .action(async () => {
    await runTui()
  })
