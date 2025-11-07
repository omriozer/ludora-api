/**
 * Israeli Compliance Service
 *
 * Handles compliance requirements specific to Israeli law, regulations,
 * and market standards for educational technology platforms.
 *
 * Features:
 * - Data residency compliance
 * - Privacy law compliance (Israeli and GDPR)
 * - Educational content regulations
 * - Hebrew language requirements
 * - Israeli timezone and calendar integration
 * - Accessibility compliance (Israeli standards)
 * - Security compliance for Israeli organizations
 */

import moment from 'moment-timezone';
import crypto from 'crypto';

/**
 * Israeli compliance constants and requirements
 */
const ISRAELI_COMPLIANCE = {
  // Data residency requirements
  DATA_RESIDENCY: {
    ALLOWED_REGIONS: ['eu-central-1', 'eu-west-1'], // Frankfurt, Ireland (closest to Israel)
    PROHIBITED_REGIONS: ['cn-north-1', 'cn-northwest-1'], // China regions
    PREFERRED_REGION: 'eu-central-1' // Frankfurt - closest to Israel
  },

  // Privacy compliance
  PRIVACY: {
    DATA_RETENTION_DAYS: 2555, // 7 years (Israeli standard for educational records)
    COOKIE_CONSENT_REQUIRED: true,
    RIGHT_TO_DELETION: true,
    DATA_PORTABILITY: true,
    BREACH_NOTIFICATION_HOURS: 72
  },

  // Educational compliance
  EDUCATION: {
    STUDENT_DATA_PROTECTION: true,
    PARENT_CONSENT_UNDER_AGE: 13,
    CURRICULUM_STANDARDS: ['israeli_national', 'bagrut_preparation'],
    HEBREW_CONTENT_REQUIRED: true
  },

  // Accessibility (Israeli standard 5568)
  ACCESSIBILITY: {
    WCAG_LEVEL: 'AA',
    HEBREW_RTL_SUPPORT: true,
    SCREEN_READER_SUPPORT: true,
    KEYBOARD_NAVIGATION: true
  },

  // Security requirements
  SECURITY: {
    ENCRYPTION_STANDARD: 'AES-256',
    PASSWORD_POLICY: 'israeli_standard',
    TWO_FACTOR_AUTH: 'recommended',
    SESSION_TIMEOUT_MINUTES: 30
  },

  // Israeli calendar and timezone
  LOCALE: {
    TIMEZONE: 'Asia/Jerusalem',
    CALENDAR: 'gregorian', // Primary (Hebrew calendar support available)
    LANGUAGE: 'he-IL',
    CURRENCY: 'ILS',
    DATE_FORMAT: 'DD/MM/YYYY'
  }
};

/**
 * Israeli holidays and special dates for compliance scheduling
 */
const ISRAELI_HOLIDAYS = {
  // Major holidays when maintenance should be avoided
  MAJOR_HOLIDAYS: [
    'rosh-hashanah', 'yom-kippur', 'sukkot', 'pesach',
    'shavuot', 'independence-day', 'memorial-day'
  ],

  // School calendar considerations
  SCHOOL_BREAKS: {
    SUMMER: { start: '07-01', end: '08-31' },
    WINTER: { start: '12-25', end: '01-07' },
    PASSOVER: { start: '03-15', end: '04-30' } // Approximate
  }
};

/**
 * Israeli Compliance Service Class
 */
class IsraeliComplianceService {
  constructor() {
    this.timezone = ISRAELI_COMPLIANCE.LOCALE.TIMEZONE;
    this.complianceLog = [];
  }

  /**
   * Validate data residency compliance
   * Ensures data is stored in compliant regions
   */
  validateDataResidency(region, dataType) {
    const { ALLOWED_REGIONS, PROHIBITED_REGIONS } = ISRAELI_COMPLIANCE.DATA_RESIDENCY;

    const result = {
      compliant: true,
      region,
      dataType,
      issues: [],
      recommendations: []
    };

    if (PROHIBITED_REGIONS.includes(region)) {
      result.compliant = false;
      result.issues.push(`Data cannot be stored in prohibited region: ${region}`);
      result.recommendations.push(`Move data to allowed region: ${ISRAELI_COMPLIANCE.DATA_RESIDENCY.PREFERRED_REGION}`);
    }

    if (!ALLOWED_REGIONS.includes(region)) {
      result.compliant = false;
      result.issues.push(`Region ${region} not in allowed list for Israeli compliance`);
      result.recommendations.push(`Use approved regions: ${ALLOWED_REGIONS.join(', ')}`);
    }

    // Educational data has stricter requirements
    if (dataType === 'student_data' && region !== ISRAELI_COMPLIANCE.DATA_RESIDENCY.PREFERRED_REGION) {
      result.issues.push('Student data should be stored in preferred region for optimal compliance');
      result.recommendations.push(`Consider migrating to: ${ISRAELI_COMPLIANCE.DATA_RESIDENCY.PREFERRED_REGION}`);
    }

    this.logComplianceCheck('data_residency', result);
    return result;
  }

