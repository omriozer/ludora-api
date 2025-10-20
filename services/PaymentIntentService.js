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

          const baseReturnUrl = `${frontendOrigin || 'https://ludora.app'}/payment-result-iframe`;
          const returnUrl = `${baseReturnUrl}?transactionId=${existingTransaction.id}`;
          const successUrl = `${returnUrl}&status=success`;
          const failureUrl = `${returnUrl}&status=failure`;
          const callbackUrl = process.env.ENVIRONMENT === 'production'
            ? 'https://api.ludora.app/api/webhooks/payplus'
            : 'https://api.ludora.app/api/webhooks/payplus';

          // Debug: Check cartPurchases before calling PaymentService
          console.log(`🔍 EXISTING TRANSACTION DEBUG: Calling PaymentService with cartPurchases:`, {
            purchaseCount: cartPurchases.length,
            purchases: cartPurchases.map(p => ({
              id: p.id,
              transaction_id: p.transaction_id,
              payment_status: p.payment_status,
              buyer_user_id: p.buyer_user_id
            }))
          });

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
      const validationResult = await this._validateCartAndCreatePurchases(cartItems, userId, appliedCoupons);
      const { products, totalAmount, originalAmount, totalDiscount } = validationResult;
      let { purchases } = validationResult;

      // 2.5. Check if this is a free transaction (totalAmount is 0)
      if (totalAmount === 0) {
        console.log('🆓 PaymentIntentService: Processing free transaction, skipping PayPlus integration');
        return await this.processFreeTransaction({
          purchases,
          products,
          totalAmount,
          originalAmount,
          totalDiscount,
          appliedCoupons,
          userId
        });
      }

      // 2.6. Smart Payment Routing - Check for stored customer tokens
      console.log('🧠 PaymentIntentService: Checking smart payment routing options for user:', userId);

      // Get stored customer tokens for this user
      const customerTokens = await this.paymentService.getCustomerTokens(userId).catch(() => []);

      if (customerTokens.length > 0) {
        console.log(`💳 PaymentIntentService: Found ${customerTokens.length} stored tokens for user, attempting token payment`);

        try {
          // Use the most recent token
          const latestToken = customerTokens[0];

          return await this.processTokenPayment({
            purchases,
            products,
            totalAmount,
            originalAmount,
            totalDiscount,
            appliedCoupons,
            userId,
            tokenUid: latestToken.tokenUid
          });
        } catch (tokenError) {
          console.warn(`⚠️ PaymentIntentService: Token payment failed, falling back to payment page:`, tokenError.message);
          // Continue to payment page flow below
        }
      } else {
        console.log('💳 PaymentIntentService: No stored tokens found, proceeding with payment page flow');
      }

      // 3. Create Transaction (PaymentIntent) - starts in 'pending' state
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log(`🔧 CREATION DEBUG: Creating transaction with ID: ${transactionId}`);
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

      // Verify linking was successful and REFRESH purchases array with transaction_id
      const verifiedLinkedPurchases = await this.models.Purchase.findAll({
        where: { transaction_id: transactionId }
      });
      console.log(`✅ CREATION DEBUG: Verified ${verifiedLinkedPurchases.length} purchases are linked to transaction ${transactionId}`);

      // Debug: Log details of linked purchases
      if (verifiedLinkedPurchases.length > 0) {
        console.log(`🔍 CREATION DEBUG: Linked purchase details:`);
        verifiedLinkedPurchases.forEach((purchase, index) => {
          console.log(`  ${index + 1}. ID: ${purchase.id}, Status: ${purchase.payment_status}, User: ${purchase.buyer_user_id}, Amount: ${purchase.payment_amount}, Type: ${purchase.purchasable_type}`);
        });

        // CRITICAL FIX: Update purchases array with linked purchases (includes transaction_id)
        purchases = verifiedLinkedPurchases;
        console.log(`🔧 CREATION DEBUG: Updated purchases array with linked purchases (transaction_id populated)`);
      } else {
        console.error(`❌ CREATION DEBUG: No purchases were successfully linked to transaction ${transactionId}`);
      }

      // 5. Call PayPlus API via existing PaymentService
      console.log('🔗 PaymentIntentService: Calling PayPlus API for transaction:', transactionId);

      const baseReturnUrl = `${frontendOrigin || 'https://ludora.app'}/payment-result-iframe`;
      const returnUrl = `${baseReturnUrl}?transactionId=${transactionId}`;
      const successUrl = `${returnUrl}&status=success`;
      const failureUrl = `${returnUrl}&status=failure`;
      const callbackUrl = process.env.ENVIRONMENT === 'production'
        ? 'https://api.ludora.app/api/webhooks/payplus'
        : 'https://api.ludora.app/api/webhooks/payplus';

      // Debug: Check purchases before calling PaymentService
      console.log(`🔍 PAYMENTINTENT DEBUG: Calling PaymentService with purchases:`, {
        purchaseCount: purchases.length,
        purchases: purchases.map(p => ({
          id: p.id,
          transaction_id: p.transaction_id,
          payment_status: p.payment_status,
          buyer_user_id: p.buyer_user_id
        }))
      });

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

        console.log(`🔄 WEBHOOK DEBUG: PaymentIntentService updating ${transaction.purchases.length} purchases to status: ${purchaseStatus}`);
        console.log(`🔄 WEBHOOK DEBUG: Purchase IDs to update:`, purchaseIds);
        console.log(`🔄 WEBHOOK DEBUG: Transaction ID for WHERE clause: ${transactionId}`);

        // Debug: Check current status of purchases before update
        const currentPurchases = await this.models.Purchase.findAll({
          where: { transaction_id: transactionId }
        });
        console.log(`🔍 WEBHOOK DEBUG: Found ${currentPurchases.length} purchases currently linked to transaction ${transactionId}`);
        currentPurchases.forEach((purchase, index) => {
          console.log(`  ${index + 1}. ID: ${purchase.id}, Current Status: ${purchase.payment_status}, Transaction ID: ${purchase.transaction_id}`);
        });

        const updateResult = await this.models.Purchase.update(
          {
            payment_status: purchaseStatus,
            updated_at: new Date(),
            metadata: fn('jsonb_set',
              col('metadata'),
              literal(`'{payment_in_progress}'`),
              literal(`'false'`),
              literal('true')
            )
          },
          { where: { transaction_id: transactionId } }
        );

        console.log(`✅ WEBHOOK DEBUG: Purchase update result - affected rows: ${updateResult[0]}, expected: ${transaction.purchases.length}`);

        if (updateResult[0] !== transaction.purchases.length) {
          console.warn(`⚠️ WEBHOOK DEBUG: Purchase update mismatch - updated ${updateResult[0]} but expected ${transaction.purchases.length}`);
        }

        // Debug: Verify the actual status after update
        const updatedPurchases = await this.models.Purchase.findAll({
          where: { transaction_id: transactionId }
        });
        console.log(`🔍 WEBHOOK DEBUG: After update, found ${updatedPurchases.length} purchases with status:`);
        updatedPurchases.forEach((purchase, index) => {
          console.log(`  ${index + 1}. ID: ${purchase.id}, New Status: ${purchase.payment_status}, Transaction ID: ${purchase.transaction_id}`);
        });
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
              literal(`'true'`),
              literal('true')
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
   * Process free transaction without PayPlus integration
   * Directly creates and completes the transaction for zero-amount items
   */
  async processFreeTransaction({ purchases, products, totalAmount, originalAmount, totalDiscount, appliedCoupons, userId }) {
    try {
      console.log('🆓 PaymentIntentService: Processing free transaction for user:', userId);

      // Create Transaction (PaymentIntent) - starts in 'pending' state initially
      const transactionId = `txn_free_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log(`🔧 FREE TRANSACTION: Creating free transaction with ID: ${transactionId}`);

      const transaction = await this.models.Transaction.create({
        id: transactionId,
        total_amount: totalAmount, // 0
        payment_status: 'pending', // Will be moved to completed immediately
        payment_method: 'free',
        environment: 'none', // No external payment processing
        payplus_response: {
          coupon_info: {
            applied_coupons: appliedCoupons,
            original_amount: originalAmount,
            total_discount: totalDiscount,
            final_amount: totalAmount
          },
          payment_created_at: new Date().toISOString(),
          free_transaction: true,
          payment_skipped_reason: 'zero_amount'
        },
        created_at: new Date(),
        updated_at: new Date()
      });

      // Link purchases to transaction
      const purchaseIds = purchases.map(p => p.id);
      console.log(`🔗 FREE TRANSACTION: Linking ${purchaseIds.length} purchases to free transaction ${transactionId}:`, purchaseIds);

      await this.models.Purchase.update(
        { transaction_id: transactionId },
        { where: { id: purchaseIds } }
      );

      // Verify linking was successful
      const verifiedLinkedPurchases = await this.models.Purchase.findAll({
        where: { transaction_id: transactionId }
      });
      console.log(`✅ FREE TRANSACTION: Verified ${verifiedLinkedPurchases.length} purchases are linked to transaction ${transactionId}`);

      // Immediately complete the free transaction
      await transaction.updateStatus('completed', {
        payment_page_url: null,
        free_transaction_completed: true,
        completed_at: new Date().toISOString()
      });

      // Update purchases to completed status
      const purchaseStatus = 'completed';
      const updateResult = await this.models.Purchase.update(
        {
          payment_status: purchaseStatus,
          updated_at: new Date(),
          metadata: fn('jsonb_set',
            col('metadata'),
            literal(`'{payment_in_progress}'`),
            literal(`'false'`),
            literal('true')
          )
        },
        { where: { transaction_id: transactionId } }
      );

      console.log(`✅ FREE TRANSACTION: Updated ${updateResult[0]} purchases to '${purchaseStatus}' status`);

      // Handle completed payment business logic (coupons, download counts, etc.)
      await this._handleCompletedPayment(transaction);

      console.log('✅ FREE TRANSACTION: Free transaction processed successfully:', {
        transactionId,
        totalAmount,
        purchaseCount: purchases.length,
        status: 'completed'
      });

      return {
        success: true,
        transactionId,
        paymentUrl: null, // No payment page needed for free transactions
        totalAmount,
        status: 'completed',
        purchaseCount: purchases.length,
        expiresAt: null, // Free transactions don't expire
        isFree: true
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error processing free transaction:', error);
      throw error;
    }
  }

  /**
   * Process free subscription without PayPlus integration
   * Directly creates and activates the subscription for zero-amount plans
   */
  async processFreeSubscription({ subscriptionData, userId }) {
    try {
      console.log('🆓 PaymentIntentService: Processing free subscription for user:', userId);

      // Create subscription record directly
      const subscriptionId = `sub_free_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const subscription = await this.models.Subscription.create({
        id: subscriptionId,
        user_id: userId,
        plan_type: subscriptionData.planType, // 'monthly' or 'yearly'
        amount: 0,
        status: 'active',
        payment_method: 'free',
        payplus_subscription_uid: null, // No PayPlus integration
        metadata: {
          free_subscription: true,
          created_via: 'free_processing',
          original_amount: subscriptionData.originalAmount || 0,
          discount_applied: subscriptionData.totalDiscount || 0
        },
        created_at: new Date(),
        updated_at: new Date(),
        // Free subscriptions don't have specific billing cycles, but we set reasonable defaults
        next_billing_date: subscriptionData.planType === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)  // 1 year from now
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),   // 1 month from now
        billing_cycle_start: new Date(),
        billing_cycle_end: subscriptionData.planType === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Create subscription history entry
      await this.models.SubscriptionHistory.create({
        subscription_id: subscriptionId,
        event_type: 'created',
        status: 'active',
        amount: 0,
        payment_method: 'free',
        metadata: {
          free_subscription: true,
          auto_activated: true
        },
        created_at: new Date()
      });

      console.log('✅ FREE SUBSCRIPTION: Free subscription created successfully:', {
        subscriptionId,
        planType: subscriptionData.planType,
        status: 'active'
      });

      return {
        success: true,
        subscriptionId,
        status: 'active',
        planType: subscriptionData.planType,
        amount: 0,
        nextBillingDate: subscription.next_billing_date,
        isFree: true
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error processing free subscription:', error);
      throw error;
    }
  }

  /**
   * Process token-based payment for purchases using stored customer tokens
   * Directly charges the token without requiring a payment page
   */
  async processTokenPayment({ purchases, products, totalAmount, originalAmount, totalDiscount, appliedCoupons, userId, tokenUid }) {
    try {
      console.log('💳 PaymentIntentService: Processing token payment for user:', userId);

      // Create Transaction (PaymentIntent) - starts in 'pending' state initially
      const transactionId = `txn_token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log(`🔧 TOKEN PAYMENT: Creating token transaction with ID: ${transactionId}`);

      const transaction = await this.models.Transaction.create({
        id: transactionId,
        total_amount: totalAmount,
        payment_status: 'pending', // Will be updated based on token charge result
        payment_method: 'payplus_token',
        environment: 'production',
        payplus_response: {
          coupon_info: {
            applied_coupons: appliedCoupons,
            original_amount: originalAmount,
            total_discount: totalDiscount,
            final_amount: totalAmount
          },
          payment_created_at: new Date().toISOString(),
          token_payment: true,
          token_uid: tokenUid?.substring(0, 8) + '...' // Store partial token for debugging
        },
        created_at: new Date(),
        updated_at: new Date()
      });

      // Link purchases to transaction
      const purchaseIds = purchases.map(p => p.id);
      console.log(`🔗 TOKEN PAYMENT: Linking ${purchaseIds.length} purchases to token transaction ${transactionId}:`, purchaseIds);

      await this.models.Purchase.update(
        { transaction_id: transactionId },
        { where: { id: purchaseIds } }
      );

      // Verify linking was successful
      const verifiedLinkedPurchases = await this.models.Purchase.findAll({
        where: { transaction_id: transactionId }
      });
      console.log(`✅ TOKEN PAYMENT: Verified ${verifiedLinkedPurchases.length} purchases are linked to transaction ${transactionId}`);

      // Process the token payment via PaymentService
      const tokenResult = await this.paymentService.processTokenPayment({
        purchases: verifiedLinkedPurchases,
        tokenUid,
        userId,
        appliedCoupons
      });

      if (!tokenResult.success) {
        throw new Error('Token payment processing failed');
      }

      // Update transaction status based on token payment result
      const finalStatus = tokenResult.status === 'approved' ? 'completed' : 'pending';
      await transaction.updateStatus(finalStatus, {
        payment_page_url: null,
        token_payment_completed: tokenResult.status === 'approved',
        payplus_transaction_uid: tokenResult.transactionId,
        token_charge_method: 'direct',
        completed_at: tokenResult.status === 'approved' ? new Date().toISOString() : null
      });

      // Update purchases to match transaction status
      const purchaseStatus = tokenResult.status === 'approved' ? 'completed' : 'pending';
      const updateResult = await this.models.Purchase.update(
        {
          payment_status: purchaseStatus,
          updated_at: new Date(),
          metadata: fn('jsonb_set',
            col('metadata'),
            literal(`'{payment_in_progress}'`),
            literal(`'false'`),
            literal('true')
          )
        },
        { where: { transaction_id: transactionId } }
      );

      console.log(`✅ TOKEN PAYMENT: Updated ${updateResult[0]} purchases to '${purchaseStatus}' status`);

      // Handle completed payment business logic if successful
      if (finalStatus === 'completed') {
        await this._handleCompletedPayment(transaction);
      }

      console.log('✅ TOKEN PAYMENT: Token payment processed successfully:', {
        transactionId,
        status: finalStatus,
        amount: totalAmount,
        purchaseCount: purchases.length
      });

      return {
        success: true,
        transactionId,
        paymentUrl: null, // No payment page needed for token payments
        totalAmount,
        status: finalStatus,
        purchaseCount: purchases.length,
        expiresAt: null, // Token payments don't expire
        isTokenPayment: true,
        chargeMethod: 'token'
      };

    } catch (error) {
      console.error('❌ PaymentIntentService: Error processing token payment:', error);
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