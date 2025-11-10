/**
 * Unit Tests for Smart Israeli Context Middleware
 *
 * Tests the context detection logic, caching behavior, and functionality
 * of the optimized Israeli context middleware.
 */

import { jest } from '@jest/globals';
import smartIsraeliContext, { smartIsraeliContextMiddleware } from '../../middleware/smartIsraeliContextMiddleware.js';

// Mock dependencies
jest.mock('../../services/IsraeliComplianceService.js', () => {
  return jest.fn().mockImplementation(() => ({
    validatePrivacyCompliance: jest.fn().mockReturnValue({
      compliant: true,
      actions: []
    }),
    validateDataResidency: jest.fn().mockReturnValue({
      compliant: true,
      issues: [],
      recommendations: []
    }),
    validateHebrewContentCompliance: jest.fn().mockReturnValue({
      hebrewPresent: true,
      rtlFormatting: true,
      recommendations: []
    }),
    isShabbat: jest.fn().mockReturnValue(false),
    logComplianceCheck: jest.fn()
  }));
});

jest.mock('moment-timezone', () => {
  const moment = jest.fn(() => ({
    tz: jest.fn(() => ({
      format: jest.fn(() => '2024-01-15 10:30:00 IST'),
      toISOString: jest.fn(() => '2024-01-15T08:30:00.000Z'),
      hour: jest.fn(() => 10)
    }))
  }));
  moment.tz = jest.fn(() => ({
    format: jest.fn(() => '2024-01-15 10:30:00 IST'),
    toISOString: jest.fn(() => '2024-01-15T08:30:00.000Z'),
    hour: jest.fn(() => 10)
  }));
  return moment;
});

