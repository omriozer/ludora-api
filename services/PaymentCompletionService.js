import { Op } from 'sequelize';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import PaymentService from './PaymentService.js';

/**
 * PaymentCompletionService - Handles payment completion for both webhooks and polling
 *
 * This service implements a race-to-completion system where both webhook and polling
 * can attempt to process the same payment. Whoever arrives first wins, the other
 * gracefully exits. This ensures maximum reliability with no duplicate processing.
 */
class PaymentCompletionService {
  constructor() {
    this.models = models;
    this.paymentService = PaymentService;
  }

  /**
   * Main completion processor - handles race condition between webhook and polling
   * @param {string} transactionId - Transaction ID to process
   * @param {Object} payplusData - PayPlus callback/API response data
   * @param {string} source - 'webhook' or 'polling' for audit trail
   * @returns {Object} Processing result
   */
  async processCompletion(transactionId, payplusData, source = 'unknown') {
    try {
      console.log(`🏁 ${source.toUpperCase()}: Starting payment completion for transaction: ${transactionId}`);

      // Step 1: Atomic status check and update (race condition protection)
      const transaction = await this.atomicStatusUpdate(transactionId, source);

      if (!transaction) {
        console.log(`⏩ ${source.toUpperCase()}: Transaction ${transactionId} already processed by other method, skipping`);
        return {
          success: true,
          alreadyProcessed: true,
          message: 'Transaction already completed by other processor'
        };
      }

      console.log(`✅ ${source.toUpperCase()}: Won race condition for transaction ${transactionId}, processing...`);

      // Step 2: Extract and save customer tokens from PayPlus data
      const tokenExtractionResult = await this.extractAndSaveCustomerTokens(
        payplusData,
        transaction,
        source
      );

      // Step 3: Update linked purchases to completed status
      const purchaseUpdateResult = await this.updateLinkedPurchases(transaction, source);

      // Step 4: Handle subscription payments (create SubscriptionHistory records)
      const subscriptionResult = await this.handleSubscriptionCompletion(
        transaction,
        payplusData,
        source
      );

      // Step 5: Business logic (coupons, download counts, email notifications)
      const businessLogicResult = await this.handleCompletionBusinessLogic(transaction);

      // Step 6: Final transaction update with completion metadata
      await this.finalizeTransactionCompletion(transaction, {
        processed_by: source,
        processing_timestamp: new Date().toISOString(),
        token_extraction: tokenExtractionResult,
        purchase_updates: purchaseUpdateResult,
        subscription_handling: subscriptionResult,
        business_logic: businessLogicResult,
        payplus_data_received: !!payplusData
      });

      console.log(`🎉 ${source.toUpperCase()}: Successfully completed payment processing for transaction ${transactionId}`);

      return {
        success: true,
        alreadyProcessed: false,
        processedBy: source,
        transactionId,
        details: {
          tokensExtracted: tokenExtractionResult.tokensExtracted || 0,
          purchasesUpdated: purchaseUpdateResult.purchasesUpdated || 0,
          subscriptionsCreated: subscriptionResult.subscriptionsCreated || 0,
          businessLogicCompleted: businessLogicResult.success || false
        }
      };

    } catch (error) {
      console.error(`❌ ${source.toUpperCase()}: Payment completion failed for transaction ${transactionId}:`, error);

      // Try to update transaction with error status if we can
      try {
        await models.Transaction.update(
          {
            payment_status: 'failed',
            payplus_response: {
              error_during_completion: {
                source,
                error_message: error.message,
                error_timestamp: new Date().toISOString()
              }
            },
            updated_at: new Date()
          },
          {
            where: {
              id: transactionId,
              payment_status: { [Op.in]: ['pending', 'in_progress'] }
            }
          }
        );
      } catch (updateError) {
        console.error(`❌ Failed to update transaction ${transactionId} with error status:`, updateError);
      }

      throw error;
    }
  }

