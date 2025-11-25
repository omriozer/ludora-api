/**
 * PayPlus Payment Gateway Constants
 * Centralized constants for PayPlus integration to improve maintainability
 */

// PayPlus API Status Codes
export const PAYPLUS_STATUS_CODES = {
  SUCCESS: '000',
  GENERAL_ERROR: '001',
  INVALID_CREDENTIALS: '002',
  INSUFFICIENT_FUNDS: '003',
  EXPIRED_CARD: '004',
  INVALID_CARD: '005',
  DECLINED: '006',
  // Add other PayPlus status codes as needed
};

// Internal Payment Status Mapping
export const PAYMENT_STATUSES = {
  SUCCESS: 'success',
  APPROVED: 'approved',
  FAILED: 'failed',
  DECLINED: 'declined',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

// Transaction Types
export const TRANSACTION_TYPES = {
  ONE_TIME: 'one-time',
  RECURRING: 'recurring',
  SUBSCRIPTION_PAYMENT: 'subscription_payment',
  SUBSCRIPTION_RETRY: 'subscription_retry_payment'
};

// PayPlus Charge Methods
export const PAYPLUS_CHARGE_METHODS = {
  CARD_CHECK: 0,      // J2 - validates card without charging
  IMMEDIATE: 1,       // J4 - immediate payment (transactional purchases)
  APPROVAL: 2,        // J5 - funds verification
  RECURRING: 3,       // Recurring Payments - subscription billing
  REFUND: 4          // Immediate refund
};

// PayPlus Webhook Event Types
export const PAYPLUS_EVENT_TYPES = {
  CHARGE: 'Charge',
  REFUND: 'Refund',
  CHARGEBACK: 'Chargeback'
};

/**
 * Map PayPlus status code to internal payment status
 * @param {string} statusCode - PayPlus status code
 * @returns {string} - Internal payment status
 */
export function mapPayPlusStatusToPaymentStatus(statusCode) {
  switch (statusCode) {
    case PAYPLUS_STATUS_CODES.SUCCESS:
      return PAYMENT_STATUSES.SUCCESS;
    case PAYPLUS_STATUS_CODES.DECLINED:
    case PAYPLUS_STATUS_CODES.INVALID_CARD:
    case PAYPLUS_STATUS_CODES.EXPIRED_CARD:
      return PAYMENT_STATUSES.DECLINED;
    case PAYPLUS_STATUS_CODES.INSUFFICIENT_FUNDS:
    case PAYPLUS_STATUS_CODES.GENERAL_ERROR:
    case PAYPLUS_STATUS_CODES.INVALID_CREDENTIALS:
      return PAYMENT_STATUSES.FAILED;
    default:
      return PAYMENT_STATUSES.PENDING;
  }
}