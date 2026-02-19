import { select } from '@inquirer/prompts'
import { TuiContext } from '../run.js'

type Action = 'pull' | 'edit' | 'set' | 'grant' | 'revoke' | 'rotate' | 'doctor'

export async function selectAction(
  ctx: TuiContext,
  env: string,
  services: string[]
): Promise<Action | null> {
  const isSingleService = services.length === 1
  
  const actions: Array<{ name: string; value: Action; description: string }> = [
    {
      name: '📥 Pull',
      value: 'pull',
      description: 'Decrypt and write .env files'
    },
    ...(isSingleService ? [{
      name: '📝 Edit',
      value: 'edit' as Action,
      description: 'Edit secrets in editor'
    }] : []),
    ...(isSingleService ? [{
      name: '✏️  Set',
      value: 'set' as Action,
      description: 'Set key=value pairs'
    }] : []),
    ...(isSingleService ? [{
      name: '➕ Grant',
      value: 'grant' as Action,
      description: 'Add user access'
    }] : []),
    ...(isSingleService ? [{
      name: '➖ Revoke',
      value: 'revoke' as Action,
      description: 'Remove user access'
    }] : []),
    {
      name: '🔄 Rotate',
      value: 'rotate',
      description: 'Rotate encryption keys'
    },
    {
      name: '🏥 Doctor',
      value: 'doctor',
      description: 'Run diagnostics'
    }
  ]
  
  const action = await select({
    message: 'Select action',
    choices: actions
  })
  
  return action
}
