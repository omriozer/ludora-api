#!/usr/bin/env node

/**
 * Git Hooks Installer for Ludora
 *
 * This script installs the pre-push hook that validates environment variables
 * before allowing pushes to main/staging branches.
 *
 * Usage:
 *   node scripts/install-hooks.js           # Install hooks
 *   node scripts/install-hooks.js --remove  # Remove hooks
 *   npm run hooks:install                   # Via npm script
 *
 * The hook is installed to .git/hooks/pre-push and will:
 * - Block pushes to 'main' if production env vars are out of sync
 * - Block pushes to 'staging' if staging env vars are out of sync
 * - Allow emergency bypass with git push --no-verify
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync, chmodSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// TERMINAL COLORS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.warn(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`)
};

// ============================================================================
// PRE-PUSH HOOK CONTENT
// ============================================================================

const PRE_PUSH_HOOK = `#!/bin/bash

#
# Ludora Pre-Push Hook
# ====================
# This hook validates environment variables are synced to Heroku before
# allowing pushes to main (production) or staging branches.
#
# Auto-installed by: npm run hooks:install
# To bypass (EMERGENCY ONLY): git push --no-verify
#
# Exit codes:
#   0 - Push allowed
#   1 - Push blocked (env vars out of sync)
#

# Terminal colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color
BOLD='\\033[1m'

# Get the directory where this hook lives
HOOK_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"

# Read stdin for push info
while read local_ref local_sha remote_ref remote_sha
do
    # Extract branch name from ref
    branch=$(echo "$remote_ref" | sed 's/refs\\/heads\\///')

    # Only check pushes to main or staging
    if [ "$branch" != "main" ] && [ "$branch" != "staging" ]; then
        continue
    fi

    echo ""
    echo -e "\${CYAN}\${BOLD}=== Ludora Environment Validator ===\${NC}"
    echo ""

    # Determine environment based on branch
    if [ "$branch" = "main" ]; then
        ENV="production"
        CHECK_FLAG="--check-prod"
        echo -e "\${YELLOW}Push to MAIN detected - checking PRODUCTION environment...\${NC}"
    else
        ENV="staging"
        CHECK_FLAG="--check-staging"
        echo -e "\${YELLOW}Push to STAGING detected - checking STAGING environment...\${NC}"
    fi

    echo ""

    # Run the environment validator
    cd "$REPO_ROOT"

    # Check if node is available
    if ! command -v node &> /dev/null; then
        echo -e "\${RED}[ERROR] Node.js not found. Cannot validate environment variables.\${NC}"
        echo -e "\${YELLOW}Push will proceed without validation.\${NC}"
        exit 0
    fi

    # Check if validator script exists
    if [ ! -f "$REPO_ROOT/scripts/env-validator.js" ]; then
        echo -e "\${RED}[ERROR] env-validator.js not found.\${NC}"
        echo -e "\${YELLOW}Push will proceed without validation.\${NC}"
        exit 0
    fi

    # Run validator
    node scripts/env-validator.js --pre-push --branch="$branch"
    RESULT=$?

    if [ $RESULT -ne 0 ]; then
        echo ""
        echo -e "\${RED}\${BOLD}============================================\${NC}"
        echo -e "\${RED}\${BOLD}  PUSH BLOCKED - Environment Out of Sync   \${NC}"
        echo -e "\${RED}\${BOLD}============================================\${NC}"
        echo ""
        echo -e "Your push to \${CYAN}$branch\${NC} was blocked because"
        echo -e "environment variables are not synced with Heroku."
        echo ""
        echo -e "\${BOLD}To fix this:\${NC}"
        echo -e "  1. Review the differences above"
        if [ "$ENV" = "production" ]; then
            echo -e "  2. Run: \${CYAN}npm run env:sync-prod\${NC}"
        else
            echo -e "  2. Run: \${CYAN}npm run env:sync-staging\${NC}"
        fi
        echo -e "  3. Then retry your push"
        echo ""
        echo -e "\${YELLOW}Emergency bypass (NOT RECOMMENDED):\${NC}"
        echo -e "  git push --no-verify"
        echo ""
        exit 1
    fi

    echo ""
    echo -e "\${GREEN}\${BOLD}Environment check passed!\${NC}"
    echo -e "Proceeding with push to \${CYAN}$branch\${NC}..."
    echo ""
done

exit 0
`;

// ============================================================================
// INSTALLATION FUNCTIONS
// ============================================================================

/**
 * Find the .git directory (handles submodules and worktrees)
 */
function findGitDir() {
  const gitPath = path.join(ROOT_DIR, '.git');

  if (!existsSync(gitPath)) {
    return null;
  }

  // Check if .git is a file (worktree or submodule)
  try {
    const content = readFileSync(gitPath, 'utf-8').trim();
    if (content.startsWith('gitdir:')) {
      // It's a gitdir reference
      const actualGitDir = content.replace('gitdir:', '').trim();
      return path.isAbsolute(actualGitDir)
        ? actualGitDir
        : path.resolve(ROOT_DIR, actualGitDir);
    }
  } catch (error) {
    // .git is a directory, not a file
  }

  return gitPath;
}

