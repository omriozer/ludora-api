# Ludora API Error Handling Reference

> **Comprehensive guide to error codes, handling patterns, and recovery strategies**

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [HTTP Status Codes](#http-status-codes)
3. [Error Code Categories](#error-code-categories)
4. [Common Error Scenarios](#common-error-scenarios)
5. [Client-Side Error Handling](#client-side-error-handling)
6. [Rate Limiting Errors](#rate-limiting-errors)
7. [Validation Errors](#validation-errors)
8. [File Upload Errors](#file-upload-errors)
9. [Payment Errors](#payment-errors)
10. [Recovery Strategies](#recovery-strategies)

---

## Error Response Format

### Standard Error Structure

All Ludora API errors follow a consistent JSON structure:

```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "MACHINE_READABLE_ERROR_CODE",
    "statusCode": 400,
    "details": {
      "field": "specific_field_name",
      "value": "invalid_value",
      "expected": "expected_format"
    },
    "requestId": "req_abc123def456",
    "timestamp": "2025-12-11T10:30:00.000Z",
    "documentation": "https://docs.ludora.app/errors/VALIDATION_ERROR"
  }
}
```

### Error Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable error description for display |
| `code` | string | Machine-readable error identifier |
| `statusCode` | integer | HTTP status code |
| `details` | object | Additional error-specific information |
| `requestId` | string | Unique request identifier for debugging |
| `timestamp` | string | ISO timestamp when error occurred |
| `documentation` | string | Link to error-specific documentation |

---

## HTTP Status Codes

### Success (2xx)
- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `204 No Content` - Successful deletion

### Client Errors (4xx)
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (duplicate)
- `413 Payload Too Large` - File/request too large
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded

### Server Errors (5xx)
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Service temporarily unavailable
- `504 Gateway Timeout` - Request timeout

---

## Error Code Categories

### Authentication Errors (AUTH_*)

```json
// Missing authentication token
{
  "error": {
    "message": "Authentication token required",
    "code": "AUTH_MISSING_TOKEN",
    "statusCode": 401
  }
}

// Invalid or expired token
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTH_INVALID_TOKEN",
    "statusCode": 401
  }
}

// Portal access mismatch
{
  "error": {
    "message": "Authentication method not valid for this portal",
    "code": "AUTH_PORTAL_MISMATCH",
    "statusCode": 403,
    "details": {
      "currentPortal": "student",
      "expectedPortal": "teacher"
    }
  }
}
```

### Validation Errors (VALIDATION_*)

```json
// Field validation failed
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 422,
    "details": [
      {
        "field": "title",
        "message": "Title must be between 1 and 200 characters",
        "value": "",
        "rule": "length"
      },
      {
        "field": "price",
        "message": "Price must be a positive number",
        "value": -10,
        "rule": "positive"
      }
    ]
  }
}

// Required field missing
{
  "error": {
    "message": "Required field missing",
    "code": "VALIDATION_REQUIRED_FIELD",
    "statusCode": 422,
    "details": {
      "field": "entity_id",
      "requiredFields": ["entity_type", "entity_id"]
    }
  }
}
```

### Access Control Errors (ACCESS_*)

```json
// Payment required for access
{
  "error": {
    "message": "Purchase required to access this content",
    "code": "ACCESS_PAYMENT_REQUIRED",
    "statusCode": 402,
    "details": {
      "entity_type": "workshop",
      "entity_id": "ws_123abc",
      "price": 49.90,
      "purchase_url": "/api/payments/createPayplusPaymentPage"
    }
  }
}

// Insufficient permissions
{
  "error": {
    "message": "You do not have permission to access this resource",
    "code": "ACCESS_INSUFFICIENT_PERMISSIONS",
    "statusCode": 403,
    "details": {
      "required_permission": "owner",
      "user_permission": "viewer"
    }
  }
}
```

### File Operation Errors (FILE_*)

```json
// File too large
{
  "error": {
    "message": "File size exceeds maximum limit",
    "code": "FILE_TOO_LARGE",
    "statusCode": 413,
    "details": {
      "fileSize": 524288000,
      "maxSize": 104857600,
      "maxSizeFormatted": "100MB"
    }
  }
}

// Invalid file type
{
  "error": {
    "message": "File type not supported",
    "code": "FILE_INVALID_TYPE",
    "statusCode": 422,
    "details": {
      "providedType": "application/x-executable",
      "allowedTypes": ["image/jpeg", "image/png", "application/pdf"]
    }
  }
}
```

### Business Logic Errors (BUSINESS_*)

```json
// Product not published
{
  "error": {
    "message": "Product is not available for purchase",
    "code": "BUSINESS_PRODUCT_NOT_PUBLISHED",
    "statusCode": 409,
    "details": {
      "product_id": "prod_123abc",
      "status": "draft"
    }
  }
}

// Subscription limit exceeded
{
  "error": {
    "message": "Monthly subscription limit exceeded",
    "code": "BUSINESS_SUBSCRIPTION_LIMIT_EXCEEDED",
    "statusCode": 409,
    "details": {
      "monthly_limit": 10,
      "current_usage": 10,
      "reset_date": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

## Common Error Scenarios

### 1. Entity Not Found

```http
GET /api/entities/game/non_existent_id

Response: 404
{
  "error": {
    "message": "Game not found",
    "code": "ENTITY_NOT_FOUND",
    "statusCode": 404,
    "details": {
      "entity_type": "game",
      "entity_id": "non_existent_id"
    }
  }
}
```

### 2. Ownership Validation Failed

```http
PUT /api/entities/game/game_123abc
Authorization: Bearer user_xyz_token

Response: 403
{
  "error": {
    "message": "You do not own this resource",
    "code": "ACCESS_OWNERSHIP_REQUIRED",
    "statusCode": 403,
    "details": {
      "entity_type": "game",
      "entity_id": "game_123abc",
      "owner_id": "user_abc",
      "requester_id": "user_xyz"
    }
  }
}
```

### 3. Bundle Validation Failed

```http
POST /api/entities/bundle
{
  "title": "Empty Bundle",
  "type_attributes": {
    "is_bundle": true,
    "bundle_items": []
  }
}

Response: 422
{
  "error": {
    "message": "Bundle validation failed",
    "code": "VALIDATION_BUNDLE_INVALID",
    "statusCode": 422,
    "details": {
      "errors": [
        "Bundle must contain at least 2 items",
        "Bundle must contain at most 50 items"
      ],
      "bundle_items_count": 0,
      "min_items": 2,
      "max_items": 50
    }
  }
}
```

---

## Client-Side Error Handling

### React Error Boundary

```javascript
// components/ErrorBoundary.jsx
class APIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service
    console.error('API Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

### Error Handler Hook

```javascript
// hooks/useErrorHandler.js
import { useState, useCallback } from 'react';

export function useErrorHandler() {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((error) => {
    setError(error);
    setIsLoading(false);

    // Handle specific error codes
    switch (error.code) {
      case 'AUTH_INVALID_TOKEN':
      case 'AUTH_MISSING_TOKEN':
        // Redirect to login
        window.location.href = '/login';
        break;

      case 'ACCESS_PAYMENT_REQUIRED':
        // Show purchase dialog
        showPurchaseDialog(error.details);
        break;

      case 'RATE_LIMITED':
        // Show rate limit message
        const retryAfter = error.details.retryAfter || 60;
        showToast(`Rate limited. Try again in ${retryAfter} seconds.`);
        break;

      case 'VALIDATION_ERROR':
        // Handle field validation errors
        if (error.details?.length > 0) {
          setFieldErrors(error.details);
        }
        break;

      default:
        // Generic error display
        showToast(error.message || 'An unexpected error occurred');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError, isLoading, setIsLoading };
}
```

### API Client Error Handling

```javascript
// utils/apiClient.js
export async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      }
    });

    // Handle successful responses
    if (response.ok) {
      return await response.json();
    }

    // Parse error response
    const errorData = await response.json().catch(() => ({
      error: {
        message: 'Unknown server error',
        code: 'UNKNOWN_ERROR',
        statusCode: response.status
      }
    }));

    // Enhance error with response data
    const error = new APIError(
      errorData.error.message,
      errorData.error.code,
      errorData.error.statusCode,
      errorData.error.details,
      response
    );

    throw error;

  } catch (fetchError) {
    // Handle network errors
    if (fetchError instanceof APIError) {
      throw fetchError;
    }

    throw new APIError(
      'Network error occurred',
      'NETWORK_ERROR',
      0,
      { originalError: fetchError.message }
    );
  }
}

// Custom error class
class APIError extends Error {
  constructor(message, code, statusCode, details = {}, response = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.response = response;
  }

  isAuthError() {
    return this.code.startsWith('AUTH_');
  }

  isValidationError() {
    return this.code.startsWith('VALIDATION_');
  }

  isRetryable() {
    return [
      'NETWORK_ERROR',
      'RATE_LIMITED',
      'SERVER_ERROR'
    ].includes(this.code);
  }
}
```

---

## Rate Limiting Errors

### Rate Limit Response

```json
{
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMITED",
    "statusCode": 429,
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset": 1670000000,
      "retryAfter": 60,
      "window": 900
    }
  }
}
```

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1670000000
X-RateLimit-Window: 900
Retry-After: 60
```

### Handling Rate Limits

```javascript
// Exponential backoff for rate limits
async function handleRateLimit(error, retryCount = 0) {
  const maxRetries = 3;

  if (retryCount >= maxRetries) {
    throw error;
  }

  const retryAfter = error.details.retryAfter || Math.pow(2, retryCount) * 1000;

  console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);

  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

  // Retry the original request
  return retryOriginalRequest(retryCount + 1);
}
```

---

## Validation Errors

### Field Validation Rules

| Rule | Description | Example Error |
|------|-------------|---------------|
| `required` | Field is mandatory | "Title is required" |
| `length` | String length validation | "Title must be between 1 and 200 characters" |
| `email` | Valid email format | "Invalid email format" |
| `url` | Valid URL format | "Invalid URL format" |
| `positive` | Positive number | "Price must be positive" |
| `enum` | Value from allowed list | "Status must be one of: draft, published" |
| `file_type` | Allowed file types | "File must be PNG, JPG, or PDF" |
| `file_size` | Maximum file size | "File must be smaller than 100MB" |

### Validation Error Response

```json
{
  "error": {
    "message": "Multiple validation errors occurred",
    "code": "VALIDATION_MULTIPLE_ERRORS",
    "statusCode": 422,
    "details": {
      "errors": [
        {
          "field": "title",
          "message": "Title is required",
          "rule": "required",
          "value": null
        },
        {
          "field": "price",
          "message": "Price must be between 0.01 and 999999.99",
          "rule": "range",
          "value": 0,
          "min": 0.01,
          "max": 999999.99
        },
        {
          "field": "type_attributes.difficulty",
          "message": "Difficulty must be one of: easy, medium, hard",
          "rule": "enum",
          "value": "impossible",
          "allowedValues": ["easy", "medium", "hard"]
        }
      ],
      "errorCount": 3
    }
  }
}
```

### Form Validation Integration

```javascript
// Form validation with error display
function ProductForm() {
  const [formData, setFormData] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const { handleError } = useErrorHandler();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiRequest('/entities/product', {
        method: 'POST',
        data: formData
      });
      // Success handling
    } catch (error) {
      if (error.code === 'VALIDATION_MULTIPLE_ERRORS') {
        // Convert validation errors to field-specific errors
        const errors = {};
        error.details.errors.forEach(err => {
          errors[err.field] = err.message;
        });
        setFieldErrors(errors);
      } else {
        handleError(error);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className={fieldErrors.title ? 'error' : ''}
        />
        {fieldErrors.title && (
          <div className="error-message">{fieldErrors.title}</div>
        )}
      </div>
      {/* More form fields */}
    </form>
  );
}
```

---

## File Upload Errors

### Common File Upload Error Codes

```javascript
const FILE_ERROR_CODES = {
  FILE_TOO_LARGE: {
    message: 'File size exceeds maximum limit',
    recovery: 'Compress file or choose a smaller file'
  },
  FILE_INVALID_TYPE: {
    message: 'File type not supported',
    recovery: 'Convert to supported format'
  },
  FILE_CORRUPTED: {
    message: 'File appears to be corrupted',
    recovery: 'Try uploading a different file'
  },
  FILE_UPLOAD_FAILED: {
    message: 'File upload failed',
    recovery: 'Check connection and try again'
  },
  FILE_VIRUS_DETECTED: {
    message: 'Security scan detected potential threat',
    recovery: 'Scan file with antivirus and try again'
  }
};
```

### File Upload Error Handling

```javascript
async function uploadFile(file, entityType, entityId, assetType) {
  try {
    // Pre-upload validation
    if (file.size > MAX_FILE_SIZE) {
      throw new APIError(
        `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`,
        'FILE_TOO_LARGE',
        413,
        {
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE,
          maxSizeFormatted: formatFileSize(MAX_FILE_SIZE)
        }
      );
    }

    const formData = new FormData();
    formData.append('file', file);

    const result = await apiRequest(`/v2/assets/${entityType}/${entityId}/${assetType}`, {
      method: 'POST',
      data: formData
    });

    return result;

  } catch (error) {
    // Enhanced file error handling
    if (error.code === 'FILE_TOO_LARGE') {
      showFileError(
        'File Too Large',
        `Your file (${formatFileSize(error.details.fileSize)}) exceeds the maximum size of ${error.details.maxSizeFormatted}. Please compress or choose a smaller file.`,
        'warning'
      );
    } else if (error.code === 'FILE_INVALID_TYPE') {
      showFileError(
        'Invalid File Type',
        `File type "${error.details.providedType}" is not supported. Please use: ${error.details.allowedTypes.join(', ')}`,
        'error'
      );
    } else {
      showFileError('Upload Failed', error.message, 'error');
    }

    throw error;
  }
}
```

---

## Payment Errors

### PayPlus Integration Errors

```json
{
  "error": {
    "message": "Payment processing failed",
    "code": "PAYMENT_PROCESSING_FAILED",
    "statusCode": 402,
    "details": {
      "transaction_id": "txn_123abc",
      "payment_status": "failed",
      "failure_reason": "insufficient_funds",
      "retry_allowed": true,
      "alternative_methods": ["bank_transfer", "paypal"]
    }
  }
}
```

### Payment Error Handling

```javascript
async function handlePaymentError(error, purchaseData) {
  switch (error.code) {
    case 'PAYMENT_PROCESSING_FAILED':
      const { failure_reason, retry_allowed } = error.details;

      if (failure_reason === 'insufficient_funds') {
        showPaymentError(
          'Insufficient Funds',
          'Your payment method does not have sufficient funds. Please use a different payment method or add funds.',
          retry_allowed
        );
      } else if (failure_reason === 'card_declined') {
        showPaymentError(
          'Card Declined',
          'Your card was declined. Please check your card details or use a different payment method.',
          retry_allowed
        );
      }
      break;

    case 'PAYMENT_TIMEOUT':
      showPaymentError(
        'Payment Timeout',
        'The payment process timed out. Please try again.',
        true
      );
      break;

    case 'PAYMENT_CANCELLED':
      // User cancelled - just return to previous state
      break;

    default:
      showPaymentError(
        'Payment Error',
        'An unexpected payment error occurred. Please try again or contact support.',
        true
      );
  }
}
```

---

## Recovery Strategies

### Automatic Retry Logic

```javascript
// Retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  const retryableCodes = [
    'NETWORK_ERROR',
    'RATE_LIMITED',
    'SERVER_ERROR',
    'TIMEOUT_ERROR',
    'SERVICE_UNAVAILABLE'
  ];

  return retryableCodes.includes(error.code) || error.statusCode >= 500;
}
```

### Offline Handling

```javascript
// Handle offline scenarios
class OfflineRequestQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async makeRequest(request) {
    if (this.isOnline) {
      try {
        return await apiRequest(request.endpoint, request.options);
      } catch (error) {
        if (error.code === 'NETWORK_ERROR') {
          this.queueRequest(request);
          throw new APIError(
            'Request queued for when connection is restored',
            'REQUEST_QUEUED',
            0
          );
        }
        throw error;
      }
    } else {
      this.queueRequest(request);
      throw new APIError(
        'No internet connection. Request will be sent when connection is restored.',
        'OFFLINE_QUEUED',
        0
      );
    }
  }

  queueRequest(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now()
    });
  }

  async processQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const request = this.queue.shift();
      try {
        await apiRequest(request.endpoint, request.options);
      } catch (error) {
        // If it fails again, put it back in the queue
        this.queue.unshift(request);
        break;
      }
    }
  }
}
```

### Error Monitoring Integration

```javascript
// Error tracking and monitoring
class ErrorTracker {
  static track(error, context = {}) {
    const errorData = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: getCurrentUserId()
      }
    };

    // Send to monitoring service
    this.sendToMonitoring(errorData);

    // Log locally for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 API Error Tracked');
      console.error('Error:', error);
      console.table(errorData.context);
      console.groupEnd();
    }
  }

  static sendToMonitoring(errorData) {
    // Send to error tracking service (Sentry, etc.)
    fetch('/api/errors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    }).catch(() => {
      // Silently fail if error tracking fails
    });
  }
}

