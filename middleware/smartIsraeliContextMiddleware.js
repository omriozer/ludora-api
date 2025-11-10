/**
 * Smart Israeli Context Middleware
 *
 * Optimized middleware that combines all Israeli compliance functionality
 * into a single smart middleware that only runs when Israeli context is detected.
 *
 * Replaces 5 separate middlewares:
 * - israeliComplianceHeaders
 * - israeliPrivacyCompliance
 * - israeliDataResidencyCompliance
 * - israeliHebrewContentCompliance
 * - israeliTimezoneCompliance
 */

import IsraeliComplianceService from '../services/IsraeliComplianceService.js';
import moment from 'moment-timezone';

// Global compliance service instance
const complianceService = new IsraeliComplianceService();

// Caching for expensive operations
const israeliTimeCache = new Map();
const contextDetectionCache = new Map();
const hebrewContentCache = new Map();

/**
 * Smart Israeli context detection
 * Determines if request needs Israeli processing
 */
function shouldActivateIsraeliMiddlewares(req) {
  // Create cache key from relevant request properties
  const cacheKey = getCacheKey(req);

  if (contextDetectionCache.has(cacheKey)) {
    return contextDetectionCache.get(cacheKey);
  }

  const needsIsraeliProcessing =
    // Hebrew language detection
    req.headers['accept-language']?.includes('he') ||
    req.headers['content-language']?.includes('he') ||

    // Israeli user context
    req.user?.location === 'Israel' ||
    req.user?.country === 'IL' ||

    // Educational routes (high Israeli usage)
    isEducationalRoute(req.path) ||

    // Explicit Israeli context
    req.headers['x-israeli-context'] === 'true' ||
    req.query.locale === 'he' ||
    req.body?.language === 'hebrew' ||

    // Hebrew content in path
    req.path.includes('hebrew') ||
    req.path.includes('he-IL');

  // Cache for 5 minutes to avoid repeated calculations
  setTimeout(() => contextDetectionCache.delete(cacheKey), 300000);
  contextDetectionCache.set(cacheKey, needsIsraeliProcessing);

  return needsIsraeliProcessing;
}

/**
 * Cached Israeli time calculation
 * Caches expensive timezone conversion for 1 minute
 */
function getCachedIsraeliTime() {
  const minute = Math.floor(Date.now() / 60000); // Cache per minute

  if (israeliTimeCache.has(minute)) {
    return israeliTimeCache.get(minute);
  }

  const israelTime = moment().tz('Asia/Jerusalem');
  israeliTimeCache.set(minute, israelTime);

  // Clean up old cache entries after 2 minutes
  setTimeout(() => israeliTimeCache.delete(minute), 120000);

  return israelTime;
}

/**
 * Check if path is educational content
 */
function isEducationalRoute(path) {
  const educationalPaths = [
    '/api/entities/',
    '/api/products/',
    '/api/games/',
    '/api/tools/',
    '/api/dashboard/',
    '/api/workshops/',
    '/api/courses/'
  ];
  return educationalPaths.some(edPath => path?.includes(edPath));
}

/**
 * Generate cache key for context detection
 */
function getCacheKey(req) {
  return `${req.headers['accept-language'] || ''}-${req.path}-${req.user?.id || 'anon'}`;
}

/**
 * Efficient Hebrew content detection
 */
function hasHebrewContent(text) {
  if (!text || typeof text !== 'string') return false;

  const cacheKey = text.substring(0, 100); // Cache based on first 100 chars

  if (hebrewContentCache.has(cacheKey)) {
    return hebrewContentCache.get(cacheKey);
  }

  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  hebrewContentCache.set(cacheKey, hasHebrew);

  // Clean cache every 10 minutes
  setTimeout(() => hebrewContentCache.delete(cacheKey), 600000);

  return hasHebrew;
}

/**
 * Apply Israeli compliance headers
 * Combines functionality from israeliComplianceHeaders()
 */
function applyIsraeliComplianceHeaders(res, israelTime) {
  if (res.headersSent) return;

  // Israeli compliance headers
  res.setHeader('X-Israeli-Compliance', 'enabled');
  res.setHeader('X-Israel-Time', israelTime.format('YYYY-MM-DD HH:mm:ss z'));
  res.setHeader('X-Data-Residency', 'EU-compliant');
  res.setHeader('X-Hebrew-Support', 'available');
  res.setHeader('X-Timezone', 'Asia/Jerusalem');

  // Privacy compliance headers
  res.setHeader('X-Privacy-Policy', '/privacy-policy-israel');
  res.setHeader('X-Cookie-Policy', '/cookie-policy-israel');
  res.setHeader('X-GDPR-Compliant', 'true');

  // Security compliance headers for Israeli standards
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Timezone headers
  res.setHeader('X-Server-Timezone', 'Asia/Jerusalem');
  res.setHeader('X-Server-Time', israelTime.toISOString());
}

/**
 * Apply Israeli timezone context
 * Combines functionality from israeliTimezoneCompliance()
 */
