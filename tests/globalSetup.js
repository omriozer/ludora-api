/**
 * Jest Global Setup
 * Runs once before all test suites
 */

export default async function globalSetup() {
  // Set test environment variable
  process.env.NODE_ENV = 'test';
  process.env.ENVIRONMENT = 'test';

  // Minimal setup - no database initialization needed for contract tests
  console.log('🧪 Jest global setup complete');
}
