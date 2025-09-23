export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up global test flag
  delete global.__TEST_ENV__;
  
  // Any additional cleanup can be added here
  // For example, cleaning up test files, closing connections, etc.
  
  console.log('✅ Test environment cleanup complete');
}