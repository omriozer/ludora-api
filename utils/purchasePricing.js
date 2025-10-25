/**
 * Purchase Pricing Utilities
 * Provides consistent pricing calculations for purchases with discounts
 */

/**
 * Calculate the final purchase price after applying discounts
 * @param {Object} purchase - Purchase object with pricing fields
 * @param {number} purchase.original_price - Original price before discounts
 * @param {number} purchase.discount_amount - Discount amount applied (optional)
 * @param {number} purchase.payment_amount - Pre-calculated payment amount (optional)
 * @returns {number} Final price to be paid
 */
export function calcFinalPurchasePrice(purchase) {
  // If payment_amount is already calculated and valid, use it
  if (purchase.payment_amount !== undefined && purchase.payment_amount !== null) {
    return parseFloat(purchase.payment_amount);
  }

  // Otherwise calculate from original_price - discount_amount
  const originalPrice = parseFloat(purchase.original_price || 0);
  const discountAmount = parseFloat(purchase.discount_amount || 0);

  const finalPrice = originalPrice - discountAmount;

  // Ensure price is never negative
  return Math.max(0, finalPrice);
}

/**
 * Calculate the final price for a product (no discounts)
 * @param {Object} product - Product object with price field
 * @param {number} product.price - Product price
 * @returns {number} Product price
 */
export function calcProductPrice(product) {
  return parseFloat(product.price || 0);
}

/**
 * Calculate the final subscription plan price after applying discounts
 * @param {Object} subscriptionPlan - SubscriptionPlan object with pricing and discount fields
 * @param {number} subscriptionPlan.price - Base subscription price
 * @param {boolean} subscriptionPlan.has_discount - Whether plan has a discount
 * @param {string} subscriptionPlan.discount_type - 'percentage' or 'fixed'
 * @param {number} subscriptionPlan.discount_value - Discount value (percentage or fixed amount)
 * @param {string} subscriptionPlan.discount_valid_until - Discount expiry date (ISO string)
 * @returns {Object} Object with originalPrice, discountAmount, finalPrice, isDiscounted
 */
export function calcSubscriptionPlanPrice(subscriptionPlan) {
  const originalPrice = parseFloat(subscriptionPlan.price || 0);

  // Check if plan has an active discount
  if (!subscriptionPlan.has_discount) {
    return {
      originalPrice,
      discountAmount: 0,
      finalPrice: originalPrice,
      isDiscounted: false
    };
  }

  // Check if discount is still valid
  if (subscriptionPlan.discount_valid_until) {
    const expiryDate = new Date(subscriptionPlan.discount_valid_until);
    const now = new Date();
    if (now > expiryDate) {
      return {
        originalPrice,
        discountAmount: 0,
        finalPrice: originalPrice,
        isDiscounted: false,
        discountExpired: true
      };
    }
  }

  // Calculate discount amount
  let discountAmount = 0;
  const discountValue = parseFloat(subscriptionPlan.discount_value || 0);

  switch (subscriptionPlan.discount_type) {
    case 'percentage':
      discountAmount = (originalPrice * discountValue) / 100;
      break;
    case 'fixed':
      discountAmount = discountValue;
      break;
    default:
      // Unknown discount type, no discount applied
      return {
        originalPrice,
        discountAmount: 0,
        finalPrice: originalPrice,
        isDiscounted: false,
        error: `Unknown discount type: ${subscriptionPlan.discount_type}`
      };
  }

  // Ensure discount doesn't make price negative
  discountAmount = Math.min(discountAmount, originalPrice);
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    isDiscounted: true,
    discountType: subscriptionPlan.discount_type,
    discountValue: discountValue
  };
}

/**
 * Get the final price for any purchasable item (purchase, product, or subscription plan)
 * @param {Object} item - Purchase, product, or subscription plan object
 * @param {string} itemType - 'purchase', 'product', or 'subscription' to determine pricing logic
 * @returns {number} Final price
 */
export function calcItemPrice(item, itemType) {
  if (itemType === 'purchase') {
    return calcFinalPurchasePrice(item);
  } else if (itemType === 'product') {
    return calcProductPrice(item);
  } else if (itemType === 'subscription') {
    return calcSubscriptionPlanPrice(item).finalPrice;
  } else {
    throw new Error(`Unknown item type: ${itemType}. Must be 'purchase', 'product', or 'subscription'`);
  }
}