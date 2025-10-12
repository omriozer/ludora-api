import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

class PaymentService {
  constructor() {
    this.models = models;
  }

  // Send payment confirmation
  async sendPaymentConfirmation({ paymentId, userId, amount, email }) {
    try {
      // Find the purchase
      const purchase = await this.models.Purchase.findByPk(paymentId);
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      // Update purchase status
      await purchase.update({
        payment_status: 'confirmed',
        updated_at: new Date()
      });

      // Log the confirmation
      await this.models.EmailLog.create({
        id: generateId(),
        recipient_email: email,
        subject: 'Payment Confirmation',
        content: `Your payment of $${amount} has been confirmed.`,
        trigger_type: 'payment_confirmation',
        related_purchase_id: paymentId,
        status: 'sent',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Payment confirmation sent',
        data: { paymentId, status: 'confirmed' }
      };
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      throw error;
    }
  }

  // Test PayPlus connection
  async testPayplusConnection() {
    try {
      // TODO: Implement actual PayPlus API connection test
      // For now, return mock success
      // Auto-detect PayPlus environment
      const deploymentEnv = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
      const payplusEnv = deploymentEnv === 'production' ? 'production' : 'sandbox';

      return {
        success: true,
        message: 'PayPlus connection test successful',
        data: {
          connected: true,
          timestamp: new Date().toISOString(),
          environment: payplusEnv,
          deploymentEnvironment: deploymentEnv
        }
      };
    } catch (error) {
      console.error('PayPlus connection test failed:', error);
      throw error;
    }
  }

  // Apply coupon to purchase(s) - enhanced with new targeting and validation
  async applyCoupon({ couponCode, userId, purchaseIds, purchaseAmount, cartItems }) {
    try {
      // Find the coupon
      const coupon = await this.models.Coupon.findOne({
        where: { code: couponCode, is_active: true }
      });

      if (!coupon) {
        throw new Error('Invalid or inactive coupon code');
      }

      // Basic validations
      await this.validateCouponBasics(coupon);

      // Get user information for targeting
      const user = userId ? await this.models.User.findByPk(userId) : null;

      // Get cart details for validation
      const cartDetails = await this.getCartDetailsForCoupon(purchaseIds, cartItems);

      // Enhanced validations with new features
      await this.validateCouponTargeting(coupon, user, cartDetails);
      await this.validateCouponRequirements(coupon, cartDetails, purchaseAmount);

      // Calculate discount with cap enforcement
      const discountResult = this.calculateCouponDiscount(coupon, cartDetails, purchaseAmount);

      // Update coupon usage (but don't commit yet - this will be done when payment completes)
      // We're just validating and calculating for now

      return {
        success: true,
        message: 'Coupon applied successfully',
        data: {
          couponCode,
          couponId: coupon.id,
          discountAmount: discountResult.discountAmount,
          discountType: coupon.discount_type,
          originalAmount: purchaseAmount,
          finalAmount: discountResult.finalAmount,
          appliedItems: discountResult.appliedItems,
          priority: coupon.priority_level,
          maxCapApplied: discountResult.maxCapApplied
        }
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      throw error;
    }
  }

  // Validate basic coupon conditions (usage limit, expiry, etc.)
  async validateCouponBasics(coupon) {
    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new Error('Coupon usage limit exceeded');
    }

    // Check expiry
    if (coupon.valid_until) {
      const expiryDate = new Date(coupon.valid_until);
      if (expiryDate < new Date()) {
        throw new Error('Coupon has expired');
      }
    }
  }

  // Get cart details for coupon validation
  async getCartDetailsForCoupon(purchaseIds, cartItems) {
    if (cartItems) {
      // Cart items provided directly
      return {
        items: cartItems,
        totalQuantity: cartItems.length,
        productTypes: [...new Set(cartItems.map(item => item.purchasable_type))],
        productIds: cartItems.map(item => item.purchasable_id)
      };
    }

    if (purchaseIds && purchaseIds.length > 0) {
      // Get purchases from database
      const purchases = await this.models.Purchase.findAll({
        where: { id: purchaseIds }
      });

      return {
        items: purchases,
        totalQuantity: purchases.length,
        productTypes: [...new Set(purchases.map(p => p.purchasable_type))],
        productIds: purchases.map(p => p.purchasable_id)
      };
    }

    throw new Error('No cart items or purchase IDs provided for coupon validation');
  }

  // Validate coupon targeting (product, user segments)
  async validateCouponTargeting(coupon, user, cartDetails) {
    // Product targeting validation
    if (coupon.targeting_type === 'product_type' && coupon.target_product_types?.length > 0) {
      const hasMatchingType = cartDetails.productTypes.some(type =>
        coupon.target_product_types.includes(type)
      );
      if (!hasMatchingType) {
        throw new Error(`This coupon only applies to: ${coupon.target_product_types.join(', ')}`);
      }
    }

    if (coupon.targeting_type === 'product_id' && coupon.target_product_ids?.length > 0) {
      const hasMatchingId = cartDetails.productIds.some(id =>
        coupon.target_product_ids.includes(id)
      );
      if (!hasMatchingId) {
        throw new Error('This coupon does not apply to any items in your cart');
      }
    }

    // User segment targeting validation
    if (coupon.targeting_type === 'user_segment' && coupon.user_segments?.length > 0) {
      if (!user) {
        throw new Error('User authentication required for this coupon');
      }

      const userSegments = this.getUserSegments(user);
      const hasMatchingSegment = coupon.user_segments.some(segment =>
        userSegments.includes(segment)
      );

      if (!hasMatchingSegment) {
        throw new Error(`This coupon is only available for: ${coupon.user_segments.join(', ')}`);
      }
    }
  }

  // Validate coupon requirements (minimum amount, quantity)
  async validateCouponRequirements(coupon, cartDetails, purchaseAmount) {
    // Check minimum amount
    if (coupon.minimum_amount && purchaseAmount < coupon.minimum_amount) {
      throw new Error(`Minimum purchase amount of ₪${coupon.minimum_amount} required`);
    }

    // Check minimum quantity
    if (coupon.minimum_quantity && cartDetails.totalQuantity < coupon.minimum_quantity) {
      throw new Error(`Minimum ${coupon.minimum_quantity} items required in cart`);
    }
  }

  // Calculate discount amount with cap enforcement
  calculateCouponDiscount(coupon, cartDetails, purchaseAmount) {
    let discountAmount = 0;
    let maxCapApplied = false;

    // Calculate base discount
    if (coupon.discount_type === 'percentage') {
      discountAmount = (purchaseAmount * coupon.discount_value) / 100;
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = coupon.discount_value;
    }

    // Apply maximum discount cap if set
    if (coupon.max_discount_cap && discountAmount > coupon.max_discount_cap) {
      discountAmount = coupon.max_discount_cap;
      maxCapApplied = true;
    }

    // Ensure discount doesn't exceed purchase amount
    discountAmount = Math.min(discountAmount, purchaseAmount);

    const finalAmount = Math.max(0, purchaseAmount - discountAmount);

    return {
      discountAmount,
      finalAmount,
      maxCapApplied,
      appliedItems: cartDetails.items.length // For now, apply to all items
    };
  }

  // Get user segments for targeting
  getUserSegments(user) {
    const segments = [];

    // Check if new user (registered within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (user.created_at > thirtyDaysAgo) {
      segments.push('new_user');
    }

    // Check content creator status
    if (user.content_creator_agreement_sign_date) {
      segments.push('content_creator');
    }

    // Check admin/VIP status
    if (user.role === 'admin' || user.role === 'sysadmin') {
      segments.push('vip', 'admin');
    }

    // Add other segments based on user properties
    if (user.role === 'student') {
      segments.push('student');
    }

    return segments;
  }

