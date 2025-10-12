import models from '../models/index.js';
import { Op } from 'sequelize';

/**
 * PaymentCleanupService - Handles cleanup of stale payment sessions and cart items
 */
class PaymentCleanupService {
  /**
   * Clean up old cart items that have been abandoned for a long time
   * @param {number} maxHours - Maximum hours to keep cart items (default: 24)
   * @returns {Promise<object>} Cleanup results
   */
  static async cleanupAbandonedCartItems(maxHours = 24) {
    try {
      console.log(`🛒 Starting cleanup of abandoned cart items older than ${maxHours} hours...`);

      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxHours);

      // Find cart purchases that are very old and don't have payment_in_progress flag
      const abandonedPurchases = await models.Purchase.findAll({
        where: {
          payment_status: 'cart',
          created_at: {
            [Op.lt]: cutoffTime
          },
          [Op.or]: [
            {
              metadata: {
                payment_in_progress: {
                  [Op.ne]: true
                }
              }
            },
            {
              metadata: {
                payment_in_progress: {
                  [Op.is]: null
                }
              }
            }
          ]
        }
      });

      let deletedCount = 0;
      const deletedPurchases = [];

      for (const purchase of abandonedPurchases) {
        try {
          await models.Purchase.destroy({
            where: { id: purchase.id }
          });

          deletedCount++;
          deletedPurchases.push({
            id: purchase.id,
            userId: purchase.buyer_user_id,
            productType: purchase.purchasable_type,
            productId: purchase.purchasable_id,
            createdAt: purchase.created_at,
            ageHours: Math.round((new Date() - new Date(purchase.created_at)) / (1000 * 60 * 60))
          });

          console.log(`🗑️ Deleted abandoned cart item ${purchase.id} (age: ${Math.round((new Date() - new Date(purchase.created_at)) / (1000 * 60 * 60))} hours)`);
        } catch (error) {
          console.error(`❌ Failed to delete abandoned purchase ${purchase.id}:`, error);
        }
      }

      const result = {
        success: true,
        deletedCount,
        totalAbandonedFound: abandonedPurchases.length,
        cutoffTime: cutoffTime.toISOString(),
        maxHours,
        deletedPurchases
      };

      console.log(`🛒 Cart cleanup completed: ${deletedCount}/${abandonedPurchases.length} abandoned cart items deleted`);
      return result;

    } catch (error) {
      console.error('❌ Error during cart cleanup:', error);
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }

  /**
   * Run full cleanup (both stale payments and abandoned carts)
   * @param {object} options - Cleanup options
   * @param {number} options.stalePaymentMinutes - Minutes for stale payment cleanup
   * @param {number} options.abandonedCartHours - Hours for abandoned cart cleanup
   * @returns {Promise<object>} Combined cleanup results
   */
  static async runFullCleanup(options = {}) {
    const {
      stalePaymentMinutes = 2,
      abandonedCartHours = 24
    } = options;

    console.log('🧹 Starting full payment and cart cleanup...');

    const abandonedCartResult = await this.cleanupAbandonedCartItems(abandonedCartHours);

    const result = {
      success: abandonedCartResult.success,
      abandonedCarts: abandonedCartResult,
      totalCleaned: (stalePaymentResult.cleanedCount || 0) + (abandonedCartResult.deletedCount || 0),
      timestamp: new Date().toISOString()
    };

    console.log(`🧹 Full cleanup completed: ${result.totalCleaned} total items cleaned`);
    return result;
  }
}

export default PaymentCleanupService;