import { Command } from 'commander'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  loadConfig,
  renderDotenv,
  resolveCryptoBackend,
  CryptoBackendSelectionError,
  parseDotenv,
  type EnvObject,
} from '../../core/index.js'

interface CiPayloadV1 {
  v: 1
  alg: 'aes-256-gcm'
  salt: string
  iv: string
  tag: string
  data: string
  meta?: {
    source?: 'vault-secret' | 'file'
    env?: string
    service?: string
    path?: string
  }
}

function toB64(input: Buffer): string {
  return input.toString('base64')
}

function fromB64(input: string): Buffer {
  return Buffer.from(input, 'base64')
}

function getCiKey(options: { key?: string; keyEnv?: string }): string {
  if (options.key) return String(options.key)
  const envName = options.keyEnv || 'ENVVAULT_CI_KEY'
  const value = process.env[envName]
  if (!value) {
    throw new Error(`CI key not provided. Use --key or set ${envName}.`)
  }
  return value
}

function sealText(plaintext: string, keyMaterial: string, meta?: CiPayloadV1['meta']): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(keyMaterial, salt, 32)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload: CiPayloadV1 = {
    v: 1,
    alg: 'aes-256-gcm',
    salt: toB64(salt),
    iv: toB64(iv),
    tag: toB64(tag),
    data: toB64(data),
  }
  if (meta) {
    payload.meta = meta
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

function unsealText(encodedPayload: string, keyMaterial: string): { plaintext: string; payload: CiPayloadV1 } {
  const raw = Buffer.from(encodedPayload.trim(), 'base64').toString('utf8')
  const payload = JSON.parse(raw) as CiPayloadV1
  if (payload.v !== 1 || payload.alg !== 'aes-256-gcm') {
    throw new Error('Unsupported CI payload format.')
  }
  const salt = fromB64(payload.salt)
  const iv = fromB64(payload.iv)
  const tag = fromB64(payload.tag)
  const data = fromB64(payload.data)
  const key = scryptSync(keyMaterial, salt, 32)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return { plaintext, payload }
}

async function loadSealSource(options: {
  env?: string
  service?: string
  fromFile?: string
}): Promise<{ plaintext: string; meta: CiPayloadV1['meta'] }> {
  const cwd = process.cwd()
  if (options.fromFile) {
    const plaintext = await readFile(join(cwd, String(options.fromFile)), 'utf-8')
    return {
      plaintext,
      meta: {
        source: 'file',
        path: String(options.fromFile),
      },
    }
  }

  if (!options.env || !options.service) {
    throw new Error('Use either --from-file <path> or --env <env> --service <service>.')
  }

  const config = await loadConfig(cwd)
  const secretPath = join(cwd, config.secretsDir, String(options.env), `${String(options.service)}.sops.yaml`)
  let backend
  try {
    backend = (
      await resolveCryptoBackend({
        preference: config.cryptoBackend ?? 'auto',
        capability: 'pull',
      })
    ).backend
  } catch (error) {
    if (error instanceof CryptoBackendSelectionError) {
      throw new Error(`${error.message}. Run \`envvault setup\` for install guidance.`)
    }
    throw error
  }

  const { data } = await backend.decrypt(secretPath)
  const plaintext = renderDotenv(data as EnvObject)
  return {
    plaintext,
    meta: {
      source: 'vault-secret',
      env: String(options.env),
      service: String(options.service),
    },
  }
}

export const ciSealCommand = new Command('ci-seal')
  .description('Create a CI-encrypted payload (AES-GCM) from a vault secret or file')
  .option('--env <env>', 'Environment (when sealing from vault secret)')
  .option('--service <service>', 'Service (when sealing from vault secret)')
  .option('--from-file <path>', 'Read plaintext from file instead of vault secret')
  .option('--key <value>', 'CI encryption key (avoid shell history in shared terminals)')
  .option('--key-env <name>', 'Environment variable containing CI key', 'ENVVAULT_CI_KEY')
  .option('--out <path>', 'Write payload to file instead of stdout')
  .option('--json', 'Print metadata as JSON (payload included)')
  .action(async (options) => {
    try {
      if (options.fromFile && (options.env || options.service)) {
        console.error('Error: Use either --from-file or --env/--service, not both.')
        process.exit(1)
      }
      const { plaintext, meta } = await loadSealSource(options)
      const key = getCiKey(options)
      const payload = sealText(plaintext, key, meta)

      if (options.out) {
        const outPath = join(process.cwd(), String(options.out))
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, payload, 'utf-8')
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              command: 'ci-seal',
              keyEnv: options.keyEnv || 'ENVVAULT_CI_KEY',
              meta,
              payload,
              output: options.out ?? null,
            },
            null,
            2
          )
        )
        return
      }

      if (options.out) {
        console.log(`CI payload written to ${options.out}`)
        return
      }

      console.log(payload)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

export const ciUnsealCommand = new Command('ci-unseal')
  .description('Decode a CI-encrypted payload (AES-GCM) into dotenv/plaintext')
  .option('--payload <value>', 'Base64 CI payload')
  .option('--payload-env <name>', 'Environment variable containing payload', 'ENVVAULT_CI_BLOB')
  .option('--key <value>', 'CI encryption key')
  .option('--key-env <name>', 'Environment variable containing CI key', 'ENVVAULT_CI_KEY')
  .option('--out <path>', 'Write plaintext to file (e.g. apps/api/.env)')
  .option('--json', 'Print metadata as JSON (plaintext omitted)')
  .option('--validate-dotenv', 'Parse output as dotenv to validate format', false)
  .action(async (options) => {
    try {
      const payloadValue = options.payload || process.env[String(options.payloadEnv || 'ENVVAULT_CI_BLOB')]
      if (!payloadValue) {
        console.error(
          `Error: CI payload not provided. Use --payload or set ${String(options.payloadEnv || 'ENVVAULT_CI_BLOB')}.`
        )
        process.exit(1)
      }

      const key = getCiKey(options)
      const { plaintext, payload } = unsealText(String(payloadValue), key)

      if (options.validateDotenv) {
        parseDotenv(plaintext)
      }

      if (options.out) {
        const outPath = join(process.cwd(), String(options.out))
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, plaintext, 'utf-8')
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              command: 'ci-unseal',
              meta: payload.meta ?? null,
              output: options.out ?? null,
              bytes: Buffer.byteLength(plaintext, 'utf8'),
            },
            null,
            2
          )
        )
        return
      }

      if (options.out) {
        console.log(`Decoded payload written to ${options.out}`)
        return
      }

      process.stdout.write(plaintext)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })
