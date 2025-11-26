import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import models from '../models/index.js';
import PaymentTokenService from '../services/PaymentTokenService.js';
import PayPlusTokenChargeService from '../services/PayPlusTokenChargeService.js';
import PaymentService from '../services/PaymentService.js';

const router = express.Router();

// Get user's saved payment methods
router.get('/payment-methods',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {

      const methods = await PaymentTokenService.getUserPaymentMethods(req.user.id);


      res.json({
        success: true,
        count: methods.length,
        payment_methods: methods
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment methods',
        message: error.message
      });
    }
  })
);

// Set default payment method
router.put('/payment-methods/:id/set-default',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { id: paymentMethodId } = req.params;


      // Validate that payment method exists and belongs to user
      const paymentMethod = await PaymentTokenService.validateUserOwnership(
        paymentMethodId,
        req.user.id
      );

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          error: 'Payment method not found or access denied'
        });
      }

      // Set as default using database transaction for atomicity
      const dbTransaction = await models.sequelize.transaction();

      try {
        const success = await PaymentTokenService.setDefaultPaymentMethod(
          paymentMethodId,
          req.user.id,
          dbTransaction
        );

        if (success) {
          await dbTransaction.commit();


          res.json({
            success: true,
            message: 'Default payment method updated successfully',
            payment_method: {
              id: paymentMethod.id,
              display_name: paymentMethod.getDisplayName(),
              is_default: true
            }
          });
        } else {
          await dbTransaction.rollback();
          res.status(400).json({
            success: false,
            error: 'Failed to set default payment method'
          });
        }
      } catch (error) {
        await dbTransaction.rollback();
        throw error;
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to set default payment method',
        message: error.message
      });
    }
  })
);

// Charge using saved payment token (one-click purchasing)
router.post('/payments/charge-token',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { payment_method_id, cart_items } = req.body;

      if (!payment_method_id || !cart_items || !Array.isArray(cart_items)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: payment_method_id, cart_items'
        });
      }

      // Start database transaction for atomicity
      const dbTransaction = await models.sequelize.transaction();

      try {
        // Verify payment method belongs to user
        const paymentMethod = await PaymentTokenService.validateUserOwnership(
          payment_method_id,
          req.user.id,
          dbTransaction
        );

        if (!paymentMethod) {
          await dbTransaction.rollback();
          return res.status(404).json({
            success: false,
            error: 'Payment method not found or access denied'
          });
        }


        // Calculate total amount from cart items
        const total = cart_items.reduce((sum, item) => {
          return sum + (parseFloat(item.price) * parseInt(item.quantity || 1));
        }, 0);

        if (total <= 0) {
          await dbTransaction.rollback();
          return res.status(400).json({
            success: false,
            error: 'Invalid total amount'
          });
        }


        // Charge the saved token directly (no payment page)
        const chargeResult = await PayPlusTokenChargeService.chargeToken({
          token: paymentMethod.payplus_token,
          amount: Math.round(total * 100), // Convert to cents
          currency: 'ILS',
          customerEmail: req.user.email,
          customerName: req.user.name || req.user.display_name,
          description: `Ludora purchase - ${cart_items.length} items`,
          metadata: {
            user_id: req.user.id,
            payment_method_id: payment_method_id,
            source: 'saved_payment_method'
          }
        });

        if (chargeResult.success) {
          // Create transaction record
          const transaction = await PaymentService.createPayPlusTransaction({
            userId: req.user.id,
            amount: total,
            pageRequestUid: chargeResult.transactionId, // Use PayPlus transaction ID
            paymentPageLink: null, // No payment page for token charges
            purchaseItems: cart_items,
            metadata: {
              charge_method: 'saved_token',
              payment_method_id: payment_method_id,
              payplus_transaction_uid: chargeResult.transactionId
            }
          });

          // Update transaction with payment method reference and completion
          await transaction.update({
            payment_method_id: payment_method_id,
            payment_status: 'completed',
            metadata: {
              ...transaction.metadata,
              completed_via: 'token_charge',
              payplus_response: chargeResult.metadata?.payplus_response
            }
          }, { transaction: dbTransaction });

          // Create purchase records for each cart item
          const purchases = [];
          for (const item of cart_items) {
            const purchase = await models.Purchase.create({
              buyer_user_id: req.user.id,
              purchasable_type: item.purchasable_type,
              purchasable_id: item.purchasable_id,
              payment_amount: parseFloat(item.price),
              original_price: parseFloat(item.price),
              discount_amount: 0,
              payment_status: 'completed',
              payment_method: 'saved_card',
              transaction_id: transaction.id,
              metadata: {
                charged_via: 'saved_payment_method',
                payment_method_id: payment_method_id,
                ...item.metadata
              }
            }, { transaction: dbTransaction });

            purchases.push(purchase);
          }

          await dbTransaction.commit();

          res.json({
            success: true,
            transaction_id: chargeResult.transactionId,
            amount: total,
            currency: 'ILS',
            purchase_count: purchases.length,
            purchases: purchases.map(p => ({
              id: p.id,
              type: p.purchasable_type,
              entity_id: p.purchasable_id,
              amount: p.payment_amount
            })),
            message: 'Payment processed successfully using saved payment method'
          });

        } else {
          // Payment failed
          await dbTransaction.rollback();


          res.status(400).json({
            success: false,
            error: 'Payment failed',
            details: chargeResult.error,
            error_code: chargeResult.errorCode
          });
        }

      } catch (error) {
        await dbTransaction.rollback();
        throw error;
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to process payment',
        message: error.message
      });
    }
  })
);

// Delete (soft delete) payment method
router.delete('/payment-methods/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { id: paymentMethodId } = req.params;


      const success = await PaymentTokenService.deletePaymentMethod(
        paymentMethodId,
        req.user.id
      );

      if (success) {

        res.json({
          success: true,
          message: 'Payment method removed successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Payment method not found or access denied'
        });
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete payment method',
        message: error.message
      });
    }
  })
);

// Get default payment method for checkout
router.get('/payment-methods/default',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {

      const defaultMethod = await PaymentTokenService.getUserDefaultPaymentMethod(req.user.id);

      if (defaultMethod) {
        res.json({
          success: true,
          has_default: true,
          payment_method: {
            id: defaultMethod.id,
            display_name: defaultMethod.getDisplayName(),
            card_last4: defaultMethod.card_last4,
            card_brand: defaultMethod.card_brand,
            is_default: defaultMethod.is_default,
            is_expired: defaultMethod.isExpired()
          }
        });
      } else {
        res.json({
          success: true,
          has_default: false,
          payment_method: null
        });
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch default payment method',
        message: error.message
      });
    }
  })
);

// Validate payment method token (health check)
router.post('/payment-methods/:id/validate',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { id: paymentMethodId } = req.params;

      // Verify payment method belongs to user
      const paymentMethod = await PaymentTokenService.validateUserOwnership(
        paymentMethodId,
        req.user.id
      );

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          error: 'Payment method not found or access denied'
        });
      }


      // Validate token with PayPlus
      const validationResult = await PayPlusTokenChargeService.validateToken(
        paymentMethod.payplus_token,
        req.user.email
      );

      res.json({
        success: true,
        payment_method_id: paymentMethodId,
        validation: {
          valid: validationResult.valid,
          expired: validationResult.expired,
          last4: validationResult.last4,
          brand: validationResult.brand,
          error: validationResult.error
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to validate payment method',
        message: error.message
      });
    }
  })
);

export default router;