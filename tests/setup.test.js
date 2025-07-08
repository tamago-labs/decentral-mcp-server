const { test, describe, beforeAll, afterAll } = require('jest');

describe('Jest Configuration Test', () => {
  test('Jest is properly configured', () => {
    expect(true).toBe(true);
  });

  test('Environment variables are accessible', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
