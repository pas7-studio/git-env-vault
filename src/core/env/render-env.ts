import { EnvObject } from '../types/index.js'

export interface RenderOptions {
  order?: string[]
  includeComments?: boolean
}

/**
 * Render an EnvObject to .env file format
 */
export function renderDotenv(env: EnvObject, options: RenderOptions = {}): string {
  const { order, includeComments = false } = options
  const lines: string[] = []
  
  if (order && order.length > 0) {
    // Use specified order
    for (const key of order) {
      if (key in env) {
        lines.push(formatLine(key, env[key]!))
      }
    }
    
    // Add any keys not in order
    for (const key of Object.keys(env)) {
      if (!order.includes(key)) {
        lines.push(formatLine(key, env[key]!))
      }
    }
  } else {
    // Use natural order
    for (const [key, value] of Object.entries(env)) {
      lines.push(formatLine(key, value))
    }
  }
  
  return lines.join('\n') + '\n'
}

/**
 * Format a single .env line
 */
function formatLine(key: string, value: string): string {
  // Check if value needs quoting
  const needsQuoting = 
    value.includes(' ') ||
    value.includes('#') ||
    value.includes('\n') ||
    value.includes('\t') ||
    value.includes('=') ||
    value.startsWith('"') ||
    value.startsWith("'")
  
  if (needsQuoting) {
    // Escape double quotes and backslashes
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
    return `${key}="${escaped}"`
  }
  
  return `${key}=${value}`
}
