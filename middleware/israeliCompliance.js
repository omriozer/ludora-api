/**
 * Israeli Compliance Middleware
 *
 * Middleware for automatic Israeli compliance checks and enforcement.
 * Integrates with IsraeliComplianceService to ensure all requests
 * and responses meet Israeli regulatory and market requirements.
 */

import IsraeliComplianceService from '../services/IsraeliComplianceService.js';
import moment from 'moment-timezone';

// Global compliance service instance
const complianceService = new IsraeliComplianceService();

/**
 * Israeli compliance headers middleware
 * Adds compliance-related headers to all responses
 */
export function israeliComplianceHeaders() {
  return (req, res, next) => {
    const israelTime = moment().tz('Asia/Jerusalem');

    // Add Israeli compliance headers
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

    next();
  };
}

/**
 * User privacy compliance middleware
 * Validates user data handling for Israeli privacy laws
 */
export function israeliPrivacyCompliance() {
  return async (req, res, next) => {
    // Skip for non-user requests
    if (!req.user) {
      return next();
    }

    try {
      // Check privacy compliance for Israeli users
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
        timestamp: moment().tz('Asia/Jerusalem').toISOString()
      };

      // If compliance issues require immediate action
      if (!compliance.compliant && compliance.actions.includes('request_parental_consent')) {
        return res.status(403).json({
          error: 'Compliance Required',
          message: 'Parental consent required for users under 13',
          action: 'request_parental_consent',
          israeliCompliance: true
        });
      }

      if (compliance.actions.includes('refresh_consent')) {
        // Add consent refresh header
        res.setHeader('X-Consent-Refresh-Required', 'true');
        res.setHeader('X-Consent-Refresh-URL', '/consent-refresh');
      }

      next();
    } catch (error) {
      console.error('Israeli privacy compliance check failed:', error);
      // Don't block request on compliance check failure, but log
      req.israeliCompliance = { error: error.message };
      next();
    }
  };
}

/**
 * Data residency compliance middleware
 * Ensures data operations comply with Israeli data residency requirements
 */
export function israeliDataResidencyCompliance() {
  return (req, res, next) => {
    // Check if request involves data storage operations
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
      res.setHeader('X-Data-Region', currentRegion);
      res.setHeader('X-Data-Compliance', residencyCheck.compliant ? 'true' : 'false');

      if (!residencyCheck.compliant && residencyCheck.issues.length > 0) {
        console.warn('Israeli data residency compliance issue:', residencyCheck);

        // For critical non-compliance, block the request
        if (dataType === 'student_data' && !residencyCheck.compliant) {
          return res.status(400).json({
            error: 'Data Residency Compliance Error',
            message: 'Student data cannot be stored in this region',
            issues: residencyCheck.issues,
            recommendations: residencyCheck.recommendations,
            israeliCompliance: true
          });
        }
      }
    }

    next();
  };
}

/**
 * Hebrew content compliance middleware
 * Validates Hebrew content meets Israeli accessibility and formatting standards
 */
export function israeliHebrewContentCompliance() {
  return (req, res, next) => {
    // Store original res.json to intercept responses
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
        if (hebrewCompliance.hebrewPresent) {
          this.setHeader('X-Hebrew-Content', 'detected');
          this.setHeader('X-RTL-Formatted', hebrewCompliance.rtlFormatting ? 'true' : 'false');
          this.setHeader('Content-Language', 'he-IL');
          this.setHeader('Direction', 'rtl');
        }

        // Add accessibility headers
        if (hebrewCompliance.recommendations.length > 0) {
          this.setHeader('X-Accessibility-Recommendations', hebrewCompliance.recommendations.join('; '));
        }

        // Store compliance info in request for logging
        if (req.israeliCompliance) {
          req.israeliCompliance.hebrewContent = hebrewCompliance;
        }
      }

      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Israeli timezone compliance middleware
 * Ensures all timestamps and scheduling respect Israeli timezone
 */
export function israeliTimezoneCompliance() {
  return (req, res, next) => {
    // Add Israeli timezone to request context
    req.israelTimezone = 'Asia/Jerusalem';
    req.israelTime = moment().tz('Asia/Jerusalem');

    // Override Date operations if needed (for consistency)
    if (!req.originalDate) {
      req.originalDate = Date;

      // Provide Israeli time utilities
      req.israelTimeUtils = {
        now: () => moment().tz('Asia/Jerusalem'),
        format: (date, format) => moment(date).tz('Asia/Jerusalem').format(format || 'YYYY-MM-DD HH:mm:ss'),
        isBusinessHours: () => {
          const hour = moment().tz('Asia/Jerusalem').hour();
          return hour >= 8 && hour <= 18;
        },
        isShabbat: () => complianceService.isShabbat(moment().tz('Asia/Jerusalem')),
        israeliDate: () => moment().tz('Asia/Jerusalem').format('DD/MM/YYYY')
      };
    }

    // Add timezone headers
    res.setHeader('X-Server-Timezone', 'Asia/Jerusalem');
    res.setHeader('X-Server-Time', moment().tz('Asia/Jerusalem').toISOString());

    next();
  };
}

/**
 * Compliance audit logging middleware
 * Logs compliance-related information for audit purposes
 */
export function israeliComplianceAuditLogger() {
  return (req, res, next) => {
    // Store original res.end to capture completion
    const originalEnd = res.end;

    res.end = function(...args) {
      // Log compliance information if available
      if (req.israeliCompliance) {
        const auditLog = {
          timestamp: moment().tz('Asia/Jerusalem').toISOString(),
          method: req.method,
          path: req.path,
          userId: req.user?.id,
          compliance: req.israeliCompliance,
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        };

        // In production, this would go to a compliance audit system
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

      // Call original res.end
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Israeli compliance report endpoint middleware
 * Provides compliance reporting for admin users
 */
export function israeliComplianceReport() {
  return async (req, res, next) => {
    // Only provide compliance reports to admin users
    if (req.path === '/api/admin/compliance/israel' && req.user?.role === 'admin') {
      try {
        const report = complianceService.generateComplianceReport();

        return res.json({
          success: true,
          report,
          generatedBy: req.user.id,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
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
 * Israeli maintenance window compliance middleware
 * Checks if maintenance operations should be scheduled
 */
export function israeliMaintenanceCompliance() {
  return (req, res, next) => {
    // Check for maintenance operations
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

      // Add scheduling info to headers
      res.setHeader('X-Israeli-Schedule-Check', 'approved');
      res.setHeader('X-Israeli-Time', schedulingCheck.israelTime);
    }

    next();
  };
}

export default {
  israeliComplianceHeaders,
  israeliPrivacyCompliance,
  israeliDataResidencyCompliance,
  israeliHebrewContentCompliance,
  israeliTimezoneCompliance,
  israeliComplianceAuditLogger,
  israeliComplianceReport,
  israeliMaintenanceCompliance,
  complianceService
};