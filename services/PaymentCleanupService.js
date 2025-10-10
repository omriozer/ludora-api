import models from '../models/index.js';

/**
 * PaymentCleanupService - Handles cleanup of stale payment sessions and cart items
 */
class PaymentCleanupService {
  /**
   * Clean up stale payment sessions that have been in progress for too long
   * @param {number} maxMinutes - Maximum minutes to allow a payment to be in progress (default: 10)
   * @returns {Promise<object>} Cleanup results
   */
  static async cleanupStalePaymentSessions(maxMinutes = 10) {
    try {
      console.log(`🧹 Starting cleanup of stale payment sessions older than ${maxMinutes} minutes...`);

      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - maxMinutes);

      // Find purchases with payment_in_progress flag that are older than cutoff time
      const stalePurchases = await models.Purchase.findAll({
        where: {
          [models.Sequelize.Op.and]: [
            {
              metadata: {
                payment_in_progress: true
              }
            },
            {
              metadata: {
                payment_page_created_at: {
                  [models.Sequelize.Op.lt]: cutoffTime.toISOString()
                }
              }
            }
          ]
        }
      });

      let cleanedCount = 0;
      const cleanedPurchases = [];

      for (const purchase of stalePurchases) {
        try {
          // Reset payment_in_progress flag and add cleanup metadata
          await models.Purchase.update(
            {
              metadata: {
                ...purchase.metadata,
                payment_in_progress: false,
                payment_cleaned_up_at: new Date().toISOString(),
                cleanup_reason: 'stale_payment_session'
              },
              updated_at: new Date()
            },
            { where: { id: purchase.id } }
          );

          cleanedCount++;
          cleanedPurchases.push({
            id: purchase.id,
            userId: purchase.buyer_user_id,
            productType: purchase.purchasable_type,
            productId: purchase.purchasable_id,
            paymentPageCreatedAt: purchase.metadata?.payment_page_created_at,
            ageMinutes: Math.round((new Date() - new Date(purchase.metadata?.payment_page_created_at)) / (1000 * 60))
          });

          console.log(`✅ Cleaned up stale purchase ${purchase.id} (age: ${Math.round((new Date() - new Date(purchase.metadata?.payment_page_created_at)) / (1000 * 60))} minutes)`);
        } catch (error) {
          console.error(`❌ Failed to clean up purchase ${purchase.id}:`, error);
        }
      }

      const result = {
        success: true,
        cleanedCount,
        totalStaleFound: stalePurchases.length,
        cutoffTime: cutoffTime.toISOString(),
        maxMinutes,
        cleanedPurchases
      };

      console.log(`🧹 Cleanup completed: ${cleanedCount}/${stalePurchases.length} stale payment sessions cleaned`);
      return result;

    } catch (error) {
      console.error('❌ Error during payment cleanup:', error);
      return {
        success: false,
        error: error.message,
        cleanedCount: 0
      };
    }
  }

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
            [models.Sequelize.Op.lt]: cutoffTime
          },
          [models.Sequelize.Op.or]: [
            {
              metadata: {
                payment_in_progress: {
                  [models.Sequelize.Op.ne]: true
                }
              }
            },
            {
              metadata: {
                payment_in_progress: {
                  [models.Sequelize.Op.is]: null
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

    const stalePaymentResult = await this.cleanupStalePaymentSessions(stalePaymentMinutes);
    const abandonedCartResult = await this.cleanupAbandonedCartItems(abandonedCartHours);

    const result = {
      success: stalePaymentResult.success && abandonedCartResult.success,
      stalePayments: stalePaymentResult,
      abandonedCarts: abandonedCartResult,
      totalCleaned: (stalePaymentResult.cleanedCount || 0) + (abandonedCartResult.deletedCount || 0),
      timestamp: new Date().toISOString()
    };

    console.log(`🧹 Full cleanup completed: ${result.totalCleaned} total items cleaned`);
    return result;
  }
}

export default PaymentCleanupService;