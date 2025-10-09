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

  // Create PayPlus payment page
  async createPayplusPaymentPage({ purchaseId, purchaseIds, amount, productId, userId, returnUrl, callbackUrl, environment, frontendOrigin, appliedCoupons, originalAmount, totalDiscount }) {
    try {
      let purchases = [];
      let products = [];
      let totalAmount = 0;

      // Handle both single purchase (legacy) and multiple purchases (cart)
      const idsToProcess = purchaseIds || (purchaseId ? [purchaseId] : []);

      if (idsToProcess.length > 0) {
        // Multi-item cart flow - get all purchases
        purchases = await this.models.Purchase.findAll({
          where: { id: idsToProcess }
        });

        if (purchases.length !== idsToProcess.length) {
          throw new Error('Some purchases not found');
        }

        // Calculate original amount from all purchases
        const originalPurchaseAmount = purchases.reduce((sum, purchase) => {
          return sum + parseFloat(purchase.payment_amount || 0);
        }, 0);

        // Use provided amount (with coupons applied) or fall back to original amount
        totalAmount = amount || originalPurchaseAmount;

        // Track coupon discount information
        const couponInfo = {
          applied_coupons: appliedCoupons || [],
          original_amount: originalAmount || originalPurchaseAmount,
          total_discount: totalDiscount || 0,
          final_amount: totalAmount
        };

        // Get product info for each purchase
        for (const purchase of purchases) {
          let product = null;

          if (purchase.product_id) {
            product = await this.models.Product.findByPk(purchase.product_id);
          } else if (purchase.purchasable_type && purchase.purchasable_id) {
            // Handle new polymorphic structure
            const entityMap = {
              'workshop': this.models.Workshop,
              'course': this.models.Course,
              'file': this.models.File,
              'tool': this.models.Tool,
              'game': this.models.Game,
              'product': this.models.Product
            };

            const entityModel = entityMap[purchase.purchasable_type];
            if (entityModel) {
              product = await entityModel.findByPk(purchase.purchasable_id);
            }
          }

          if (product) {
            products.push({
              purchase,
              product,
              title: purchase.metadata?.product_title || product.title || product.name,
              amount: purchase.payment_amount
            });
          }
        }

        // Create Transaction record for multi-item payment
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const transaction = await this.models.Transaction.create({
          id: transactionId,
          total_amount: totalAmount,
          payment_status: 'pending',
          payment_method: 'payplus',
          environment: environment || 'production',
          payplus_response: {
            coupon_info: couponInfo,
            payment_created_at: new Date().toISOString()
          },
          created_at: new Date(),
          updated_at: new Date()
        });

        // Update all purchases to reference this transaction and set to pending
        await this.models.Purchase.update(
          {
            payment_status: 'pending',
            transaction_id: transactionId,
            updated_at: new Date()
          },
          { where: { id: idsToProcess } }
        );

        console.log(`🛒 Created transaction ${transactionId} for ${purchases.length} purchases, total: ₪${totalAmount}`);

      } else {
        // Legacy product-based flow
        if (!productId || !amount) {
          throw new Error('Product ID and amount are required for product-based payment');
        }

        product = await this.models.Product.findByPk(productId);
        if (!product) {
          throw new Error('Product not found');
        }

        // Check for existing purchases to prevent duplicates
        const existingPurchases = await this.models.Purchase.findAll({
          where: {
            buyer_user_id: userId,
            purchasable_type: product.product_type,
            purchasable_id: product.entity_id
          }
        });

        // Check if user has any non-refunded purchases for this product
        const nonRefundedPurchases = existingPurchases.filter(p => p.payment_status !== 'refunded');
        if (nonRefundedPurchases.length > 0) {
          throw new Error(`You already have an existing purchase for this product. Status: ${nonRefundedPurchases[0].payment_status}. Multiple purchases for the same product are not allowed unless the previous purchase was refunded.`);
        }

        // Create purchase record with clean schema
        purchase = await this.models.Purchase.create({
          id: generateId(),
          buyer_user_id: userId,
          purchasable_type: product.product_type,
          purchasable_id: product.entity_id,
          payment_amount: amount,
          original_price: product.price,
          payment_status: 'pending',
          metadata: {
            environment: environment || process.env.ENVIRONMENT || 'development'
          }
        });

        // For legacy single product flow, add to arrays for consistent processing
        purchases = [purchase];
        products = [{
          purchase,
          product,
          title: product.title || product.name,
          amount: purchase.payment_amount
        }];
        totalAmount = parseFloat(purchase.payment_amount);
      }

      if (products.length === 0) {
        throw new Error('No products found for payment');
      }

      // Generate return URLs - use transaction ID for multi-item, purchase ID for single item
      const orderRef = purchases.length > 1
        ? purchases[0].transaction_id
        : purchases[0].order_number || purchases[0].id;

      const baseReturnUrl = returnUrl || `${frontendOrigin || 'https://ludora.app'}/payment-result`;
      const successUrl = `${baseReturnUrl}?status=success&order=${orderRef}`;
      const failureUrl = `${baseReturnUrl}?status=failure&order=${orderRef}`;

      // Integrate with actual PayPlus API
      const paymentPageUrl = await this.createPayplusPaymentLink({
        purchases,
        products,
        totalAmount,
        returnUrl,
        successUrl,
        failureUrl,
        callbackUrl,
        environment
      });

      return {
        success: true,
        message: 'Payment page created',
        data: {
          payment_url: paymentPageUrl,
          paymentId: purchases.length === 1 ? purchases[0].id : purchases[0].transaction_id,
          amount: totalAmount,
          productTitle: products.length === 1
            ? products[0].title
            : `${products.length} items`,
          environment: environment || 'production',
          itemCount: products.length
        }
      };
    } catch (error) {
      console.error('Error creating PayPlus payment page:', error);
      throw error;
    }
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
    try {
      // Get PayPlus configuration based on environment
      const config = this.getPayplusConfig(environment);

      // Force correct callback URL to our webhook endpoint
      const webhookCallbackUrl = process.env.ENVIRONMENT === 'production'
        ? 'https://api.ludora.app/api/webhooks/payplus'
        : 'https://api.ludora.app/api/webhooks/payplus';

      // Create payment description for multi-item purchases
      const paymentDescription = products.length === 1
        ? `Purchase: ${products[0].title}`
        : `Cart purchase: ${products.length} items`;

      // Create invoice name for PayPlus
      const invoiceName = products.length === 1
        ? products[0].title
        : `Cart (${products.length} items)`;

      // Prepare PayPlus API payload
      const payload = {
        payment_page_uid: config.paymentPageUid,
        amount: totalAmount,
        currency_code: 'ILS',
        sendEmailApproval: true,
        sendEmailFailure: true,
        refURL_success: successUrl || returnUrl,
        refURL_failure: failureUrl || returnUrl,
        refURL_callback: webhookCallbackUrl, // Always use webhook endpoint
        charge_method: 1, // 1 = immediate charge, 2 = authorization only
        custom_invoice_name: invoiceName,
        more_info: paymentDescription,
        charge_default: 1, // Default to credit card
        // Add item details for PayPlus (if supported)
        items: (() => {
          if (products.length > 0) {
            const validItems = products.map(item => ({
              name: item.title || 'Product',
              amount: parseFloat(item.amount) || 0,
              quantity: 1
            })).filter(item => item.amount > 0); // Only include items with valid amounts

            // If all items were filtered out due to invalid amounts, create fallback
            return validItems.length > 0 ? validItems : [
              {
                name: 'Payment',
                amount: totalAmount,
                quantity: 1
              }
            ];
          } else {
            // Fallback item if no products found
            return [
              {
                name: 'Payment',
                amount: totalAmount,
                quantity: 1
              }
            ];
          }
        })()
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

      console.log('🚀 PayPlus API Request:', {
        url: `${config.apiBaseUrl}/PaymentPages/generateLink`,
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'MISSING',
          'secret-key': config.secretKey ? `${config.secretKey.substring(0, 8)}...` : 'MISSING'
        },
        payload: JSON.stringify(payload, null, 2)
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
      if (purchases.length > 1 && purchases[0].transaction_id) {
        // Multi-item: update Transaction record with PayPlus data
        const transaction = await this.models.Transaction.findByPk(purchases[0].transaction_id);
        if (transaction) {
          await transaction.update({
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
        }

        // Also update purchases with basic PayPlus reference
        await this.models.Purchase.update(
          {
            metadata: {
              ...purchases[0].metadata,
              payplus_page_request_uid: data.data.page_request_uid,
              transaction_type: 'multi_item',
              environment: environment
            },
            updated_at: new Date()
          },
          { where: { transaction_id: purchases[0].transaction_id } }
        );
      } else {
        // Single item: update Purchase record directly (legacy behavior)
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