  /**
   * Atomic status update with race condition protection and comprehensive audit trail
   * Returns transaction if we won the race, null if someone else already processed it
   */
  async atomicStatusUpdate(transactionId, source) {
    try {
      const processingStartTime = Date.now();

      // First, get the current transaction to check its current status and build audit trail
      const currentTransaction = await models.Transaction.findByPk(transactionId);
      if (!currentTransaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Mark webhook received if applicable
      if (source === 'webhook' && !currentTransaction.webhook_received_at) {
        await currentTransaction.markWebhookReceived();
      }

      // Build status history entry
      const statusHistoryEntry = {
        timestamp: new Date().toISOString(),
        from_status: currentTransaction.payment_status,
        to_status: 'completed',
        source: source,
        processing_time_ms: Date.now() - processingStartTime,
        race_condition_attempt: true
      };

      const newStatusHistory = [...(currentTransaction.status_history || []), statusHistoryEntry];

      // Atomic update: only update if transaction is not already completed
      const updateResult = await models.Transaction.update(
        {
          payment_status: 'completed',
          completed_at: new Date(),
          processing_completed_at: new Date(),
          updated_at: new Date(),
          status_history: newStatusHistory,
          processing_attempts: (currentTransaction.processing_attempts || 0) + 1,
          race_condition_winner: source,
          processing_source: currentTransaction.processing_source || source,
          processing_started_at: currentTransaction.processing_started_at || new Date(),
          payplus_response: {
            ...currentTransaction.payplus_response,
            processing_started_by: source,
            processing_started_at: new Date().toISOString(),
            atomic_update_attempt: true,
            audit_trail: {
              last_updated_by: source,
              last_updated_at: new Date().toISOString(),
              processing_attempts: (currentTransaction.processing_attempts || 0) + 1,
              race_condition_attempt: true
            }
          }
        },
        {
          where: {
            id: transactionId,
            payment_status: { [Op.in]: ['pending', 'in_progress'] }
          }
        }
      );

      if (updateResult[0] === 0) {
        // No rows updated - someone else already processed this transaction
        console.log(`⏩ ${source.toUpperCase()}: Lost atomic update race for transaction ${transactionId} - already completed`);

        // Update status history to record that we lost the race
        const updatedTransaction = await models.Transaction.findByPk(transactionId);
        if (updatedTransaction) {
          const lostRaceEntry = {
            timestamp: new Date().toISOString(),
            from_status: currentTransaction.payment_status,
            to_status: 'completed',
            source: source,
            processing_time_ms: Date.now() - processingStartTime,
            race_condition_result: 'lost_race',
            winner: updatedTransaction.race_condition_winner
          };

          await updatedTransaction.update({
            status_history: [...(updatedTransaction.status_history || []), lostRaceEntry],
            updated_at: new Date()
          });
        }

        return null;
      }

      // We won the race! Fetch the updated transaction with audit trail
      const transaction = await models.Transaction.findByPk(transactionId, {
        include: [{
          model: models.Purchase,
          as: 'purchases'
        }]
      });

      // Update the status history to mark that we won the race
      const wonRaceEntry = {
        timestamp: new Date().toISOString(),
        from_status: currentTransaction.payment_status,
        to_status: 'completed',
        source: source,
        processing_time_ms: Date.now() - processingStartTime,
        race_condition_result: 'won_race'
      };

      const finalStatusHistory = [...(transaction.status_history || [])];
      // Replace the last entry (which was the attempt) with the won race entry
      if (finalStatusHistory.length > 0) {
        finalStatusHistory[finalStatusHistory.length - 1] = wonRaceEntry;
      } else {
        finalStatusHistory.push(wonRaceEntry);
      }

      await transaction.update({
        status_history: finalStatusHistory,
        updated_at: new Date()
      });

      console.log(`🏆 ${source.toUpperCase()}: Won atomic update race for transaction ${transactionId} (${Date.now() - processingStartTime}ms)`);
      return transaction;

    } catch (error) {
      console.error(`❌ Atomic status update failed for transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Extract customer tokens from PayPlus data and save them
   */
  async extractAndSaveCustomerTokens(payplusData, transaction, source) {
    try {
      console.log(`🔑 ${source.toUpperCase()}: Extracting customer tokens from PayPlus data`);

      if (!payplusData || !transaction.purchases || transaction.purchases.length === 0) {
        console.log(`⚠️ ${source.toUpperCase()}: No PayPlus data or purchases found for token extraction`);
        return { tokensExtracted: 0, reason: 'no_data_or_purchases' };
      }

      // Get user ID from first purchase (all purchases in same transaction belong to same user)
      const userId = transaction.purchases[0].buyer_user_id;

      if (!userId) {
        console.warn(`⚠️ ${source.toUpperCase()}: No user ID found in transaction purchases`);
        return { tokensExtracted: 0, reason: 'no_user_id' };
      }

      // Use existing token extraction logic from webhooks
      const { extractAndSaveCustomerToken } = await import('../routes/webhooks.js');

      const savedToken = await extractAndSaveCustomerToken(
        payplusData,
        transaction,
        transaction.purchases,
        source,
        userId
      );

      if (savedToken) {
        console.log(`✅ ${source.toUpperCase()}: Successfully extracted and saved customer token ${savedToken.id}`);
        return {
          tokensExtracted: 1,
          tokenId: savedToken.id,
          userId: userId
        };
      } else {
        console.log(`⚠️ ${source.toUpperCase()}: Token extraction completed but no token was saved`);
        return { tokensExtracted: 0, reason: 'extraction_failed' };
      }

    } catch (error) {
      console.error(`❌ ${source.toUpperCase()}: Token extraction failed:`, error);
      return {
        tokensExtracted: 0,
        error: error.message,
        reason: 'extraction_error'
      };
    }
  }

  /**
   * Update linked purchases to completed status
   */
  async updateLinkedPurchases(transaction, source) {
    try {
      console.log(`📦 ${source.toUpperCase()}: Updating linked purchases to completed status`);

      if (!transaction.purchases || transaction.purchases.length === 0) {
        console.log(`⚠️ ${source.toUpperCase()}: No purchases linked to transaction ${transaction.id}`);
        return { purchasesUpdated: 0, reason: 'no_purchases' };
      }

      const purchaseIds = transaction.purchases.map(p => p.id);
      console.log(`📦 ${source.toUpperCase()}: Updating ${purchaseIds.length} purchases: ${purchaseIds.join(', ')}`);

      const updateResult = await models.Purchase.update(
        {
          payment_status: 'completed',
          updated_at: new Date(),
          metadata: models.sequelize.fn(
            'jsonb_set',
            models.sequelize.col('metadata'),
            models.sequelize.literal(`'{completion_details}'`),
            models.sequelize.literal(`'${JSON.stringify({
              completed_by: source,
              completed_at: new Date().toISOString(),
              transaction_id: transaction.id
            })}'`),
            models.sequelize.literal('true')
          )
        },
        {
          where: {
            transaction_id: transaction.id,
            payment_status: { [Op.in]: ['pending', 'cart', 'in_progress'] }
          }
        }
      );

      const purchasesUpdated = updateResult[0];
      console.log(`✅ ${source.toUpperCase()}: Updated ${purchasesUpdated} purchases to completed status`);

      return {
        purchasesUpdated,
        expectedUpdates: purchaseIds.length,
        allUpdated: purchasesUpdated === purchaseIds.length
      };

    } catch (error) {
      console.error(`❌ ${source.toUpperCase()}: Purchase update failed:`, error);
      return {
        purchasesUpdated: 0,
        error: error.message,
        reason: 'update_error'
      };
    }
  }

  /**
   * Handle subscription completion - create SubscriptionHistory records for subscription purchases
   */
  async handleSubscriptionCompletion(transaction, payplusData, source) {
    try {
      console.log(`🔔 ${source.toUpperCase()}: Checking for subscription purchases in transaction`);

      if (!transaction.purchases || transaction.purchases.length === 0) {
        return { subscriptionsCreated: 0, reason: 'no_purchases' };
      }

      // Check if any purchases are subscription-related
      // This would be determined by purchase metadata or purchasable_type
      const subscriptionPurchases = transaction.purchases.filter(purchase => {
        return purchase.metadata?.subscription_purchase === true ||
               purchase.purchasable_type === 'subscription_plan' ||
               purchase.metadata?.purchase_type === 'subscription';
      });

      if (subscriptionPurchases.length === 0) {
        console.log(`📋 ${source.toUpperCase()}: No subscription purchases found in transaction`);
        return { subscriptionsCreated: 0, reason: 'no_subscription_purchases' };
      }

      console.log(`🔔 ${source.toUpperCase()}: Found ${subscriptionPurchases.length} subscription purchases, creating SubscriptionHistory records`);

      const subscriptionHistoryRecords = [];

      for (const purchase of subscriptionPurchases) {
        try {
          // Calculate subscription dates
          const startDate = new Date();
          const endDate = this.calculateSubscriptionEndDate(purchase.metadata?.billing_period || 'monthly');

          const subscriptionHistory = await models.SubscriptionHistory.create({
            id: generateId(),
            user_id: purchase.buyer_user_id,
            subscription_plan_id: purchase.purchasable_id,
            action_type: 'subscribe',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            purchased_price: purchase.payment_amount,
            payplus_subscription_uid: payplusData?.subscription_uid || `txn_${transaction.id}`,
            status: 'active',
            transaction_id: transaction.id, // Link to transaction
            metadata: {
              completed_by: source,
              completed_at: new Date().toISOString(),
              purchase_id: purchase.id,
              transaction_id: transaction.id,
              payplus_data_available: !!payplusData
            },
            created_at: new Date(),
            updated_at: new Date()
          });

          subscriptionHistoryRecords.push(subscriptionHistory);
          console.log(`✅ ${source.toUpperCase()}: Created SubscriptionHistory record ${subscriptionHistory.id} for purchase ${purchase.id}`);

        } catch (subscriptionError) {
          console.error(`❌ ${source.toUpperCase()}: Failed to create SubscriptionHistory for purchase ${purchase.id}:`, subscriptionError);
        }
      }

      return {
        subscriptionsCreated: subscriptionHistoryRecords.length,
        subscriptionIds: subscriptionHistoryRecords.map(s => s.id),
        purchasesProcessed: subscriptionPurchases.length
      };

    } catch (error) {
      console.error(`❌ ${source.toUpperCase()}: Subscription completion handling failed:`, error);
      return {
        subscriptionsCreated: 0,
        error: error.message,
        reason: 'handling_error'
      };
    }
  }

  /**
   * Handle business logic completion (coupons, download counts, etc.)
   */
  async handleCompletionBusinessLogic(transaction) {
    try {
      console.log(`🎯 Processing business logic for completed transaction ${transaction.id}`);

      const results = {
        couponsCommitted: 0,
        downloadCountsUpdated: 0,
        errors: []
      };

      // Handle coupon commitment
      const appliedCoupons = transaction.payplus_response?.coupon_info?.applied_coupons || [];
      if (appliedCoupons.length > 0) {
        console.log(`🎫 Committing ${appliedCoupons.length} coupon usages`);

        for (const appliedCoupon of appliedCoupons) {
          try {
            await this.paymentService.commitCouponUsage(appliedCoupon.code);
            results.couponsCommitted++;
            console.log(`✅ Committed coupon usage: ${appliedCoupon.code}`);
          } catch (error) {
            console.error(`❌ Failed to commit coupon ${appliedCoupon.code}:`, error);
            results.errors.push(`Coupon ${appliedCoupon.code}: ${error.message}`);
          }
        }
      }

      // Handle download count updates for file products
      if (transaction.purchases) {
        for (const purchase of transaction.purchases) {
          if (purchase.purchasable_type === 'file') {
            try {
              const fileEntity = await models.File.findByPk(purchase.purchasable_id);
              if (fileEntity) {
                await fileEntity.update({
                  downloads_count: (fileEntity.downloads_count || 0) + 1
                });
                results.downloadCountsUpdated++;
                console.log(`📈 Updated download count for file: ${purchase.purchasable_id}`);
              }
            } catch (error) {
              console.error(`❌ Failed to update download count for ${purchase.purchasable_id}:`, error);
              results.errors.push(`File ${purchase.purchasable_id}: ${error.message}`);
            }
          }
        }
      }

      console.log(`✅ Business logic completed: ${results.couponsCommitted} coupons, ${results.downloadCountsUpdated} downloads`);

      return {
        success: true,
        ...results
      };

    } catch (error) {
      console.error(`❌ Business logic completion failed:`, error);
      return {
        success: false,
        error: error.message,
        couponsCommitted: 0,
        downloadCountsUpdated: 0
      };
    }
  }

  /**
   * Finalize transaction completion with processing metadata
   */
  async finalizeTransactionCompletion(transaction, processingMetadata) {
    try {
      await transaction.update({
        payplus_response: {
          ...transaction.payplus_response,
          completion_processing: processingMetadata
        },
        updated_at: new Date()
      });

      console.log(`✅ Finalized transaction ${transaction.id} with completion metadata`);

    } catch (error) {
      console.error(`❌ Failed to finalize transaction ${transaction.id}:`, error);
      // Don't throw - transaction is already completed, metadata is nice-to-have
    }
  }

  /**
   * Helper method to calculate subscription end date
   */
  calculateSubscriptionEndDate(billingPeriod) {
    const now = new Date();
    switch (billingPeriod) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      case 'yearly':
        return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      case 'weekly':
        return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      default:
        return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // Default to 30 days
    }
  }
}

export default PaymentCompletionService;