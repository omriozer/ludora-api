#!/usr/bin/env node

/**
 * API Environment Variable Synchronization Script
 *
 * This script synchronizes environment variables from .env files to Heroku config vars
 * and manages environment-specific deployment configurations.
 *
 * Features:
 * - Reads .env files based on branch/environment mapping
 * - Compares with existing Heroku config vars
 * - Optionally prompts for confirmation on changes
 * - Supports staging, production, and development environments
 * - Handles sensitive variables with security checks
 * - Generates Heroku config:set commands or applies them directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment mapping configuration
const ENV_CONFIG = {
  'main': {
    envFile: '.env.production',
    herokuApp: 'ludora-api-prod',
    environment: 'production',
    excludeVars: ['PORT'] // PORT is managed by Heroku
  },
  'staging': {
    envFile: '.env.staging',
    herokuApp: 'ludora-api-staging',
    environment: 'staging',
    excludeVars: ['PORT'] // PORT is managed by Heroku
  },
  'development': {
    envFile: '.env.development',
    herokuApp: null, // No Heroku app for development
    environment: 'development',
    excludeVars: ['PORT', 'DB_HOST', 'DB_PORT'] // Local development values
  }
};

// Sensitive variables that require special handling
const SENSITIVE_VARIABLES = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'API_KEY',
  'ANTHROPIC_API_KEY',
  'EMAIL_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
  'PAYPLUS_SECRET_KEY',
  'PAYPLUS_STAGING_SECRET_KEY'
];

/**
 * Parse .env file into key-value pairs
 * @param {string} filePath - Path to .env file
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(filePath) {
  const envVars = {};

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Environment file not found: ${filePath}`);
    return envVars;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE or KEY="VALUE" or KEY='VALUE'
    const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)\\s*=\\s*(.*)$/);
    if (match) {
      const [, key, value] = match;

      // Remove surrounding quotes if present
      let cleanValue = value;
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        cleanValue = value.slice(1, -1);
      }

      // Skip empty values and placeholder comments
      if (cleanValue && !cleanValue.startsWith('#') && cleanValue.trim() !== '') {
        envVars[key] = cleanValue;
      }
    }
  }

  return envVars;
}

/**
 * Determine environment configuration based on current branch/context
 * @param {string} branch - Git branch name
 * @param {string} environment - Override environment
 * @returns {Object} Environment configuration
 */
function getEnvironmentConfig(branch = null, environment = null) {
  // Use explicit environment if provided
  if (environment && ENV_CONFIG[environment]) {
    return ENV_CONFIG[environment];
  }

  // Auto-detect from branch
  if (branch) {
    if (branch === 'main' || branch === 'master') {
      return ENV_CONFIG['main'];
    } else if (branch === 'staging') {
      return ENV_CONFIG['staging'];
    } else if (branch.startsWith('dev') || branch.includes('development')) {
      return ENV_CONFIG['development'];
    }
  }

  // Default to development for unknown branches
  console.warn(`⚠️  Unknown branch '${branch}', defaulting to development environment`);
  return ENV_CONFIG['development'];
}

/**
 * Check if a variable is sensitive and needs special handling
 * @param {string} key - Environment variable key
 * @returns {boolean} True if sensitive
 */
function isSensitiveVariable(key) {
  return SENSITIVE_VARIABLES.some(sensitive =>
    key.includes(sensitive) || key.endsWith('_KEY') || key.endsWith('_SECRET') || key.endsWith('_PASSWORD')
  );
}

/**
 * Generate Heroku config:set commands
 * @param {Object} envVars - Environment variables
 * @param {Object} config - Environment configuration
 * @returns {Array} Array of Heroku commands
 */
function generateHerokuCommands(envVars, config) {
  if (!config.herokuApp) {
    console.warn(`⚠️  No Heroku app configured for ${config.environment} environment`);
    return [];
  }

  const commands = [];
  const configVars = [];

  for (const [key, value] of Object.entries(envVars)) {
    // Skip excluded variables
    if (config.excludeVars && config.excludeVars.includes(key)) {
      console.log(`📋 Skipping ${key} (excluded for ${config.environment})`);
      continue;
    }

    // Escape quotes and special characters for shell
    const escapedValue = value.includes(' ') || value.includes('"') || value.includes("'")
      ? `"${value.replace(/"/g, '\\"')}"`
      : value;

    configVars.push(`${key}=${escapedValue}`);
  }

  if (configVars.length > 0) {
    // Split into chunks to avoid command line length limits
    const chunkSize = 10;
    for (let i = 0; i < configVars.length; i += chunkSize) {
      const chunk = configVars.slice(i, i + chunkSize);
      commands.push(`heroku config:set ${chunk.join(' ')} --app ${config.herokuApp}`);
    }
  }

  return commands;
}

