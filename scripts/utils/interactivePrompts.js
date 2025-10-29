/**
 * Interactive Prompts Utility
 * Handles user interaction, confirmations, and table display
 */

import readline from 'readline';

/**
 * Create readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask a yes/no question with default
 * @param {string} question - Question to ask
 * @param {boolean} defaultAnswer - Default answer if user just presses enter
 * @returns {Promise<boolean>} User's answer
 */
function askYesNo(question, defaultAnswer = false) {
  return new Promise((resolve) => {
    const rl = createInterface();
    const defaultText = defaultAnswer ? '[Y/n]' : '[y/N]';

    rl.question(`${question} ${defaultText}: `, (answer) => {
      rl.close();

      const input = answer.toLowerCase().trim();
      if (input === '') {
        resolve(defaultAnswer);
      } else if (input === 'y' || input === 'yes') {
        resolve(true);
      } else if (input === 'n' || input === 'no') {
        resolve(false);
      } else {
        console.log('Please answer yes (y) or no (n)');
        resolve(askYesNo(question, defaultAnswer));
      }
    });
  });
}

/**
 * Ask multiple choice question
 * @param {string} question - Question to ask
 * @param {Array} choices - Array of choice objects {key, description}
 * @param {string} defaultChoice - Default choice key
 * @returns {Promise<string>} Selected choice key
 */
function askMultipleChoice(question, choices, defaultChoice = null) {
  return new Promise((resolve) => {
    const rl = createInterface();

    console.log(`\n${question}`);
    choices.forEach(choice => {
      const isDefault = choice.key === defaultChoice ? ' (default)' : '';
      console.log(`${choice.key} = ${choice.description}${isDefault}`);
    });

    rl.question('\nChoice: ', (answer) => {
      rl.close();

      const input = answer.toLowerCase().trim();
      if (input === '' && defaultChoice) {
        resolve(defaultChoice);
      } else {
        const choice = choices.find(c => c.key.toLowerCase() === input);
        if (choice) {
          resolve(choice.key);
        } else {
          console.log('Invalid choice. Please try again.');
          resolve(askMultipleChoice(question, choices, defaultChoice));
        }
      }
    });
  });
}

/**
 * Display files in a formatted table
 * @param {Array} files - Array of file objects
 * @param {string} title - Table title
 * @param {number} maxRows - Maximum rows to display
 */
function displayFileTable(files, title, maxRows = 20) {
  if (files.length === 0) {
    console.log(`\n📋 ${title}: No files to display\n`);
    return;
  }

  console.log(`\n📋 ${title}:\n`);

  // Calculate column widths
  const headers = ['S3 Location', 'Size', 'Last Modified'];
  const colWidths = [60, 10, 15];

  // Display header
  const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join('│');
  const separatorRow = colWidths.map(width => '─'.repeat(width)).join('┼');

  console.log('┌' + separatorRow.replace(/┼/g, '┬') + '┐');
  console.log('│' + headerRow + '│');
  console.log('├' + separatorRow + '┤');

  // Display file rows
  const filesToShow = files.slice(0, maxRows);
  filesToShow.forEach(file => {
    const location = (file.s3Url || file.key || '').substring(0, colWidths[0] - 1);
    const size = (file.sizeFormatted || file.size || '').toString();
    const age = file.ageFormatted || file.lastModified || '';

    const row = [
      location.padEnd(colWidths[0]),
      size.padEnd(colWidths[1]),
      age.padEnd(colWidths[2])
    ].join('│');

    console.log('│' + row + '│');
  });

  console.log('└' + separatorRow.replace(/┼/g, '┴') + '┘');

  if (files.length > maxRows) {
    console.log(`\n... and ${files.length - maxRows} more files\n`);
  } else {
    console.log('');
  }
}

/**
 * Display operation summary
 * @param {Object} summary - Summary object with counts and sizes
 * @param {string} operation - Operation name (e.g., "move to trash", "delete")
 */
function displayOperationSummary(summary, operation) {
  const { totalFiles, totalSize, files } = summary;

  console.log(`\n🎯 Files to be ${operation}:`);
  console.log(`   Count: ${totalFiles.toLocaleString()} files`);
  console.log(`   Size: ${totalSize || 'Unknown size'}`);

  if (files && files.length > 0) {
    displayFileTable(files, `Files to ${operation}`, 10);
  }
}

/**
 * Display operation results
 * @param {Object} results - Results object
 * @param {string} operation - Operation name
 */
function displayOperationResults(results, operation) {
  const { successful, failed, totalProcessed, totalSize } = results;

  console.log(`\n✅ ${operation} completed:`);
  console.log(`   Successful: ${successful.length.toLocaleString()} files`);
  if (failed.length > 0) {
    console.log(`   Failed: ${failed.length.toLocaleString()} files`);
  }
  console.log(`   Total processed: ${totalProcessed.toLocaleString()} files`);
  if (totalSize) {
    console.log(`   Size processed: ${totalSize}`);
  }

  // Show successful operations
  if (successful.length > 0) {
    successful.slice(0, 5).forEach(result => {
      if (result.message) {
        console.log(`   ✓ ${result.message}`);
      }
    });

    if (successful.length > 5) {
      console.log(`   ... and ${successful.length - 5} more successful operations`);
    }
  }

  // Show failed operations
  if (failed.length > 0) {
    console.log('\n❌ Failed operations:');
    failed.slice(0, 3).forEach(result => {
      console.log(`   ✗ ${result.message || result.error}`);
    });

    if (failed.length > 3) {
      console.log(`   ... and ${failed.length - 3} more failures`);
    }
  }
}

