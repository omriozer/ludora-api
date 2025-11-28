import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * BundlePurchaseService
 *
 * Handles purchase flow for bundle products using auto-purchase pattern:
 * 1. Creates main bundle purchase record
 * 2. Auto-creates individual purchase records for each bundled item
 * 3. Links individual purchases to bundle via bundle_purchase_id
 * 4. Existing AccessControlService handles access via normal purchase checks
 *
 * This approach requires ZERO changes to access control logic - bundles work
 * automatically through existing purchase-based access patterns.
 */
class BundlePurchaseService {
  /**
   * Create bundle purchase with auto-created individual purchases
   *
   * @param {Object} bundleProduct - The bundle Product record with type_attributes.bundle_items
   * @param {string} buyerId - User ID of the buyer
   * @param {Object} paymentData - Payment transaction data (amount, status, method, etc.)
   * @param {Object} transaction - Optional Sequelize transaction
   * @returns {Object} { bundlePurchase, individualPurchases }
   */
  async createBundlePurchase(bundleProduct, buyerId, paymentData, transaction = null) {
    const shouldCommit = !transaction;
    const txn = transaction || await models.sequelize.transaction();

    try {
      // Validate bundle product structure
      if (!bundleProduct.type_attributes?.is_bundle) {
        throw new BadRequestError('Product is not a bundle');
      }

      const bundleItems = bundleProduct.type_attributes.bundle_items || [];
      if (bundleItems.length === 0) {
        throw new BadRequestError('Bundle has no items');
      }

      ludlog.payments('Creating bundle purchase:', {
        bundleProductId: bundleProduct.id,
        buyerId,
        itemCount: bundleItems.length
      });

      // 1. Create main bundle purchase record
      const bundlePurchase = await models.Purchase.create({
        id: generateId(),
        buyer_user_id: buyerId,
        purchasable_type: bundleProduct.product_type,
        purchasable_id: bundleProduct.id,
        payment_amount: paymentData.payment_amount || bundleProduct.price,
        original_price: bundleProduct.type_attributes.original_total_price || bundleProduct.price,
        discount_amount: bundleProduct.type_attributes.savings || 0,
        coupon_code: paymentData.coupon_code || null,
        payment_method: paymentData.payment_method || 'payplus',
        payment_status: paymentData.payment_status || 'completed',
        access_expires_at: null, // Bundles always grant lifetime access to items
        metadata: {
          is_bundle_purchase: true,
          bundle_item_count: bundleItems.length,
          ...paymentData.metadata
        },
        transaction_id: paymentData.transaction_id || null,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction: txn });

      ludlog.payments('Main bundle purchase created:', {
        bundlePurchaseId: bundlePurchase.id
      });

      // 2. Auto-create individual purchases for each bundled item
      const individualPurchases = [];

      for (const item of bundleItems) {
        const individualPurchase = await models.Purchase.create({
          id: generateId(),
          buyer_user_id: buyerId,
          purchasable_type: bundleProduct.product_type, // Same type as bundle
          purchasable_id: item.product_id, // Individual product ID
          payment_amount: 0, // No additional payment - included in bundle price
          original_price: item.price || 0,
          discount_amount: item.price || 0, // Full discount since included in bundle
          payment_method: paymentData.payment_method || 'payplus',
          payment_status: 'completed', // Auto-complete for bundle items
          bundle_purchase_id: bundlePurchase.id, // CRITICAL: Link to bundle purchase
          access_expires_at: null, // Lifetime access to bundled items
          metadata: {
            from_bundle: true,
            bundle_purchase_id: bundlePurchase.id,
            bundle_product_id: bundleProduct.id,
            item_title: item.title
          },
          transaction_id: paymentData.transaction_id || null,
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction: txn });

        individualPurchases.push(individualPurchase);
      }

      if (shouldCommit) {
        await txn.commit();
      }

      ludlog.payments('Bundle purchase completed successfully:', {
        bundlePurchaseId: bundlePurchase.id,
        individualPurchases: individualPurchases.length,
        totalValue: bundleProduct.type_attributes.original_total_price,
        paidAmount: paymentData.payment_amount
      });

      return {
        bundlePurchase,
        individualPurchases
      };
    } catch (error) {
      if (shouldCommit) {
        await txn.rollback();
      }
      luderror.payments('Bundle purchase creation failed:', error);
      throw error;
    }
  }

  /**
   * Refund bundle purchase and all related individual purchases
   *
   * @param {string} bundlePurchaseId - ID of the main bundle purchase
   * @returns {Object} { refundedCount, bundlePurchaseId }
   */
  async refundBundlePurchase(bundlePurchaseId) {
    const transaction = await models.sequelize.transaction();

    try {
      // 1. Find and validate main bundle purchase
      const bundlePurchase = await models.Purchase.findByPk(bundlePurchaseId, { transaction });

      if (!bundlePurchase) {
        throw new NotFoundError('Bundle purchase not found');
      }

      if (bundlePurchase.payment_status === 'refunded') {
        throw new BadRequestError('Bundle purchase already refunded');
      }

      ludlog.payments('Refunding bundle purchase:', { bundlePurchaseId });

      // 2. Refund main bundle purchase
      await bundlePurchase.update({
        payment_status: 'refunded',
        updated_at: new Date()
      }, { transaction });

      // 3. Find and refund all individual purchases created from this bundle
      const individualPurchases = await models.Purchase.findAll({
        where: { bundle_purchase_id: bundlePurchaseId },
        transaction
      });

      let refundedCount = 0;
      for (const purchase of individualPurchases) {
        await purchase.update({
          payment_status: 'refunded',
          updated_at: new Date()
        }, { transaction });
        refundedCount++;
      }

      await transaction.commit();

      ludlog.payments('Bundle refund completed:', {
        bundlePurchaseId,
        refundedIndividualPurchases: refundedCount
      });

      return {
        bundlePurchaseId,
        refundedCount: refundedCount + 1 // +1 for main bundle purchase
      };
    } catch (error) {
      await transaction.rollback();
      luderror.payments('Bundle refund failed:', error);
      throw error;
    }
  }

  /**
   * Get bundle purchase details with individual purchases
   *
   * @param {string} bundlePurchaseId - ID of the bundle purchase
   * @returns {Object} Bundle purchase with individualPurchases array
   */
  async getBundlePurchaseDetails(bundlePurchaseId) {
    try {
      const bundlePurchase = await models.Purchase.findByPk(bundlePurchaseId);

      if (!bundlePurchase) {
        throw new NotFoundError('Bundle purchase not found');
      }

      // Get all individual purchases created from this bundle
      const individualPurchases = await models.Purchase.findAll({
        where: { bundle_purchase_id: bundlePurchaseId }
      });

      return {
        ...bundlePurchase.toJSON(),
        individualPurchases: individualPurchases.map(p => p.toJSON())
      };
    } catch (error) {
      luderror.payments('Failed to get bundle purchase details:', error);
      throw error;
    }
  }

  /**
   * Check if a purchase is from a bundle
   *
   * @param {Object} purchase - Purchase record
   * @returns {boolean}
   */
  isFromBundle(purchase) {
    return !!purchase.bundle_purchase_id;
  }

  /**
   * Check if a purchase is a bundle purchase
   *
   * @param {Object} purchase - Purchase record
   * @returns {boolean}
   */
  isBundlePurchase(purchase) {
    return purchase.metadata?.is_bundle_purchase === true;
  }
}

export default new BundlePurchaseService();
