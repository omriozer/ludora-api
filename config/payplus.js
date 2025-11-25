/**
 * PayPlus Webhook Security Configuration
 *
 * Centralized configuration for PayPlus webhook signature verification
 * and security settings to prevent payment fraud.
 */

/**
 * Webhook signature configuration
 */
const webhookConfig = {
  // Signature header names PayPlus might use
  signatureHeaders: [
    'x-payplus-signature',
    'payplus-signature',
    'x-signature',
    'signature',
    'x-payplus-webhook-signature',
    'payplus-webhook-signature'
  ],

  // Default signature header (primary expected header)
  defaultSignatureHeader: process.env.PAYPLUS_SIGNATURE_HEADER || 'x-payplus-signature',

  // Whether to enforce signature verification
  // Can be disabled for development/testing with environment variable
  enforceSignature: process.env.PAYPLUS_ENFORCE_SIGNATURE !== 'false', // Default true

  // Whether to log signature verification failures for monitoring
  logSecurityFailures: process.env.PAYPLUS_LOG_SECURITY_FAILURES !== 'false', // Default true

  // Maximum payload size for security (prevent DoS attacks)
  maxPayloadSize: process.env.PAYPLUS_MAX_PAYLOAD_SIZE || '10mb',

  // Rate limiting for signature failures (per IP)
  securityRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxFailures: parseInt(process.env.PAYPLUS_MAX_SIGNATURE_FAILURES) || 5,
    blockDurationMs: 60 * 60 * 1000 // 1 hour block after max failures
  },

  // Monitoring thresholds
  monitoring: {
    // Alert if more than X signature failures in Y minutes
    alertThresholds: {
      failures: parseInt(process.env.PAYPLUS_ALERT_FAILURE_COUNT) || 5,
      timeWindowMinutes: parseInt(process.env.PAYPLUS_ALERT_TIME_WINDOW) || 60,
      severity: process.env.PAYPLUS_ALERT_SEVERITY || 'high'
    },

    // Dashboard metrics to track
    metrics: [
      'webhook_received_count',
      'signature_verified_count',
      'signature_failed_count',
      'security_blocked_count',
      'processing_time_avg'
    ]
  }
};

/**
 * Security validation rules
 */
const securityRules = {
  // Required fields in PayPlus webhooks for additional validation
  requiredFields: [
    'transaction.payment_page_request_uid',
    'transaction_uid'
  ],

  // Suspicious patterns to flag for additional monitoring
  suspiciousPatterns: {
    // Flag if same IP sends many failed signature attempts
    repeatedFailuresFromSameIP: true,

    // Flag if webhook data doesn't match expected PayPlus format
    invalidDataStructure: true,

    // Flag if timing between requests suggests automated attacks
    rapidFireRequests: true
  },

  // IP whitelist for PayPlus servers (if known)
  // Leave empty if PayPlus doesn't provide static IPs
  allowedSourceIPs: process.env.PAYPLUS_ALLOWED_IPS ?
    process.env.PAYPLUS_ALLOWED_IPS.split(',').map(ip => ip.trim()) : [],

  // User-Agent patterns that are suspicious
  suspiciousUserAgents: [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /postman/i
  ]
};

/**
 * Get webhook configuration based on environment
 * @returns {Object} Webhook configuration object
 */
function getWebhookConfig() {
  const environment = process.env.NODE_ENV || 'development';

  return {
    ...webhookConfig,
    environment,

    // In development, can optionally disable signature verification
    enforceSignature: environment === 'production' ?
      true :
      webhookConfig.enforceSignature,

    // Enhanced logging in non-production environments
    debugMode: environment !== 'production',

    // Adjusted rate limits for development
    securityRateLimit: environment === 'development' ?
      {
        ...webhookConfig.securityRateLimit,
        maxFailures: 20, // More lenient in development
        blockDurationMs: 5 * 60 * 1000 // 5 minute blocks in development
      } :
      webhookConfig.securityRateLimit
  };
}

/**
 * Get security validation rules
 * @returns {Object} Security rules object
 */
function getSecurityRules() {
  return securityRules;
}

/**
 * Check if an IP address is in the allowed list
 * @param {string} ip - IP address to check
 * @returns {boolean} True if IP is allowed or no whitelist is configured
 */
function isIPAllowed(ip) {
  if (!securityRules.allowedSourceIPs.length) {
    return true; // No whitelist configured, allow all
  }

  return securityRules.allowedSourceIPs.includes(ip);
}

/**
 * Check if User-Agent appears suspicious
 * @param {string} userAgent - User-Agent string to check
 * @returns {boolean} True if User-Agent is suspicious
 */
function isSuspiciousUserAgent(userAgent) {
  if (!userAgent) return true; // Missing User-Agent is suspicious

  return securityRules.suspiciousUserAgents.some(pattern =>
    pattern.test(userAgent)
  );
}

/**
 * Validate webhook data structure
 * @param {Object} webhookData - Webhook payload to validate
 * @returns {Object} Validation result
 */
function validateWebhookStructure(webhookData) {
  const missingFields = [];

  for (const fieldPath of securityRules.requiredFields) {
    const fieldValue = getNestedField(webhookData, fieldPath);
    if (!fieldValue) {
      missingFields.push(fieldPath);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    suspiciousStructure: missingFields.length > 0
  };
}

/**
 * Helper function to get nested object fields by path
 * @param {Object} obj - Object to search in
 * @param {string} path - Dot-notation path (e.g., 'transaction.payment_page_request_uid')
 * @returns {*} Field value or null if not found
 */
function getNestedField(obj, path) {
  return path.split('.').reduce((current, field) =>
    current && current[field] !== undefined ? current[field] : null, obj
  );
}

module.exports = {
  getWebhookConfig,
  getSecurityRules,
  isIPAllowed,
  isSuspiciousUserAgent,
  validateWebhookStructure,
  webhookConfig,
  securityRules
};