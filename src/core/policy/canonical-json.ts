/**
 * Deterministic JSON canonicalization for policy signatures
 * Uses sorted keys and stable whitespace
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null) return 'null'
  if (obj === undefined) return 'null'

  if (typeof obj === 'boolean') return obj.toString()
  if (typeof obj === 'number') {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      throw new Error('Cannot canonicalize NaN or Infinity')
    }
    return obj.toString()
  }
  if (typeof obj === 'string') return JSON.stringify(obj)

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalizeJson(item))
    return `[${items.join(',')}]`
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>
    const sortedKeys = Object.keys(record).sort()
    const pairs = sortedKeys.map((key) => {
      const value = canonicalizeJson(record[key])
      return `${JSON.stringify(key)}:${value}`
    })
    return `{${pairs.join(',')}}`
  }

  throw new Error(`Unknown type: ${typeof obj}`)
}
