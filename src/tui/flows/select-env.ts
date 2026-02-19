import { select } from '@inquirer/prompts'
import { TuiContext } from '../run.js'

export async function selectEnvironment(ctx: TuiContext): Promise<string | null> {
  const environments = Object.keys(ctx.policy.environments)
  
  if (environments.length === 0) {
    console.log('❌ No environments configured')
    return null
  }
  
  const env = await select({
    message: 'Select environment',
    choices: environments.map(e => ({
      name: e.toUpperCase(),
      value: e,
      description: `Environment: ${e}`
    }))
  })
  
  return env
}
