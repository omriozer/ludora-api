const { describe, it, expect } = require('@jest/globals');

describe('Basic backend test setup', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to Node.js environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should load test environment variables', () => {
    expect(process.env.ENVIRONMENT).toBe('test');
  });
});