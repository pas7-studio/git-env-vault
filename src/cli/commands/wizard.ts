/**
 * Auto-detect wizard for envvault configuration
 *
 * @module gev:cli/commands/wizard
 *
 * Scans project structure and auto-generates:
 * - envvault.config.json
 * - envvault.schema.yaml (optional)
 */

import { Command } from 'commander';
import { readdir, access, readFile, writeFile, stat } from 'fs/promises';
import { join, basename, dirname, relative } from 'path';
import { confirm, input, checkbox } from '@inquirer/prompts';
import { constants } from 'fs';
import { loadConfig, generateConfigJson } from '../../core/config/index.js';
import type { EnvVaultConfig } from '../../core/types/index.js';

interface DetectedService {
  name: string;
  path: string;
  envOutput: string;
  hasEnvFile: boolean;
  envFilePaths: string[];
  type: 'app' | 'package' | 'docker';
}

export interface ScanResult {
  monorepoType: 'apps-packages' | 'docker-compose' | 'single' | 'unknown';
  services: DetectedService[];
  hasDockerCompose: boolean;
  dockerComposePath?: string;
}

/**
 * Check if a file or directory exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get list of subdirectories in a directory
 */
async function getSubdirectories(parentPath: string): Promise<string[]> {
  if (!(await exists(parentPath))) {
    return [];
  }

  const entries = await readdir(parentPath);
  const dirs: string[] = [];

  for (const entry of entries) {
    const fullPath = join(parentPath, entry);
    if (await isDirectory(fullPath)) {
      dirs.push(entry);
    }
  }

  return dirs;
}

/**
 * Find .env files in a directory
 */
async function findEnvFiles(dirPath: string): Promise<string[]> {
  if (!(await exists(dirPath))) {
    return [];
  }

  const entries = await readdir(dirPath);
  const envFiles: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith('.env')) {
      envFiles.push(entry);
    }
  }

  return envFiles;
}

/**
 * Scan project for services
 */
export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const services: DetectedService[] = [];
  let monorepoType: ScanResult['monorepoType'] = 'unknown';
  let hasDockerCompose = false;
  let dockerComposePath: string | undefined;

  // Check for apps/* structure (monorepo)
  const appsDir = join(projectRoot, 'apps');
  const packagesDir = join(projectRoot, 'packages');

  const appsExists = await exists(appsDir);
  const packagesExists = await exists(packagesDir);

  if (appsExists || packagesExists) {
    monorepoType = 'apps-packages';

    // Scan apps directory
    if (appsExists) {
      const appDirs = await getSubdirectories(appsDir);
      for (const appDir of appDirs) {
        const appPath = join(appsDir, appDir);
        const envFiles = await findEnvFiles(appPath);
        const relativePath = relative(projectRoot, appPath);

        services.push({
          name: appDir,
          path: appPath,
          envOutput: join(relativePath, '.env'),
          hasEnvFile: envFiles.length > 0,
          envFilePaths: envFiles.map((f) => join(appPath, f)),
          type: 'app',
        });
      }
    }

    // Scan packages directory
    if (packagesExists) {
      const pkgDirs = await getSubdirectories(packagesDir);
      for (const pkgDir of pkgDirs) {
        const pkgPath = join(packagesDir, pkgDir);
        const envFiles = await findEnvFiles(pkgPath);
        const relativePath = relative(projectRoot, pkgPath);

        services.push({
          name: pkgDir,
          path: pkgPath,
          envOutput: join(relativePath, '.env'),
          hasEnvFile: envFiles.length > 0,
          envFilePaths: envFiles.map((f) => join(pkgPath, f)),
          type: 'package',
        });
      }
    }
  }

  // Check for docker-compose files
  const dockerComposeNames = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ];

  for (const name of dockerComposeNames) {
    const composePath = join(projectRoot, name);
    if (await exists(composePath)) {
      hasDockerCompose = true;
      dockerComposePath = composePath;
      break;
    }
  }

  // If no monorepo structure found, check for single service
  if (services.length === 0) {
    const envFiles = await findEnvFiles(projectRoot);

    if (hasDockerCompose || envFiles.length > 0) {
      monorepoType = hasDockerCompose ? 'docker-compose' : 'single';

      services.push({
        name: basename(projectRoot) || 'main',
        path: projectRoot,
        envOutput: '.env',
        hasEnvFile: envFiles.length > 0,
        envFilePaths: envFiles,
        type: hasDockerCompose ? 'docker' : 'app',
      });
    }
  }

  const result: ScanResult = {
    monorepoType,
    services,
    hasDockerCompose,
  };
  
  if (dockerComposePath !== undefined) {
    result.dockerComposePath = dockerComposePath;
  }
  
  return result;
}