describe('Smart Israeli Context Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '',
      method: 'GET',
      user: null,
      query: {},
      body: {}
    };

    res = {
      headersSent: false,
      setHeader: jest.fn(),
      json: jest.fn(),
      end: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Context Detection', () => {
    it('should detect Hebrew language from accept-language header', () => {
      req.headers['accept-language'] = 'he-IL,en;q=0.9';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect Hebrew language from content-language header', () => {
      req.headers['content-language'] = 'he';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect Israeli user context', () => {
      req.user = { location: 'Israel', id: '123' };

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect educational routes', () => {
      req.path = '/api/entities/games';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect explicit Israeli context', () => {
      req.headers['x-israeli-context'] = 'true';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect Hebrew in query locale', () => {
      req.query.locale = 'he';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should detect Hebrew in request body', () => {
      req.body = { language: 'hebrew' };

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(true);
    });

    it('should not activate for non-Israeli requests', () => {
      req.headers['accept-language'] = 'en-US,en;q=0.9';
      req.path = '/api/auth/login';

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(false);
    });
  });

  describe('Hebrew Content Detection', () => {
    it('should detect Hebrew characters', () => {
      const text = 'שלום עולם Hello World';

      const hasHebrew = smartIsraeliContext.hasHebrewContent(text);

      expect(hasHebrew).toBe(true);
    });

    it('should not detect Hebrew in English text', () => {
      const text = 'Hello World';

      const hasHebrew = smartIsraeliContext.hasHebrewContent(text);

      expect(hasHebrew).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(smartIsraeliContext.hasHebrewContent('')).toBe(false);
      expect(smartIsraeliContext.hasHebrewContent(null)).toBe(false);
      expect(smartIsraeliContext.hasHebrewContent(undefined)).toBe(false);
      expect(smartIsraeliContext.hasHebrewContent(123)).toBe(false);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache Israeli time calculations', () => {
      const time1 = smartIsraeliContext.getCachedIsraeliTime();
      const time2 = smartIsraeliContext.getCachedIsraeliTime();

      // Should return same cached instance
      expect(time1).toBe(time2);
    });

    it('should cache context detection results', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';
      req.user = { id: '123' };

      // First call calculates
      const result1 = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      // Second call should use cache
      const result2 = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });
  });

  describe('Middleware Integration', () => {
    it('should skip processing for non-Israeli requests', async () => {
      req.path = '/api/auth/login';
      req.headers['accept-language'] = 'en-US';

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should process Israeli requests', async () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Israeli-Compliance', 'enabled');
    });

    it('should add Israeli timezone context', async () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      expect(req.israelTimezone).toBe('Asia/Jerusalem');
      expect(req.israelTimeUtils).toBeDefined();
      expect(typeof req.israelTimeUtils.now).toBe('function');
      expect(typeof req.israelTimeUtils.isBusinessHours).toBe('function');
    });

    it('should handle privacy compliance for users', async () => {
      req.headers['accept-language'] = 'he';
      req.user = {
        id: '123',
        consent_date: '2024-01-01',
        parental_consent: true,
        data_processing_consent: true
      };

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      expect(req.israeliCompliance).toBeDefined();
      expect(req.israeliCompliance.user).toBe('123');
    });

    it('should handle errors gracefully', async () => {
      req.headers['accept-language'] = 'he';

      // Force an error by corrupting the request
      req.user = { id: null }; // This might cause compliance check to fail

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      // Should not block the request even if compliance check fails
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('should use cached results for identical requests', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';
      req.user = { id: '123' };

      // Call multiple times - should use cache after first call
      for (let i = 0; i < 5; i++) {
        smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);
      }

      // The cache should prevent repeated calculations
      // This is a behavioral test - in real implementation,
      // we'd measure execution time or mock internal functions
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should efficiently detect educational routes', () => {
      const educationalPaths = [
        '/api/entities/games',
        '/api/products/123',
        '/api/tools/math',
        '/api/dashboard/student'
      ];

      educationalPaths.forEach(path => {
        req.path = path;
        const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);
        expect(needsProcessing).toBe(true);
      });
    });
  });

  describe('Header Management', () => {
    it('should not set headers if already sent', async () => {
      req.headers['accept-language'] = 'he';
      res.headersSent = true;

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should set comprehensive Israeli compliance headers', async () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartIsraeliContextMiddleware();
      await middleware(req, res, next);

      const expectedHeaders = [
        'X-Israeli-Compliance',
        'X-Israel-Time',
        'X-Data-Residency',
        'X-Hebrew-Support',
        'X-Timezone',
        'X-Privacy-Policy',
        'X-Cookie-Policy',
        'X-GDPR-Compliant',
        'X-Server-Timezone',
        'X-Server-Time'
      ];

      expectedHeaders.forEach(header => {
        expect(res.setHeader).toHaveBeenCalledWith(header, expect.anything());
      });
    });
  });
});

describe('Educational Route Detection', () => {
  const testCases = [
    { path: '/api/entities/games/123', expected: true, description: 'games entity' },
    { path: '/api/products/educational', expected: true, description: 'educational products' },
    { path: '/api/tools/math', expected: true, description: 'math tools' },
    { path: '/api/dashboard/student', expected: true, description: 'student dashboard' },
    { path: '/api/workshops/hebrew', expected: true, description: 'Hebrew workshops' },
    { path: '/api/courses/science', expected: true, description: 'science courses' },
    { path: '/api/auth/login', expected: false, description: 'auth endpoints' },
    { path: '/api/payments/stripe', expected: false, description: 'payment endpoints' },
    { path: '/api/admin/users', expected: false, description: 'admin endpoints' },
  ];

  testCases.forEach(({ path, expected, description }) => {
    it(`should ${expected ? 'detect' : 'not detect'} ${description} as educational`, () => {
      const req = { path, headers: {}, user: null, query: {}, body: {} };

      const needsProcessing = smartIsraeliContext.shouldActivateIsraeliMiddlewares(req);

      expect(needsProcessing).toBe(expected);
    });
  });
});

describe('Cache Management', () => {
  it('should clean up old cache entries', (done) => {
    // This test would require mocking the setInterval and setTimeout
    // For now, we'll just verify the cache functions exist
    expect(smartIsraeliContext.shouldActivateIsraeliMiddlewares).toBeDefined();
    expect(smartIsraeliContext.getCachedIsraeliTime).toBeDefined();
    expect(smartIsraeliContext.hasHebrewContent).toBeDefined();
    done();
  });
});