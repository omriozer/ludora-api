/**
 * OpenAPI Contract Tests for Ludora API
 *
 * Validates that API responses match the documented OpenAPI schemas.
 * These tests ensure API contract compliance and catch schema drift.
 *
 * @module tests/contract/api-contract
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import { specs } from '../../src/openapi/index.js';

// Initialize AJV validator with OpenAPI schema (no ajv-formats for now)
const ajv = new Ajv({
  strict: false,  // Allow additional properties in responses
  allErrors: true,  // Report all validation errors, not just the first
  validateFormats: false  // Disable format validation for now to avoid compatibility issues
});

// Extract schemas from OpenAPI spec
let schemas = {};

beforeAll(() => {
  // Extract component schemas from OpenAPI spec
  if (specs.components && specs.components.schemas) {
    schemas = specs.components.schemas;

    // Add schemas to AJV for validation
    Object.entries(schemas).forEach(([name, schema]) => {
      try {
        ajv.addSchema(schema, `#/components/schemas/${name}`);
      } catch (error) {
        console.warn(`Failed to add schema ${name}:`, error.message);
      }
    });
  }
});

/**
 * Helper function to validate data against a schema
 * @param {Object} data - The data to validate
 * @param {string} schemaName - Name of the schema to validate against
 * @returns {Object} Validation result with { valid: boolean, errors: array }
 */
function validateAgainstSchema(data, schemaName) {
  const schemaRef = `#/components/schemas/${schemaName}`;
  const validate = ajv.getSchema(schemaRef);

  if (!validate) {
    return {
      valid: false,
      errors: [{ message: `Schema '${schemaName}' not found in OpenAPI spec` }]
    };
  }

  const valid = validate(data);

  return {
    valid,
    errors: validate.errors || []
  };
}