  /**
   * Validate privacy compliance for Israeli users
   */
  validatePrivacyCompliance(userData, userConsent) {
    const result = {
      compliant: true,
      issues: [],
      requirements: [],
      actions: []
    };

    // Check age requirements
    if (userData.age && userData.age < ISRAELI_COMPLIANCE.EDUCATION.PARENT_CONSENT_UNDER_AGE) {
      if (!userConsent.parentalConsent) {
        result.compliant = false;
        result.issues.push('Parental consent required for users under 13');
        result.actions.push('request_parental_consent');
      }
    }

    // Check data retention
    if (userData.lastActivity) {
      const lastActivity = moment(userData.lastActivity);
      const retentionLimit = moment().subtract(ISRAELI_COMPLIANCE.PRIVACY.DATA_RETENTION_DAYS, 'days');

      if (lastActivity.isBefore(retentionLimit)) {
        result.actions.push('consider_data_cleanup');
        result.requirements.push('Data retention period exceeded - review for cleanup');
      }
    }

    // Check consent currency
    if (userConsent.consentDate) {
      const consentDate = moment(userConsent.consentDate);
      const consentAge = moment().diff(consentDate, 'months');

      if (consentAge > 12) {
        result.actions.push('refresh_consent');
        result.requirements.push('User consent should be refreshed annually');
      }
    }

    this.logComplianceCheck('privacy', result);
    return result;
  }

  /**
   * Generate Israeli-compliant session configuration
   */
  generateIsraeliSessionConfig() {
    return {
      timeout: ISRAELI_COMPLIANCE.SECURITY.SESSION_TIMEOUT_MINUTES * 60 * 1000,
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      timezone: this.timezone,
      locale: ISRAELI_COMPLIANCE.LOCALE.LANGUAGE,

      // Israeli-specific session features
      rtlSupport: true,
      hebrewInterface: true,
      israeliCalendar: true,
      currency: ISRAELI_COMPLIANCE.LOCALE.CURRENCY,
      dateFormat: ISRAELI_COMPLIANCE.LOCALE.DATE_FORMAT
    };
  }

  /**
   * Check if operation should be scheduled considering Israeli context
   */
  checkIsraeliSchedulingCompliance(operationType, proposedTime) {
    const israelTime = moment(proposedTime).tz(this.timezone);
    const result = {
      approved: true,
      israelTime: israelTime.format(),
      recommendations: [],
      alternatives: []
    };

    // Check for major holidays
    const dayOfYear = israelTime.format('MM-DD');
    const isHolidayPeriod = this.isIsraeliHoliday(israelTime);

    if (isHolidayPeriod && operationType === 'maintenance') {
      result.approved = false;
      result.recommendations.push('Avoid maintenance during Israeli holidays');
      result.alternatives.push(this.suggestAlternativeMaintenanceTime(israelTime));
    }

    // Check for school hours (educational platform consideration)
    const hour = israelTime.hour();
    const isWeekday = israelTime.isoWeekday() <= 5;
    const isSchoolHours = hour >= 8 && hour <= 16;

    if (operationType === 'maintenance' && isWeekday && isSchoolHours) {
      result.recommendations.push('Consider scheduling outside school hours (8 AM - 4 PM)');
      result.alternatives.push(this.suggestOffHoursTime(israelTime));
    }

    // Check for Shabbat (Friday evening to Saturday evening)
    if (this.isShabbat(israelTime) && operationType === 'critical_maintenance') {
      result.recommendations.push('Consider Shabbat observance - emergency only');
    }

    return result;
  }

  /**
   * Generate Hebrew content compliance report
   */
  validateHebrewContentCompliance(content) {
    const result = {
      compliant: true,
      hebrewPresent: false,
      rtlFormatting: false,
      accessibility: {
        screenReaderFriendly: false,
        keyboardNavigable: false
      },
      recommendations: []
    };

    // Check for Hebrew content
    const hebrewPattern = /[\u0590-\u05FF]/;
    result.hebrewPresent = hebrewPattern.test(content.text || '');

    if (result.hebrewPresent) {
      // Check RTL formatting
      result.rtlFormatting = content.direction === 'rtl' || content.lang === 'he';

      if (!result.rtlFormatting) {
        result.compliant = false;
        result.recommendations.push('Hebrew content should use RTL formatting');
      }

      // Check accessibility
      if (content.ariaLabels && content.ariaLabels.he) {
        result.accessibility.screenReaderFriendly = true;
      } else {
        result.recommendations.push('Add Hebrew aria-labels for screen reader accessibility');
      }
    }

    // Educational content specific checks
    if (content.type === 'educational' && !result.hebrewPresent) {
      result.recommendations.push('Consider providing Hebrew translation for educational content');
    }

    return result;
  }

