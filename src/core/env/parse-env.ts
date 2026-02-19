import { EnvObject } from '../types/index.js'

export interface ParseResult {
  env: EnvObject
  order: string[]
}

/**
 * Parse a .env file content into key-value pairs
 * Preserves order of keys
 */
export function parseDotenv(content: string): ParseResult {
  const env: EnvObject = {}
  const order: string[] = []
  
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }
    
    // Find the first = sign
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) {
      // Invalid line, skip
      continue
    }
    
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    
    if (!key) {
      continue
    }
    
    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    
    // Only add key if not already present (first one wins)
    if (!(key in env)) {
      env[key] = value
      order.push(key)
    }
  }
  
  return { env, order }
}