/**
 * Install the pre-push hook
 */
function installHooks() {
  console.log('');
  console.log(`${colors.bold}${colors.cyan}=== Installing Ludora Git Hooks ===${colors.reset}`);
  console.log('');

  // Find .git directory
  const gitDir = findGitDir();
  if (!gitDir) {
    log.error('Not a git repository. Run this from the ludora-api directory.');
    process.exit(1);
  }

  log.info(`Git directory: ${gitDir}`);

  // Ensure hooks directory exists
  const hooksDir = path.join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    log.info('Creating hooks directory...');
    mkdirSync(hooksDir, { recursive: true });
  }

  // Check for existing pre-push hook
  const hookPath = path.join(hooksDir, 'pre-push');
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');
    if (existing.includes('Ludora Pre-Push Hook')) {
      log.info('Ludora pre-push hook already installed. Updating...');
    } else {
      log.warn('Existing pre-push hook found (not Ludora). Backing up...');
      const backupPath = hookPath + '.backup.' + Date.now();
      writeFileSync(backupPath, existing);
      log.info(`Backup saved to: ${backupPath}`);
    }
  }

  // Write the hook
  try {
    writeFileSync(hookPath, PRE_PUSH_HOOK);
    chmodSync(hookPath, '755'); // Make executable
    log.success(`Pre-push hook installed: ${hookPath}`);
  } catch (error) {
    log.error(`Failed to install hook: ${error.message}`);
    process.exit(1);
  }

  // Summary
  console.log('');
  console.log(`${colors.bold}What happens now:${colors.reset}`);
  console.log(`  - Pushes to ${colors.cyan}main${colors.reset} will check ${colors.yellow}production${colors.reset} environment`);
  console.log(`  - Pushes to ${colors.cyan}staging${colors.reset} will check ${colors.yellow}staging${colors.reset} environment`);
  console.log(`  - Pushes to other branches proceed normally`);
  console.log('');
  console.log(`${colors.bold}Useful commands:${colors.reset}`);
  console.log(`  npm run env:check-prod     # Check production sync status`);
  console.log(`  npm run env:check-staging  # Check staging sync status`);
  console.log(`  npm run env:sync-prod      # Sync to production`);
  console.log(`  npm run env:sync-staging   # Sync to staging`);
  console.log('');
  log.success('Git hooks installed successfully!');
}

/**
 * Remove the pre-push hook
 */
function removeHooks() {
  console.log('');
  console.log(`${colors.bold}${colors.cyan}=== Removing Ludora Git Hooks ===${colors.reset}`);
  console.log('');

  const gitDir = findGitDir();
  if (!gitDir) {
    log.error('Not a git repository.');
    process.exit(1);
  }

  const hookPath = path.join(gitDir, 'hooks', 'pre-push');

  if (!existsSync(hookPath)) {
    log.info('No pre-push hook found. Nothing to remove.');
    process.exit(0);
  }

  // Check if it's our hook
  const content = readFileSync(hookPath, 'utf-8');
  if (!content.includes('Ludora Pre-Push Hook')) {
    log.warn('Pre-push hook exists but is not the Ludora hook.');
    log.info('Not removing to avoid breaking other tools.');
    process.exit(0);
  }

  try {
    unlinkSync(hookPath);
    log.success('Pre-push hook removed successfully.');
  } catch (error) {
    log.error(`Failed to remove hook: ${error.message}`);
    process.exit(1);
  }

  console.log('');
  log.warn('Environment validation is now disabled.');
  log.warn('Pushes to main/staging will NOT be validated.');
}

/**
 * Check if hooks are installed
 */
function checkHooks() {
  const gitDir = findGitDir();
  if (!gitDir) {
    log.error('Not a git repository.');
    process.exit(1);
  }

  const hookPath = path.join(gitDir, 'hooks', 'pre-push');

  if (!existsSync(hookPath)) {
    log.warn('Pre-push hook is NOT installed');
    log.info('Run: npm run hooks:install');
    process.exit(1);
  }

  const content = readFileSync(hookPath, 'utf-8');
  if (!content.includes('Ludora Pre-Push Hook')) {
    log.warn('Pre-push hook exists but is NOT the Ludora hook');
    process.exit(1);
  }

  log.success('Ludora pre-push hook is installed and active');
  process.exit(0);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bold}Ludora Git Hooks Installer${colors.reset}

${colors.bold}Usage:${colors.reset}
  node scripts/install-hooks.js [options]

${colors.bold}Options:${colors.reset}
  --remove      Remove the Ludora pre-push hook
  --check       Check if hooks are installed
  --help, -h    Show this help message

${colors.bold}What it does:${colors.reset}
  Installs a pre-push hook that validates environment variables
  are properly synced to Heroku before allowing pushes to
  main (production) or staging branches.

${colors.bold}Examples:${colors.reset}
  npm run hooks:install     # Install hooks
  npm run hooks:remove      # Remove hooks
  npm run hooks:check       # Check installation status
`);
  process.exit(0);
}

if (args.includes('--remove')) {
  removeHooks();
} else if (args.includes('--check')) {
  checkHooks();
} else {
  installHooks();
}
