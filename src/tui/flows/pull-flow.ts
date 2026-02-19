import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { TuiContext } from '../run.js'
import { SopsAdapter, renderDotenv } from '../../core/index.js'
import ora from 'ora'

export async function runPullFlow(
  ctx: TuiContext,
  env: string,
  services: string[]
): Promise<void> {
  const sops = new SopsAdapter()
  const spinner = ora()
  
  for (const service of services) {
    const secretPath = join(ctx.cwd, ctx.config.secretsDir, env, `${service}.sops.yaml`)
    const outputPath = join(ctx.cwd, ctx.config.services[service]!.envOutput)
    
    spinner.start(`Decrypting ${env}/${service}...`)
    
    try {
      const { data } = await sops.decrypt(secretPath)
      const envContent = renderDotenv(data)
      
      spinner.text = `Writing to ${outputPath}...`
      
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, envContent, 'utf-8')
      
      spinner.succeed(`Wrote ${outputPath} (${Object.keys(data).length} keys)`)
    } catch (error) {
      spinner.fail(`Failed to decrypt ${env}/${service}`)
      console.error(`   ${(error as Error).message}`)
    }
  }
  
  console.log('\n✅ Pull complete')
}