  // Commit coupon usage (call this after successful payment)
  async commitCouponUsage(couponCode) {
    try {
      const coupon = await this.models.Coupon.findOne({
        where: { code: couponCode, is_active: true }
      });

      if (coupon) {
        await coupon.update({
          usage_count: (coupon.usage_count || 0) + 1,
          updated_at: new Date()
        });
      }
    } catch (error) {
      console.error('Error committing coupon usage:', error);
      // Don't throw here to avoid breaking payment flow
    }
  }

  // Legacy method - DEPRECATED: Use PaymentIntentService.createPaymentIntent() instead
  // This method conflicts with the new PaymentIntent flow and should not be used
  // Kept for backward compatibility but will be removed in future versions
  async createPayplusPaymentPage() {
    throw new Error('DEPRECATED: createPayplusPaymentPage() has been replaced by PaymentIntentService.createPaymentIntent(). Please update your code to use the new PaymentIntent flow.');
  }

  // Handle PayPlus callback
  async handlePayplusCallback({ paymentId, status, amount, transactionId, payerEmail }) {
    try {
      // Find the purchase
      const purchase = await this.models.Purchase.findByPk(paymentId);
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      // Update purchase with callback data
      await purchase.update({
        payment_status: status,
        // buyer_user_id is already set and immutable
        updated_at: new Date()
      });

      // If payment successful, handle post-payment logic
      if (status === 'completed' || status === 'approved') {
        // Update download count for file products (only files have downloads_count)
        if (purchase.product_id) {
          const product = await this.models.Product.findByPk(purchase.product_id);
          if (product && product.product_type === 'file') {
            // Find the associated file entity using polymorphic reference
            const fileEntity = await this.models.File.findByPk(product.entity_id);
            if (fileEntity) {
              await fileEntity.update({
                downloads_count: (fileEntity.downloads_count || 0) + 1
              });
            }
          }
        }

        // Send confirmation email
        if (payerEmail) {
          await this.sendPaymentConfirmation({
            paymentId,
            userId: null,
            amount,
            email: payerEmail
          });
        }
      }

      return {
        success: true,
        message: 'Payment callback processed',
        data: { paymentId, status, processed: true }
      };
    } catch (error) {
      console.error('Error handling PayPlus callback:', error);
      throw error;
    }
  }

