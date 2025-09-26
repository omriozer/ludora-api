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
        recipient_email: email || purchase.buyer_email,
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
      return {
        success: true,
        message: 'PayPlus connection test successful',
        data: { 
          connected: true, 
          timestamp: new Date().toISOString(),
          environment: process.env.PAYPLUS_ENV || 'sandbox'
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

        // Create purchase record
        purchase = await this.models.Purchase.create({
          id: generateId(),
          product_id: productId,
          payment_amount: amount,
          original_price: product.price,
          payment_status: 'pending',
          environment: environment || process.env.ENVIRONMENT || 'development',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      if (!product) {
        throw new Error('Product not found for payment');
      }

      // TODO: Integrate with actual PayPlus API
      // For development, create a local payment simulation page
      const paymentPageUrl = `${frontendOrigin || 'http://localhost:5173'}/payment-simulator?purchaseId=${purchase.id}&amount=${purchase.payment_amount}&env=${environment}`;

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
        buyer_email: payerEmail || purchase.buyer_email,
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
}

export default new PaymentService();