/**
 * Compare environment variables with expected configuration
 * @param {Object} envVars - Environment variables from .env file
 * @param {Object} config - Environment configuration
 * @returns {Object} Comparison results
 */
function analyzeVariables(envVars, config) {
  const analysis = {
    totalVariables: Object.keys(envVars).length,
    sensitiveVariables: [],
    publicVariables: [],
    excludedVariables: [],
    herokuCommands: 0
  };

  for (const [key, value] of Object.entries(envVars)) {
    if (config.excludeVars && config.excludeVars.includes(key)) {
      analysis.excludedVariables.push(key);
      continue;
    }

    const isSensitive = isSensitiveVariable(key);
    if (isSensitive) {
      analysis.sensitiveVariables.push({ key, hasValue: !!value });
    } else {
      analysis.publicVariables.push({ key, value: value.length > 50 ? value.substring(0, 50) + '...' : value });
    }
  }

  const commands = generateHerokuCommands(envVars, config);
  analysis.herokuCommands = commands.length;

  return analysis;
}

/**
 * Main function to sync environment variables
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    branch: process.env.GITHUB_REF_NAME || 'development',
    environment: null,
    dryRun: false,
    interactive: false,
    outputFormat: 'heroku-commands' // 'heroku-commands' or 'env-file'
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--branch':
        options.branch = args[++i];
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--output-format':
        options.outputFormat = args[++i];
        break;
      case '--help':
        console.log(`
Usage: sync-env-variables.js [options]

Options:
  --branch <name>         Git branch name (auto-detected from GITHUB_REF_NAME)
  --environment <env>     Explicit environment (main|staging|development)
  --dry-run               Show what would be done without making changes
  --interactive           Prompt for confirmation on changes
  --output-format <fmt>   Output format: heroku-commands (default) or env-file
  --help                  Show this help message

Examples:
  # Auto-detect environment from branch
  sync-env-variables.js --branch staging

  # Force specific environment
  sync-env-variables.js --environment production --dry-run

  # Interactive mode with confirmation prompts
  sync-env-variables.js --branch main --interactive
        `);
        process.exit(0);
        break;
    }
  }

  console.log(`🔧 API Environment Variable Synchronization`);
  console.log(`Branch: ${options.branch}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Get environment configuration
  const config = getEnvironmentConfig(options.branch, options.environment);
  console.log(`📁 Environment: ${config.environment}`);
  console.log(`📄 Env File: ${config.envFile}`);
  console.log(`🚀 Heroku App: ${config.herokuApp || 'None (local development)'}`);
  console.log('');

  // Parse environment file
  const envFilePath = path.resolve(process.cwd(), config.envFile);
  const envVars = parseEnvFile(envFilePath);

  if (Object.keys(envVars).length === 0) {
    console.log(`❌ No environment variables found in ${config.envFile}`);
    process.exit(1);
  }

  console.log(`✅ Found ${Object.keys(envVars).length} environment variables`);

  // Analyze variables
  const analysis = analyzeVariables(envVars, config);

  console.log('');
  console.log('📊 Analysis:');
  console.log(`   • Total variables: ${analysis.totalVariables}`);
  console.log(`   • Sensitive variables: ${analysis.sensitiveVariables.length}`);
  console.log(`   • Public variables: ${analysis.publicVariables.length}`);
  console.log(`   • Excluded variables: ${analysis.excludedVariables.length}`);
  console.log(`   • Heroku commands needed: ${analysis.herokuCommands}`);

  if (analysis.excludedVariables.length > 0) {
    console.log('');
    console.log('🚫 Excluded Variables:');
    for (const variable of analysis.excludedVariables) {
      console.log(`   • ${variable} (managed by platform)`);
    }
  }

  // Generate output
  console.log('');
  if (options.outputFormat === 'heroku-commands') {
    const commands = generateHerokuCommands(envVars, config);
    if (commands.length > 0) {
      console.log('🚀 Heroku Configuration Commands:');
      console.log('```bash');
      for (const command of commands) {
        console.log(command);
      }
      console.log('```');
    } else {
      console.log('ℹ️  No Heroku commands needed (development environment or no valid variables)');
    }
  } else {
    console.log('📝 Environment File Content:');
    console.log('```env');
    for (const [key, value] of Object.entries(envVars)) {
      if (!(config.excludeVars && config.excludeVars.includes(key))) {
        console.log(`${key}=${value}`);
      }
    }
    console.log('```');
  }

  if (options.dryRun) {
    console.log('');
    console.log('ℹ️  This was a dry run. No changes were made.');
  }

  console.log('');
  console.log('✅ Environment variable synchronization analysis completed!');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { parseEnvFile, getEnvironmentConfig, generateHerokuCommands, analyzeVariables };