  /**
   * Generate compliance audit log entry
   */
  logComplianceCheck(type, result) {
    const logEntry = {
      timestamp: moment().tz(this.timezone).toISOString(),
      type,
      compliant: result.compliant,
      result: result,
      israelTime: moment().tz(this.timezone).format()
    };

    this.complianceLog.push(logEntry);

    // Keep log size manageable
    if (this.complianceLog.length > 1000) {
      this.complianceLog = this.complianceLog.slice(-500);
    }

    return logEntry;
  }

  /**
   * Generate Israeli compliance report
   */
  generateComplianceReport() {
    const recentLogs = this.complianceLog.slice(-100);
    const now = moment().tz(this.timezone);

    return {
      generatedAt: now.toISOString(),
      israelTime: now.format(),
      summary: {
        totalChecks: recentLogs.length,
        compliantChecks: recentLogs.filter(log => log.compliant).length,
        complianceRate: recentLogs.length ?
          (recentLogs.filter(log => log.compliant).length / recentLogs.length * 100).toFixed(2) + '%' : '100%'
      },
      breakdown: this.generateComplianceBreakdown(recentLogs),
      recommendations: this.generateComplianceRecommendations(recentLogs),
      israeliContext: {
        currentTime: now.format(),
        timezone: this.timezone,
        isShabbat: this.isShabbat(now),
        isHoliday: this.isIsraeliHoliday(now)
      }
    };
  }

  /**
   * Utility: Check if time falls on Shabbat
   */
  isShabbat(time) {
    const israelTime = moment(time).tz(this.timezone);
    const dayOfWeek = israelTime.day();

    // Friday after sunset (approximate) or Saturday before sunset
    if (dayOfWeek === 5) { // Friday
      return israelTime.hour() >= 18; // Approximate sunset
    }
    if (dayOfWeek === 6) { // Saturday
      return israelTime.hour() < 20; // Approximate end of Shabbat
    }

    return false;
  }

  /**
   * Utility: Check if time falls on Israeli holiday
   */
  isIsraeliHoliday(time) {
    // Simplified check - in production would integrate with Hebrew calendar
    const israelTime = moment(time).tz(this.timezone);
    const monthDay = israelTime.format('MM-DD');

    // Approximate major holidays (would need proper Hebrew calendar integration)
    const approximateHolidays = [
      '09-15', '09-16', // Rosh Hashanah (approximate)
      '09-24', // Yom Kippur (approximate)
      '04-14', '04-15', // Independence Day
      '05-04' // Memorial Day
    ];

    return approximateHolidays.includes(monthDay);
  }

  /**
   * Utility: Suggest alternative maintenance time
   */
  suggestAlternativeMaintenanceTime(originalTime) {
    const alternative = moment(originalTime).tz(this.timezone);

    // Suggest early morning (2-5 AM) on weekdays
    alternative.hour(3).minute(0).second(0);

    // If it's Friday/Saturday, move to Sunday
    if (alternative.day() >= 5) {
      alternative.day(7); // Sunday
    }

    return alternative.toISOString();
  }

  /**
   * Utility: Suggest off-hours time
   */
  suggestOffHoursTime(originalTime) {
    const alternative = moment(originalTime).tz(this.timezone);

    // If during day, suggest evening
    if (alternative.hour() < 18) {
      alternative.hour(22); // 10 PM
    } else {
      alternative.add(1, 'day').hour(2); // 2 AM next day
    }

    return alternative.toISOString();
  }

  /**
   * Generate compliance breakdown by type
   */
  generateComplianceBreakdown(logs) {
    const breakdown = {};

    logs.forEach(log => {
      if (!breakdown[log.type]) {
        breakdown[log.type] = { total: 0, compliant: 0 };
      }
      breakdown[log.type].total++;
      if (log.compliant) breakdown[log.type].compliant++;
    });

    Object.keys(breakdown).forEach(type => {
      breakdown[type].rate = breakdown[type].total ?
        (breakdown[type].compliant / breakdown[type].total * 100).toFixed(1) + '%' : '100%';
    });

    return breakdown;
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(logs) {
    const recommendations = [];
    const issues = logs.filter(log => !log.compliant);

    if (issues.length > 0) {
      recommendations.push('Review and address compliance issues identified in recent checks');
    }

    if (issues.some(issue => issue.type === 'data_residency')) {
      recommendations.push('Consider data migration to Israeli-compliant regions');
    }

    if (issues.some(issue => issue.type === 'privacy')) {
      recommendations.push('Update privacy controls and consent management');
    }

    return recommendations;
  }
}

export default IsraeliComplianceService;