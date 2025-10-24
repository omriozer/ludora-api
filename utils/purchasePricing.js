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
 * Get the final price for any purchasable item (purchase or product)
 * @param {Object} item - Purchase or product object
 * @param {string} itemType - 'purchase' or 'product' to determine pricing logic
 * @returns {number} Final price
 */
export function calcItemPrice(item, itemType) {
  if (itemType === 'purchase') {
    return calcFinalPurchasePrice(item);
  } else if (itemType === 'product') {
    return calcProductPrice(item);
  } else {
    throw new Error(`Unknown item type: ${itemType}. Must be 'purchase' or 'product'`);
  }
}