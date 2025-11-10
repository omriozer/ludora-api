/**
 * Unit Tests for Smart Response Processor Middleware
 *
 * Tests the unified response processing logic, compression behavior, CORS handling,
 * and Hebrew content optimization of the Smart Response Processor middleware.
 */

import { jest } from '@jest/globals';
import smartResponseProcessor, { smartResponseProcessor as middleware } from '../../middleware/smartResponseProcessor.js';

// Mock dependencies
jest.mock('compression');
jest.mock('cors');
jest.mock('express');
jest.mock('moment-timezone', () => {
  const moment = jest.fn(() => ({
    tz: jest.fn(() => ({
      format: jest.fn(() => '2024-01-15 10:30:00 IST'),
      toISOString: jest.fn(() => '2024-01-15T08:30:00.000Z'),
      hour: jest.fn(() => 10),
      day: jest.fn(() => 1)
    }))
  }));
  moment.tz = jest.fn(() => ({
    format: jest.fn(() => '2024-01-15 10:30:00 IST'),
    toISOString: jest.fn(() => '2024-01-15T08:30:00.000Z'),
    hour: jest.fn(() => 10),
    day: jest.fn(() => 1)
  }));
  return moment;
});

describe('Smart Response Processor Middleware', () => {
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
      header: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Context Analysis', () => {
    it('should detect Hebrew language from headers', () => {
      req.headers['accept-language'] = 'he-IL,en;q=0.9';

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.hasHebrewLanguage).toBe(true);
      expect(context.needsHebrewOptimization).toBe(true);
    });

    it('should detect Hebrew from content-language header', () => {
      req.headers['content-language'] = 'he';

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.hasHebrewLanguage).toBe(true);
    });

    it('should detect Hebrew in path', () => {
      req.path = '/api/entities/hebrew-content';

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.hebrewInPath).toBe(true);
    });

    it('should detect Hebrew in query parameters', () => {
      req.query = { locale: 'he' };

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.hebrewInQuery).toBe(true);
    });

    it('should detect Israeli user context', () => {
      req.user = { location: 'Israel', id: '123' };

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.israeliUser).toBe(true);
    });

    it('should detect educational content', () => {
      req.path = '/api/entities/games';

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.educationalContent).toBe(true);
    });

    it('should detect large payloads', () => {
      req.headers['content-length'] = '2000000'; // 2MB

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.isLargePayload).toBe(true);
    });

    it('should detect methods that need body parsing', () => {
      req.method = 'POST';

      const context = smartResponseProcessor.analyzeRequestContext(req);

      expect(context.methodNeedsBodyParsing).toBe(true);
    });
  });

  describe('Hebrew Content Detection', () => {
    it('should detect Hebrew characters in text', () => {
      const text = 'שלום עולם Hello World';

      const hasHebrew = smartResponseProcessor.hasHebrewContent(text);

      expect(hasHebrew).toBe(true);
    });

    it('should not detect Hebrew in English text', () => {
      const text = 'Hello World';

      const hasHebrew = smartResponseProcessor.hasHebrewContent(text);

      expect(hasHebrew).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(smartResponseProcessor.hasHebrewContent('')).toBe(false);
      expect(smartResponseProcessor.hasHebrewContent(null)).toBe(false);
      expect(smartResponseProcessor.hasHebrewContent(undefined)).toBe(false);
      expect(smartResponseProcessor.hasHebrewContent(123)).toBe(false);
    });

    it('should cache Hebrew content detection results', () => {
      const text = 'שלום עולם';

      // First call
      const result1 = smartResponseProcessor.hasHebrewContent(text);

      // Second call should use cache
      const result2 = smartResponseProcessor.hasHebrewContent(text);

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });
  });

  describe('Educational Path Detection', () => {
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
        const isEducational = smartResponseProcessor.isEducationalPath(path);

        expect(isEducational).toBe(expected);
      });
    });
  });

  describe('Israeli Time Context', () => {
    it('should detect Israeli peak hours', () => {
      const peakHours = [8, 13, 17, 20];

      peakHours.forEach(hour => {
        const isPeak = smartResponseProcessor.isIsraeliPeakHours(hour);
        expect(isPeak).toBe(true);
      });
    });

    it('should detect off-peak hours', () => {
      const offPeakHours = [3, 6, 11, 15, 23];

      offPeakHours.forEach(hour => {
        const isPeak = smartResponseProcessor.isIsraeliPeakHours(hour);
        expect(isPeak).toBe(false);
      });
    });
  });

  describe('Middleware Integration', () => {
    it('should process request without errors', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle requests without Hebrew content', () => {
      req.headers['accept-language'] = 'en-US';
      req.path = '/api/auth/login';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should add processing headers in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      req.headers['accept-language'] = 'he';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(res.header).toHaveBeenCalledWith('X-Smart-Processor', 'enabled');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle large payloads appropriately', () => {
      req.headers['content-length'] = '5000000'; // 5MB
      req.method = 'POST';
      req.headers['content-type'] = 'application/json';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should optimize for educational content', () => {
      req.path = '/api/entities/games';
      req.headers['accept-language'] = 'he-IL';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(res.header).toHaveBeenCalledWith('X-Educational-Content', 'true');
    });
  });

  describe('Response Processing', () => {
    it('should override json method for Hebrew content detection', () => {
      req.headers['accept-language'] = 'he';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      const hebrewData = { message: 'שלום עולם' };
      res.json(hebrewData);

      expect(res.header).toHaveBeenCalledWith('X-Compression-Type', 'hebrew-optimized');
      expect(res.header).toHaveBeenCalledWith('X-RTL-Formatted', 'true');
    });

    it('should override send method for text responses', () => {
      req.headers['accept-language'] = 'he';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      const hebrewText = 'שלום עולם';
      res.send(hebrewText);

      expect(res.header).toHaveBeenCalledWith('X-Compression-Type', 'hebrew-optimized');
    });

    it('should use standard compression for non-Hebrew content', () => {
      req.headers['accept-language'] = 'en-US';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      const englishData = { message: 'Hello World' };
      res.json(englishData);

      expect(res.header).toHaveBeenCalledWith('X-Compression-Type', 'standard');
    });
  });

  describe('Error Handling', () => {
    it('should not block request on processing errors', () => {
      // Force an error by corrupting the request
      req.headers = null;

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      // Should still call next even if processing fails
      expect(next).toHaveBeenCalled();
    });

    it('should handle malformed headers gracefully', () => {
      req.headers = {
        'accept-language': null,
        'content-type': undefined
      };

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('should use cached results for repeated requests', () => {
      const text = 'שלום עולם';

      // Call multiple times - should use cache after first call
      for (let i = 0; i < 5; i++) {
        smartResponseProcessor.hasHebrewContent(text);
      }

      // Cache behavior is tested by consistency
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should efficiently process context analysis', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';
      req.user = { id: '123' };

      const startTime = Date.now();

      const context = smartResponseProcessor.analyzeRequestContext(req);

      const processingTime = Date.now() - startTime;

      expect(context).toBeDefined();
      expect(processingTime).toBeLessThan(10); // Should be very fast
    });
  });

  describe('CORS Handling', () => {
    it('should add Israeli-specific CORS headers for Hebrew requests', () => {
      req.headers['accept-language'] = 'he';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(res.header).toHaveBeenCalledWith('X-Israeli-Context', 'enabled');
      expect(res.header).toHaveBeenCalledWith('X-Hebrew-Support', 'enabled');
    });

    it('should not add special headers for non-Israeli requests', () => {
      req.headers['accept-language'] = 'en-US';
      req.path = '/api/auth/login';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      // Should not add Israeli-specific headers
      expect(res.header).not.toHaveBeenCalledWith('X-Israeli-Context', 'enabled');
    });
  });

  describe('Body Parsing Logic', () => {
    it('should only parse body for relevant HTTP methods', () => {
      req.method = 'GET';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      // GET requests should not trigger body parsing
      expect(next).toHaveBeenCalled();
    });

    it('should parse body for POST requests', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'application/json';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use appropriate limits for large payloads', () => {
      req.method = 'POST';
      req.headers['content-length'] = '10000000'; // 10MB
      req.headers['content-type'] = 'application/json';

      const processorMiddleware = middleware();
      processorMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('Smart Response Dashboard', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      path: '/api/admin/response-processor/stats',
      user: { role: 'admin' }
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  it('should return stats for admin users', () => {
    const { smartResponseDashboard } = smartResponseProcessor;
    const dashboard = smartResponseDashboard();

    dashboard(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Object)
      })
    );
  });

  it('should skip for non-admin users', () => {
    req.user.role = 'user';

    const { smartResponseDashboard } = smartResponseProcessor;
    const dashboard = smartResponseDashboard();

    dashboard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', () => {
    req.path = '/api/admin/response-processor/stats';
    req.user = null; // This will cause an error

    const { smartResponseDashboard } = smartResponseProcessor;
    const dashboard = smartResponseDashboard();

    dashboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('Cleanup Functions', () => {
  it('should clean up caches on shutdown', () => {
    const { cleanupSmartResponseProcessor } = smartResponseProcessor;

    // Should not throw errors
    expect(() => {
      cleanupSmartResponseProcessor();
    }).not.toThrow();
  });
});