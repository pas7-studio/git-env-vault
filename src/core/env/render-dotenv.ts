import { EnvObject } from '../types/index.js'

export interface RenderOptions {
  sortKeys?: boolean
  order?: string[]
}

/**
 * Render EnvObject to .env file format
 */
export function renderDotenv(env: EnvObject, options: RenderOptions = {}): string {
  const { sortKeys = false, order } = options

  let keys: string[]
  if (order) {
    // Use provided order, add any missing keys at the end
    const orderedKeys = order.filter((k) => k in env)
    const remainingKeys = Object.keys(env).filter((k) => !order.includes(k))
    keys = [...orderedKeys, ...remainingKeys]
  } else if (sortKeys) {
    keys = Object.keys(env).sort()
  } else {
    keys = Object.keys(env)
  }

  const lines = keys.map((key) => {
    const value = env[key]
    if (value === undefined) return ''
    return `${key}=${quoteValue(value)}`
  })

  return lines.join('\n') + '\n'
}

/**
 * Quote a value if necessary
 */
function quoteValue(value: string): string {
  // If empty, return empty quotes
  if (value === '') return '""'

  // Check if quoting is needed
  const needsQuoting = /[\s#"']/.test(value) || value.startsWith('#')

  if (!needsQuoting) {
    return value
  }

  // Use double quotes and escape special chars
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')

  return `"${escaped}"`
}