function applyIsraeliTimezoneContext(req, israelTime) {
  req.israelTimezone = 'Asia/Jerusalem';
  req.israelTime = israelTime;

  // Provide Israeli time utilities
  req.israelTimeUtils = {
    now: () => getCachedIsraeliTime(),
    format: (date, format) => moment(date).tz('Asia/Jerusalem').format(format || 'YYYY-MM-DD HH:mm:ss'),
    isBusinessHours: () => {
      const hour = getCachedIsraeliTime().hour();
      return hour >= 8 && hour <= 18;
    },
    isShabbat: () => complianceService.isShabbat(getCachedIsraeliTime()),
    israeliDate: () => getCachedIsraeliTime().format('DD/MM/YYYY')
  };
}

/**
 * Handle Israeli privacy compliance
 * Combines functionality from israeliPrivacyCompliance()
 */
async function handleIsraeliPrivacyCompliance(req, res) {
  if (!req.user) return null;

  try {
    const userConsent = {
      consentDate: req.user.consent_date,
      parentalConsent: req.user.parental_consent,
      dataProcessingConsent: req.user.data_processing_consent
    };

    const compliance = complianceService.validatePrivacyCompliance(req.user, userConsent);

    // Add compliance metadata to request
    req.israeliCompliance = {
      privacy: compliance,
      user: req.user.id,
      timestamp: getCachedIsraeliTime().toISOString()
    };

    // Handle compliance issues
    if (!compliance.compliant && compliance.actions.includes('request_parental_consent')) {
      return {
        error: true,
        response: {
          error: 'Compliance Required',
          message: 'Parental consent required for users under 13',
          action: 'request_parental_consent',
          israeliCompliance: true
        },
        statusCode: 403
      };
    }

    if (compliance.actions.includes('refresh_consent') && !res.headersSent) {
      res.setHeader('X-Consent-Refresh-Required', 'true');
      res.setHeader('X-Consent-Refresh-URL', '/consent-refresh');
    }

    return null; // No error
  } catch (error) {
    console.error('Israeli privacy compliance check failed:', error);
    req.israeliCompliance = { error: error.message };
    return null; // Don't block request on compliance check failure
  }
}

/**
 * Handle Israeli data residency compliance
 * Combines functionality from israeliDataResidencyCompliance()
 */
function handleIsraeliDataResidencyCompliance(req, res) {
  const isDataOperation = ['POST', 'PUT', 'PATCH'].includes(req.method);
  const isFileUpload = req.headers['content-type']?.includes('multipart/form-data');
  const isUserData = req.path.includes('/entities/') || req.path.includes('/assets/');

  if (isDataOperation && (isFileUpload || isUserData)) {
    const currentRegion = process.env.AWS_REGION || process.env.DEFAULT_AWS_REGION || 'eu-central-1';
    let dataType = 'general';

    // Determine data type
    if (req.path.includes('/user') || req.user) {
      dataType = 'user_data';
    }
    if (req.path.includes('/student') || req.body?.type === 'student') {
      dataType = 'student_data';
    }
    if (req.path.includes('/file') || isFileUpload) {
      dataType = 'file_data';
    }

    // Validate data residency
    const residencyCheck = complianceService.validateDataResidency(currentRegion, dataType);

    // Add compliance info to request
    req.israeliCompliance = {
      ...req.israeliCompliance,
      dataResidency: residencyCheck
    };

    // Add data residency headers
    if (!res.headersSent) {
      res.setHeader('X-Data-Region', currentRegion);
      res.setHeader('X-Data-Compliance', residencyCheck.compliant ? 'true' : 'false');
    }

    if (!residencyCheck.compliant && residencyCheck.issues.length > 0) {
      console.warn('Israeli data residency compliance issue:', residencyCheck);

      // Block request for critical non-compliance
      if (dataType === 'student_data' && !residencyCheck.compliant) {
        return {
          error: true,
          response: {
            error: 'Data Residency Compliance Error',
            message: 'Student data cannot be stored in this region',
            issues: residencyCheck.issues,
            recommendations: residencyCheck.recommendations,
            israeliCompliance: true
          },
          statusCode: 400
        };
      }
    }
  }

  return null; // No error
}

/**
 * Setup Hebrew content compliance
 * Combines functionality from israeliHebrewContentCompliance()
 */
function setupHebrewContentCompliance(req, res) {
  const originalJson = res.json;

  res.json = function(data) {
    // Check for Hebrew content in response
    if (data && typeof data === 'object') {
      const content = {
        text: JSON.stringify(data),
        direction: req.headers['content-language'] === 'he' ? 'rtl' : 'ltr',
        lang: req.headers['content-language'],
        type: req.path.includes('/entities/') ? 'educational' : 'general'
      };

      const hebrewCompliance = complianceService.validateHebrewContentCompliance(content);

      // Add Hebrew compliance headers
      if (hebrewCompliance.hebrewPresent && !this.headersSent) {
        this.setHeader('X-Hebrew-Content', 'detected');
        this.setHeader('X-RTL-Formatted', hebrewCompliance.rtlFormatting ? 'true' : 'false');
        this.setHeader('Content-Language', 'he-IL');
        this.setHeader('Direction', 'rtl');
      }

      // Add accessibility headers
      if (hebrewCompliance.recommendations.length > 0 && !this.headersSent) {
        this.setHeader('X-Accessibility-Recommendations', hebrewCompliance.recommendations.join('; '));
      }

      // Store compliance info
      if (req.israeliCompliance) {
        req.israeliCompliance.hebrewContent = hebrewCompliance;
      }
    }

    return originalJson.call(this, data);
  };
}

