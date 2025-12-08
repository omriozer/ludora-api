/**
 * Jest Global Teardown
 * Runs once after all test suites
 */

export default async function globalTeardown() {
  // Cleanup - no database teardown needed for contract tests
  console.log('🧪 Jest global teardown complete');
}