/**
 * Extract service names from docker-compose file
 */
async function parseDockerComposeServices(
  composePath: string
): Promise<string[]> {
  try {
    const content = await readFile(composePath, 'utf-8');
    const { parse: parseYaml } = await import('yaml');
    const doc = parseYaml(content);

    if (doc && doc.services) {
      return Object.keys(doc.services);
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Generate schema content based on detected services
 */
function generateInitialSchema(services: DetectedService[]): string {
  const lines: string[] = [
    '# envvault.schema.yaml',
    '# Defines required and optional environment variables for each service',
    '',
    'version: 1',
    '',
    'services:',
  ];

  for (const service of services) {
    lines.push(`  ${service.name}:`);
    lines.push('    required: []');
    lines.push('    optional: []');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main wizard command implementation
 */
async function runWizard(options: { schema?: boolean; force?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n🔍 Scanning project structure...\n');

  // Check for existing config
  const configExists = await exists(join(projectRoot, 'envvault.config.json'));
  if (configExists && !options.force) {
    const overwrite = await confirm({
      message: 'envvault.config.json already exists. Overwrite?',
      default: false,
    });

    if (!overwrite) {
      console.log('❌ Wizard cancelled.');
      return;
    }
  }

  // Scan project
  const scanResult = await scanProject(projectRoot);

  console.log(`📁 Detected project type: ${scanResult.monorepoType}`);
  console.log(`🔍 Found ${scanResult.services.length} potential service(s)\n`);

  if (scanResult.services.length === 0) {
    console.log('⚠️  No services detected. You may need to:');
    console.log('   - Create an apps/ or packages/ directory for monorepo');
    console.log('   - Add a docker-compose.yml file');
    console.log('   - Or create an .env file in the root');
    return;
  }

  // Let user select services
  const selectedServices = await checkbox({
    message: 'Select services to configure:',
    choices: scanResult.services.map((s) => ({
      name: `${s.name} (${s.type})${s.hasEnvFile ? ' 📄' : ''}`,
      value: s.name,
      checked: true,
    })),
  });

  if (selectedServices.length === 0) {
    console.log('❌ No services selected. Wizard cancelled.');
    return;
  }

  // Build config
  const configServices: Record<string, { envOutput: string }> = {};

  for (const serviceName of selectedServices) {
    const service = scanResult.services.find((s) => s.name === serviceName);
    if (service) {
      configServices[serviceName] = {
        envOutput: service.envOutput,
      };
    }
  }

  // Ask for secrets directory
  const secretsDir = await input({
    message: 'Where should encrypted secrets be stored?',
    default: 'secrets',
  });

  const config: EnvVaultConfig = {
    version: 1,
    secretsDir,
    services: configServices,
  };

  // Write config
  const configContent = generateConfigJson(config);
  await writeFile(join(projectRoot, 'envvault.config.json'), configContent, 'utf-8');
  console.log('\n✅ Created envvault.config.json');

  // Optionally create schema
  if (options.schema) {
    const selectedServicesList = scanResult.services.filter((s) =>
      selectedServices.includes(s.name)
    );
    const schemaContent = generateInitialSchema(selectedServicesList);
    await writeFile(
      join(projectRoot, 'envvault.schema.yaml'),
      schemaContent,
      'utf-8'
    );
    console.log('✅ Created envvault.schema.yaml');
  } else {
    const createSchema = await confirm({
      message: 'Create envvault.schema.yaml for required keys validation?',
      default: false,
    });

    if (createSchema) {
      const selectedServicesList = scanResult.services.filter((s) =>
        selectedServices.includes(s.name)
      );
      const schemaContent = generateInitialSchema(selectedServicesList);
      await writeFile(
        join(projectRoot, 'envvault.schema.yaml'),
        schemaContent,
        'utf-8'
      );
      console.log('✅ Created envvault.schema.yaml');
    }
  }

  // Summary
  console.log('\n📋 Configuration Summary:');
  console.log(`   Secrets directory: ${secretsDir}/`);
  console.log(`   Services configured: ${selectedServices.join(', ')}`);
  console.log('\n✨ Setup complete! Next steps:');
  console.log('   1. Edit envvault.config.json if needed');
  console.log('   2. Add required keys to envvault.schema.yaml');
  console.log('   3. Run "envvault init" to initialize encryption');
  console.log('   4. Run "envvault grant" to add team members');
}

export const wizardCommand = new Command('wizard')
  .description('Auto-detect project structure and generate configuration')
  .option('--schema', 'Create schema file automatically')
  .option('--force', 'Overwrite existing config without prompting')
  .action(async (options) => {
    try {
      await runWizard(options);
    } catch (error) {
      console.error('❌ Wizard failed:', (error as Error).message);
      process.exit(1);
    }
  });
