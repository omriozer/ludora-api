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

// Type-specific attribute schemas
export const TYPE_ATTRIBUTE_SCHEMAS = {
  file: {
    grade_min: {
      type: 'number',
      min: 1,
      max: 12,
      label: 'כיתה מינימלית',
      description: 'הכיתה הנמוכה ביותר המתאימה לקובץ'
    },
    grade_max: {
      type: 'number',
      min: 1,
      max: 12,
      label: 'כיתה מקסימלית',
      description: 'הכיתה הגבוהה ביותר המתאימה לקובץ'
    },
    subject: {
      type: 'string',
      label: 'מקצוע',
      description: 'המקצוע הרלוונטי לקובץ',
      nullable: true
    }
  },
  workshop: {
    duration_minutes: {
      type: 'number',
      min: 15,
      max: 480,
      label: 'משך בדקות',
      description: 'משך ההדרכה בדקות'
    },
    max_participants: {
      type: 'number',
      min: 1,
      max: 1000,
      label: 'מספר משתתפים מקסימלי',
      description: 'מספר המשתתפים המקסימלי בהדרכה'
    },
    workshop_type: {
      type: 'string',
      label: 'סוג הדרכה',
      description: 'האם ההדרכה חיה או מוקלטת',
      options: ['live', 'recorded', 'hybrid']
    }
  },
  course: {
    estimated_hours: {
      type: 'number',
      min: 0.5,
      max: 200,
      label: 'שעות לימוד משוערות',
      description: 'מספר שעות הלימוד המשוער להשלמת הקורס'
    },
    modules_count: {
      type: 'number',
      min: 1,
      max: 50,
      label: 'מספר מודולים',
      description: 'מספר המודולים בקורס'
    },
    skill_level: {
      type: 'string',
      label: 'רמת מיומנות',
      description: 'רמת המיומנות הנדרשת לקורס',
      options: ['beginner', 'intermediate', 'advanced']
    }
  },
  game: {
    min_age: {
      type: 'number',
      min: 3,
      max: 18,
      label: 'גיל מינימלי',
      description: 'הגיל המינימלי המתאים למשחק'
    },
    max_age: {
      type: 'number',
      min: 3,
      max: 99,
      label: 'גיל מקסימלי',
      description: 'הגיל המקסימלי המתאים למשחק'
    },
    game_type: {
      type: 'string',
      label: 'סוג משחק',
      description: 'קטגוריית המשחק',
      options: ['memory', 'puzzle', 'quiz', 'adventure', 'educational']
    },
    estimated_duration: {
      type: 'number',
      min: 1,
      max: 120,
      label: 'משך משחק משוער (דקות)',
      description: 'משך המשחק הממוצע בדקות'
    }
  },
  tool: {
    // complexity: {
    //   type: 'string',
    //   label: 'רמת מורכבות',
    //   description: 'רמת המורכבות של הכלי',
    //   options: ['simple', 'medium', 'complex']
    // },
  }
};

// Helper function to get attributes schema for a product type
export const getAttributeSchema = (productType) => {
  return TYPE_ATTRIBUTE_SCHEMAS[productType] || {};
};

// Helper function to validate type attributes
export const validateTypeAttributes = (productType, attributes) => {
  const schema = getAttributeSchema(productType);
  const errors = [];

  for (const [key, value] of Object.entries(attributes)) {
    const fieldSchema = schema[key];
    if (!fieldSchema) continue;

    // Type validation
    if (fieldSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`${key} must be a number`);
      continue;
    }
    if (fieldSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string`);
      continue;
    }
    if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean`);
      continue;
    }

    // Range validation for numbers
    if (fieldSchema.type === 'number') {
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        errors.push(`${key} must be at least ${fieldSchema.min}`);
      }
      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        errors.push(`${key} must be at most ${fieldSchema.max}`);
      }
    }

    // Options validation for strings
    if (fieldSchema.options && !fieldSchema.options.includes(value)) {
      errors.push(`${key} must be one of: ${fieldSchema.options.join(', ')}`);
    }
  }

  return errors;
};