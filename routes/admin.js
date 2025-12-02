import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import BulkSubscriptionPollingService from '../services/BulkSubscriptionPollingService.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/subscriptions/audit
 *
 * Comprehensive subscription audit - queries PayPlus bulk API to get all subscriptions
 * and cross-references with local database to find discrepancies.
 *
 * Features:
 * - Detects missing webhook notifications
 * - Finds subscriptions missing in local database
 * - Identifies status mismatches
 * - Generates actionable recommendations
 * - Saves results to temporary markdown file
 *
 * Admin-only endpoint for manual subscription verification.
 */
router.get('/subscriptions/audit', async (req, res) => {
  try {
    // Generate comprehensive audit report
    const auditReport = await BulkSubscriptionPollingService.generateSubscriptionAuditReport();

    if (!auditReport.success) {
      return res.status(500).json({
        error: 'Failed to generate subscription audit report',
        details: auditReport
      });
    }

    // Save report to temporary file
    const filePath = await BulkSubscriptionPollingService.saveReportToTempFile(auditReport);

    // Return audit summary with file location
    res.json({
      success: true,
      message: 'Subscription audit completed successfully',
      audit_summary: {
        total_discrepancies: auditReport.discrepancies.length,
        missing_activation_webhooks: auditReport.summary.missing_activation_webhooks,
        missing_in_database: auditReport.summary.missing_in_database,
        status_mismatches: auditReport.summary.status_mismatches,
        perfect_matches: auditReport.summary.perfect_matches,
        payplus_total: auditReport.payplus_query.total_subscriptions,
        local_total: auditReport.local_database.total_subscriptions
      },
      recommendations: auditReport.recommendations,
      report_file: filePath,
      audit_timestamp: auditReport.audit_timestamp,
      next_steps: auditReport.discrepancies.length > 0
        ? 'Review discrepancies in the generated report and take recommended actions'
        : 'All subscriptions are properly synchronized - no action required'
    });

  } catch (error) {
    console.error('❌ Admin subscription audit error:', error);
    res.status(500).json({
      error: 'Internal server error during subscription audit',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/subscriptions/payplus-raw
 *
 * Get raw PayPlus subscription data without analysis.
 * Useful for debugging PayPlus API responses.
 */
router.get('/subscriptions/payplus-raw', async (req, res) => {
  try {
    const payplusResult = await BulkSubscriptionPollingService.getAllPayPlusSubscriptions();

    if (!payplusResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch PayPlus subscriptions',
        details: payplusResult
      });
    }

    res.json({
      success: true,
      message: 'PayPlus subscriptions retrieved successfully',
      total_subscriptions: payplusResult.subscriptions?.length || 0,
      endpoint_used: payplusResult.endpoint,
      retrieved_at: payplusResult.retrieved_at,
      subscriptions: payplusResult.subscriptions
    });

  } catch (error) {
    console.error('❌ Admin PayPlus raw query error:', error);
    res.status(500).json({
      error: 'Internal server error during PayPlus query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;