/**
 * Ask for batch continuation with multiple options
 * @param {number} currentBatch - Current batch number
 * @param {number} totalBatches - Total number of batches
 * @param {Object} batchResults - Results from current batch
 * @returns {Promise<string>} User's choice (continue, stop, show, quit)
 */
async function askBatchContinuation(currentBatch, totalBatches, batchResults) {
  const { orphansFound, orphansProcessed, filesProcessed } = batchResults;

  console.log(`\nBatch ${currentBatch}/${totalBatches} completed:`);
  console.log(`   Files processed: ${filesProcessed || 0}`);
  console.log(`   Orphans found: ${orphansFound || 0}`);
  console.log(`   Orphans processed: ${orphansProcessed || 0}`);

  const choices = [
    { key: 'Y', description: 'Yes, continue to next batch' },
    { key: 'n', description: 'No, stop here' },
    { key: 's', description: 'Show details from this batch' },
    { key: 'q', description: 'Quit and save progress' }
  ];

  return await askMultipleChoice(
    'Continue to next batch?',
    choices,
    'Y'
  );
}

/**
 * Display environment warning for production
 * @param {string} environment - Environment name
 * @param {string} operation - Operation being performed
 * @returns {Promise<boolean>} Whether user confirmed
 */
async function displayEnvironmentWarning(environment, operation) {
  if (environment === 'production') {
    console.log('\n⚠️  WARNING: PRODUCTION ENVIRONMENT ⚠️');
    console.log(`You are about to ${operation} in the PRODUCTION environment.`);
    console.log('This operation affects live user data.');
    console.log('Please ensure you have:');
    console.log('  1. Reviewed the files that will be affected');
    console.log('  2. Confirmed S3 versioning is enabled');
    console.log('  3. Tested the operation in development first');

    return await askYesNo('\nAre you sure you want to proceed with PRODUCTION?', false);
  }

  return true;
}

/**
 * Display startup banner
 * @param {Object} config - Configuration object
 */
function displayStartupBanner(config) {
  const { environment, operation, batchSize, mode } = config;

  console.log('\n' + '='.repeat(60));
  console.log(`🧹 Starting Ludora Orphan File ${operation.charAt(0).toUpperCase() + operation.slice(1)}`);
  console.log('='.repeat(60));
  console.log(`🎯 Environment: ${environment.charAt(0).toUpperCase() + environment.slice(1)}`);
  console.log(`📦 Batch Size: ${batchSize} files`);
  console.log(`🔍 Mode: ${mode}`);
  console.log('='.repeat(60));
}

/**
 * Display final summary and ask about continuation
 * @param {Object} sessionSummary - Summary of entire session
 * @returns {Promise<boolean>} Whether user wants to continue with another operation
 */
async function displayFinalSummary(sessionSummary) {
  const { environment, totalFiles, orphansFound, orphansProcessed, timeElapsed, spaceSaved } = sessionSummary;

  console.log('\n' + '🎉'.repeat(20));
  console.log('SESSION COMPLETE');
  console.log('🎉'.repeat(20));
  console.log(`Environment: ${environment}`);
  console.log(`Files Scanned: ${totalFiles.toLocaleString()}`);
  console.log(`Orphans Found: ${orphansFound.toLocaleString()}`);
  console.log(`Orphans Processed: ${orphansProcessed.toLocaleString()}`);
  console.log(`Time Elapsed: ${timeElapsed}`);
  if (spaceSaved) {
    console.log(`Space Processed: ${spaceSaved}`);
  }
  console.log('🎉'.repeat(20));

  return await askYesNo('\nWould you like to run another cleanup operation?', false);
}

/**
 * Wait for user to press any key
 * @param {string} message - Message to display
 * @returns {Promise<void>}
 */
function waitForKeyPress(message = 'Press any key to continue...') {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(`\n${message}`, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Display progress dots (for long operations)
 * @param {string} message - Message to show with dots
 * @param {number} intervalMs - Interval between dots in milliseconds
 * @returns {Function} Function to stop the progress display
 */
function showProgressDots(message, intervalMs = 500) {
  let dotCount = 0;
  process.stdout.write(`${message}`);

  const interval = setInterval(() => {
    process.stdout.write('.');
    dotCount++;
    if (dotCount % 3 === 0) {
      process.stdout.write('\b\b\b   \b\b\b'); // Clear and restart dots
    }
  }, intervalMs);

  return () => {
    clearInterval(interval);
    process.stdout.write('\n');
  };
}

export {
  askYesNo,
  askMultipleChoice,
  displayFileTable,
  displayOperationSummary,
  displayOperationResults,
  askBatchContinuation,
  displayEnvironmentWarning,
  displayStartupBanner,
  displayFinalSummary,
  waitForKeyPress,
  showProgressDots
};