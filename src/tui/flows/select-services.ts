import { checkbox } from '@inquirer/prompts'
import { TuiContext } from '../run.js'

export async function selectServices(
  ctx: TuiContext,
  env: string
): Promise<string[]> {
  const services = Object.keys(ctx.config.services)
  
  if (services.length === 0) {
    console.log('❌ No services configured')
    return []
  }
  
  // Get services that have recipients for this env
  const envPolicy = ctx.policy.environments[env]
  const availableServices = services.filter(s => {
    const servicePolicy = envPolicy?.services[s]
    return servicePolicy && servicePolicy.recipients.length > 0
  })
  
  if (availableServices.length === 0) {
    console.log(`⚠️  No services have recipients configured for ${env}`)
    return []
  }
  
  const selected = await checkbox({
    message: 'Select services (space to select, enter to confirm)',
    choices: availableServices.map(s => ({
      name: s,
      value: s,
      description: `Output: ${ctx.config.services[s]?.envOutput}`
    })),
    required: true
  })
  
  return selected
}
