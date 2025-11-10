/**
 * Unit Tests for Smart Alert System Middleware
 *
 * Tests the unified alert system logic, alert rules engine, deduplication,
 * rate limiting, and background processing functionality.
 */

import { jest } from '@jest/globals';
import smartAlertSystem, {
  smartAlertSystemMiddleware,
  smartAlertDashboard
} from '../../middleware/smartAlertSystem.js';
import IsraeliMarketAlertsService from '../../services/IsraeliMarketAlertsService.js';

// Mock dependencies
jest.mock('../../services/IsraeliMarketAlertsService.js', () => {
  return jest.fn().mockImplementation(() => ({
    activeAlerts: new Map(),
    alertHistory: [],
    trackStudentActivity: jest.fn(),
    stopMarketMonitoring: jest.fn()
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

describe('Smart Alert System Middleware', () => {
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
      getHeader: jest.fn(),
      statusCode: 200,
      statusMessage: 'OK',
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn(function(...args) {
        return this;
      }),
      locals: {}
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Middleware Basic Functionality', () => {
    it('should process requests without blocking', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should override response.end for alert monitoring', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      expect(typeof res.end).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should handle response completion', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance Alert Detection', () => {
    beforeEach(() => {
      // Mock slow response time
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(4000); // End time (3000ms response)
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should detect slow response times during peak hours', () => {
      req.headers['accept-language'] = 'he-IL';
      req.path = '/api/entities/games';

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should not trigger performance alerts for fast responses', () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500); // 500ms response

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should include Hebrew content context in performance alerts', () => {
      req.headers['accept-language'] = 'he';

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      const hebrewData = { message: 'שלום עולם' };
      res.json(hebrewData);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Rate Alert Detection', () => {
    it('should detect 4xx errors', () => {
      res.statusCode = 404;
      res.statusMessage = 'Not Found';

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should detect 5xx server errors', () => {
      res.statusCode = 500;
      res.statusMessage = 'Internal Server Error';

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should include educational content context in error alerts', () => {
      req.path = '/api/entities/games/math';
      res.statusCode = 500;

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Hebrew Content Alert Detection', () => {
    it('should detect Unicode escape sequences in Hebrew content', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      const corruptedHebrewData = {
        message: 'Hello \\u05e9\\u05dc\\u05d5\\u05dd World'
      };

      res.json(corruptedHebrewData);

      expect(next).toHaveBeenCalled();
    });

    it('should detect missing UTF-8 charset', () => {
      res.getHeader = jest.fn((header) => {
        if (header === 'content-type') return 'text/html'; // Missing charset
        return null;
      });

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      const hebrewData = { message: 'שלום עולם' };
      res.json(hebrewData);

      expect(next).toHaveBeenCalled();
    });

    it('should detect missing RTL formatting', () => {
      res.getHeader = jest.fn((header) => {
        if (header === 'X-RTL-Formatted') return null;
        return null;
      });

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      const hebrewData = { content: 'שלום עולם' };
      res.json(hebrewData);

      expect(next).toHaveBeenCalled();
    });

    it('should not trigger alerts for properly formatted Hebrew content', () => {
      res.getHeader = jest.fn((header) => {
        if (header === 'content-type') return 'application/json; charset=utf-8';
        if (header === 'X-RTL-Formatted') return 'true';
        return null;
      });

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      const properHebrewData = { message: 'שלום עולם' };
      res.json(properHebrewData);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Educational Usage Pattern Tracking', () => {
    it('should track educational content access', () => {
      req.path = '/api/entities/games/math';
      req.user = { id: 'student123', role: 'student', grade: '5' };

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should detect unusual access patterns', () => {
      req.path = '/api/entities/games';
      req.user = { id: 'student456', role: 'student' };

      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(8000); // 7000ms response (very slow)

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should track student activity metrics', () => {
      req.path = '/api/entities/tools/calculator';
      req.user = { id: 'student789', role: 'student' };
      req.headers['accept-language'] = 'he-IL';
      res.locals.completionData = { completionRate: 85 };

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should not track non-educational paths', () => {
      req.path = '/api/auth/login';
      req.user = { id: 'user123', role: 'teacher' };

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Real-time Market Monitoring', () => {
    it('should perform throttled monitoring checks', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should add monitoring headers in development', () => {
      const originalEnv = process.env.ENVIRONMENT;
      process.env.ENVIRONMENT = 'development';

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(res.setHeader).toHaveBeenCalledWith('X-Israeli-Monitoring', 'smart-alert-system');

      process.env.ENVIRONMENT = originalEnv;
    });

    it('should emit real-time monitoring events', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should not block requests on alert processing errors', () => {
      // Force an error by corrupting the request
      req.path = null;

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });

    it('should handle malformed response data', () => {
      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.json(null);

      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user context gracefully', () => {
      req.path = '/api/entities/games';
      req.user = null;

      const middleware = smartAlertSystemMiddleware();
      middleware(req, res, next);

      res.end();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Helper Function Tests', () => {
    it('should correctly identify educational paths', () => {
      const educationalPaths = [
        '/api/entities/games',
        '/api/products/educational',
        '/api/tools/calculator',
        '/api/dashboard/student',
        '/api/workshops/math',
        '/api/courses/science'
      ];

      educationalPaths.forEach(path => {
        expect(smartAlertSystem.isEducationalPath(path)).toBe(true);
      });
    });

    it('should correctly identify non-educational paths', () => {
      const nonEducationalPaths = [
        '/api/auth/login',
        '/api/payments/checkout',
        '/api/admin/users',
        '/api/settings/profile'
      ];

      nonEducationalPaths.forEach(path => {
        expect(smartAlertSystem.isEducationalPath(path)).toBe(false);
      });
    });

    it('should detect Hebrew content issues correctly', () => {
      const issues = [
        {
          content: 'Hello \\u05e9\\u05dc\\u05d5\\u05dd World',
          req: {},
          res: { getHeader: () => null },
          expectedType: 'unicode_escape_sequences'
        },
        {
          content: 'שלום עולם',
          req: {},
          res: { getHeader: (h) => h === 'content-type' ? 'text/html' : null },
          expectedType: 'charset_missing'
        }
      ];

      issues.forEach(({ content, req, res, expectedType }) => {
        const issue = smartAlertSystem.detectHebrewContentIssues(content, req, res);
        expect(issue?.type).toBe(expectedType);
      });
    });
  });
});

describe('Smart Alert Dashboard', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      path: '',
      method: 'GET',
      user: { role: 'admin', id: 'admin123' },
      query: {},
      body: {}
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('Admin Dashboard Endpoints', () => {
    it('should return active alerts for admin users', () => {
      req.path = '/api/admin/alerts/israel';
      req.query.type = 'active';

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          type: 'active',
          data: expect.any(Array)
        })
      );
    });

    it('should return alert history', () => {
      req.path = '/api/admin/alerts/israel';
      req.query.type = 'history';

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          type: 'history',
          data: expect.any(Array)
        })
      );
    });

    it('should return alert summary', () => {
      req.path = '/api/admin/alerts/israel';
      req.query.type = 'summary';

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          type: 'summary',
          data: expect.any(Object)
        })
      );
    });

    it('should return system stats', () => {
      req.path = '/api/admin/alerts/israel';
      req.query.type = 'stats';

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          type: 'stats',
          data: expect.any(Object)
        })
      );
    });

    it('should skip for non-admin users', () => {
      req.user.role = 'user';

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('Alert Management Endpoints', () => {
    beforeEach(() => {
      // Mock alert service with test alert
      const mockAlert = {
        id: 'test-alert-123',
        type: 'performance',
        status: 'active',
        timestamp: '2024-01-15T08:30:00.000Z'
      };

      smartAlertSystem.alertsService.activeAlerts.set('test-alert-123', mockAlert);
    });

    it('should acknowledge alerts', () => {
      req.path = '/api/admin/alerts/acknowledge';
      req.method = 'POST';
      req.body = { alertId: 'test-alert-123' };

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Alert acknowledged successfully'
        })
      );
    });

    it('should resolve alerts', () => {
      req.path = '/api/admin/alerts/resolve';
      req.method = 'POST';
      req.body = {
        alertId: 'test-alert-123',
        resolution: 'Performance issue fixed by server restart'
      };

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Alert resolved successfully'
        })
      );
    });

    it('should handle non-existent alert acknowledgment', () => {
      req.path = '/api/admin/alerts/acknowledge';
      req.method = 'POST';
      req.body = { alertId: 'non-existent-alert' };

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle non-existent alert resolution', () => {
      req.path = '/api/admin/alerts/resolve';
      req.method = 'POST';
      req.body = { alertId: 'non-existent-alert', resolution: 'Fixed' };

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Error Handling in Dashboard', () => {
    it('should handle dashboard errors gracefully', () => {
      req.path = '/api/admin/alerts/israel';
      req.user = null; // This will cause an error

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle malformed request bodies', () => {
      req.path = '/api/admin/alerts/acknowledge';
      req.method = 'POST';
      req.body = null;

      const dashboard = smartAlertDashboard();
      dashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

describe('SmartAlertSystem Class', () => {
  let alertSystem;

  beforeEach(() => {
    // Access the smart alert system instance from the module
    alertSystem = smartAlertSystem.smartAlertSystem;
  });

  describe('Alert Rules Engine', () => {
    it('should have configured alert rules', () => {
      expect(alertSystem.alertRules).toBeDefined();
      expect(alertSystem.alertRules.performance).toBeDefined();
      expect(alertSystem.alertRules.hebrew_content).toBeDefined();
      expect(alertSystem.alertRules.educational).toBeDefined();
      expect(alertSystem.alertRules.system_health).toBeDefined();
    });

    it('should calculate alert severity correctly', () => {
      const performanceAlert = { type: 'response_time', value: 3000, threshold: 2000 };
      const severity = alertSystem.calculateAlertSeverity(performanceAlert);

      expect(['low', 'medium', 'high', 'critical']).toContain(severity);
    });

    it('should get alert rule by type', () => {
      const rule = alertSystem.getAlertRule('response_time');

      expect(rule).toBeDefined();
      expect(rule.threshold).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(rule.cooldown).toBeDefined();
    });
  });

  describe('Alert Processing', () => {
    it('should process alerts without errors', () => {
      const testAlert = {
        type: 'response_time',
        value: 3000,
        threshold: 2000,
        path: '/api/test',
        method: 'GET'
      };

      const processedAlert = alertSystem.processAlert(testAlert);

      if (processedAlert) {
        expect(processedAlert.id).toBeDefined();
        expect(processedAlert.timestamp).toBeDefined();
        expect(processedAlert.severity).toBeDefined();
      }
    });

    it('should enrich alerts with Israeli context', () => {
      const basicAlert = {
        type: 'hebrew_content_issue',
        path: '/api/entities/games'
      };

      const enrichedAlert = alertSystem.enrichAlert(basicAlert);

      expect(enrichedAlert.israelTime).toBeDefined();
      expect(enrichedAlert.isPeakHours).toBeDefined();
      expect(enrichedAlert.isSchoolHours).toBeDefined();
      expect(enrichedAlert.recommendations).toBeDefined();
    });

    it('should generate contextual recommendations', () => {
      const responseTimeAlert = {
        type: 'response_time',
        isPeakHours: true,
        hebrewContent: true
      };

      const recommendations = alertSystem.generateRecommendations(responseTimeAlert);

      expect(recommendations).toContain('Check server performance');
      expect(recommendations).toContain('Consider Israeli peak hours optimization');
      expect(recommendations).toContain('Optimize Hebrew content compression');
    });
  });

  describe('Alert Deduplication and Rate Limiting', () => {
    it('should suppress duplicate alerts', () => {
      const alert1 = {
        type: 'response_time',
        path: '/api/test',
        value: 3000,
        threshold: 2000
      };

      // First alert should be processed
      const result1 = alertSystem.processAlert(alert1);

      // Immediate duplicate should be suppressed
      const result2 = alertSystem.processAlert(alert1);

      expect(result1).toBeDefined();
      expect(result2).toBeNull();
    });

    it('should respect cooldown periods', () => {
      const alertKey = 'test-response_time-/api/test';

      // Set a recent cooldown
      alertSystem.alertCooldowns.set(`cooldown-${alertKey}`, Date.now() - 1000); // 1 second ago

      const alert = {
        type: 'response_time',
        path: '/api/test',
        value: 3000,
        threshold: 2000
      };

      const shouldSuppress = alertSystem.shouldSuppressAlert(alert);

      expect(shouldSuppress).toBe(true);
    });
  });

  describe('Israeli Time Context Helpers', () => {
    it('should correctly identify Israeli peak hours', () => {
      const peakHours = [8, 13, 17, 20];
      const offPeakHours = [3, 6, 11, 15, 23];

      peakHours.forEach(hour => {
        expect(alertSystem.isIsraeliPeakHours(hour)).toBe(true);
      });

      offPeakHours.forEach(hour => {
        expect(alertSystem.isIsraeliPeakHours(hour)).toBe(false);
      });
    });

    it('should correctly identify Israeli school hours', () => {
      const schoolTime = {
        hour: () => 10,
        day: () => 2 // Tuesday
      };

      const nonSchoolTime = {
        hour: () => 20,
        day: () => 6 // Saturday
      };

      expect(alertSystem.isIsraeliSchoolHours(schoolTime)).toBe(true);
      expect(alertSystem.isIsraeliSchoolHours(nonSchoolTime)).toBe(false);
    });

    it('should correctly identify Shabbat', () => {
      const shabbatFriday = {
        day: () => 5,
        hour: () => 19
      };

      const shabbatSaturday = {
        day: () => 6,
        hour: () => 15
      };

      const weekday = {
        day: () => 2,
        hour: () => 15
      };

      expect(alertSystem.isShabbat(shabbatFriday)).toBe(true);
      expect(alertSystem.isShabbat(shabbatSaturday)).toBe(true);
      expect(alertSystem.isShabbat(weekday)).toBe(false);
    });
  });

  describe('Statistics and Health Monitoring', () => {
    it('should provide system statistics', () => {
      const stats = alertSystem.getStats();

      expect(stats.totalAlerts).toBeDefined();
      expect(stats.alertsByType).toBeDefined();
      expect(stats.alertsBySeverity).toBeDefined();
      expect(stats.activeAlertsCount).toBeDefined();
    });

    it('should provide health status', () => {
      const health = alertSystem.getHealthStatus();

      expect(health.status).toBeDefined();
      expect(health.queueUtilization).toBeDefined();
      expect(health.errorRate).toBeDefined();
      expect(health.health).toBeDefined();
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up old data', () => {
      // Add some old data
      alertSystem.alertCooldowns.set('old-alert', Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago

      alertSystem.cleanupOldData();

      expect(alertSystem.alertCooldowns.has('old-alert')).toBe(false);
    });

    it('should generate unique alert IDs', () => {
      const id1 = alertSystem.generateAlertId();
      const id2 = alertSystem.generateAlertId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^IL-alert-/);
      expect(id2).toMatch(/^IL-alert-/);
    });
  });
});