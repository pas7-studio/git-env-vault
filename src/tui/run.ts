import { select, checkbox, confirm } from '@inquirer/prompts'
import { loadConfig, loadPolicy, ConfigError, EnvVaultConfig, EnvVaultPolicy } from '../core/index.js'
import { selectEnvironment } from './flows/select-env.js'
import { selectServices } from './flows/select-services.js'
import { selectAction } from './flows/select-action.js'
import { runPullFlow } from './flows/pull-flow.js'
import { runEditFlow } from './flows/edit-flow.js'
import { runSetFlow } from './flows/set-flow.js'
import { runGrantFlow } from './flows/grant-flow.js'
import { runRevokeFlow } from './flows/revoke-flow.js'
import { runRotateFlow } from './flows/rotate-flow.js'
import { runDoctorFlow } from './flows/doctor-flow.js'

export interface TuiContext {
  cwd: string
  config: EnvVaultConfig
  policy: EnvVaultPolicy
}

export async function runTui(): Promise<void> {
  console.log('🔐 Git Env Vault - Interactive Mode\n')
  
  const cwd = process.cwd()
  
  // Load config
  let config: EnvVaultConfig
  let policy: EnvVaultPolicy
  
  try {
    config = await loadConfig(cwd)
    policy = await loadPolicy(cwd)
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ ${error.message}`)
      
      const shouldInit = await confirm({
        message: 'Would you like to run `envvault init`?',
        default: true
      })
      
      if (shouldInit) {
        const { initCommand } = await import('../cli/commands/init.js')
        await initCommand.parseAsync(['node', 'envvault', 'init'])
        // Reload config after init
        config = await loadConfig(cwd)
        policy = await loadPolicy(cwd)
      } else {
        process.exit(1)
      }
    } else {
      throw error
    }
  }
  
  const ctx: TuiContext = { cwd, config, policy }
  
  // Main loop
  while (true) {
    try {
      // Select environment
      const env = await selectEnvironment(ctx)
      if (!env) break
      
      // Select services
      const services = await selectServices(ctx, env)
      if (services.length === 0) continue
      
      // Select action
      const action = await selectAction(ctx, env, services)
      if (!action) continue
      
      // Run action
      switch (action) {
        case 'pull':
          await runPullFlow(ctx, env, services)
          break
        case 'edit':
          await runEditFlow(ctx, env, services[0]!)
          break
        case 'set':
          await runSetFlow(ctx, env, services[0]!)
          break
        case 'grant':
          await runGrantFlow(ctx, env, services[0]!)
          break
        case 'revoke':
          await runRevokeFlow(ctx, env, services[0]!)
          break
        case 'rotate':
          await runRotateFlow(ctx, env, services)
          break
        case 'doctor':
          await runDoctorFlow(ctx)
          break
      }
      
      // Ask if continue
      const shouldContinue = await confirm({
        message: 'Perform another action?',
        default: false
      })
      
      if (!shouldContinue) break
    } catch (error) {
      if ((error as Error).message === 'User abort') {
        break
      }
      throw error
    }
  }
  
  console.log('\n👋 Goodbye!')
}