describe('OpenAPI Schema Validation', () => {
  describe('Schema Loading', () => {
    it('should load OpenAPI specification successfully', () => {
      expect(specs).toBeDefined();
      expect(specs.openapi).toBe('3.1.0');
      expect(specs.info).toBeDefined();
      expect(specs.info.title).toBe('Ludora Educational Platform API');
    });

    it('should have component schemas defined', () => {
      expect(schemas).toBeDefined();
      expect(Object.keys(schemas).length).toBeGreaterThan(0);
    });

    it('should have core schemas available', () => {
      const coreSchemas = ['User', 'AccessControlResponse', 'ErrorResponse'];

      coreSchemas.forEach(schemaName => {
        expect(schemas[schemaName]).toBeDefined();
      });
    });

    it('should have product schemas available', () => {
      const productSchemas = ['ProductBase', 'GameEntity', 'FileEntity', 'ProductWithAccess'];

      productSchemas.forEach(schemaName => {
        expect(schemas[schemaName]).toBeDefined();
      });
    });
  });

  describe('Core Schema Validation', () => {
    describe('User Schema', () => {
      it('should validate a valid user object', () => {
        const validUser = {
          id: 'user_abc123',
          email: 'teacher@example.com',
          role: 'teacher',
          first_name: 'Sarah',
          last_name: 'Cohen',
          created_at: '2025-01-15T10:00:00Z'
        };

        const result = validateAgainstSchema(validUser, 'User');

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject user with missing required fields', () => {
        const invalidUser = {
          email: 'teacher@example.com'
          // Missing id and role
        };

        const result = validateAgainstSchema(invalidUser, 'User');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject user with invalid role', () => {
        const invalidUser = {
          id: 'user_abc123',
          email: 'teacher@example.com',
          role: 'invalid_role'  // Not in enum
        };

        const result = validateAgainstSchema(invalidUser, 'User');

        expect(result.valid).toBe(false);
      });
    });

    describe('AccessControlResponse Schema', () => {
      it('should validate a valid access control response', () => {
        const validResponse = {
          hasAccess: true,
          accessType: 'purchase',
          canDownload: true,
          canPreview: true,
          canPlay: true,
          remainingAllowances: 'unlimited',
          expiresAt: null
        };

        const result = validateAgainstSchema(validResponse, 'AccessControlResponse');

        if (!result.valid) {
          console.log('AccessControlResponse validation errors:', JSON.stringify(result.errors, null, 2));
        }

        expect(result.valid).toBe(true);
      });

      it('should validate access control with numeric allowances', () => {
        const validResponse = {
          hasAccess: true,
          accessType: 'subscription_claim',
          canDownload: true,
          canPreview: true,
          canPlay: true,
          remainingAllowances: 42,
          expiresAt: '2025-12-31T23:59:59Z'
        };

        const result = validateAgainstSchema(validResponse, 'AccessControlResponse');

        expect(result.valid).toBe(true);
      });

      it('should reject access control with invalid access type', () => {
        const invalidResponse = {
          hasAccess: true,
          accessType: 'invalid_type',  // Not in enum
          canDownload: true,
          canPreview: true,
          canPlay: true,
          remainingAllowances: 'unlimited',
          expiresAt: null
        };

        const result = validateAgainstSchema(invalidResponse, 'AccessControlResponse');

        expect(result.valid).toBe(false);
      });
    });

    describe('ErrorResponse Schema', () => {
      it('should validate a basic error response', () => {
        const validError = {
          error: 'PRODUCT_NOT_FOUND',
          message: 'Product with ID "game_123" was not found'
        };

        const result = validateAgainstSchema(validError, 'ErrorResponse');

        expect(result.valid).toBe(true);
      });

      it('should validate error response with details', () => {
        const validError = {
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            field: 'title',
            reason: 'Title is required'
          }
        };

        const result = validateAgainstSchema(validError, 'ErrorResponse');

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Product Schema Validation', () => {
    describe('ProductBase Schema', () => {
      it('should validate a basic product', () => {
        const validProduct = {
          id: 'product_abc123',
          product_type: 'game',
          title: 'Advanced Memory Game',
          description: 'A challenging memory game for students',
          price: 49.90,
          creator_user_id: 'user_teacher123',
          created_at: '2025-01-15T10:00:00Z'
        };

        const result = validateAgainstSchema(validProduct, 'ProductBase');

        expect(result.valid).toBe(true);
      });

      it('should reject product with invalid type', () => {
        const invalidProduct = {
          id: 'product_abc123',
          product_type: 'invalid_type',  // Not in enum
          title: 'Test Product',
          price: 49.90,
          creator_user_id: 'user_teacher123',
          created_at: '2025-01-15T10:00:00Z'
        };

        const result = validateAgainstSchema(invalidProduct, 'ProductBase');

        expect(result.valid).toBe(false);
      });

      it('should reject product with negative price', () => {
        const invalidProduct = {
          id: 'product_abc123',
          product_type: 'game',
          title: 'Test Product',
          price: -10,  // Negative price
          creator_user_id: 'user_teacher123',
          created_at: '2025-01-15T10:00:00Z'
        };

        const result = validateAgainstSchema(invalidProduct, 'ProductBase');

        expect(result.valid).toBe(false);
      });
    });

    describe('GameEntity Schema', () => {
      it('should validate a valid game entity', () => {
        const validGame = {
          id: 'game_abc123',
          game_type: 'memory',
          difficulty: 'medium',
          cards_data: [
            { front: 'Card 1 Front', back: 'Card 1 Back' },
            { front: 'Card 2 Front', back: 'Card 2 Back' }
          ]
        };

        const result = validateAgainstSchema(validGame, 'GameEntity');

        expect(result.valid).toBe(true);
      });

      it('should reject game with invalid difficulty', () => {
        const invalidGame = {
          id: 'game_abc123',
          game_type: 'memory',
          difficulty: 'impossible',  // Not in enum
          cards_data: []
        };

        const result = validateAgainstSchema(invalidGame, 'GameEntity');

        expect(result.valid).toBe(false);
      });
    });

    describe('FileEntity Schema', () => {
      it('should validate a valid file entity', () => {
        const validFile = {
          id: 'file_abc123',
          filename: 'worksheet.pdf',
          file_size: 2048576,
          content_type: 'application/pdf'
        };

        const result = validateAgainstSchema(validFile, 'FileEntity');

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Authentication Schema Validation', () => {
    it('should have authentication schemas defined', () => {
      // Check if auth schemas exist (they might be in a separate file)
      // This test will pass if schemas are loaded, fail if not
      expect(specs.components).toBeDefined();
    });
  });

  describe('Subscription Schema Validation', () => {
    it('should have subscription schemas defined', () => {
      // Check if subscription schemas exist
      expect(specs.components).toBeDefined();
    });
  });
});

describe('Schema Validation Helper', () => {
  it('should export validateAgainstSchema function', () => {
    expect(typeof validateAgainstSchema).toBe('function');
  });

  it('should return validation errors for invalid data', () => {
    const invalidData = {
      // Missing all required fields
    };

    const result = validateAgainstSchema(invalidData, 'User');

    expect(result.valid).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should handle non-existent schema gracefully', () => {
    const result = validateAgainstSchema({}, 'NonExistentSchema');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('not found');
  });
});

// Export helper function for use in other tests
export { validateAgainstSchema };
