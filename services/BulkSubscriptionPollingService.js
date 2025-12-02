import models from '../models/index.js';
import PaymentService from './PaymentService.js';
import { luderror, ludlog } from '../lib/ludlog.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * BulkSubscriptionPollingService - Handles bulk subscription polling from PayPlus
 *
 * Uses PayPlus RecurringPayments/View API to get all active subscriptions
 * and cross-reference with local database to detect missing webhooks.
 */
class BulkSubscriptionPollingService {

  /**
   * Get all active subscriptions from PayPlus using bulk API
   * @returns {Promise<Object>} PayPlus bulk subscription response
   */
  static async getAllPayPlusSubscriptions() {
    try {
      // Check if polling is disabled
      const pollingActive = process.env.PAYMENTS_POLLING_ACTIVE === 'true';
      if (!pollingActive) {
        ludlog.payment('⚠️ BulkSubscriptionPollingService: Polling disabled (PAYMENTS_POLLING_ACTIVE=false)');

        return {
          success: false,
          error: 'Bulk subscription polling is disabled via PAYMENTS_POLLING_ACTIVE environment variable',
          subscriptions: [],
          disabled: true
        };
      }

      const credentials = PaymentService.getPayPlusCredentials();
      const { payplusUrl, payment_api_key, payment_secret_key, terminal_uid } = credentials;

      // Use PayPlus bulk subscription API
      const bulkUrl = `${payplusUrl}RecurringPayments/View`;

      ludlog.payment('📡 Querying PayPlus bulk subscription API', {
        endpoint: 'RecurringPayments/View',
        payplusUrl: payplusUrl.substring(0, 30) + '...',
        terminal_uid: terminal_uid ? terminal_uid.substring(0, 8) + '...' : 'missing'
      });

      const response = await fetch(bulkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': payment_api_key,
          'secret-key': payment_secret_key
        },
        body: JSON.stringify({
          terminal_uid: terminal_uid
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `PayPlus bulk API HTTP ${response.status}: ${response.statusText}`,
          debug_info: {
            http_status: response.status,
            response_preview: responseText.substring(0, 200),
            endpoint: 'RecurringPayments/View'
          }
        };
      }

      let subscriptionData;
      try {
        subscriptionData = JSON.parse(responseText);
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid PayPlus bulk API response',
          debug_info: {
            parse_error: parseError.message,
            endpoint: 'RecurringPayments/View'
          }
        };
      }

      ludlog.payment('📊 PayPlus bulk subscription API result', {
        totalSubscriptions: Array.isArray(subscriptionData) ? subscriptionData.length : 'unknown_format',
        endpoint: 'RecurringPayments/View'
      });

      return {
        success: true,
        subscriptions: subscriptionData,
        endpoint: 'RecurringPayments/View',
        retrieved_at: new Date().toISOString()
      };

    } catch (error) {
      luderror.payment('❌ Error querying PayPlus bulk subscription API:', error);
      return {
        success: false,
        error: error.message,
        endpoint: 'RecurringPayments/View'
      };
    }
  }

  /**
   * Get all subscriptions from our local database
   * @returns {Promise<Array>} Array of local subscription records
   */
  static async getLocalSubscriptions() {
    try {
      const subscriptions = await models.Subscription.findAll({
        where: {
          status: ['pending', 'active']
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan'
          },
          {
            model: models.Transaction,
            as: 'transaction',
            required: false
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return subscriptions.map(sub => ({
        id: sub.id,
        user_id: sub.user_id,
        status: sub.status,
        payplus_subscription_uid: sub.payplus_subscription_uid,
        monthly_price: sub.monthly_price,
        created_at: sub.created_at,
        plan_name: sub.subscriptionPlan?.name,
        plan_price: sub.subscriptionPlan?.price,
        transaction_id: sub.transaction?.id,
        payment_page_request_uid: sub.transaction?.payment_page_request_uid
      }));

    } catch (error) {
      luderror.payment('❌ Error fetching local subscriptions:', error);
      throw error;
    }
  }

  /**
   * Cross-reference PayPlus and local subscriptions to find discrepancies
   * @param {Array} payplusSubscriptions - PayPlus subscription data
   * @param {Array} localSubscriptions - Local database subscriptions
   * @returns {Object} Analysis results with found discrepancies
   */
  static analyzeSubscriptionDiscrepancies(payplusSubscriptions, localSubscriptions) {
    const discrepancies = [];
    const summary = {
      payplus_total: payplusSubscriptions.length,
      local_total: localSubscriptions.length,
      missing_in_database: 0,
      missing_activation_webhooks: 0,
      status_mismatches: 0,
      perfect_matches: 0
    };

    // Check each PayPlus subscription against local database
    for (const payplusSubscription of payplusSubscriptions) {
      const localSubscription = localSubscriptions.find(
        local => local.payplus_subscription_uid === payplusSubscription.uid
      );

      if (!localSubscription) {
        // PayPlus subscription exists but not in our database
        discrepancies.push({
          type: 'missing_in_database',
          payplus_subscription: payplusSubscription,
          issue: 'PayPlus subscription not found in local database',
          recommended_action: 'Create subscription record or investigate why it was not created'
        });
        summary.missing_in_database++;

      } else if (localSubscription.status === 'pending' && payplusSubscription.status === 'active') {
        // Subscription activated in PayPlus but still pending in our database (missing webhook)
        discrepancies.push({
          type: 'missing_activation_webhook',
          payplus_subscription: payplusSubscription,
          local_subscription: localSubscription,
          issue: 'PayPlus shows active but local database shows pending',
          recommended_action: 'Manually activate subscription or check webhook processing'
        });
        summary.missing_activation_webhooks++;

      } else if (localSubscription.status !== payplusSubscription.status) {
        // Other status mismatches
        discrepancies.push({
          type: 'status_mismatch',
          payplus_subscription: payplusSubscription,
          local_subscription: localSubscription,
          issue: `Status mismatch: PayPlus=${payplusSubscription.status}, Local=${localSubscription.status}`,
          recommended_action: 'Investigate status synchronization'
        });
        summary.status_mismatches++;

      } else {
        // Perfect match
        summary.perfect_matches++;
      }
    }

    return {
      discrepancies,
      summary,
      analyzed_at: new Date().toISOString()
    };
  }

  /**
   * Generate comprehensive subscription audit report
   * @returns {Promise<Object>} Complete audit report with recommendations
   */
  static async generateSubscriptionAuditReport() {
    try {
      ludlog.payment('🔍 Starting comprehensive subscription audit...');

      // 1. Get PayPlus subscriptions
      const payplusResult = await this.getAllPayPlusSubscriptions();

      if (!payplusResult.success) {
        return {
          success: false,
          error: 'Failed to fetch PayPlus subscriptions',
          details: payplusResult
        };
      }

      // 2. Get local subscriptions
      const localSubscriptions = await this.getLocalSubscriptions();

      // 3. Analyze discrepancies
      const analysis = this.analyzeSubscriptionDiscrepancies(
        payplusResult.subscriptions || [],
        localSubscriptions
      );

      // 4. Generate report
      const report = {
        success: true,
        audit_timestamp: new Date().toISOString(),
        payplus_query: {
          endpoint: payplusResult.endpoint,
          success: payplusResult.success,
          retrieved_at: payplusResult.retrieved_at,
          total_subscriptions: payplusResult.subscriptions?.length || 0
        },
        local_database: {
          total_subscriptions: localSubscriptions.length,
          pending_subscriptions: localSubscriptions.filter(s => s.status === 'pending').length,
          active_subscriptions: localSubscriptions.filter(s => s.status === 'active').length
        },
        discrepancies: analysis.discrepancies,
        summary: analysis.summary,
        recommendations: this.generateRecommendations(analysis),
        raw_data: {
          payplus_subscriptions: payplusResult.subscriptions,
          local_subscriptions: localSubscriptions
        }
      };

      ludlog.payment('📊 Subscription audit complete', {
        total_discrepancies: analysis.discrepancies.length,
        missing_activation_webhooks: analysis.summary.missing_activation_webhooks,
        missing_in_database: analysis.summary.missing_in_database,
        perfect_matches: analysis.summary.perfect_matches
      });

      return report;

    } catch (error) {
      luderror.payment('❌ Error generating subscription audit report:', error);
      return {
        success: false,
        error: error.message,
        audit_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate actionable recommendations based on audit analysis
   * @param {Object} analysis - Discrepancy analysis results
   * @returns {Array} Array of recommendation objects
   */
  static generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.summary.missing_activation_webhooks > 0) {
      recommendations.push({
        priority: 'high',
        issue: `${analysis.summary.missing_activation_webhooks} subscriptions missing activation webhooks`,
        action: 'Run manual activation for subscriptions showing as active in PayPlus but pending locally',
        endpoint: 'POST /api/admin/subscriptions/fix-missing-activations'
      });
    }

    if (analysis.summary.missing_in_database > 0) {
      recommendations.push({
        priority: 'critical',
        issue: `${analysis.summary.missing_in_database} PayPlus subscriptions not found in database`,
        action: 'Investigate why these subscriptions were not created in local database',
        endpoint: 'Manual investigation required'
      });
    }

    if (analysis.summary.status_mismatches > 0) {
      recommendations.push({
        priority: 'medium',
        issue: `${analysis.summary.status_mismatches} subscriptions with status mismatches`,
        action: 'Review and synchronize subscription statuses between PayPlus and local database',
        endpoint: 'POST /api/admin/subscriptions/sync-statuses'
      });
    }

    if (analysis.discrepancies.length === 0) {
      recommendations.push({
        priority: 'info',
        issue: 'No discrepancies found',
        action: 'All subscriptions are properly synchronized',
        endpoint: 'No action required'
      });
    }

    return recommendations;
  }

  /**
   * Save audit report to temporary markdown file
   * @param {Object} report - Audit report data
   * @returns {Promise<string>} Path to saved file
   */
  static async saveReportToTempFile(report) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `payplus-subscription-audit-${timestamp}.md`;
      const filepath = path.join(process.cwd(), 'temp', filename);

      // Ensure temp directory exists
      try {
        await fs.mkdir(path.dirname(filepath), { recursive: true });
      } catch (dirError) {
        // Directory might already exist
      }

      // Generate markdown content
      const markdown = this.generateMarkdownReport(report);

      // Write file
      await fs.writeFile(filepath, markdown, 'utf8');

      ludlog.payment('📝 Audit report saved to temporary file', {
        filename,
        filepath,
        file_size: markdown.length
      });

      return filepath;

    } catch (error) {
      luderror.payment('❌ Error saving audit report to file:', error);
      throw error;
    }
  }

  /**
   * Generate markdown formatted audit report
   * @param {Object} report - Audit report data
   * @returns {string} Markdown formatted report
   */
  static generateMarkdownReport(report) {
    const { audit_timestamp, payplus_query, local_database, discrepancies, summary, recommendations } = report;

    return `# PayPlus Subscription Audit Report

**Generated:** ${audit_timestamp}
**Status:** ${report.success ? '✅ Success' : '❌ Failed'}

## Summary

| Metric | PayPlus | Local DB | Status |
|--------|---------|----------|---------|
| Total Subscriptions | ${payplus_query.total_subscriptions} | ${local_database.total_subscriptions} | ${payplus_query.total_subscriptions === local_database.total_subscriptions ? '✅' : '⚠️'} |
| Perfect Matches | - | - | ${summary.perfect_matches} |
| Missing Activations | - | - | ${summary.missing_activation_webhooks} |
| Missing in Database | - | - | ${summary.missing_in_database} |
| Status Mismatches | - | - | ${summary.status_mismatches} |

## Local Database Breakdown

- **Active Subscriptions:** ${local_database.active_subscriptions}
- **Pending Subscriptions:** ${local_database.pending_subscriptions}
- **Total Tracked:** ${local_database.total_subscriptions}

## PayPlus Query Details

- **Endpoint:** ${payplus_query.endpoint}
- **Retrieved At:** ${payplus_query.retrieved_at}
- **Total Found:** ${payplus_query.total_subscriptions}

## Discrepancies Found

${discrepancies.length === 0 ? '✅ **No discrepancies found!** All subscriptions are properly synchronized.' : ''}

${discrepancies.map((disc, index) => `
### ${index + 1}. ${disc.type.replace(/_/g, ' ').toUpperCase()}

**Issue:** ${disc.issue}
**Action:** ${disc.recommended_action}

**PayPlus Data:**
\`\`\`json
${JSON.stringify(disc.payplus_subscription, null, 2)}
\`\`\`

${disc.local_subscription ? `**Local Data:**
\`\`\`json
${JSON.stringify(disc.local_subscription, null, 2)}
\`\`\`` : ''}

---
`).join('')}

## Recommendations

${recommendations.map((rec, index) => `
### ${index + 1}. ${rec.priority.toUpperCase()} PRIORITY

**Issue:** ${rec.issue}
**Action:** ${rec.action}
**Endpoint:** ${rec.endpoint}
`).join('')}

## Raw Data

### PayPlus Subscriptions
\`\`\`json
${JSON.stringify(report.raw_data.payplus_subscriptions, null, 2)}
\`\`\`

### Local Database Subscriptions
\`\`\`json
${JSON.stringify(report.raw_data.local_subscriptions, null, 2)}
\`\`\`

---

*Report generated by BulkSubscriptionPollingService*
*Environment: ${process.env.NODE_ENV || 'unknown'}*
`;
  }
}

export default BulkSubscriptionPollingService;