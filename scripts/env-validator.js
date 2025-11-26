#!/usr/bin/env node

/**
 * Environment Variable Validator for Ludora
 *
 * This script validates that environment variables are properly synced
 * between local .env files and Heroku deployments.
 *
 * Usage:
 *   node scripts/env-validator.js --check-prod     # Check production sync
 *   node scripts/env-validator.js --check-staging  # Check staging sync
 *   node scripts/env-validator.js --sync-prod      # Sync to production (with confirmation)
 *   node scripts/env-validator.js --sync-staging   # Sync to staging (with confirmation)
 *   node scripts/env-validator.js --diff-prod      # Show diff only
 *   node scripts/env-validator.js --diff-staging   # Show diff only
 *
 * Exit codes:
 *   0 - Environment variables are in sync
 *   1 - Missing or mismatched variables (push should be blocked)
 *   2 - Heroku API error or configuration issue
 *   3 - User cancelled operation
 *
 * CRITICAL: This is designed to work with the pre-push hook to prevent
 * deployment failures due to missing environment variables.
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  production: {
    herokuApp: 'ludora-api-prod',
    envFile: '.env.production',
    branch: 'main'
  },
  staging: {
    herokuApp: 'ludora-api-staging',
    envFile: '.env.staging',
    branch: 'staging'
  }
};

// Variables that should NEVER be synced from local (sensitive or auto-managed)
const NEVER_SYNC_VARS = new Set([
  'DATABASE_URL',           // Managed by Heroku Postgres addon
  'HEROKU_APP_NAME',       // Auto-set by Heroku
  'HEROKU_DYNO_ID',        // Auto-set by Heroku
  'HEROKU_RELEASE_VERSION', // Auto-set by Heroku
  'HEROKU_SLUG_COMMIT',    // Auto-set by Heroku
  'HEROKU_SLUG_DESCRIPTION', // Auto-set by Heroku
  'PORT',                  // Auto-set by Heroku
  'DYNO'                   // Auto-set by Heroku
]);

// Variables that are optional (won't block push if missing)
const OPTIONAL_VARS = new Set([
  'DEBUG_USER',
  'ENABLE_DEBUG_LOGS',
  'LOG_LEVEL',
  'SENTRY_DSN',
  'NEW_RELIC_LICENSE_KEY',
  // AI features (optional)
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEFAULT_LLM_MODEL',
  // Email features (optional)
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'DEFAULT_FROM_EMAIL',
  // Notifications (optional)
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  // Documentation (optional)
  'API_DOCS_URL',
  // Development flags (optional)
  'CORS_DEV_OVERRIDE',
  'MAX_REQUEST_SIZE'
]);

// Variables that require extra confirmation before syncing
const SENSITIVE_VARS = new Set([
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'ADMIN_PASSWORD',
  'POSTGRES_PASSWORD',
  'DB_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
  'PAYPLUS_SECRET_KEY',
  'PAYPLUS_TERMINAL_UID',
  'FIREBASE_SERVICE_ACCOUNT',
  'TELEGRAM_BOT_TOKEN'
]);

// ============================================================================
// TERMINAL COLORS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

const log = {
  error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.warn(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}\n`),
  critical: (msg) => console.log(`\n${colors.bgRed}${colors.white}${colors.bold} BLOCKED ${colors.reset} ${colors.red}${msg}${colors.reset}\n`)
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse a .env file and return a Map of key-value pairs
 * Handles:
 *   - Full line comments (# at start)
 *   - Inline comments (# after value, with space before)
 *   - Quoted values (preserves content inside quotes including #)
 *   - Values with = in them
 */
function parseEnvFile(filePath) {
  const envVars = new Map();

  if (!existsSync(filePath)) {
    return envVars;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE (handle values with = in them)
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, separatorIndex).trim();
    let value = trimmed.substring(separatorIndex + 1).trim();

    // Handle quoted values (preserve content including # inside quotes)
    if ((value.startsWith('"') && value.includes('"')) ||
        (value.startsWith("'") && value.includes("'"))) {
      const quote = value[0];
      const endQuoteIndex = value.indexOf(quote, 1);
      if (endQuoteIndex > 0) {
        value = value.substring(1, endQuoteIndex);
      }
    } else {
      // For unquoted values, strip inline comments
      // Inline comment is space followed by # (or just # at start of remaining value)
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.substring(0, commentIndex).trim();
      }
      // Handle case where value starts with # (it's just a comment, empty value)
      if (value.startsWith('#')) {
        value = '';
      }
    }

    if (key) {
      envVars.set(key, value);
    }
  }

  return envVars;
}

