import { Op, fn, col, literal } from 'sequelize';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import PaymentService from './PaymentService.js';

/**
 * PaymentIntentService - Centralized payment management using Transaction as PaymentIntent
 *
 * This service manages the complete payment lifecycle:
 * 1. Creates PaymentIntent (Transaction) with cart validation
 * 2. Manages state transitions through a proper state machine
 * 3. Integrates with PayPlus while maintaining backend as source of truth
 * 4. Handles webhook processing and status updates
 */
class PaymentIntentService {
  constructor() {
    this.models = models;
    this.paymentService = PaymentService; // Use the existing instance instead of creating new one
  }

  /**
   * Create a new payment intent with cart items
   * This replaces the existing createPayplusPaymentPage flow
   */
  async createPaymentIntent({ cartItems, userId, appliedCoupons = [], environment = 'production', frontendOrigin }) {
    try {
      console.log('🎯 PaymentIntentService: Creating payment intent for user:', userId);

      // 1. ROBUST race condition prevention - check for user's cart purchases that might be in payment
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const cartItemIds = cartItems.map(item => item.id);

      console.log(`🔍 PaymentIntentService: Race condition check for user ${userId} with cart items: ${cartItemIds.join(', ')}`);

      // Get the actual cart purchases for this user that match the cart items being paid for
      const cartPurchases = await this.models.Purchase.findAll({
        where: {
          id: cartItemIds,
          buyer_user_id: userId,
          payment_status: 'cart'
        },
        order: [['created_at', 'DESC']]
      });

      console.log(`🛒 PaymentIntentService: Found ${cartPurchases.length} cart purchases for the requested items`);

      if (cartPurchases.length !== cartItems.length) {
        console.error(`❌ PaymentIntentService: Cart validation failed - expected ${cartItems.length} purchases, found ${cartPurchases.length}`);
        throw new Error('Some cart items are invalid or not owned by user');
      }

      // Check if any of these purchases are already linked to a transaction
      const linkedPurchases = cartPurchases.filter(p => p.transaction_id);
      if (linkedPurchases.length > 0) {
        console.log(`🔗 PaymentIntentService: Found ${linkedPurchases.length} purchases already linked to transactions`);

        // Check if all linked purchases point to the same transaction
        const transactionIds = [...new Set(linkedPurchases.map(p => p.transaction_id))];
        if (transactionIds.length > 1) {
          console.error(`❌ PaymentIntentService: Cart purchases linked to multiple transactions: ${transactionIds.join(', ')}`);
          throw new Error('Cart purchases are linked to multiple different transactions - data inconsistency');
        }

        // Check if there's an existing transaction with these purchases
        const existingTransactionId = transactionIds[0];
        const existingTransaction = await this.models.Transaction.findByPk(existingTransactionId);

        if (existingTransaction && ['pending', 'in_progress'].includes(existingTransaction.payment_status)) {
          console.log(`⚠️ PaymentIntentService: Found existing transaction ${existingTransaction.id} with ${linkedPurchases.length}/${cartPurchases.length} linked purchases, reusing it`);

          // Ensure ALL cart purchases are linked to this transaction (fix partial linking)
          const unlinkedPurchases = cartPurchases.filter(p => !p.transaction_id);
          if (unlinkedPurchases.length > 0) {
            console.log(`🔗 PaymentIntentService: Linking ${unlinkedPurchases.length} additional purchases to existing transaction ${existingTransaction.id}`);
            await this.models.Purchase.update(
              { transaction_id: existingTransaction.id },
              { where: { id: unlinkedPurchases.map(p => p.id) } }
            );
          }

          // If transaction has payment URL, return it immediately
          if (existingTransaction.payment_url) {
            console.log(`🔄 PaymentIntentService: Existing transaction ${existingTransaction.id} already has payment URL, returning it`);
            return {
              success: true,
              transactionId: existingTransaction.id,
              paymentUrl: existingTransaction.payment_url,
              totalAmount: existingTransaction.total_amount,
              status: existingTransaction.payment_status,
              purchaseCount: cartPurchases.length, // Use full cart count, not just linked
              expiresAt: existingTransaction.expires_at,
              reused: true
            };
          }

          // Transaction exists but no payment URL - complete the payment creation
          console.log(`🔄 PaymentIntentService: Completing payment creation for existing transaction ${existingTransaction.id}`);

          // Ensure ALL cart purchases are linked to this transaction (completion phase)
          const additionalUnlinkedPurchases = cartPurchases.filter(p => !p.transaction_id);
          if (additionalUnlinkedPurchases.length > 0) {
            console.log(`🔗 PaymentIntentService: Linking ${additionalUnlinkedPurchases.length} additional purchases to transaction ${existingTransaction.id}`);
            await this.models.Purchase.update(
              { transaction_id: existingTransaction.id },
              { where: { id: additionalUnlinkedPurchases.map(p => p.id) } }
            );
          }

          // Calculate total amount and create payment URL
          const { products, totalAmount } = await this._validateCartAndCreatePurchases(cartItems, userId, appliedCoupons);

          const baseReturnUrl = `${frontendOrigin || 'https://ludora.app'}/payment-result`;
          const returnUrl = `${baseReturnUrl}?transactionId=${existingTransaction.id}`;
          const successUrl = `${returnUrl}&status=success`;
          const failureUrl = `${returnUrl}&status=failure`;
          const callbackUrl = process.env.ENVIRONMENT === 'production'
            ? 'https://api.ludora.app/api/webhooks/payplus'
            : 'https://api.ludora.app/api/webhooks/payplus';

          const paymentPageUrl = await this.paymentService.createPayplusPaymentLink({
            purchases: cartPurchases,
            products,
            totalAmount,
            returnUrl,
            successUrl,
            failureUrl,
            callbackUrl,
            environment,
            sessionId: existingTransaction.id
          });

          // Update transaction with payment URL
          await existingTransaction.updateStatus('in_progress', {
            payment_page_url: paymentPageUrl,
            payplus_integration_success: true
          });

          await existingTransaction.update({
            payment_url: paymentPageUrl,
            total_amount: totalAmount,
            updated_at: new Date()
          });

          console.log('✅ PaymentIntentService: Completed payment creation for existing transaction:', existingTransaction.id);

          return {
            success: true,
            transactionId: existingTransaction.id,
            paymentUrl: paymentPageUrl,
            totalAmount,
            status: 'in_progress',
            purchaseCount: cartPurchases.length,
            expiresAt: existingTransaction.expires_at,
            reused: true
          };
        } else if (existingTransaction && ['failed', 'cancelled', 'expired'].includes(existingTransaction.payment_status)) {
          console.log(`🔄 PaymentIntentService: Found failed/expired transaction ${existingTransaction.id}, resetting purchases to cart status`);

          // Reset all linked purchases back to cart status for retry
          await this.models.Purchase.update(
            {
              payment_status: 'cart',
              transaction_id: null,
              updated_at: new Date()
            },
            { where: { id: cartPurchases.map(p => p.id) } }
          );

          console.log(`✅ PaymentIntentService: Reset ${cartPurchases.length} purchases to cart status, proceeding to create new transaction`);
        } else if (existingTransaction) {
          console.log(`⚠️ PaymentIntentService: Found transaction ${existingTransaction.id} in unexpected status: ${existingTransaction.payment_status}`);
        } else {
          console.log(`❌ PaymentIntentService: Transaction ${existingTransactionId} not found, resetting purchase links`);

          // Reset purchase links if transaction doesn't exist
          await this.models.Purchase.update(
            {
              transaction_id: null,
              updated_at: new Date()
            },
            { where: { id: cartPurchases.map(p => p.id) } }
          );
        }
      }

      console.log(`✅ PaymentIntentService: No existing valid transaction found, proceeding to create new one`);

      // 2. Validate cart items and get product details
      const { purchases, products, totalAmount, originalAmount, totalDiscount } =
        await this._validateCartAndCreatePurchases(cartItems, userId, appliedCoupons);

      // 3. Create Transaction (PaymentIntent) - starts in 'pending' state
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const transaction = await this.models.Transaction.create({
        id: transactionId,
        total_amount: totalAmount,
        payment_status: 'pending',
        payment_method: 'payplus',
        environment: environment,
        payplus_response: {
          coupon_info: {
            applied_coupons: appliedCoupons,
            original_amount: originalAmount,
            total_discount: totalDiscount,
            final_amount: totalAmount
          },
          payment_created_at: new Date().toISOString()
        },
        created_at: new Date(),
        updated_at: new Date()
      });

      // 3. Set expiration (30 minutes)
      await transaction.setExpiration(30);

      // 4. Link purchases to transaction
      const purchaseIds = purchases.map(p => p.id);
      console.log(`🔗 PaymentIntentService: Linking ${purchaseIds.length} purchases to transaction ${transactionId}:`, purchaseIds);

      const updateResult = await this.models.Purchase.update(
        { transaction_id: transactionId },
        { where: { id: purchaseIds } }
      );

      console.log(`🔗 PaymentIntentService: Purchase linking result - affected rows: ${updateResult[0]}`);

      // Verify linking was successful
      const verifiedLinkedPurchases = await this.models.Purchase.findAll({
        where: { transaction_id: transactionId }
      });
      console.log(`✅ PaymentIntentService: Verified ${verifiedLinkedPurchases.length} purchases are linked to transaction ${transactionId}`);

      // 5. Call PayPlus API via existing PaymentService
      console.log('🔗 PaymentIntentService: Calling PayPlus API for transaction:', transactionId);

      const baseReturnUrl = `${frontendOrigin || 'https://ludora.app'}/payment-result`;
      const returnUrl = `${baseReturnUrl}?transactionId=${transactionId}`;
      const successUrl = `${returnUrl}&status=success`;
      const failureUrl = `${returnUrl}&status=failure`;
      const callbackUrl = process.env.ENVIRONMENT === 'production'
        ? 'https://api.ludora.app/api/webhooks/payplus'
        : 'https://api.ludora.app/api/webhooks/payplus';

      const paymentPageUrl = await this.paymentService.createPayplusPaymentLink({
        purchases,
        products,
        totalAmount,
        returnUrl,
        successUrl,
        failureUrl,
        callbackUrl,
        environment,
        sessionId: transactionId // Use transaction ID as session ID
      });

      // 6. Update transaction with payment URL and move to 'in_progress'
      await transaction.updateStatus('in_progress', {
        payment_page_url: paymentPageUrl,
        payplus_integration_success: true
      });

      await transaction.update({
        payment_url: paymentPageUrl,
        updated_at: new Date()
      });

      console.log('✅ PaymentIntentService: Payment intent created successfully:', {
        transactionId,
        totalAmount,
        purchaseCount: purchases.length,
        status: 'in_progress'
      });

      return {
        success: true,
        transactionId,
        paymentUrl: paymentPageUrl,
        totalAmount,
        status: 'in_progress',
        purchaseCount: purchases.length,
        expiresAt: transaction.expires_at
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Get payment status for polling
   */
  async getPaymentStatus(transactionId) {
    try {
      const transaction = await this.models.Transaction.findByPk(transactionId, {
        include: [{
          model: this.models.Purchase,
          as: 'purchases'
        }]
      });

      if (!transaction) {
        throw new Error('Payment intent not found');
      }

      // Update last checked timestamp
      await transaction.update({
        status_last_checked_at: new Date(),
        updated_at: new Date()
      });

      return {
        transactionId: transaction.id,
        status: transaction.payment_status,
        totalAmount: transaction.total_amount,
        purchaseCount: transaction.purchases?.length || 0,
        purchases: transaction.purchases || [],
        updatedAt: transaction.updated_at,
        expiresAt: transaction.expires_at,
        isExpired: transaction.isExpired(),
        canRetry: transaction.canBeRetried()
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Update payment status (used by webhook)
   */
  async updatePaymentStatus(transactionId, newStatus, webhookData = {}) {
    try {
      console.log(`🔄 PaymentIntentService: Updating payment ${transactionId} to status: ${newStatus}`);

      const transaction = await this.models.Transaction.findByPk(transactionId, {
        include: [{
          model: this.models.Purchase,
          as: 'purchases'
        }]
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Update transaction status with webhook data
      await transaction.updateStatus(newStatus, {
        ...webhookData,
        webhook_processed_at: new Date().toISOString()
      });

      // Cascade status to purchases
      if (transaction.purchases && transaction.purchases.length > 0) {
        const purchaseStatus = this._mapTransactionStatusToPurchaseStatus(newStatus);
        const purchaseIds = transaction.purchases.map(p => p.id);

        console.log(`🔄 PaymentIntentService: Updating ${transaction.purchases.length} purchases to status: ${purchaseStatus}`);
        console.log(`🔄 PaymentIntentService: Purchase IDs to update:`, purchaseIds);

        const updateResult = await this.models.Purchase.update(
          {
            payment_status: purchaseStatus,
            updated_at: new Date(),
            metadata: fn('jsonb_set',
              col('metadata'),
              literal(`'{payment_in_progress}'`),
              literal('false'),
              false
            )
          },
          { where: { transaction_id: transactionId } }
        );

        console.log(`✅ Purchase update result - affected rows: ${updateResult[0]}, expected: ${transaction.purchases.length}`);

        if (updateResult[0] !== transaction.purchases.length) {
          console.warn(`⚠️ Purchase update mismatch - updated ${updateResult[0]} but expected ${transaction.purchases.length}`);
        }
      }

      // Handle business logic for completed payments
      if (newStatus === 'completed') {
        await this._handleCompletedPayment(transaction);
      }

      console.log('✅ PaymentIntentService: Payment status updated successfully');

      return {
        success: true,
        transactionId,
        status: newStatus,
        updatedAt: new Date()
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Mark payment as in progress when frontend confirms payment submission
   * Moves purchases from 'cart' to 'pending' status for immediate user feedback
   */
  async markPaymentInProgress(transactionId) {
    try {
      console.log(`✋ PaymentIntentService: Marking payment in progress for transaction: ${transactionId}`);

      const transaction = await this.models.Transaction.findByPk(transactionId, {
        include: [{
          model: this.models.Purchase,
          as: 'purchases'
        }]
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Only allow this operation for transactions in 'pending' or 'in_progress' status
      if (!['pending', 'in_progress'].includes(transaction.payment_status)) {
        throw new Error(`Cannot mark transaction ${transactionId} as in progress - current status: ${transaction.payment_status}`);
      }

      // Update transaction metadata to indicate frontend confirmation received
      await transaction.update({
        payplus_response: {
          ...transaction.payplus_response,
          frontend_confirmation_received: true,
          frontend_confirmation_at: new Date().toISOString()
        },
        updated_at: new Date()
      });

      // Move purchases from 'cart' to 'pending' status for immediate user feedback
      const cartPurchaseIds = transaction.purchases
        ?.filter(p => p.payment_status === 'cart')
        .map(p => p.id) || [];

      if (cartPurchaseIds.length > 0) {
        console.log(`🔄 PaymentIntentService: Moving ${cartPurchaseIds.length} purchases from 'cart' to 'pending' status`);

        const updateResult = await this.models.Purchase.update(
          {
            payment_status: 'pending',
            updated_at: new Date(),
            metadata: fn('jsonb_set',
              col('metadata'),
              literal(`'{payment_in_progress}'`),
              literal('true'),
              true
            )
          },
          {
            where: {
              id: cartPurchaseIds,
              transaction_id: transactionId
            }
          }
        );

        console.log(`✅ PaymentIntentService: Updated ${updateResult[0]} purchases to 'pending' status`);

        if (updateResult[0] !== cartPurchaseIds.length) {
          console.warn(`⚠️ Purchase update mismatch - updated ${updateResult[0]} but expected ${cartPurchaseIds.length}`);
        }
      } else {
        console.log(`📋 PaymentIntentService: No cart purchases found to update for transaction ${transactionId}`);
      }

      console.log(`✅ PaymentIntentService: Payment marked as in progress for transaction ${transactionId}`);

      return {
        success: true,
        transactionId,
        updatedPurchases: cartPurchaseIds.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ PaymentIntentService: Error marking payment in progress for ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  async _validateCartAndCreatePurchases(cartItems, userId, appliedCoupons) {
    // For now, assume cartItems are already valid Purchase records
    // In a full implementation, you'd validate products and create purchases here
    let purchases = [];
    let products = [];
    let totalAmount = 0;
    let originalAmount = 0;

    if (Array.isArray(cartItems) && cartItems.length > 0) {
      // Get existing purchases by IDs - CONSISTENT with race condition check
      const purchaseIds = cartItems.map(item => item.id);
      console.log(`🛒 PaymentIntentService: Validating ${cartItems.length} cart items for user ${userId}:`, purchaseIds);

      purchases = await this.models.Purchase.findAll({
        where: {
          id: purchaseIds,
          buyer_user_id: userId,
          payment_status: 'cart' // MUST be cart status - consistent with race condition check
        }
      });

      console.log(`🛒 PaymentIntentService: Found ${purchases.length} valid cart purchases owned by user`);

      if (purchases.length !== cartItems.length) {
        console.error(`❌ PaymentIntentService: Cart validation failed - expected ${cartItems.length} cart purchases, found ${purchases.length}`);
        console.error(`❌ PaymentIntentService: Requested purchase IDs:`, purchaseIds);
        console.error(`❌ PaymentIntentService: Found cart purchase IDs:`, purchases.map(p => p.id));
        throw new Error('Some cart items are invalid, not owned by user, or not in cart status');
      }

      // Calculate amounts
      purchases.forEach(purchase => {
        totalAmount += parseFloat(purchase.payment_amount);
        originalAmount += parseFloat(purchase.original_price);
      });

      // Mock product details for PayPlus API
      products = purchases.map(purchase => ({
        id: purchase.purchasable_id,
        title: `Product ${purchase.purchasable_type}`,
        amount: parseFloat(purchase.payment_amount),
        product: {
          price: parseFloat(purchase.original_price)
        }
      }));
    }

    const totalDiscount = originalAmount - totalAmount;

    return {
      purchases,
      products,
      totalAmount,
      originalAmount,
      totalDiscount
    };
  }

  _mapTransactionStatusToPurchaseStatus(transactionStatus) {
    const statusMap = {
      'pending': 'pending',
      'in_progress': 'pending',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
      'expired': 'failed'
    };

    return statusMap[transactionStatus] || 'pending';
  }

  async _handleCompletedPayment(transaction) {
    try {
      console.log('🎉 PaymentIntentService: Handling completed payment logic');

      // Handle coupon commitment
      const appliedCoupons = transaction.payplus_response?.coupon_info?.applied_coupons || [];
      if (appliedCoupons.length > 0) {
        console.log(`🎫 Committing coupon usage for ${appliedCoupons.length} coupons`);

        for (const appliedCoupon of appliedCoupons) {
          try {
            await this.paymentService.commitCouponUsage(appliedCoupon.code);
            console.log(`✅ Committed usage for coupon: ${appliedCoupon.code}`);
          } catch (error) {
            console.error(`❌ Failed to commit usage for coupon ${appliedCoupon.code}:`, error);
            // Don't throw - payment is successful, coupon tracking is secondary
          }
        }
      }

      // Handle download count updates for file products
      if (transaction.purchases) {
        for (const purchase of transaction.purchases) {
          if (purchase.purchasable_type === 'file') {
            try {
              const fileEntity = await this.models.File.findByPk(purchase.purchasable_id);
              if (fileEntity) {
                await fileEntity.update({
                  downloads_count: (fileEntity.downloads_count || 0) + 1
                });
                console.log(`📈 Updated download count for file: ${purchase.purchasable_id}`);
              }
            } catch (error) {
              console.error(`❌ Failed to update download count for ${purchase.purchasable_id}:`, error);
            }
          }
        }
      }

      console.log('✅ Completed payment business logic handled successfully');

    } catch (error) {
      console.error('❌ Error handling completed payment logic:', error);
      // Don't throw - payment is successful, business logic is secondary
    }
  }
}

export default PaymentIntentService;