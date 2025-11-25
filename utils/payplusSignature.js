import crypto from 'crypto';
import { error as logger } from '../lib/errorLogger.js';
import PaymentService from '../services/PaymentService.js';

/**
 * PayPlus Webhook Signature Verification Utility
 *
 * Provides cryptographic verification of PayPlus webhook signatures to prevent
 * payment fraud and ensure webhook authenticity.
 */

/**
 * Verifies PayPlus webhook signature using HMAC-SHA256
 * @param {Object|string} payload - Request body (raw payload)
 * @param {string} signature - Signature from webhook headers
 * @param {string} [providedSecretKey] - Optional secret key override
 * @returns {boolean} - True if signature is valid
 */
function verifyPayPlusSignature(payload, signature, providedSecretKey = null) {
  try {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification started');

    // Validate required parameters
    if (!signature) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification failed: Missing signature');
      return false;
    }

    // Get secret key (use provided or fetch from PaymentService)
    let secretKey = providedSecretKey;
    if (!secretKey) {
      try {
        const credentials = PaymentService.getPayPlusCredentials();
        secretKey = credentials.payment_secret_key;
      } catch (error) {
        // TODO remove debug - webhook signature verification
        logger.payment('PayPlus signature verification failed: Could not get credentials', error);
        return false;
      }
    }

    if (!secretKey) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification failed: Missing secret key');
      return false;
    }

    // Normalize payload to string for signature generation
    // PayPlus sends JSON body, we need consistent string representation
    const message = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification: payload normalized', {
      payloadType: typeof payload,
      messageLength: message.length
    });

    // Generate expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('hex');

    // Remove any prefixes from received signature (PayPlus might add 'sha256=' prefix)
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Validate signature format and length before comparison
    if (!/^[a-f0-9]{64}$/i.test(cleanSignature)) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: FAILED - invalid signature format', {
        received: cleanSignature.substring(0, 10) + '...',
        length: cleanSignature.length
      });
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    // This is critical for security - prevents attackers from determining
    // correct signature characters by measuring response time
    const isValid = crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (isValid) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: SUCCESS');
    } else {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus signature verification: FAILED - signature mismatch', {
        received: cleanSignature.substring(0, 10) + '...',
        expected: expectedSignature.substring(0, 10) + '...'
      });
    }

    return isValid;

  } catch (error) {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus signature verification: FAILED - exception occurred', error);
    return false;
  }
}

/**
 * Generate a PayPlus-style signature for testing purposes
 * @param {Object|string} payload - Payload to sign
 * @param {string} [providedSecretKey] - Optional secret key override
 * @returns {string} - Generated signature
 */
function generatePayPlusSignature(payload, providedSecretKey = null) {
  try {
    // Get secret key (use provided or fetch from PaymentService)
    let secretKey = providedSecretKey;
    if (!secretKey) {
      const credentials = PaymentService.getPayPlusCredentials();
      secretKey = credentials.payment_secret_key;
    }

    // Normalize payload to string
    const message = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    // Generate signature
    return crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('hex');

  } catch (error) {
    logger.payment('PayPlus signature generation failed:', error);
    throw error;
  }
}

/**
 * Validate PayPlus webhook signature and log security events
 * @param {Object} req - Express request object
 * @param {Array<string>} possibleHeaders - Array of possible signature header names
 * @returns {boolean} - True if signature is valid
 */
function validateWebhookSignature(req, possibleHeaders = ['x-payplus-signature', 'payplus-signature', 'x-signature']) {
  try {
    // Check multiple possible header names for signature
    let signature = null;
    let usedHeader = null;

    for (const headerName of possibleHeaders) {
      if (req.headers[headerName]) {
        signature = req.headers[headerName];
        usedHeader = headerName;
        break;
      }
    }

    if (!signature) {
      // TODO remove debug - webhook signature verification
      logger.payment('PayPlus webhook validation failed: No signature header found', {
        checkedHeaders: possibleHeaders,
        availableHeaders: Object.keys(req.headers)
      });
      return false;
    }

    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus webhook validation: Found signature header', {
      header: usedHeader,
      signatureLength: signature.length
    });

    // Verify the signature
    return verifyPayPlusSignature(req.body, signature);

  } catch (error) {
    // TODO remove debug - webhook signature verification
    logger.payment('PayPlus webhook validation failed with exception:', error);
    return false;
  }
}

export {
  verifyPayPlusSignature,
  generatePayPlusSignature,
  validateWebhookSignature
};