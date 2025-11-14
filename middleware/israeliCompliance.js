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

// REMOVED: israeliComplianceHeaders - unnecessary headers

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

      if (compliance.actions.includes('refresh_consent') && !res.headersSent) {
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

// REMOVED: israeliDataResidencyCompliance - unnecessary overhead

// REMOVED: israeliHebrewContentCompliance - unnecessary overhead

// REMOVED: israeliTimezoneCompliance - unnecessary overhead
// REMOVED: israeliComplianceAuditLogger - unnecessary logging
// REMOVED: israeliComplianceReport - unnecessary endpoint
// REMOVED: israeliMaintenanceCompliance - unnecessary scheduling

export default {
  israeliPrivacyCompliance,
  complianceService
};