  // Check payment status
  async checkPaymentStatus({ paymentId }) {
    try {
      const purchase = await this.models.Purchase.findByPk(paymentId);
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      return {
        success: true,
        data: {
          paymentId,
          status: purchase.payment_status,
          amount: purchase.payment_amount,
          productId: purchase.product_id,
          timestamp: purchase.updated_at
        }
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      throw error;
    }
  }

  // Create PayPlus payment link using their API
  async createPayplusPaymentLink({ purchases, products, totalAmount, returnUrl, successUrl, failureUrl, callbackUrl, environment }) {
    console.log('🎯 STARTING PayPlus createPayplusPaymentLink function');
    try {
      // Get PayPlus configuration based on environment
      const config = this.getPayplusConfig(environment);

      // Force correct callback URL to our webhook endpoint
      const webhookCallbackUrl = process.env.ENVIRONMENT === 'production'
        ? 'https://api.ludora.app/api/webhooks/payplus'
        : 'https://api.ludora.app/api/webhooks/payplus'; // Still use production for development testing since PayPlus can't reach localhost

      // Create payment description for multi-item purchases
      const paymentDescription = products.length === 1
        ? `Purchase: ${products[0].title}`
        : `Cart purchase: ${products.length} items`;

      // Create invoice name for PayPlus
      const invoiceName = products.length === 1
        ? products[0].title
        : `Cart (${products.length} items)`;

      // Get customer information from the first purchase
      let customerName = 'Customer';
      let customerEmail = '';

      if (purchases && purchases.length > 0) {
        try {
          const user = await this.models.User.findByPk(purchases[0].buyer_user_id);
          if (user) {
            customerName = user.full_name || user.display_name || 'Customer';
            customerEmail = user.email || '';
          }
        } catch (error) {
          console.warn('Could not fetch customer info:', error.message);
        }
      }

      // Try PayPlus API with just amount (no items array) first
      const payload = {
        payment_page_uid: config.paymentPageUid,
        amount: totalAmount.toFixed(2),
        currency_code: 'ILS',
        sendEmailApproval: true,
        sendEmailFailure: true,
        refURL_success: successUrl || returnUrl,
        refURL_failure: failureUrl || returnUrl,
        refURL_callback: webhookCallbackUrl,
        charge_method: 1,
        custom_invoice_name: invoiceName,
        more_info: paymentDescription,
        charge_default: 1,
        customer_name: customerName,
        customer_email: customerEmail
      };

      // Add subscription settings if any product has recurring billing
      const firstProduct = products[0]?.product;
      if (firstProduct && firstProduct.subscription_type && firstProduct.subscription_type !== 'none') {
        payload.charge_method = 3; // Recurring payment
        payload.recurring_settings = {
          intervalType: this.getPayplusIntervalType(firstProduct.subscription_type),
          intervalCount: 1,
          totalOccurrences: firstProduct.subscription_total_cycles || 0, // 0 = unlimited
          trialDays: firstProduct.trial_days || 0
        };
      }

      console.log('🚀 PayPlus API Request (FULL DEBUG):', {
        url: `${config.apiBaseUrl}/PaymentPages/generateLink`,
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'MISSING',
          'secret-key': config.secretKey ? `${config.secretKey.substring(0, 8)}...` : 'MISSING'
        },
        payload: payload,
        payloadString: JSON.stringify(payload, null, 2),
        totalAmount: totalAmount,
        products: products.map(p => ({ title: p.title, amount: p.amount, originalPrice: p.product?.price })),
        purchases: purchases?.map(p => ({ id: p.id, buyer_user_id: p.buyer_user_id }))
      });

      // Make API call to PayPlus
      const response = await fetch(`${config.apiBaseUrl}/PaymentPages/generateLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'secret-key': config.secretKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`PayPlus API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json();

      console.log('🔍 PayPlus API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(data, null, 2)
      });

      if (!data.data?.payment_page_link) {
        console.error('❌ PayPlus API Error - Missing payment_page_link:', {
          received_data: data,
          expected_field: 'data.payment_page_link',
          available_fields: Object.keys(data || {}),
          data_fields: Object.keys(data?.data || {})
        });
        throw new Error(`PayPlus API did not return a payment link. Response: ${JSON.stringify(data)}`);
      }

      // Store PayPlus transaction reference
      if (purchases[0].transaction_id) {
        // Transaction-based payment (PaymentIntent flow): update Transaction record with PayPlus data
        const transaction = await this.models.Transaction.findByPk(purchases[0].transaction_id);
        if (transaction) {
          console.log(`🔗 PAYPLUS DEBUG: Storing payplus_page_uid in transaction ${transaction.id}: ${data.data.page_request_uid}`);
          console.log(`🔗 PAYPLUS DEBUG: Transaction before update:`, {
            id: transaction.id,
            current_payplus_page_uid: transaction.payplus_page_uid,
            payment_status: transaction.payment_status
          });

          const updateResult = await transaction.update({
            payplus_page_uid: data.data.page_request_uid,
            payplus_response: {
              ...transaction.payplus_response, // Preserve existing coupon_info
              page_request_uid: data.data.page_request_uid,
              qr_code_image: data.data.qr_code_image,
              payment_page_link: data.data.payment_page_link,
              created_at: new Date().toISOString(),
              environment: environment
            },
            updated_at: new Date()
          });

          console.log(`✅ PAYPLUS DEBUG: Transaction updated successfully:`, {
            id: transaction.id,
            new_payplus_page_uid: updateResult.payplus_page_uid,
            update_affected_rows: updateResult ? 1 : 0
          });
        } else {
          console.error(`❌ PAYPLUS DEBUG: Transaction not found for ID: ${purchases[0].transaction_id}`);
        }

        // Also update purchases with basic PayPlus reference
        console.log(`🔗 PAYPLUS DEBUG: Updating ${purchases.length} purchases with PayPlus UID: ${data.data.page_request_uid}`);
        console.log(`🔗 PAYPLUS DEBUG: Purchase transaction_ids:`, purchases.map(p => p.transaction_id));

        const purchaseUpdateResult = await this.models.Purchase.update(
          {
            metadata: {
              ...purchases[0].metadata,
              payplus_page_request_uid: data.data.page_request_uid,
              transaction_type: purchases.length > 1 ? 'multi_item' : 'single_item_with_transaction',
              environment: environment
            },
            updated_at: new Date()
          },
          { where: { transaction_id: purchases[0].transaction_id } }
        );

        console.log(`✅ PAYPLUS DEBUG: Updated ${purchaseUpdateResult[0]} purchases with PayPlus metadata`);

        // Verify purchases were updated
        const verifyPurchases = await this.models.Purchase.findAll({
          where: { transaction_id: purchases[0].transaction_id }
        });
        console.log(`🔍 PAYPLUS DEBUG: Verified ${verifyPurchases.length} purchases have PayPlus UID in metadata`);
        verifyPurchases.forEach((purchase, index) => {
          console.log(`  ${index + 1}. Purchase ${purchase.id}: metadata.payplus_page_request_uid = ${purchase.metadata?.payplus_page_request_uid}`);
        });
      } else {
        // Legacy single-item payment (no transaction_id): update Purchase record directly
        const purchase = purchases[0];
        await purchase.update({
          metadata: {
            ...purchase.metadata,
            payplus_page_request_uid: data.data.page_request_uid,
            payplus_qr_code: data.data.qr_code_image,
            transaction_type: 'single_item',
            environment: environment
          }
        });
      }

      return data.data.payment_page_link;

    } catch (error) {
      console.error('Error creating PayPlus payment link:', error);

      // Check if PayPlus is not configured and provide helpful error
      if (!process.env.PAYPLUS_API_KEY || !process.env.PAYPLUS_SECRET_KEY || !process.env.PAYPLUS_PAYMENT_PAGE_UID) {
        throw new Error('PayPlus payment gateway is not configured. Please add PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY, and PAYPLUS_PAYMENT_PAGE_UID to your environment variables.');
      }

      throw error;
    }
  }

