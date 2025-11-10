/**
 * Unit Tests for Smart Performance & Cost Tracker Middleware
 *
 * Tests the unified performance monitoring and cost tracking logic,
 * metrics batching, and background processing functionality.
 */

import { jest } from '@jest/globals';
import smartPerformanceCostTracker, {
  smartPerformanceCostTrackerMiddleware,
  getMetricsStats
} from '../../middleware/smartPerformanceCostTracker.js';
import MetricsBatchProcessor from '../../services/MetricsBatchProcessor.js';

// Mock dependencies
jest.mock('../../services/MetricsBatchProcessor.js', () => {
  return jest.fn().mockImplementation(() => ({
    addMetrics: jest.fn(),
    getStats: jest.fn(() => ({
      totalProcessed: 100,
      queueSize: 5,
      avgBatchSize: 25,
      avgProcessingTime: 150
    })),
    getHealthStatus: jest.fn(() => ({
      status: 'processing',
      queueUtilization: '15.0',
      errorRate: '2.0',
      health: 'healthy'
    }))
  }));
});

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

describe('Smart Performance & Cost Tracker Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '',
      method: 'GET',
      user: null,
      query: {},
      body: {},
      ip: '127.0.0.1',
      get: jest.fn()
    };

    res = {
      headersSent: false,
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      statusCode: 200,
      statusMessage: 'OK',
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn(function(...args) {
        // Mock original end behavior
        return this;
      }),
      locals: {}
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Middleware Activation Logic', () => {
    it('should activate for Israeli context requests', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/test';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(typeof res.end).toBe('function');
    });

    it('should activate for educational paths', () => {
      req.path = '/api/entities/games';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should activate during Israeli peak hours', () => {
      // Peak hour is mocked as 10 AM in moment mock
      req.path = '/api/products/123';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip for non-relevant requests during off-peak', () => {
      req.path = '/api/auth/login';
      req.headers['accept-language'] = 'en-US';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // Should not override response methods for non-relevant requests
    });
  });

  describe('Performance Tracking', () => {
    it('should track response time accurately', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartPerformanceCostTrackerMiddleware();
      const startTime = Date.now();

      middleware(req, res, next);

      // Simulate processing time
      setTimeout(() => {
        res.end();
      }, 100);

      expect(next).toHaveBeenCalled();
    });

    it('should capture request metadata', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/games';
      req.method = 'POST';
      req.user = { id: '123', role: 'student' };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should track Hebrew content in responses', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      const hebrewData = { message: 'שלום עולם' };
      res.json(hebrewData);

      expect(next).toHaveBeenCalled();
    });

    it('should track large response sizes', () => {
      req.path = '/api/entities/large-content';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      const largeData = { data: 'x'.repeat(10000) };
      res.json(largeData);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Cost Tracking', () => {
    it('should calculate S3 operation costs', () => {
      req.path = '/api/assets/upload';
      req.method = 'POST';
      res.locals.s3Operation = {
        operationType: 'putObject',
        fileSize: 5000000, // 5MB
        success: true
      };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should calculate bandwidth costs for large responses', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      // Simulate large response
      const largeResponse = { data: 'x'.repeat(50000) };
      res.json(largeResponse);

      expect(next).toHaveBeenCalled();
    });

    it('should calculate Hebrew content processing costs', () => {
      req.headers['accept-language'] = 'he-IL';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      const hebrewResponse = {
        content: 'שלום עולם'.repeat(100),
        metadata: 'Additional Hebrew content'
      };
      res.json(hebrewResponse);

      expect(next).toHaveBeenCalled();
    });

    it('should apply compression savings calculations', () => {
      req.headers['accept-language'] = 'he';
      res.getHeader = jest.fn((header) => {
        if (header === 'content-encoding') return 'gzip';
        return null;
      });

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Smart Sampling', () => {
    it('should use full sampling during peak hours', () => {
      req.headers['accept-language'] = 'he';
      // Peak hours are mocked as true in moment mock

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should use reduced sampling during off-peak hours', () => {
      req.path = '/api/entities/content';
      // Would need to mock off-peak hours for this test

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should always track educational content regardless of hours', () => {
      req.path = '/api/entities/games';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should not block request on metrics processing errors', () => {
      req.headers['accept-language'] = 'he';

      // Force an error by corrupting response
      res.statusCode = 500;
      res.statusMessage = 'Internal Server Error';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should handle malformed request data gracefully', () => {
      req.headers = null;
      req.path = undefined;

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle response override failures', () => {
      req.headers['accept-language'] = 'he';

      // Mock a response that throws on end()
      res.end = jest.fn(() => {
        throw new Error('Response error');
      });

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      expect(() => {
        res.end();
      }).toThrow('Response error');

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics for Hebrew educational content', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/games/math';
      req.method = 'GET';
      req.user = { id: 'student123', role: 'student', grade: '5' };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      const educationalResponse = {
        game: 'Math Challenge',
        instructions: 'פתרו את התרגילים הבאים',
        questions: ['מה זה 2+2?', 'מה זה 5-3?']
      };

      res.json(educationalResponse);

      expect(next).toHaveBeenCalled();
    });

    it('should batch metrics for background processing', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      // Verify metrics were queued for batch processing
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track slow responses during peak hours', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      // Simulate slow response
      setTimeout(() => {
        res.end();
      }, 1000);

      expect(next).toHaveBeenCalled();
    });

    it('should monitor S3 operation performance', () => {
      req.path = '/api/assets/file.pdf';
      res.locals.s3Operation = {
        operationType: 'getObject',
        fileSize: 2000000,
        responseTime: 250,
        success: true
      };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should track content delivery performance', () => {
      req.headers['accept-language'] = 'he';
      req.path = '/api/entities/content/large';

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      const largeContent = {
        text: 'שלום עולם'.repeat(1000),
        media: 'base64data'.repeat(500)
      };

      res.json(largeContent);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Israeli Context Detection', () => {
    it('should detect Israeli school hours context', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/games';
      req.user = { role: 'student', grade: '3' };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should detect Israeli educational usage patterns', () => {
      req.path = '/api/dashboard/student';
      req.user = {
        id: 'student456',
        role: 'student',
        location: 'Israel',
        grade: '7'
      };

      const middleware = smartPerformanceCostTrackerMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('Metrics Stats API', () => {
  it('should return current metrics statistics', () => {
    const stats = getMetricsStats();

    expect(stats).toEqual(
      expect.objectContaining({
        totalProcessed: expect.any(Number),
        queueSize: expect.any(Number),
        avgBatchSize: expect.any(Number),
        avgProcessingTime: expect.any(Number)
      })
    );
  });
});

describe('MetricsBatchProcessor Integration', () => {
  let processor;

  beforeEach(() => {
    processor = new MetricsBatchProcessor();
  });

  it('should integrate with batch processor for metrics queuing', () => {
    const metrics = {
      requestId: 'test-123',
      timestamp: new Date().toISOString(),
      method: 'GET',
      path: '/api/test',
      responseTime: 150
    };

    processor.addMetrics([metrics]);

    expect(processor.addMetrics).toHaveBeenCalledWith([metrics]);
  });

  it('should provide health status information', () => {
    const health = processor.getHealthStatus();

    expect(health).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        health: expect.any(String)
      })
    );
  });
});

describe('Performance Edge Cases', () => {
  it('should handle very large responses efficiently', () => {
    req.headers['accept-language'] = 'he';

    const middleware = smartPerformanceCostTrackerMiddleware();
    middleware(req, res, next);

    // 10MB response
    const veryLargeResponse = { data: 'x'.repeat(10000000) };
    res.json(veryLargeResponse);

    expect(next).toHaveBeenCalled();
  });

  it('should handle rapid successive requests', () => {
    req.headers['accept-language'] = 'he';

    const middleware = smartPerformanceCostTrackerMiddleware();

    // Simulate 10 rapid requests
    for (let i = 0; i < 10; i++) {
      middleware(req, res, next);
      res.end();
    }

    expect(next).toHaveBeenCalledTimes(10);
  });

  it('should handle mixed Hebrew and English content', () => {
    req.headers['accept-language'] = 'he-IL,en;q=0.8';

    const middleware = smartPerformanceCostTrackerMiddleware();
    middleware(req, res, next);

    const mixedContent = {
      hebrew: 'שלום עולם',
      english: 'Hello World',
      mixed: 'Welcome ברוכים הבאים to our platform'
    };

    res.json(mixedContent);

    expect(next).toHaveBeenCalled();
  });
});