// Centralized product type definitions
// This is the single source of truth for all product types in the system
// To add/remove product types, only modify this file

export const PRODUCT_TYPES = {
  WORKSHOP: 'workshop',
  COURSE: 'course',
  FILE: 'file',
  TOOL: 'tool',
  GAME: 'game'
};

// Arrays for different use cases
export const ALL_PRODUCT_TYPES = Object.values(PRODUCT_TYPES);

// Product types that have creator relationships
export const PRODUCT_TYPES_WITH_CREATORS = [
  'product', // Product table itself has creator
  ...ALL_PRODUCT_TYPES
];

// Product types that can be purchased (for purchases, payments, etc.)
export const PURCHASABLE_PRODUCT_TYPES = [
  ...ALL_PRODUCT_TYPES,
  'subscription' // Special case for subscription purchases
];

// Product types that support media/video access
export const MEDIA_ENABLED_PRODUCT_TYPES = ALL_PRODUCT_TYPES;

// Product types that use the normalized structure (have Product table relationship)
export const NORMALIZED_PRODUCT_TYPES = ALL_PRODUCT_TYPES;