  // Get PayPlus configuration based on environment
  getPayplusConfig(environment) {
    // Determine PayPlus environment:
    // 1. Admin override from frontend (environment parameter)
    // 2. Automatic: production deployment = production, others = test/sandbox
    let payplusEnv;

    if (environment === 'test' || environment === 'production') {
      // Admin override via frontend toggle
      payplusEnv = environment === 'test' ? 'sandbox' : 'production';
    } else {
      // Automatic environment detection
      const deploymentEnv = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
      payplusEnv = deploymentEnv === 'production' ? 'production' : 'sandbox';
    }

    const config = {
      apiBaseUrl: payplusEnv === 'production'
        ? 'https://restapi.payplus.co.il/api/v1.0'
        : 'https://restapidev.payplus.co.il/api/v1.0',
      apiKey: payplusEnv === 'production'
        ? process.env.PAYPLUS_API_KEY
        : (process.env.PAYPLUS_STAGING_API_KEY || process.env.PAYPLUS_API_KEY),
      secretKey: payplusEnv === 'production'
        ? process.env.PAYPLUS_SECRET_KEY
        : (process.env.PAYPLUS_STAGING_SECRET_KEY || process.env.PAYPLUS_SECRET_KEY),
      paymentPageUid: payplusEnv === 'production'
        ? process.env.PAYPLUS_PAYMENT_PAGE_UID
        : (process.env.PAYPLUS_STAGING_PAYMENT_PAGE_UID || process.env.PAYPLUS_PAYMENT_PAGE_UID)
    };

    // Validate configuration
    if (!config.apiKey || !config.secretKey || !config.paymentPageUid) {
      console.warn('PayPlus configuration incomplete:', {
        hasApiKey: !!config.apiKey,
        hasSecretKey: !!config.secretKey,
        hasPaymentPageUid: !!config.paymentPageUid,
        payplusEnvironment: payplusEnv,
        deploymentEnvironment: process.env.ENVIRONMENT || process.env.NODE_ENV,
        adminOverride: environment || 'none',
        usingCredentials: payplusEnv === 'production' ? 'production' : 'staging-or-fallback'
      });
    }

    console.log('🔧 PayPlus Configuration:', {
      environment: payplusEnv,
      apiUrl: config.apiBaseUrl,
      hasCredentials: !!(config.apiKey && config.secretKey && config.paymentPageUid),
      credentialSource: payplusEnv === 'production' ? 'PAYPLUS_*' : 'PAYPLUS_STAGING_* (or fallback)',
      adminOverride: environment
    });

    return config;
  }

  // Convert subscription types to PayPlus interval types
  getPayplusIntervalType(subscriptionType) {
    const intervalMap = {
      'weekly': 1,      // Weekly
      'monthly': 2,     // Monthly
      'quarterly': 3,   // Quarterly
      'yearly': 4,      // Yearly
      'daily': 5        // Daily
    };

    return intervalMap[subscriptionType] || 2; // Default to monthly
  }
}

export default new PaymentService();