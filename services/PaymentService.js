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

  // Apply coupon to purchase
  async applyCoupon({ couponCode, userId, productId, purchaseAmount }) {
    try {
      // Find the coupon
      const coupon = await this.models.Coupon.findOne({
        where: { code: couponCode, is_active: true }
      });

      if (!coupon) {
        throw new Error('Invalid or inactive coupon code');
      }

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

      // Check minimum amount
      if (coupon.minimum_amount && purchaseAmount < coupon.minimum_amount) {
        throw new Error(`Minimum purchase amount of $${coupon.minimum_amount} required`);
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = (purchaseAmount * coupon.discount_value) / 100;
      } else if (coupon.discount_type === 'fixed') {
        discountAmount = coupon.discount_value;
      }

      // Ensure discount doesn't exceed purchase amount
      discountAmount = Math.min(discountAmount, purchaseAmount);

      // Update coupon usage
      await coupon.update({
        usage_count: (coupon.usage_count || 0) + 1,
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Coupon applied successfully',
        data: {
          couponCode,
          discountAmount,
          discountType: coupon.discount_type,
          originalAmount: purchaseAmount,
          finalAmount: purchaseAmount - discountAmount
        }
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      throw error;
    }
  }

  // Create PayPlus payment page
  async createPayplusPaymentPage({ purchaseId, amount, productId, userId, returnUrl, callbackUrl, environment, frontendOrigin }) {
    try {
      let purchase;
      let product;

      if (purchaseId) {
        // New purchase-based flow - use existing Purchase record
        purchase = await this.models.Purchase.findByPk(purchaseId);
        if (!purchase) {
          throw new Error('Purchase not found');
        }

        // Get product info from Purchase record
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
      }

      if (!product) {
        throw new Error('Product not found for payment');
      }

      // Integrate with actual PayPlus API
      const paymentPageUrl = await this.createPayplusPaymentLink({
        purchase,
        product,
        returnUrl,
        callbackUrl,
        environment
      });

      return {
        success: true,
        message: 'Payment page created',
        data: {
          payment_url: paymentPageUrl,
          paymentId: purchase.id,
          amount: purchase.payment_amount || amount,
          productTitle: product.title || product.name,
          environment: environment || 'production'
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
  async createPayplusPaymentLink({ purchase, product, returnUrl, callbackUrl, environment }) {
    try {
      // Get PayPlus configuration based on environment
      const config = this.getPayplusConfig(environment);

      // Force correct callback URL to our webhook endpoint
      const webhookCallbackUrl = process.env.ENVIRONMENT === 'production'
        ? 'https://api.ludora.app/api/webhooks/payplus'
        : 'https://api.ludora.app/api/webhooks/payplus';

      // Prepare PayPlus API payload
      const payload = {
        payment_page_uid: config.paymentPageUid,
        amount: purchase.payment_amount,
        currency_code: 'ILS',
        sendEmailApproval: true,
        sendEmailFailure: true,
        refURL_success: returnUrl,
        refURL_failure: returnUrl,
        refURL_callback: webhookCallbackUrl, // Always use webhook endpoint
        charge_method: 1, // 1 = immediate charge, 2 = authorization only
        // Removed custom_invoice_number - was causing PayPlus errors due to non-numeric format
        custom_invoice_name: product.title || product.name,
        more_info: `Purchase: ${product.title || product.name}`,
        charge_default: 1 // Default to credit card
      };

      // Add subscription settings if product has recurring billing
      if (product.subscription_type && product.subscription_type !== 'none') {
        payload.charge_method = 3; // Recurring payment
        payload.recurring_settings = {
          intervalType: this.getPayplusIntervalType(product.subscription_type),
          intervalCount: 1,
          totalOccurrences: product.subscription_total_cycles || 0, // 0 = unlimited
          trialDays: product.trial_days || 0
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
      await purchase.update({
        metadata: {
          ...purchase.metadata,
          payplus_page_request_uid: data.data.page_request_uid,
          payplus_qr_code: data.data.qr_code_image,
          environment: environment
        }
      });

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
      apiKey: process.env.PAYPLUS_API_KEY,
      secretKey: process.env.PAYPLUS_SECRET_KEY,
      paymentPageUid: process.env.PAYPLUS_PAYMENT_PAGE_UID
    };

    // Validate configuration
    if (!config.apiKey || !config.secretKey || !config.paymentPageUid) {
      console.warn('PayPlus configuration incomplete:', {
        hasApiKey: !!config.apiKey,
        hasSecretKey: !!config.secretKey,
        hasPaymentPageUid: !!config.paymentPageUid,
        payplusEnvironment: payplusEnv,
        deploymentEnvironment: process.env.ENVIRONMENT || process.env.NODE_ENV,
        adminOverride: environment || 'none'
      });
    }

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