/**
 * Main Smart Israeli Context Middleware
 * Replaces 5 separate Israeli compliance middlewares
 */
export function smartIsraeliContextMiddleware() {
  return async (req, res, next) => {
    // Quick context detection
    const needsIsraeliProcessing = shouldActivateIsraeliMiddlewares(req);

    if (!needsIsraeliProcessing) {
      return next(); // Skip all Israeli processing
    }

    try {
      // Get cached Israeli time (expensive operation)
      const israelTime = getCachedIsraeliTime();

      // Apply Israeli compliance headers
      applyIsraeliComplianceHeaders(res, israelTime);

      // Apply Israeli timezone context
      applyIsraeliTimezoneContext(req, israelTime);

      // Handle privacy compliance (async)
      const privacyError = await handleIsraeliPrivacyCompliance(req, res);
      if (privacyError?.error) {
        return res.status(privacyError.statusCode).json(privacyError.response);
      }

      // Handle data residency compliance
      const residencyError = handleIsraeliDataResidencyCompliance(req, res);
      if (residencyError?.error) {
        return res.status(residencyError.statusCode).json(residencyError.response);
      }

      // Setup Hebrew content compliance (response override)
      setupHebrewContentCompliance(req, res);

      next();
    } catch (error) {
      console.error('Smart Israeli context middleware error:', error);
      // Don't block request on middleware error
      next();
    }
  };
}

/**
 * Israeli compliance audit logging
 * Maintains functionality from israeliComplianceAuditLogger()
 */
export function israeliComplianceAuditLogger() {
  return (req, res, next) => {
    const originalEnd = res.end;

    res.end = function(...args) {
      // Only log if Israeli compliance was processed
      if (req.israeliCompliance) {
        const auditLog = {
          timestamp: getCachedIsraeliTime().toISOString(),
          method: req.method,
          path: req.path,
          userId: req.user?.id,
          compliance: req.israeliCompliance,
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        };

        // Log in development
        if (process.env.ENVIRONMENT === 'development') {
          console.log('🇮🇱 Israeli Compliance Audit:', JSON.stringify(auditLog, null, 2));
        }

        // Store compliance metrics
        complianceService.logComplianceCheck('request_audit', {
          compliant: res.statusCode < 400,
          path: req.path,
          method: req.method,
          compliance: req.israeliCompliance
        });
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Israeli compliance report endpoint
 * Maintains functionality from israeliComplianceReport()
 */
export function israeliComplianceReport() {
  return async (req, res, next) => {
    if (req.path === '/api/admin/compliance/israel' && req.user?.role === 'admin') {
      try {
        const report = complianceService.generateComplianceReport();

        return res.json({
          success: true,
          report,
          generatedBy: req.user.id,
          timestamp: getCachedIsraeliTime().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Compliance Report Generation Failed',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Israeli maintenance compliance
 * Maintains functionality from israeliMaintenanceCompliance()
 */
export function israeliMaintenanceCompliance() {
  return (req, res, next) => {
    const isMaintenanceOperation = req.path.includes('/admin/maintenance') ||
                                   req.headers['x-maintenance-operation'];

    if (isMaintenanceOperation && req.method !== 'GET') {
      const schedulingCheck = complianceService.checkIsraeliSchedulingCompliance(
        'maintenance',
        new Date()
      );

      if (!schedulingCheck.approved) {
        return res.status(409).json({
          error: 'Maintenance Schedule Conflict',
          message: 'Maintenance not recommended at this time',
          israeliCompliance: schedulingCheck,
          alternatives: schedulingCheck.alternatives
        });
      }

      if (!res.headersSent) {
        res.setHeader('X-Israeli-Schedule-Check', 'approved');
        res.setHeader('X-Israeli-Time', schedulingCheck.israelTime);
      }
    }

    next();
  };
}

// Cache management - clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;
  const tenMinutesAgo = now - 600000;

  // Clean context detection cache (5 minutes)
  for (const [key, timestamp] of contextDetectionCache.entries()) {
    if (timestamp < fiveMinutesAgo) {
      contextDetectionCache.delete(key);
    }
  }

  // Clean Hebrew content cache (10 minutes)
  for (const [key, timestamp] of hebrewContentCache.entries()) {
    if (timestamp < tenMinutesAgo) {
      hebrewContentCache.delete(key);
    }
  }
}, 300000); // Every 5 minutes

export default {
  smartIsraeliContextMiddleware,
  israeliComplianceAuditLogger,
  israeliComplianceReport,
  israeliMaintenanceCompliance,
  shouldActivateIsraeliMiddlewares, // Export for testing
  getCachedIsraeliTime, // Export for testing
  hasHebrewContent // Export for testing
};