// Use in error handlers
try {
  await apiRequest('/api/entities/game');
} catch (error) {
  ErrorTracker.track(error, {
    operation: 'fetch_games',
    component: 'GamesList'
  });
  throw error;
}
```

---

## Error Code Reference

### Complete Error Code List

| Category | Code | HTTP | Description |
|----------|------|------|-------------|
| **Authentication** |
| | `AUTH_MISSING_TOKEN` | 401 | Authentication token required |
| | `AUTH_INVALID_TOKEN` | 401 | Invalid or expired token |
| | `AUTH_PORTAL_MISMATCH` | 403 | Wrong portal for auth method |
| | `AUTH_RATE_LIMITED` | 429 | Too many auth attempts |
| **Authorization** |
| | `ACCESS_PAYMENT_REQUIRED` | 402 | Purchase required |
| | `ACCESS_INSUFFICIENT_PERMISSIONS` | 403 | Insufficient permissions |
| | `ACCESS_OWNERSHIP_REQUIRED` | 403 | Resource ownership required |
| | `ACCESS_SUBSCRIPTION_REQUIRED` | 402 | Subscription required |
| **Validation** |
| | `VALIDATION_ERROR` | 422 | Field validation failed |
| | `VALIDATION_REQUIRED_FIELD` | 422 | Required field missing |
| | `VALIDATION_BUNDLE_INVALID` | 422 | Bundle validation failed |
| | `VALIDATION_DUPLICATE` | 409 | Duplicate resource |
| **Files** |
| | `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| | `FILE_INVALID_TYPE` | 422 | Unsupported file type |
| | `FILE_UPLOAD_FAILED` | 500 | Upload processing failed |
| | `FILE_NOT_FOUND` | 404 | File not found |
| **Business Logic** |
| | `BUSINESS_PRODUCT_NOT_PUBLISHED` | 409 | Product not available |
| | `BUSINESS_SUBSCRIPTION_LIMIT_EXCEEDED` | 409 | Usage limit exceeded |
| | `BUSINESS_INVALID_OPERATION` | 409 | Operation not allowed |
| **System** |
| | `RATE_LIMITED` | 429 | Rate limit exceeded |
| | `SERVER_ERROR` | 500 | Internal server error |
| | `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |
| | `NETWORK_ERROR` | 0 | Network connectivity issue |

---

For implementation examples and integration patterns, see:
- [API Integration Guide](./API_INTEGRATION_GUIDE.md)
- [Authentication Reference](./AUTHENTICATION_REFERENCE.md)
- [Rate Limiting Documentation](./RATE_LIMITING_GUIDE.md)