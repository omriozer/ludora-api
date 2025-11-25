/**
 * PayPlus Signature Verification Unit Tests
 *
 * Comprehensive test suite for PayPlus webhook signature verification
 * to ensure security and prevent payment fraud.
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import {
  verifyPayPlusSignature,
  generatePayPlusSignature,
  validateWebhookSignature
} from '../../../utils/payplusSignature.js';

// Mock the PaymentService to avoid database dependencies in unit tests
const mockPaymentService = {
  getPayPlusCredentials: jest.fn()
};

// Mock the logger to avoid log spam in tests
const mockLogger = {
  payment: jest.fn()
};

jest.unstable_mockModule('../../../services/PaymentService.js', () => ({
  default: mockPaymentService
}));

jest.unstable_mockModule('../../../lib/errorLogger.js', () => ({
  error: mockLogger
}));

describe('PayPlus Signature Verification', () => {
  const TEST_SECRET_KEY = 'test_secret_key_for_unit_tests';
  const VALID_PAYLOAD = {
    transaction: {
      uid: 'txn_123456789',
      payment_page_request_uid: 'req_987654321',
      status_code: '000'
    },
    status: 'success',
    amount: 100.50
  };

  beforeAll(() => {
    // Setup mock PaymentService to return test credentials
    mockPaymentService.getPayPlusCredentials.mockReturnValue({
      payment_secret_key: TEST_SECRET_KEY,
      environment: 'test'
    });
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks after tests
    jest.restoreAllMocks();
  });

  describe('verifyPayPlusSignature', () => {
    test('should accept valid HMAC-SHA256 signature for object payload', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(VALID_PAYLOAD, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should accept valid HMAC-SHA256 signature for string payload', () => {
      const stringPayload = JSON.stringify(VALID_PAYLOAD);
      const signature = generatePayPlusSignature(stringPayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(stringPayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should reject invalid signature', () => {
      const invalidSignature = 'invalid_signature_123';
      const result = verifyPayPlusSignature(VALID_PAYLOAD, invalidSignature, TEST_SECRET_KEY);

      expect(result).toBe(false);
    });

    test('should reject tampered payload', () => {
      // Generate signature for original payload
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      // Modify payload after signing
      const tamperedPayload = {
        ...VALID_PAYLOAD,
        transaction: {
          ...VALID_PAYLOAD.transaction,
          uid: 'modified_transaction_id' // This tampering should fail verification
        }
      };

      const result = verifyPayPlusSignature(tamperedPayload, signature, TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should reject when signature is missing', () => {
      const result = verifyPayPlusSignature(VALID_PAYLOAD, null, TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should reject when signature is empty string', () => {
      const result = verifyPayPlusSignature(VALID_PAYLOAD, '', TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should reject when secret key is missing', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(VALID_PAYLOAD, signature, null);
      expect(result).toBe(false);
    });

    test('should handle signature with sha256= prefix', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const prefixedSignature = `sha256=${signature}`;
      const result = verifyPayPlusSignature(VALID_PAYLOAD, prefixedSignature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should handle non-JSON string payloads', () => {
      const stringPayload = 'simple_string_payload';
      const signature = generatePayPlusSignature(stringPayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(stringPayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should handle complex nested objects', () => {
      const complexPayload = {
        transaction: {
          uid: 'txn_123',
          payment_page_request_uid: 'req_456',
          customer: {
            name: 'Test Customer',
            email: 'test@example.com',
            metadata: {
              custom_field: 'value',
              nested: {
                deep: 'object'
              }
            }
          }
        },
        items: [
          { name: 'Item 1', price: 50.00 },
          { name: 'Item 2', price: 75.25 }
        ]
      };

      const signature = generatePayPlusSignature(complexPayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(complexPayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should handle empty object payload', () => {
      const emptyPayload = {};
      const signature = generatePayPlusSignature(emptyPayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(emptyPayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should use PaymentService when no secret key provided', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(VALID_PAYLOAD, signature);

      expect(mockPaymentService.getPayPlusCredentials).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should handle PaymentService failure gracefully', () => {
      // Mock PaymentService to throw error
      mockPaymentService.getPayPlusCredentials.mockImplementationOnce(() => {
        throw new Error('PaymentService error');
      });

      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(VALID_PAYLOAD, signature);

      expect(result).toBe(false);
    });

    test('should be timing-attack resistant', () => {
      const payload = VALID_PAYLOAD;
      const validSignature = generatePayPlusSignature(payload, TEST_SECRET_KEY);
      const invalidSignature = 'a'.repeat(validSignature.length); // Same length invalid sig

      // Measure execution times
      const validTimes = [];
      const invalidTimes = [];
      const iterations = 100;

      // Test valid signatures
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        verifyPayPlusSignature(payload, validSignature, TEST_SECRET_KEY);
        const end = process.hrtime.bigint();
        validTimes.push(Number(end - start));
      }

      // Test invalid signatures
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        verifyPayPlusSignature(payload, invalidSignature, TEST_SECRET_KEY);
        const end = process.hrtime.bigint();
        invalidTimes.push(Number(end - start));
      }

      // Calculate averages
      const avgValidTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      const avgInvalidTime = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length;

      // Timing difference should be minimal (less than 50% difference)
      const timingDifference = Math.abs(avgValidTime - avgInvalidTime) / Math.max(avgValidTime, avgInvalidTime);
      expect(timingDifference).toBeLessThan(0.5);
    });

    test('should handle Unicode characters in payload', () => {
      const unicodePayload = {
        transaction: {
          uid: 'txn_unicode_test',
          customer_name: 'משתמש בדיקה', // Hebrew text
          description: '🎉 Payment successful! 💳', // Emojis
          special_chars: 'åäöø∞≈≠±§'
        }
      };

      const signature = generatePayPlusSignature(unicodePayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(unicodePayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });

    test('should handle very large payloads', () => {
      const largePayload = {
        transaction: { uid: 'large_test' },
        large_data: 'x'.repeat(10000) // 10KB of data
      };

      const signature = generatePayPlusSignature(largePayload, TEST_SECRET_KEY);
      const result = verifyPayPlusSignature(largePayload, signature, TEST_SECRET_KEY);

      expect(result).toBe(true);
    });
  });

  describe('generatePayPlusSignature', () => {
    test('should generate consistent signatures for same payload', () => {
      const signature1 = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const signature2 = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      expect(signature1).toBe(signature2);
    });

    test('should generate different signatures for different payloads', () => {
      const payload1 = { transaction: { uid: 'test1' } };
      const payload2 = { transaction: { uid: 'test2' } };

      const signature1 = generatePayPlusSignature(payload1, TEST_SECRET_KEY);
      const signature2 = generatePayPlusSignature(payload2, TEST_SECRET_KEY);

      expect(signature1).not.toBe(signature2);
    });

    test('should generate different signatures for different keys', () => {
      const signature1 = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const signature2 = generatePayPlusSignature(VALID_PAYLOAD, 'different_key');

      expect(signature1).not.toBe(signature2);
    });

    test('should generate hex string signatures', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      expect(signature).toMatch(/^[a-f0-9]+$/);
      expect(signature.length).toBe(64); // SHA256 hex = 64 characters
    });

    test('should use PaymentService when no secret key provided', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD);

      expect(mockPaymentService.getPayPlusCredentials).toHaveBeenCalled();
      expect(typeof signature).toBe('string');
    });

    test('should throw error when PaymentService fails and no key provided', () => {
      mockPaymentService.getPayPlusCredentials.mockImplementationOnce(() => {
        throw new Error('PaymentService error');
      });

      expect(() => {
        generatePayPlusSignature(VALID_PAYLOAD);
      }).toThrow('PaymentService error');
    });
  });

  describe('validateWebhookSignature', () => {
    test('should validate signature from request headers', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'x-payplus-signature': signature
        }
      };

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(true);
    });

    test('should check multiple header names', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'payplus-signature': signature // Alternative header name
        }
      };

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(true);
    });

    test('should use custom header names if provided', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'custom-signature-header': signature
        }
      };

      const result = validateWebhookSignature(mockRequest, ['custom-signature-header']);
      expect(result).toBe(true);
    });

    test('should return false when no signature header found', () => {
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'content-type': 'application/json'
        }
      };

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(false);
    });

    test('should return false for invalid signature in headers', () => {
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'x-payplus-signature': 'invalid_signature'
        }
      };

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(false);
    });

    test('should handle exception gracefully', () => {
      const mockRequest = null; // This will cause an exception

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(false);
    });

    test('should use first found signature header', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);
      const mockRequest = {
        body: VALID_PAYLOAD,
        headers: {
          'x-payplus-signature': signature,
          'payplus-signature': 'different_signature', // This should be ignored
          'x-signature': 'another_signature' // This should also be ignored
        }
      };

      const result = validateWebhookSignature(mockRequest);
      expect(result).toBe(true);
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle null payload gracefully', () => {
      const result = verifyPayPlusSignature(null, 'signature', TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should handle undefined payload gracefully', () => {
      const result = verifyPayPlusSignature(undefined, 'signature', TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should handle circular references in payload', () => {
      const circularPayload = { transaction: { uid: 'circular_test' } };
      circularPayload.circular = circularPayload; // Create circular reference

      // This should not crash due to JSON.stringify handling
      expect(() => {
        verifyPayPlusSignature(circularPayload, 'signature', TEST_SECRET_KEY);
      }).not.toThrow();
    });

    test('should handle very short signatures', () => {
      const result = verifyPayPlusSignature(VALID_PAYLOAD, 'short', TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should handle very long signatures', () => {
      const longSignature = 'a'.repeat(1000);
      const result = verifyPayPlusSignature(VALID_PAYLOAD, longSignature, TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should handle signatures with special characters', () => {
      const specialSignature = 'signature_with_special_chars_!@#$%^&*()';
      const result = verifyPayPlusSignature(VALID_PAYLOAD, specialSignature, TEST_SECRET_KEY);
      expect(result).toBe(false);
    });

    test('should be deterministic across multiple runs', () => {
      const results = [];
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      // Run verification multiple times
      for (let i = 0; i < 10; i++) {
        results.push(verifyPayPlusSignature(VALID_PAYLOAD, signature, TEST_SECRET_KEY));
      }

      // All results should be true and consistent
      expect(results.every(result => result === true)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('signature verification should complete within reasonable time', () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      const start = process.hrtime.bigint();
      verifyPayPlusSignature(VALID_PAYLOAD, signature, TEST_SECRET_KEY);
      const end = process.hrtime.bigint();

      const executionTimeMs = Number(end - start) / 1000000; // Convert to milliseconds
      expect(executionTimeMs).toBeLessThan(10); // Should complete within 10ms
    });

    test('should handle multiple concurrent verifications', async () => {
      const signature = generatePayPlusSignature(VALID_PAYLOAD, TEST_SECRET_KEY);

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve(verifyPayPlusSignature(VALID_PAYLOAD, signature, TEST_SECRET_KEY)));
      }

      const results = await Promise.all(promises);
      expect(results.every(result => result === true)).toBe(true);
    });
  });
});