/**
 * Get required variables from .env.example
 */
function getRequiredVariables() {
  const examplePath = path.join(ROOT_DIR, '.env.example');
  const envVars = parseEnvFile(examplePath);

  // Filter out variables that are marked as optional in the example
  const required = new Map();
  for (const [key, value] of envVars) {
    if (!OPTIONAL_VARS.has(key) && !NEVER_SYNC_VARS.has(key)) {
      required.set(key, value);
    }
  }

  return required;
}

/**
 * Fetch current Heroku config vars
 */
async function getHerokuConfig(appName) {
  try {
    const result = execSync(`heroku config --app ${appName} --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30 second timeout
    });

    const config = JSON.parse(result);
    return new Map(Object.entries(config));
  } catch (error) {
    if (error.message.includes('not logged in')) {
      throw new Error('Not logged into Heroku CLI. Run: heroku login');
    }
    if (error.message.includes('Couldn\'t find that app')) {
      throw new Error(`Heroku app "${appName}" not found. Check app name in configuration.`);
    }
    if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      throw new Error('Heroku API timeout. Check your internet connection.');
    }
    throw new Error(`Failed to fetch Heroku config: ${error.message}`);
  }
}

/**
 * Set a Heroku config var
 */
async function setHerokuConfig(appName, key, value) {
  try {
    // Escape value for shell
    const escapedValue = value.replace(/'/g, "'\\''");
    execSync(`heroku config:set ${key}='${escapedValue}' --app ${appName}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    });
    return true;
  } catch (error) {
    log.error(`Failed to set ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Interactive prompt for user confirmation
 */
async function confirm(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Mask sensitive values for display
 */
function maskValue(value) {
  if (!value) return '(empty)';
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

// ============================================================================
// CORE VALIDATION LOGIC
// ============================================================================

/**
 * Compare local and remote environment variables
 * Returns detailed diff information
 */
async function compareEnvironments(environment) {
  const config = CONFIG[environment];
  if (!config) {
    throw new Error(`Unknown environment: ${environment}`);
  }

  log.header(`Checking ${environment.toUpperCase()} Environment`);
  log.info(`Heroku App: ${config.herokuApp}`);
  log.info(`Local File: ${config.envFile}`);

  // Get required variables from .env.example
  const requiredVars = getRequiredVariables();
  log.info(`Required variables from .env.example: ${requiredVars.size}`);

  // Get local environment variables
  const localEnvPath = path.join(ROOT_DIR, config.envFile);
  const localVars = parseEnvFile(localEnvPath);

  if (localVars.size === 0) {
    log.warn(`Local file ${config.envFile} is empty or doesn't exist`);
  } else {
    log.info(`Local variables loaded: ${localVars.size}`);
  }

  // Get Heroku config
  log.info('Fetching Heroku configuration...');
  const herokuVars = await getHerokuConfig(config.herokuApp);
  log.info(`Heroku variables loaded: ${herokuVars.size}`);

  // Analyze differences
  const result = {
    environment,
    config,
    missing: [],       // In local but not in Heroku
    extra: [],         // In Heroku but not in local (informational)
    mismatched: [],    // Value differs between local and Heroku
    synced: [],        // Properly synced
    skipped: []        // Skipped (NEVER_SYNC_VARS)
  };

  // Check all local variables
  for (const [key, localValue] of localVars) {
    if (NEVER_SYNC_VARS.has(key)) {
      result.skipped.push({ key, reason: 'Auto-managed by Heroku' });
      continue;
    }

    const herokuValue = herokuVars.get(key);

    if (!herokuVars.has(key)) {
      result.missing.push({ key, localValue, isSensitive: SENSITIVE_VARS.has(key) });
    } else if (localValue !== herokuValue) {
      result.mismatched.push({
        key,
        localValue,
        herokuValue,
        isSensitive: SENSITIVE_VARS.has(key)
      });
    } else {
      result.synced.push({ key });
    }
  }

  // Check for variables in Heroku but not in local (informational only)
  for (const [key, herokuValue] of herokuVars) {
    if (!localVars.has(key) && !NEVER_SYNC_VARS.has(key)) {
      result.extra.push({ key, herokuValue, isSensitive: SENSITIVE_VARS.has(key) });
    }
  }

  // Check for required variables that are completely missing
  const requiredMissing = [];
  for (const [key] of requiredVars) {
    if (!herokuVars.has(key) && !localVars.has(key)) {
      requiredMissing.push(key);
    }
  }

  result.requiredMissing = requiredMissing;

  return result;
}

