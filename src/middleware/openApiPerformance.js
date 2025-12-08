/**
 * OpenAPI Validation Performance Monitoring Middleware
 *
 * Tracks OpenAPI validation overhead and logs slow validations
 * for performance optimization.
 *
 * CRITICAL: This middleware must be placed AFTER openApiValidation middleware
 * to accurately measure validation performance impact.
 */

import { performance } from 'perf_hooks';
import { ludlog } from '../lib/ludlog.js';

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  SLOW_VALIDATION_MS: 100,        // Log if validation takes > 100ms
  VERY_SLOW_VALIDATION_MS: 500,   // Alert if validation takes > 500ms
  CRITICAL_VALIDATION_MS: 1000    // Critical alert if > 1s
};

// Performance metrics storage (in-memory for this session)
const performanceMetrics = {
  totalRequests: 0,
  totalValidationTime: 0,
  slowValidations: 0,
  verySlow Validations: 0,
  criticalValidations: 0,
  averageValidationTime: 0
};

/**
 * Performance monitoring middleware for OpenAPI validation
 *
 * Usage:
 * app.use(openApiValidationMiddleware);
 * app.use(openApiPerformanceMonitoring);
 * app.use('/api', routes);
 */
export const openApiPerformanceMonitoring = (req, res, next) => {
  // Skip performance monitoring for non-API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Skip monitoring for API docs themselves
  if (req.path.includes('/api-docs')) {
    return next();
  }

  const startTime = performance.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override res.end to capture timing
  res.end = function(...args) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Update metrics
    performanceMetrics.totalRequests++;
    performanceMetrics.totalValidationTime += duration;
    performanceMetrics.averageValidationTime =
      performanceMetrics.totalValidationTime / performanceMetrics.totalRequests;

    // Log slow validations
    if (duration > THRESHOLDS.CRITICAL_VALIDATION_MS) {
      performanceMetrics.criticalValidations++;
      ludlog.api('[OpenAPI Performance] CRITICAL: Very slow validation detected', {
        path: req.path,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        threshold: `${THRESHOLDS.CRITICAL_VALIDATION_MS}ms`,
        impact: 'HIGH - Consider schema optimization or caching'
      });
    } else if (duration > THRESHOLDS.VERY_SLOW_VALIDATION_MS) {
      performanceMetrics.verySlowValidations++;
      ludlog.api('[OpenAPI Performance] WARNING: Slow validation detected', {
        path: req.path,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        threshold: `${THRESHOLDS.VERY_SLOW_VALIDATION_MS}ms`,
        impact: 'MEDIUM - Monitor for performance degradation'
      });
    } else if (duration > THRESHOLDS.SLOW_VALIDATION_MS) {
      performanceMetrics.slowValidations++;
      ludlog.api('[OpenAPI Performance] INFO: Validation slower than expected', {
        path: req.path,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        threshold: `${THRESHOLDS.SLOW_VALIDATION_MS}ms`
      });
    }

    // Call original end function
    return originalEnd.apply(res, args);
  };

  next();
};

/**
 * Get current performance metrics
 *
 * Returns:
 * {
 *   totalRequests: number,
 *   totalValidationTime: number,
 *   averageValidationTime: number,
 *   slowValidations: number,
 *   verySlowValidations: number,
 *   criticalValidations: number,
 *   performanceScore: number (0-100)
 * }
 */
export function getPerformanceMetrics() {
  const metrics = { ...performanceMetrics };

  // Calculate performance score (0-100)
  // Score decreases based on percentage of slow validations
  const totalSlowRequests =
    metrics.slowValidations +
    metrics.verySlowValidations +
    metrics.criticalValidations;

  const slowPercentage = metrics.totalRequests > 0
    ? (totalSlowRequests / metrics.totalRequests) * 100
    : 0;

  // Perfect score (100) = 0% slow requests
  // Score decreases linearly: 10% slow = 90 score, 50% slow = 50 score
  metrics.performanceScore = Math.max(0, Math.round(100 - slowPercentage));

  return metrics;
}

/**
 * Reset performance metrics
 *
 * Useful for testing or resetting after deployment
 */
export function resetPerformanceMetrics() {
  performanceMetrics.totalRequests = 0;
  performanceMetrics.totalValidationTime = 0;
  performanceMetrics.slowValidations = 0;
  performanceMetrics.verySlowValidations = 0;
  performanceMetrics.criticalValidations = 0;
  performanceMetrics.averageValidationTime = 0;

  ludlog.api('[OpenAPI Performance] Metrics reset');
}

/**
 * Log performance summary
 *
 * Call this periodically (e.g., every hour) to get performance insights
 */
export function logPerformanceSummary() {
  const metrics = getPerformanceMetrics();

  if (metrics.totalRequests === 0) {
    ludlog.api('[OpenAPI Performance] No requests processed yet');
    return;
  }

  ludlog.api('[OpenAPI Performance] Performance Summary', {
    totalRequests: metrics.totalRequests,
    averageValidationTime: `${metrics.averageValidationTime.toFixed(2)}ms`,
    performanceScore: `${metrics.performanceScore}/100`,
    slowValidations: {
      count: metrics.slowValidations,
      percentage: `${((metrics.slowValidations / metrics.totalRequests) * 100).toFixed(2)}%`
    },
    verySlowValidations: {
      count: metrics.verySlowValidations,
      percentage: `${((metrics.verySlowValidations / metrics.totalRequests) * 100).toFixed(2)}%`
    },
    criticalValidations: {
      count: metrics.criticalValidations,
      percentage: `${((metrics.criticalValidations / metrics.totalRequests) * 100).toFixed(2)}%`
    },
    recommendation: getPerformanceRecommendation(metrics)
  });
}

/**
 * Get performance recommendation based on metrics
 */
function getPerformanceRecommendation(metrics) {
  if (metrics.performanceScore >= 95) {
    return 'EXCELLENT - Validation performance is optimal';
  } else if (metrics.performanceScore >= 85) {
    return 'GOOD - Validation performance is acceptable';
  } else if (metrics.performanceScore >= 70) {
    return 'FAIR - Consider optimizing slow validation schemas';
  } else if (metrics.performanceScore >= 50) {
    return 'POOR - Schema optimization recommended, consider caching strategies';
  } else {
    return 'CRITICAL - Immediate schema optimization required, high performance impact';
  }
}

export default {
  openApiPerformanceMonitoring,
  getPerformanceMetrics,
  resetPerformanceMetrics,
  logPerformanceSummary
};