/**
 * Display comparison results in a user-friendly format
 */
function displayResults(result) {
  const { environment, missing, extra, mismatched, synced, skipped, requiredMissing } = result;

  // Synced variables (brief)
  if (synced.length > 0) {
    log.success(`${synced.length} variables are properly synced`);
  }

  // Skipped variables (brief)
  if (skipped.length > 0) {
    log.info(`${skipped.length} variables skipped (auto-managed)`);
  }

  // Missing from Heroku (CRITICAL)
  if (missing.length > 0) {
    console.log(`\n${colors.red}${colors.bold}MISSING FROM HEROKU (${missing.length}):${colors.reset}`);
    for (const { key, localValue, isSensitive } of missing) {
      const displayValue = isSensitive ? maskValue(localValue) : localValue;
      const sensitiveMarker = isSensitive ? ` ${colors.yellow}[SENSITIVE]${colors.reset}` : '';
      console.log(`  ${colors.red}- ${key}${colors.reset} = ${displayValue}${sensitiveMarker}`);
    }
  }

  // Mismatched values (CRITICAL)
  if (mismatched.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}VALUE MISMATCH (${mismatched.length}):${colors.reset}`);
    for (const { key, localValue, herokuValue, isSensitive } of mismatched) {
      const localDisplay = isSensitive ? maskValue(localValue) : localValue;
      const herokuDisplay = isSensitive ? maskValue(herokuValue) : herokuValue;
      const sensitiveMarker = isSensitive ? ` ${colors.yellow}[SENSITIVE]${colors.reset}` : '';
      console.log(`  ${colors.yellow}~ ${key}${colors.reset}${sensitiveMarker}`);
      console.log(`    ${colors.dim}Local:${colors.reset}  ${localDisplay}`);
      console.log(`    ${colors.dim}Heroku:${colors.reset} ${herokuDisplay}`);
    }
  }

  // Extra in Heroku (informational)
  if (extra.length > 0) {
    console.log(`\n${colors.cyan}${colors.bold}EXTRA IN HEROKU (${extra.length}):${colors.reset} ${colors.dim}(not in local)${colors.reset}`);
    for (const { key, herokuValue, isSensitive } of extra) {
      const displayValue = isSensitive ? maskValue(herokuValue) : herokuValue;
      console.log(`  ${colors.cyan}+ ${key}${colors.reset} = ${displayValue}`);
    }
  }

  // Required but completely missing
  if (requiredMissing.length > 0) {
    console.log(`\n${colors.bgRed}${colors.white}${colors.bold} REQUIRED VARIABLES MISSING EVERYWHERE (${requiredMissing.length}): ${colors.reset}`);
    for (const key of requiredMissing) {
      console.log(`  ${colors.red}! ${key}${colors.reset} - Required by .env.example`);
    }
  }

  console.log('');
}

/**
 * Check if push should be blocked based on comparison results
 */
function shouldBlockPush(result, isForceMode = false) {
  const { missing, mismatched, requiredMissing } = result;

  // Filter out optional vars
  const criticalMissing = missing.filter(v => !OPTIONAL_VARS.has(v.key));
  const criticalMismatched = mismatched.filter(v => !OPTIONAL_VARS.has(v.key));

  if (isForceMode) {
    if (criticalMissing.length > 0 || criticalMismatched.length > 0 || requiredMissing.length > 0) {
      log.warn('Force mode: Push will proceed despite environment mismatches');
      log.warn('This may cause deployment failures or runtime errors!');
      return false;
    }
  }

  return criticalMissing.length > 0 ||
         criticalMismatched.length > 0 ||
         requiredMissing.length > 0;
}

// ============================================================================
// SYNC FUNCTIONALITY
// ============================================================================

/**
 * Sync local environment variables to Heroku
 */
async function syncToHeroku(environment, options = {}) {
  const { dryRun = false, force = false } = options;

  const result = await compareEnvironments(environment);
  displayResults(result);

  const { config, missing, mismatched } = result;
  const toSync = [...missing, ...mismatched];

  if (toSync.length === 0) {
    log.success('No variables to sync - environments are already in sync!');
    return true;
  }

  // Separate sensitive and non-sensitive vars
  const sensitiveToSync = toSync.filter(v => v.isSensitive);
  const normalToSync = toSync.filter(v => !v.isSensitive);

  console.log(`\n${colors.bold}Will sync ${toSync.length} variable(s) to ${environment}:${colors.reset}`);

  if (normalToSync.length > 0) {
    console.log(`\nNormal variables (${normalToSync.length}):`);
    for (const { key, localValue } of normalToSync) {
      console.log(`  ${key} = ${localValue}`);
    }
  }

  if (sensitiveToSync.length > 0) {
    console.log(`\n${colors.yellow}Sensitive variables (${sensitiveToSync.length}):${colors.reset}`);
    for (const { key, localValue } of sensitiveToSync) {
      console.log(`  ${key} = ${maskValue(localValue)}`);
    }
  }

  if (dryRun) {
    log.info('Dry run mode - no changes will be made');
    return true;
  }

  // Confirmation
  console.log('');
  const envWarning = environment === 'production'
    ? `${colors.bgRed}${colors.white} PRODUCTION ${colors.reset}`
    : `${colors.bgYellow}${colors.white} STAGING ${colors.reset}`;

  if (!force) {
    const confirmed = await confirm(
      `${envWarning} Are you sure you want to sync these variables to ${config.herokuApp}?`
    );

    if (!confirmed) {
      log.warn('Sync cancelled by user');
      process.exit(3);
    }

    // Extra confirmation for sensitive vars in production
    if (sensitiveToSync.length > 0 && environment === 'production') {
      const confirmedSensitive = await confirm(
        `${colors.red}${colors.bold}This includes ${sensitiveToSync.length} SENSITIVE variable(s). Confirm again?${colors.reset}`
      );

      if (!confirmedSensitive) {
        log.warn('Sync cancelled by user');
        process.exit(3);
      }
    }
  }

  // Perform sync
  log.header('Syncing Variables');
  let successCount = 0;
  let failCount = 0;

  for (const { key, localValue } of toSync) {
    process.stdout.write(`Setting ${key}... `);
    const success = await setHerokuConfig(config.herokuApp, key, localValue);

    if (success) {
      console.log(`${colors.green}OK${colors.reset}`);
      successCount++;
    } else {
      console.log(`${colors.red}FAILED${colors.reset}`);
      failCount++;
    }
  }

  console.log('');
  log.info(`Sync complete: ${successCount} succeeded, ${failCount} failed`);

  if (failCount > 0) {
    log.error('Some variables failed to sync. Check errors above.');
    return false;
  }

  log.success('All variables synced successfully!');
  return true;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {
    checkProd: args.includes('--check-prod') || args.includes('--check-production'),
    checkStaging: args.includes('--check-staging'),
    syncProd: args.includes('--sync-prod') || args.includes('--sync-production'),
    syncStaging: args.includes('--sync-staging'),
    diffProd: args.includes('--diff-prod') || args.includes('--diff-production'),
    diffStaging: args.includes('--diff-staging'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    help: args.includes('--help') || args.includes('-h'),
    // Pre-push hook mode (used by git hook)
    prePush: args.includes('--pre-push'),
    branch: args.find(a => a.startsWith('--branch='))?.split('=')[1]
  };

  // Show help
  if (flags.help || args.length === 0) {
    console.log(`
${colors.bold}Ludora Environment Validator${colors.reset}

${colors.bold}Usage:${colors.reset}
  node scripts/env-validator.js [command] [options]

${colors.bold}Commands:${colors.reset}
  --check-prod       Check if local .env.production matches Heroku production
  --check-staging    Check if local .env.staging matches Heroku staging
  --sync-prod        Sync local .env.production to Heroku production
  --sync-staging     Sync local .env.staging to Heroku staging
  --diff-prod        Show diff without blocking (informational)
  --diff-staging     Show diff without blocking (informational)
  --pre-push         Pre-push hook mode (auto-detects branch)

${colors.bold}Options:${colors.reset}
  --force, -f        Skip confirmation prompts
  --dry-run          Show what would be synced without making changes
  --quiet, -q        Minimal output
  --branch=<name>    Override branch detection (for --pre-push)
  --help, -h         Show this help message

${colors.bold}Examples:${colors.reset}
  # Check production environment
  npm run env:check-prod

  # Sync staging with confirmation
  npm run env:sync-staging

  # Force sync without prompts (use with caution!)
  node scripts/env-validator.js --sync-prod --force

${colors.bold}Exit Codes:${colors.reset}
  0 - Success (environments in sync)
  1 - Mismatch found (push should be blocked)
  2 - Error (API failure, configuration issue)
  3 - User cancelled operation
`);
    process.exit(0);
  }

  try {
    // Pre-push hook mode
    if (flags.prePush) {
      const branch = flags.branch || getCurrentBranch();
      let environment;

      if (branch === 'main') {
        environment = 'production';
      } else if (branch === 'staging') {
        environment = 'staging';
      } else {
        log.info(`Branch "${branch}" doesn't require environment check`);
        process.exit(0);
      }

      const result = await compareEnvironments(environment);
      displayResults(result);

      if (shouldBlockPush(result, flags.force)) {
        log.critical(`Push to ${branch} BLOCKED - environment variables out of sync`);
        console.log(`${colors.bold}To fix this:${colors.reset}`);
        console.log(`  1. Review the differences above`);
        console.log(`  2. Sync your local env: ${colors.cyan}npm run env:sync-${environment === 'production' ? 'prod' : 'staging'}${colors.reset}`);
        console.log(`  3. Or use emergency override: ${colors.yellow}git push --no-verify${colors.reset} (NOT RECOMMENDED)`);
        console.log('');
        process.exit(1);
      }

      log.success(`Environment check passed for ${environment}`);
      process.exit(0);
    }

    // Check commands
    if (flags.checkProd) {
      const result = await compareEnvironments('production');
      displayResults(result);
      process.exit(shouldBlockPush(result, flags.force) ? 1 : 0);
    }

    if (flags.checkStaging) {
      const result = await compareEnvironments('staging');
      displayResults(result);
      process.exit(shouldBlockPush(result, flags.force) ? 1 : 0);
    }

    // Diff commands (informational only)
    if (flags.diffProd) {
      const result = await compareEnvironments('production');
      displayResults(result);
      process.exit(0);
    }

    if (flags.diffStaging) {
      const result = await compareEnvironments('staging');
      displayResults(result);
      process.exit(0);
    }

    // Sync commands
    if (flags.syncProd) {
      const success = await syncToHeroku('production', {
        dryRun: flags.dryRun,
        force: flags.force
      });
      process.exit(success ? 0 : 2);
    }

    if (flags.syncStaging) {
      const success = await syncToHeroku('staging', {
        dryRun: flags.dryRun,
        force: flags.force
      });
      process.exit(success ? 0 : 2);
    }

    log.error('No valid command specified. Use --help for usage.');
    process.exit(2);

  } catch (error) {
    log.error(error.message);

    if (error.message.includes('heroku login')) {
      console.log(`\n${colors.bold}To fix:${colors.reset}`);
      console.log(`  heroku login`);
    }

    process.exit(2);
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    return 'unknown';
  }
}

// Run main
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(2);
});
