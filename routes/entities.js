import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { addETagSupport } from '../middleware/etagMiddleware.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import ProductServiceRouter from '../services/ProductServiceRouter.js';
import EntityService from '../services/EntityService.js';
import GameDetailsService from '../services/GameDetailsService.js';
import SettingsService from '../services/SettingsService.js';
import AccessControlIntegrator from '../services/AccessControlIntegrator.js';
import models, { sequelize } from '../models/index.js';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
// Note: No longer importing deprecated helper functions since we use SystemTemplate now
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';
import { CONTENT_CREATOR_KEYS } from '../constants/settingsKeys.js';
import fileService from '../services/FileService.js';
import { getLessonPlanPresentationFiles, checkLessonPlanAccess, getOrderedPresentationUrls } from '../utils/lessonPlanPresentationHelper.js';
import { countSlidesInPowerPoint, calculateTotalSlides } from '../utils/slideCountingUtils.js';
import { GAME_TYPES } from '../config/gameTypes.js';
import { generateId } from '../models/baseModel.js';
import { LANGUAGES_OPTIONS } from '../constants/langauages.js';
import { luderror, ludlog } from '../lib/ludlog.js';
import { requireStudentConsent } from '../middleware/consentEnforcement.js';

const router = express.Router();

// Configure multer for file uploads (memory storage for S3)
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  },
  // Handle UTF-8 filenames properly
  preservePath: false,
  // Ensure proper encoding handling for Hebrew filenames
  fileFilter: (_req, file, cb) => {
    // Try to fix encoding if it's corrupted
    try {
      // Check for mojibake patterns (UTF-8 interpreted as Latin-1 and re-encoded)
      // Common Hebrew mojibake pattern: ×ª×©×¤×´×" (תשפ״ה)
      if (file.originalname.includes('×') || file.originalname.includes('Ã') || file.originalname.includes('�')) {
        // First try: Latin-1 to UTF-8 conversion (most common Hebrew encoding issue)
        try {
          const fixedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          // Check if result contains proper Hebrew characters
          if (/[\u0590-\u05FF]/.test(fixedName)) {
            file.originalname = fixedName;
            luderror.api(`✅ Fixed Hebrew filename encoding: ${fixedName}`);
          }
        } catch (e1) {
          // Try alternative: UTF-8 to Latin-1 conversion (for different corruption patterns)
          try {
            const fixedName = Buffer.from(file.originalname, 'utf8').toString('latin1');
            if (/[\u0590-\u05FF]/.test(fixedName)) {
              file.originalname = fixedName;
              luderror.api(`✅ Fixed Hebrew filename encoding (alt): ${fixedName}`);
            }
          } catch (e2) {
            luderror.api(`⚠️ Could not fix filename encoding: ${file.originalname}`);
          }
        }
      }
    } catch (error) {
      luderror.api(`📤 Could not fix filename encoding: ${error.message}`);
    }

    cb(null, true);
  }
});

// Helper function to get file type from extension (must match File model validation)
function getFileTypeFromExtension(extension) {
  switch (extension.toLowerCase()) {
    case 'pdf': return 'pdf';
    case 'doc':
    case 'docx': return 'docx';
    case 'zip': return 'zip';
    case 'svg': return 'other'; // SVG files for new slide system
    // Audio files and all other types fall back to 'other'
    // File model only allows: ['pdf', 'docx', 'zip', 'other']
    default: return 'other';
  }
}

// Helper function to get default study topics for a subject and grade range
function getDefaultStudyTopicsForSubject(subject, gradeFrom, gradeTo) {
  // Define default topics based on subject
  const topicTemplates = {
    'hebrew_language': [
      { topic: 'קריאה והבנת הנקרא', description: 'פיתוח כישורי קריאה והבנת טקסטים' },
      { topic: 'כתיבה יצירתית', description: 'כתיבת סיפורים ויצירות מקוריות' },
      { topic: 'דקדוק ותחביר', description: 'חוקי הדקדוק והתחביר בעברית' },
      { topic: 'אוצר מילים', description: 'הרחבת אוצר המילים העברי' },
      { topic: 'ביטוי בעל פה', description: 'פיתוח כישורי דיבור והצגה' }
    ],
    'mathematics': [
      { topic: 'מספרים וחשבון', description: 'פעולות חשבון בסיסיות ומספרים' },
      { topic: 'גיאומטריה', description: 'צורות גיאומטריות ומדידות' },
      { topic: 'אלגברה בסיסית', description: 'משוואות ופונקציות פשוטות' },
      { topic: 'חשיבה מתמטית', description: 'פתרון בעיות וחשיבה לוגית' },
      { topic: 'סטטיסטיקה והסתברות', description: 'איסוף וניתוח נתונים' }
    ],
    'science': [
      { topic: 'חקר הטבע', description: 'התבוננות וחקירה במערכות טבע' },
      { topic: 'כימיה בסיסית', description: 'תכונות החומר ותגובות כימיות' },
      { topic: 'פיזיקה יסודית', description: 'כוח, תנועה ואנרגיה' },
      { topic: 'ביולוגיה', description: 'מערכות חיות וסביבה' },
      { topic: 'טכנולוגיה ומדע', description: 'יישומים טכנולוגיים של מדע' }
    ],
    'english': [
      { topic: 'Reading Comprehension', description: 'Understanding English texts' },
      { topic: 'Vocabulary Building', description: 'Learning new English words' },
      { topic: 'Grammar and Writing', description: 'English grammar rules and writing skills' },
      { topic: 'Listening Skills', description: 'Understanding spoken English' },
      { topic: 'Speaking Practice', description: 'Developing oral communication' }
    ],
    'history': [
      { topic: 'תולדות עם ישראל', description: 'היסטוריה של העם היהודי' },
      { topic: 'תולדות ארץ ישראל', description: 'היסטוריה של ארץ ישראל' },
      { topic: 'תולדות העולם', description: 'אירועים חשובים בהיסטוריה העולמית' },
      { topic: 'מקורות היסטוריים', description: 'עבודה עם מסמכים היסטוריים' },
      { topic: 'חשיבה היסטורית', description: 'ניתוח גורמים ותוצאות בהיסטוריה' }
    ],
    'geography': [
      { topic: 'גיאוגרפיה פיזית', description: 'הבנת נופים וצורות קרקע' },
      { topic: 'גיאוגרפיה אנושית', description: 'התנחלות ופיתוח אזורים' },
      { topic: 'מפות וכיוונים', description: 'קריאת מפות וניווט' },
      { topic: 'אקלים וסביבה', description: 'מזג אוויר ותנאי סביבה' },
      { topic: 'משאבי טבע', description: 'שימוש ושימור משאבים טבעיים' }
    ]
  };

  // Get templates for the subject (fallback to general topics if subject not found)
  const subjectTopics = topicTemplates[subject] || [
    { topic: 'נושא 1', description: `נושא בסיסי ב${subject}` },
    { topic: 'נושא 2', description: `נושא מתקדם ב${subject}` },
    { topic: 'נושא 3', description: `נושא מעמיק ב${subject}` }
  ];

  // Adjust number of topics based on grade range
  const rangeSize = gradeTo - gradeFrom + 1;
  const topicsPerGrade = Math.max(2, Math.min(4, Math.ceil(subjectTopics.length / rangeSize)));
  const selectedTopics = subjectTopics.slice(0, Math.min(topicsPerGrade * rangeSize, subjectTopics.length));

  return selectedTopics;
}

// Helper function to check content creator permissions
async function checkContentCreatorPermissions(user, entityType, entityData = {}) {
  // Admins and sysadmins always have permission
  if (user.role === 'admin' || user.role === 'sysadmin') {
    return { allowed: true };
  }

  // Asset-only files don't require content creator permissions (they're internal assets, not products)
  if (entityType === 'file' && entityData.is_asset_only === true) {
    return { allowed: true };
  }

  // Non-content creators can't create products
  if (!user.content_creator_agreement_sign_date) {
    return {
      allowed: false,
      message: 'Only signed content creators can create products'
    };
  }

  // For product types, check specific content creator permissions
  if (ALL_PRODUCT_TYPES.includes(entityType)) {
    try {
      let permissionKey;

      if (entityType === 'file' || entityType === 'tool') {
        permissionKey = CONTENT_CREATOR_KEYS.ALLOW_CONTENT_CREATOR_FILES;
      } else if (entityType === 'game') {
        permissionKey = CONTENT_CREATOR_KEYS.ALLOW_CONTENT_CREATOR_GAMES;
      } else if (entityType === 'workshop') {
        permissionKey = CONTENT_CREATOR_KEYS.ALLOW_CONTENT_CREATOR_WORKSHOPS;
      } else if (entityType === 'course') {
        permissionKey = CONTENT_CREATOR_KEYS.ALLOW_CONTENT_CREATOR_COURSES;
      } else if (entityType === 'lesson_plan') {
        permissionKey = CONTENT_CREATOR_KEYS.ALLOW_CONTENT_CREATOR_LESSON_PLANS;
      } else {
        // Fallback for any unknown types (should not happen with current entity types)
        permissionKey = `allow_content_creator_${entityType}s`;
      }

      const permissionValue = await SettingsService.get(permissionKey);

      if (!permissionValue) {
        return {
          allowed: false,
          message: `Content creators are not allowed to create ${entityType}s`
        };
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, message: 'Error checking permissions' };
    }
  }

  // For other entity types, allow if signed content creator
  return { allowed: true };
}

// Helper function to get full product with entity and creator
async function getFullProduct(product, userId = null, includeGameDetails = false) {
  // Get the entity based on product_type and entity_id
  let entity = null;
  if (product.entity_id && product.product_type) {
    // Regular polymorphic association for all product types
    const entityModel = ProductServiceRouter.getModel(product.product_type);
    entity = await entityModel.findByPk(product.entity_id);
  }

  // Get creator information
  let creator = null;
  if (product.creator_user_id) {
    creator = await models.User.findByPk(product.creator_user_id, {
      attributes: ['id', 'full_name', 'email', 'content_creator_agreement_sign_date']
    });
  }

  // If creator_user_id is NULL or user lookup failed, use default 'Ludora' creator
  if (!creator) {
    creator = {
      id: null,
      full_name: 'Ludora',
      email: null,
      content_creator_agreement_sign_date: null
    };
  }

  // Get purchase information if user is authenticated
  let purchase = null;
  if (userId && product.id) {
    // Check for any non-refunded purchase (completed OR pending)
    purchase = await models.Purchase.findOne({
      where: {
        buyer_user_id: userId,
        purchasable_id: product.entity_id || product.id,
        purchasable_type: product.product_type,
        payment_status: ['completed', 'pending', 'cart'] // Include completed, pending, and cart purchases
      },
      attributes: ['id', 'payment_status', 'access_expires_at', 'created_at'],
      order: [['created_at', 'DESC']] // Get the most recent purchase
    });
  }

  // Merge all data
  // IMPORTANT: Preserve product.id and explicitly rename entity.id to avoid conflicts
  const productData = product.toJSON();
  const entityData = entity ? entity.toJSON() : {};

  // Remove 'id' from entity to prevent overwriting product.id
  if (entityData.id) {
    delete entityData.id;
  }

  // Calculate game details if requested and product is a game
  let gameDetails = null;
  if (includeGameDetails && product.product_type === 'game' && entity && entity.game_type) {
    try {
      gameDetails = await GameDetailsService.getGameDetails(product.entity_id, entity.game_type);
    } catch (error) {
      // Don't fail the entire request if game details calculation fails
      gameDetails = null;
    }
  }

  // Build the response object
  const response = {
    ...productData,
    ...entityData,
    id: productData.id, // Ensure product ID is preserved
    entity_id: product.entity_id, // Keep entity_id reference
    creator: {
      id: creator.id,
      full_name: creator.full_name,
      email: creator.email,
      is_content_creator: !!creator.content_creator_agreement_sign_date
    },
    purchase: purchase ? purchase.toJSON() : null
  };

  // Add game details if calculated
  if (gameDetails) {
    response.game_details = gameDetails;
  }

  // Add preview metadata for lesson plan products
  if (product.product_type === 'lesson_plan' && entity) {
    response.preview_info = {
      allow_slide_preview: entity.allow_slide_preview || false,
      accessible_slides: entity.accessible_slides || null,
      total_slides: entity.total_slides || 0,
      watermark_template_id: entity.watermark_template_id || null,
      has_preview_restrictions: entity.allow_slide_preview && entity.accessible_slides && entity.accessible_slides.length > 0
    };
  }

  return response;
}

// GET /entities/products/list - Get all products with full details and filtering
router.get('/products/list', optionalAuth, async (req, res) => {
  try {
    const {
      product_type,
      category,
      is_published,
      limit,
      offset,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Build where clause
    const where = {};
    if (product_type) where.product_type = product_type;
    if (category) where.category = category;
    if (is_published !== undefined) where.is_published = is_published === 'true';

    // Build order clause
    const validSortFields = ['created_at', 'updated_at', 'price', 'title', 'downloads_count'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get user ID from auth if available
    const userId = req.user?.id || null;

    // PERFORMANCE OPTIMIZATION: Use eager loading for creator to reduce N+1 queries
    const options = {
      where,
      order: [[sortField, sortDirection]],
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email', 'content_creator_agreement_sign_date'],
          required: false
        }
      ]
    };

    const products = await models.Product.findAll(options);

    // Optimize purchase queries by batching if user is authenticated
    const purchasesByProduct = {};
    if (userId && products.length > 0) {
      const productIds = products.map(p => p.id);
      const purchases = await models.Purchase.findAll({
        where: {
          buyer_user_id: userId,
          product_id: productIds,
          payment_status: ['completed', 'pending', 'cart']
        },
        attributes: ['id', 'product_id', 'payment_status', 'access_expires_at', 'created_at'],
        order: [['created_at', 'DESC']]
      });

      // Group purchases by product_id
      purchases.forEach(purchase => {
        if (!purchasesByProduct[purchase.product_id]) {
          purchasesByProduct[purchase.product_id] = purchase;
        }
      });
    }

    // Optimize entity queries by grouping by type
    const entitiesByType = {};
    products.forEach(product => {
      if (product.entity_id && product.product_type) {
        if (!entitiesByType[product.product_type]) {
          entitiesByType[product.product_type] = [];
        }
        entitiesByType[product.product_type].push(product.entity_id);
      }
    });

    // Batch load entities by type
    const entityDataMap = {};
    for (const [productType, entityIds] of Object.entries(entitiesByType)) {
      try {
        const entityModel = ProductServiceRouter.getModel(productType);
        const entities = await entityModel.findAll({
          where: { id: entityIds }
        });
        entities.forEach(entity => {
          entityDataMap[entity.id] = entity.toJSON();
        });
      } catch (error) {
        // Continue without this entity type
      }
    }

    // Process products with loaded data
    const fullProducts = products.map(product => {
      const productData = product.toJSON();

      // Get entity data from batch loaded entities
      let entityData = {};
      if (product.entity_id && entityDataMap[product.entity_id]) {
        entityData = entityDataMap[product.entity_id];
        delete entityData.id; // Remove entity id to avoid conflict
      }

      // Use creator from eager loaded data
      const creator = productData.creator || {
        id: null,
        full_name: 'Ludora',
        email: null,
        content_creator_agreement_sign_date: null
      };

      // Get purchase from batch loaded purchases
      const purchase = purchasesByProduct[product.id] || null;

      return {
        ...productData,
        ...entityData,
        id: productData.id, // Ensure product ID is preserved
        entity_id: product.entity_id,
        creator: {
          id: creator.id,
          full_name: creator.full_name,
          email: creator.email,
          is_content_creator: !!creator.content_creator_agreement_sign_date
        },
        purchase: purchase ? purchase.toJSON() : null
      };
    });

    // Enrich products with access control information
    const enrichedProducts = await AccessControlIntegrator.enrichProductsWithAccess(fullProducts, userId);

    res.json(enrichedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/product/:id/details - Get product with full details (Product + Entity + Creator)
// This MUST be before generic /:type/:id route to match correctly
// Optional query parameter: ?includeGameDetails=true
router.get('/product/:id/details', optionalAuth, async (req, res) => {
  const productId = req.params.id;
  const includeGameDetails = req.query.includeGameDetails === 'true';

  try {
    // Get the Product
    const product = await models.Product.findByPk(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get user ID from auth if available
    const userId = req.user?.id || null;

    const fullProduct = await getFullProduct(product, userId, includeGameDetails);

    // Enrich product with access control information
    const enrichedProduct = await AccessControlIntegrator.enrichProductWithAccess(fullProduct, userId);

    res.json(enrichedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate unique invitation code
function generateInvitationCode() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Exclude 0 and O to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /entities/user/:id/generate-invitation-code - Generate invitation code for teacher
// MUST be before generic /:type routes to match correctly
router.post('/user/:id/generate-invitation-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id;

    // Get requesting user information
    const requestingUser = await models.User.findOne({ where: { id: requestingUserId } });
    if (!requestingUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is trying to generate code for themselves or if admin
    if (userId !== requestingUserId && requestingUser.role !== 'admin' && requestingUser.role !== 'sysadmin') {
      return res.status(403).json({ error: 'You can only generate invitation codes for yourself' });
    }

    // Get the target user
    const targetUser = await models.User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can have invitation codes
    if (targetUser.user_type !== 'teacher') {
      return res.status(400).json({
        error: 'Only teachers can have invitation codes',
        current_user_type: targetUser.user_type
      });
    }

    // Generate unique invitation code
    let invitationCode;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      invitationCode = generateInvitationCode();
      attempts++;

      // Check if code already exists
      const existingUser = await models.User.findOne({
        where: { invitation_code: invitationCode }
      });

      if (!existingUser) break;

      if (attempts >= maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique invitation code' });
      }
    } while (attempts < maxAttempts);

    // Update user with new invitation code
    const updatedUser = await targetUser.update({
      invitation_code: invitationCode
    });

    res.json({
      message: 'Invitation code generated successfully',
      user: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        invitation_code: updatedUser.invitation_code
      },
      catalog_url: `my.ludora.app/portal/${invitationCode}`
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate invitation code',
      message: error.message
    });
  }
});

// GET /entities/curriculum/available-combinations - Get available subject-grade combinations that have curriculum items
// MUST be before generic /:type route to match correctly
router.get('/curriculum/available-combinations', optionalAuth, async (_req, res) => {
  try {

    // Single optimized query to get all curricula with their items count
    const query = `
      SELECT
        c.subject,
        c.grade,
        c.grade_from,
        c.grade_to,
        c.is_grade_range,
        COUNT(ci.id) as item_count
      FROM curriculum c
      LEFT JOIN curriculum_item ci ON c.id = ci.curriculum_id
      WHERE c.teacher_user_id IS NULL
        AND c.class_id IS NULL
        AND c.is_active = true
      GROUP BY c.id, c.subject, c.grade, c.grade_from, c.grade_to, c.is_grade_range
      HAVING COUNT(ci.id) > 0
    `;

    const results = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    // Process results to create a lightweight mapping
    const combinations = {};

    results.forEach(curriculum => {
      const subject = curriculum.subject;

      // Initialize subject array if it doesn't exist
      if (!combinations[subject]) {
        combinations[subject] = [];
      }

      if (curriculum.is_grade_range && curriculum.grade_from && curriculum.grade_to) {
        // Add all grades in the range
        for (let grade = curriculum.grade_from; grade <= curriculum.grade_to; grade++) {
          if (!combinations[subject].includes(grade)) {
            combinations[subject].push(grade);
          }
        }
      } else {
        // Single grade curriculum
        const grade = curriculum.grade || curriculum.grade_from || curriculum.grade_to;
        if (grade && !combinations[subject].includes(grade)) {
          combinations[subject].push(grade);
        }
      }
    });

    // Sort grades within each subject
    Object.keys(combinations).forEach(subject => {
      combinations[subject].sort((a, b) => a - b);
    });

    res.json({
      combinations,
      total_subjects: Object.keys(combinations).length,
      total_combinations: Object.values(combinations).reduce((sum, grades) => sum + grades.length, 0)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic CRUD routes for all entities
// GET /entities/:type - Find entities with query params
router.get('/:type', optionalAuth, customValidators.validateEntityType, validateQuery(schemas.entityQuery), async (req, res) => {
  const entityType = req.params.type;

  try {
    const { limit, offset, ...query } = req.query;
    const options = {};

    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    // For curriculum entity, filter based on user role and handle type conversions
    if (entityType === 'curriculum') {
      // Non-admin users should only see active curricula
      const user = req.user ? await models.User.findOne({ where: { id: req.user.id } }) : null;
      const isAdmin = user && (user.role === 'admin' || user.role === 'sysadmin');

      if (!isAdmin) {
        // Add is_active=true filter for non-admin users
        query.is_active = true;
      }

      // Handle type conversions for curriculum query parameters
      if (query.grade !== undefined) {
        query.grade = parseInt(query.grade);
      }
      if (query.grade_from !== undefined) {
        query.grade_from = parseInt(query.grade_from);
      }
      if (query.grade_to !== undefined) {
        query.grade_to = parseInt(query.grade_to);
      }
      if (query.is_grade_range !== undefined) {
        query.is_grade_range = query.is_grade_range === 'true' || query.is_grade_range === true;
      }
      if (query.is_active !== undefined) {
        query.is_active = query.is_active === 'true' || query.is_active === true;
      }
      if (query.teacher_user_id === 'null') {
        query.teacher_user_id = null;
      }
      if (query.class_id === 'null') {
        query.class_id = null;
      }

      // Special handling for grade range queries
      if (query.find_by_grade && !isNaN(parseInt(query.find_by_grade))) {
        const targetGrade = parseInt(query.find_by_grade);
        // Remove the helper parameter from the query
        delete query.find_by_grade;

        // Use the model's method for finding by grade (Sequelize is already imported)
        const results = await models.Curriculum.findByGradeAndSubject(targetGrade, query.subject || '', {
          where: {
            teacher_user_id: query.teacher_user_id,
            class_id: query.class_id,
            is_active: query.is_active
          },
          limit: options.limit,
          offset: options.offset
        });

        return res.json(results);
      } else {
      }
    }

    // For file entity, filter out asset-only files by default
    if (entityType === 'file') {
      // Check if include_assets parameter is explicitly set to true
      const includeAssets = query.include_assets === 'true' || query.include_assets === true;

      // Remove include_assets from query as it's not a database field
      delete query.include_assets;

      // By default, exclude asset-only files (show only potential products)
      if (!includeAssets) {
        query.is_asset_only = false;
      }

      // Handle type conversions for file query parameters
      if (query.is_asset_only !== undefined) {
        query.is_asset_only = query.is_asset_only === 'true' || query.is_asset_only === true;
      }
      if (query.allow_preview !== undefined) {
        query.allow_preview = query.allow_preview === 'true' || query.allow_preview === true;
      }
      if (query.add_branding !== undefined) {
        query.add_branding = query.add_branding === 'true' || query.add_branding === true;
      }
      // Legacy support for old column name
      if (query.add_copyrights_footer !== undefined) {
        query.add_branding = query.add_copyrights_footer === 'true' || query.add_copyrights_footer === true;
        delete query.add_copyrights_footer;
      }
    }

    // For Settings entity, use SettingsService to get properly transformed object with enhancements
    if (entityType === 'settings') {
      try {
        // Get settings object from SettingsService (built from key-value records)
        const settingsObject = await SettingsService.getSettings();

        // Enhance with same static config as Configuration
        const enhancedSettings = {
          ...settingsObject,
          file_types_config: getFileTypesForFrontend(),
          study_subjects: STUDY_SUBJECTS,
          audiance_targets: AUDIANCE_TARGETS,
          school_grades: SCHOOL_GRADES,
          game_types: GAME_TYPES,
          languade_options: LANGUAGES_OPTIONS
        };

        // Return as array to match frontend expectations
        return res.json([enhancedSettings]);
      } catch (error) {
        return res.status(500).json({ error: `Settings service error: ${error.message}` });
      }
    }

    // Route to appropriate service based on entity type
    const results = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.find(entityType, query, options)
      : await EntityService.find(entityType, query, options);

    // Enrich product types with access control information
    if (ALL_PRODUCT_TYPES.includes(entityType)) {
      const userId = req.user?.id || null;
      const enrichedResults = await AccessControlIntegrator.enrichProductsWithAccess(results, userId);
      return res.json(enrichedResults);
    }

    res.json(results);
  } catch (error) {
    luderror.api('[ENTITIES-FIND] Failed to find entities', {
      entityType,
      query: req.query,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/:type/:id - Find entity by ID
// Apply ETag support conditionally for user entities
router.get('/:type/:id',
  optionalAuth,
  customValidators.validateEntityType,
  // Conditionally apply ETag middleware for user entities
  (req, res, next) => {
    if (req.params.type === 'user') {
      return addETagSupport('user')(req, res, next);
    }
    next();
  },
  async (req, res) => {
  const entityType = req.params.type;
  const id = req.params.id;

  try {
    const include = req.query.include;
    // Route to appropriate service based on entity type
    const entity = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.findById(entityType, id, include)
      : await EntityService.findById(entityType, id, include);

    // Enrich product types with access control information
    if (ALL_PRODUCT_TYPES.includes(entityType)) {
      const userId = req.user?.id || null;
      const enrichedEntity = await AccessControlIntegrator.enrichProductWithAccess(entity, userId);
      return res.json(enrichedEntity);
    }

    res.json(entity);
  } catch (error) {
    const isNotFound = error.message.includes('not found');

    if (isNotFound) {
      ludlog.api('[ENTITIES-FIND-BY-ID] Entity not found', {
        entityType,
        entityId: id,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
        serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
      });
      return res.status(404).json({ error: error.message });
    }

    luderror.api('[ENTITIES-FIND-BY-ID] Failed to find entity by ID', {
      entityType,
      entityId: id,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/:type - Create new entity
router.post('/:type', authenticateToken, customValidators.validateEntityType, (req, res, next) => {
  // Use entity-specific validation schemas when available
  const entityType = req.params.type;
  let validationSchema;
  
  switch (entityType) {
    case 'workshop':
      validationSchema = schemas.workshopCreate;
      break;
    case 'game':
      validationSchema = schemas.gameCreate;
      break;
    default:
      validationSchema = schemas.entityCreate;
  }
  
  return validateBody(validationSchema)(req, res, next);
}, async (req, res) => {
  const entityType = req.params.type;

  try {
    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check content creator permissions (except for curriculum-related entities which are admin-only)
    const curriculumEntities = ['curriculum', 'curriculumitem', 'curriculumproduct'];
    if (!curriculumEntities.includes(entityType)) {
      const permissionCheck = await checkContentCreatorPermissions(user, entityType, req.body);
      if (!permissionCheck.allowed) {
        return res.status(403).json({ error: permissionCheck.message });
      }
    }

    // Determine creator_user_id based on is_ludora_creator flag (admin-only)
    let createdBy = req.user.id;

    // Only admins and sysadmins can create products without creator (Ludora products)
    if (req.body.is_ludora_creator === true) {
      if (user.role === 'admin' || user.role === 'sysadmin') {
        createdBy = null; // Don't set creator_user_id - will default to Ludora
      }
      // If non-admin tries to set is_ludora_creator, ignore it and use their ID
    }

    // Route to appropriate service based on entity type
    const entity = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.create(entityType, req.body, createdBy)
      : await EntityService.create(entityType, req.body, createdBy);
    res.status(201).json(entity);
  } catch (error) {
    // Determine error type for better categorization
    const isValidationError = error.message.includes('validation') || error.message.includes('invalid') || error.message.includes('required');
    const isPermissionError = error.message.includes('permission') || error.message.includes('access') || error.message.includes('allowed');

    luderror.api('[ENTITIES-CREATE] Failed to create entity', {
      entityType,
      requestBody: req.body,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      errorType: isValidationError ? 'validation' : isPermissionError ? 'permission' : 'unknown',
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// Helper function to sanitize numeric and enum fields
function sanitizeNumericFields(data, entityType) {
  const sanitizedData = { ...data };

  // Common numeric fields that should be null instead of empty string
  const numericFields = {
    product: ['access_days', 'marketing_video_duration', 'total_duration_minutes'],
    lessonplan: ['estimated_duration', 'total_slides'],
    workshop: ['duration_minutes', 'max_participants'],
    course: ['total_modules', 'estimated_duration'],
    file: ['file_size'],
    // Add more as needed
  };

  // ENUM fields that should be null instead of empty string
  const enumFields = {
    product: ['marketing_video_type'],
    // Add more as needed
  };

  const numericFieldsToSanitize = numericFields[entityType] || [];
  const enumFieldsToSanitize = enumFields[entityType] || [];

  // Handle numeric fields
  numericFieldsToSanitize.forEach(field => {
    if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
      sanitizedData[field] = null;
    } else if (sanitizedData[field] !== null && !isNaN(sanitizedData[field])) {
      // Convert string numbers to proper numbers
      sanitizedData[field] = Number(sanitizedData[field]);
    }
  });

  // Handle enum fields
  enumFieldsToSanitize.forEach(field => {
    if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
      sanitizedData[field] = null;
    }
  });

  return sanitizedData;
}

// PUT /entities/:type/:id - Update entity
router.put('/:type/:id', authenticateToken, customValidators.validateEntityType, (req, res, next) => {
  // Use entity-specific validation schemas when available
  const entityType = req.params.type;
  let validationSchema;

  switch (entityType) {
    case 'workshop':
      validationSchema = schemas.workshopUpdate;
      break;
    case 'game':
      validationSchema = schemas.gameUpdate;
      break;
    default:
      validationSchema = schemas.entityUpdate;
  }

  return validateBody(validationSchema)(req, res, next);
}, async (req, res) => {
  const entityType = req.params.type;
  const id = req.params.id;

  try {
    // Sanitize numeric fields before processing
    req.body = sanitizeNumericFields(req.body, entityType);
    // Handle legacy field name mappings for settings
    if (entityType === 'settings') {
      // Map legacy field name to new field name
      if (req.body.copyright_footer_text !== undefined) {
        req.body.copyright_text = req.body.copyright_footer_text;
        delete req.body.copyright_footer_text;
      }

      // Special handling for settings updates - use SettingsService instead of EntityService
      try {
        // Get user information to verify admin access
        const user = await models.User.findOne({ where: { id: req.user.id } });
        if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
          return res.status(403).json({ error: 'Only admins can update settings' });
        }

        // Call SettingsService.updateSettings() instead of EntityService
        const updatedSettings = await SettingsService.updateSettings(req.body);

        // Return settings object with enhancements (like GET does)
        const enhancedSettings = {
          ...updatedSettings,
          file_types_config: getFileTypesForFrontend(),
          study_subjects: STUDY_SUBJECTS,
          audiance_targets: AUDIANCE_TARGETS,
          school_grades: SCHOOL_GRADES,
          game_types: GAME_TYPES,
          languade_options: LANGUAGES_OPTIONS
        };

        return res.json(enhancedSettings);
      } catch (error) {
        luderror.api('Settings update error:', error);
        return res.status(400).json({ error: error.message });
      }
    }

    // Special handling for product updates
    if (entityType === 'product') {

      // Handle is_ludora_creator flag (transform to creator_user_id)
      if (req.body.hasOwnProperty('is_ludora_creator')) {
        const user = await models.User.findOne({ where: { id: req.user.id } });

        if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
          // Non-admin trying to change Ludora creator status - ignore it
          delete req.body.is_ludora_creator;
        } else {
          // Admin user - transform is_ludora_creator to creator_user_id
          req.body.creator_user_id = req.body.is_ludora_creator ? null : req.user.id;
          delete req.body.is_ludora_creator; // Remove the flag after transformation
        }
      }

      // Only allow admins to change creator_user_id directly
      if (req.body.hasOwnProperty('creator_user_id')) {
        const user = await models.User.findOne({ where: { id: req.user.id } });

        if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
          // Non-admin trying to change creator_user_id - remove it from update
          delete req.body.creator_user_id;
          // Non-admin user tried to change creator_user_id - ignored
        } else {
          // Admin user updating creator_user_id
        }
      }
    }

    // Route to appropriate service based on entity type
    const entity = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.update(entityType, id, req.body, req.user.id)
      : await EntityService.update(entityType, id, req.body, req.user.id);

    res.json(entity);
  } catch (error) {
    const isNotFound = error.message.includes('not found');
    const isValidationError = error.message.includes('validation') || error.message.includes('invalid') || error.message.includes('required');
    const isPermissionError = error.message.includes('permission') || error.message.includes('access') || error.message.includes('allowed');

    if (isNotFound) {
      ludlog.api('[ENTITIES-UPDATE] Entity not found for update', {
        entityType,
        entityId: id,
        requestBody: req.body,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
        serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
      });
      return res.status(404).json({ error: error.message });
    }

    luderror.api('[ENTITIES-UPDATE] Failed to update entity', {
      entityType,
      entityId: id,
      requestBody: req.body,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      errorType: isValidationError ? 'validation' : isPermissionError ? 'permission' : 'unknown',
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /entities/:type/:id - Delete entity
router.delete('/:type/:id', authenticateToken, customValidators.validateEntityType, async (req, res) => {
  const entityType = req.params.type;
  const id = req.params.id;
  
  try {
    // Route to appropriate service based on entity type
    const result = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.delete(entityType, id)
      : await EntityService.delete(entityType, id);
    res.json({ message: 'Entity deleted successfully', ...result });
  } catch (error) {
    const isNotFound = error.message.includes('not found');
    const isPermissionError = error.message.includes('permission') || error.message.includes('access') || error.message.includes('allowed');

    if (isNotFound) {
      ludlog.api('[ENTITIES-DELETE] Entity not found for deletion', {
        entityType,
        entityId: id,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
        serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
      });
      return res.status(404).json({ error: error.message });
    }

    luderror.api('[ENTITIES-DELETE] Failed to delete entity', {
      entityType,
      entityId: id,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      errorType: isPermissionError ? 'permission' : 'unknown',
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/:type/bulk - Bulk operations
router.post('/:type/bulk', authenticateToken, customValidators.validateEntityType, validateBody(schemas.bulkOperation), async (req, res) => {
  const entityType = req.params.type;
  const { operation, data } = req.body;
  
  try {
    let results = [];
    
    switch (operation) {
      case 'create':
        // Route to appropriate service based on entity type
        results = ProductServiceRouter.isDomainManaged(entityType)
          ? await ProductServiceRouter.bulkCreate(entityType, data, req.user.id)
          : await EntityService.bulkCreate(entityType, data, req.user.id);
        break;
        
      case 'delete':
        // Route to appropriate service based on entity type
        const deleteResult = ProductServiceRouter.isDomainManaged(entityType)
          ? await ProductServiceRouter.bulkDelete(entityType, data)
          : await EntityService.bulkDelete(entityType, data);
        results = data.map(id => ({
          id,
          deleted: deleteResult.ids.includes(id),
          error: deleteResult.ids.includes(id) ? null : 'Not found'
        }));
        break;
        
      default:
        return res.status(400).json({ error: 'Unsupported bulk operation' });
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    luderror.api('[ENTITIES-BULK] Failed to execute bulk operation', {
      entityType,
      operation: req.body.operation,
      dataLength: req.body.data ? req.body.data.length : 0,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/:type/count - Count entities with optional filtering
router.get('/:type/count', optionalAuth, customValidators.validateEntityType, async (req, res) => {
  const entityType = req.params.type;
  
  try {
    // Route to appropriate service based on entity type
    const count = ProductServiceRouter.isDomainManaged(entityType)
      ? await ProductServiceRouter.count(entityType, req.query)
      : await EntityService.count(entityType, req.query);
    res.json({ count });
  } catch (error) {
    luderror.api('[ENTITIES-COUNT] Failed to count entities', {
      entityType,
      query: req.query,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error.message,
      stack: error.stack,
      isDomainManaged: ProductServiceRouter.isDomainManaged(entityType),
      serviceUsed: ProductServiceRouter.isDomainManaged(entityType) ? 'ProductServiceRouter' : 'EntityService'
    });
    res.status(500).json({ error: error.message });
  }
});

// GET /entities - List all available entity types
router.get('/', optionalAuth, (_req, res) => {
  // Combine product entity types and non-product entity types
  const productTypes = ProductServiceRouter.getAvailableEntityTypes();
  const nonProductTypes = EntityService.getAvailableEntityTypes();
  const allEntityTypes = [...productTypes, ...nonProductTypes];
  res.json({ entityTypes: allEntityTypes, count: allEntityTypes.length });
});

// GET /entities/purchase/check-product-purchases/:productId - Check if product has completed non-free purchases
router.get('/purchase/check-product-purchases/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get the product to check if it's free
    const product = await models.Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for completed purchases where product is not free
    const purchases = await models.Purchase.findAll({
      where: {
        product_id: productId,
        status: 'completed'
      }
    });

    // Filter out free products
    const nonFreePurchases = purchases.filter(() => product.price > 0);

    res.json({
      hasNonFreePurchases: nonFreePurchases.length > 0,
      purchaseCount: nonFreePurchases.length,
      isFree: product.price === 0 || product.is_free === true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/curriculum/create-range - Create a new grade range curriculum
router.post('/curriculum/create-range', authenticateToken, validateBody(
  Joi.object({
    subject: Joi.string().required(),
    grade_from: Joi.number().integer().min(1).max(12).required(),
    grade_to: Joi.number().integer().min(1).max(12).required(),
    description: Joi.string().allow('').optional()
  })
), async (req, res) => {
  try {
    const { subject, grade_from, grade_to, description } = req.body;
    const userId = req.user.id;

    // Get user information
    const user = await models.User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Only admins can create system curricula
    if (user.role !== 'admin' && user.role !== 'sysadmin') {
      return res.status(403).json({ error: 'Only admins can create system curricula' });
    }

    // Validate grade range
    if (grade_from > grade_to) {
      return res.status(400).json({ error: 'grade_from must be less than or equal to grade_to' });
    }

    // Check for existing curriculum with overlapping grade range
    // Use Sequelize operators from the models instance
    const { Op } = models.Sequelize;

    const existingCurriculum = await models.Curriculum.findOne({
      where: {
        subject: subject,
        teacher_user_id: null,
        class_id: null,
        is_active: true,
        [Op.or]: [
          // Check for overlapping grade ranges
          {
            [Op.and]: [
              { grade_from: { [Op.lte]: grade_to } },
              { grade_to: { [Op.gte]: grade_from } },
              { is_grade_range: true }
            ]
          },
          // Check for single grade curricula within this range
          {
            grade: { [Op.between]: [grade_from, grade_to] },
            is_grade_range: false
          }
        ]
      }
    });

    if (existingCurriculum) {
      return res.status(409).json({
        error: 'A curriculum already exists that overlaps with this grade range',
        existing: {
          id: existingCurriculum.id,
          gradeRange: existingCurriculum.is_grade_range ?
            `${existingCurriculum.grade_from}-${existingCurriculum.grade_to}` :
            existingCurriculum.grade.toString()
        }
      });
    }

    // Generate new curriculum

    const curriculumData = {
      id: generateId(),
      subject: subject,
      grade: grade_from, // Set to first grade in range to satisfy NOT NULL constraint
      grade_from: grade_from,
      grade_to: grade_to,
      is_grade_range: true,
      teacher_user_id: null, // System curriculum
      class_id: null, // System curriculum
      is_active: true,
      description: description
    };

    const curriculum = await models.Curriculum.create(curriculumData);

    // Create default curriculum items based on the subject
    const defaultTopics = getDefaultStudyTopicsForSubject(subject, grade_from, grade_to);
    const createdItems = [];

    for (let i = 0; i < defaultTopics.length; i++) {
      const topicData = defaultTopics[i];
      const itemData = {
        id: generateId(),
        curriculum_id: curriculum.id,
        study_topic: topicData.topic,
        is_mandatory: topicData.is_mandatory || true,
        mandatory_order: i + 1,
        description: topicData.description || null,
        is_completed: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      const curriculumItem = await models.CurriculumItem.create(itemData);
      createdItems.push(curriculumItem);
    }

    res.status(201).json({
      message: 'Grade range curriculum created successfully',
      curriculum: curriculum,
      curriculum_items: createdItems,
      items_count: createdItems.length,
      grade_range: `${grade_from}-${grade_to}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/curriculum/copy-to-class - Copy system curriculum to a specific class
router.post('/curriculum/copy-to-class', authenticateToken, validateBody(schemas.copyCurriculumToClass || {
  type: 'object',
  required: ['systemCurriculumId', 'classId'],
  properties: {
    systemCurriculumId: { type: 'string' },
    classId: { type: 'string' }
  }
}), async (req, res) => {
  try {
    const { systemCurriculumId, classId } = req.body;
    const userId = req.user.id;

    // Get user information and verify they're a teacher
    const user = await models.User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get the classroom and verify ownership
    const classroom = await models.Classroom.findByPk(classId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Verify the user owns this classroom (unless admin)
    if (user.role !== 'admin' && user.role !== 'sysadmin' && classroom.teacher_id !== userId) {
      return res.status(403).json({ error: 'You can only copy curricula to your own classrooms' });
    }

    // Get the system curriculum
    const systemCurriculum = await models.Curriculum.findByPk(systemCurriculumId);
    if (!systemCurriculum) {
      return res.status(404).json({ error: 'System curriculum not found' });
    }

    // Verify it's actually a system curriculum (not already assigned to a class)
    if (systemCurriculum.teacher_user_id !== null || systemCurriculum.class_id !== null) {
      return res.status(400).json({ error: 'Can only copy system curricula (not class-specific ones)' });
    }

    // Check if a curriculum already exists for this class/subject/grade combination
    // Need to handle both legacy grade field and new grade range fields
    let existingWhere = {
      class_id: classId,
      subject: systemCurriculum.subject
    };

    if (systemCurriculum.is_grade_range && systemCurriculum.grade_from && systemCurriculum.grade_to) {
      // For grade range curricula, check for overlapping ranges
      existingWhere = {
        ...existingWhere,
        grade_from: systemCurriculum.grade_from,
        grade_to: systemCurriculum.grade_to,
        is_grade_range: true
      };
    } else {
      // For legacy single grade curricula
      existingWhere.grade = systemCurriculum.grade;
    }

    const existingCurriculum = await models.Curriculum.findOne({
      where: existingWhere
    });

    if (existingCurriculum) {
      return res.status(409).json({ error: 'A curriculum already exists for this class and subject/grade combination' });
    }

    // Generate new ID for the class curriculum

    // Copy the curriculum including grade range fields
    const classCurriculumData = {
      id: generateId(),
      subject: systemCurriculum.subject,
      grade: systemCurriculum.grade, // Keep legacy field for backwards compatibility
      grade_from: systemCurriculum.grade_from,
      grade_to: systemCurriculum.grade_to,
      is_grade_range: systemCurriculum.is_grade_range,
      teacher_user_id: userId,
      class_id: classId,
      original_curriculum_id: systemCurriculumId, // Track which system curriculum this was copied from
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const classCurriculum = await models.Curriculum.create(classCurriculumData);

    // Get all curriculum items from the system curriculum with their content topics
    const systemItems = await models.CurriculumItem.findAll({
      where: { curriculum_id: systemCurriculumId },
      include: [
        {
          model: models.ContentTopic,
          as: 'contentTopics',
          through: {
            attributes: []
          }
        }
      ],
      order: [['mandatory_order', 'ASC'], ['custom_order', 'ASC']]
    });

    // Copy all curriculum items and their content topic associations
    const copiedItems = [];
    for (const item of systemItems) {
      const itemData = {
        id: generateId(),
        curriculum_id: classCurriculum.id,
        study_topic: item.study_topic,
        is_mandatory: item.is_mandatory,
        mandatory_order: item.mandatory_order,
        custom_order: item.custom_order,
        description: item.description,
        is_completed: false, // Start as not completed for class tracking
        created_at: new Date(),
        updated_at: new Date()
      };

      const copiedItem = await models.CurriculumItem.create(itemData);

      // Copy content topic associations
      if (item.contentTopics && item.contentTopics.length > 0) {
        for (const contentTopic of item.contentTopics) {
          await models.CurriculumItemContentTopic.create({
            id: generateId(),
            curriculum_item_id: copiedItem.id,
            content_topic_id: contentTopic.id,
            created_at: new Date()
          });
        }
      }

      copiedItems.push(copiedItem);
    }

    res.status(201).json({
      message: 'Curriculum copied successfully to class',
      curriculum: classCurriculum,
      items: copiedItems,
      copiedItemsCount: copiedItems.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /entities/curriculum/:id/cascade-update - Update curriculum and all its copies
router.put('/curriculum/:id/cascade-update', authenticateToken, validateBody(
  Joi.object({
    is_active: Joi.boolean().required()
  })
), async (req, res) => {
  try {
    const curriculumId = req.params.id;
    const { is_active } = req.body;
    const userId = req.user.id;

    // Get user information
    const user = await models.User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Only admins can perform cascade updates
    if (user.role !== 'admin' && user.role !== 'sysadmin') {
      return res.status(403).json({ error: 'Only admins can perform cascade updates' });
    }

    // Get the curriculum
    const curriculum = await models.Curriculum.findByPk(curriculumId);
    if (!curriculum) {
      return res.status(404).json({ error: 'Curriculum not found' });
    }

    // Only system curricula can have cascade updates
    if (curriculum.teacher_user_id !== null || curriculum.class_id !== null) {
      return res.status(400).json({ error: 'Can only perform cascade updates on system curricula' });
    }

    // Update the main curriculum
    const updatedCurriculum = await curriculum.update({ is_active });

    // Find all copies and update them
    const copies = await models.Curriculum.findAll({
      where: {
        original_curriculum_id: curriculumId
      },
      include: [
        {
          model: models.Classroom,
          as: 'classroom',
          attributes: ['id', 'name', 'grade_level', 'year']
        }
      ]
    });

    // Update all copies
    const updatedCopies = [];
    for (const copy of copies) {
      await copy.update({ is_active });
      updatedCopies.push({
        id: copy.id,
        classroomId: copy.class_id,
        classroomName: copy.classroom?.name || `כיתה ${copy.classroom?.grade_level}`,
        updated: true
      });
    }

    res.json({
      message: 'Curriculum and all copies updated successfully',
      curriculum: updatedCurriculum,
      copiesUpdated: updatedCopies.length,
      affectedClasses: updatedCopies
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/curriculum/:id/products - Get all products associated with a curriculum item
router.get('/curriculum/:id/products', optionalAuth, async (req, res) => {
  try {
    const curriculumItemId = req.params.id;
    const userId = req.user?.id || null;

    // Get the curriculum item to verify it exists
    const curriculumItem = await models.CurriculumItem.findByPk(curriculumItemId);
    if (!curriculumItem) {
      return res.status(404).json({ error: 'Curriculum item not found' });
    }

    // Get all curriculum_product relationships for this curriculum item
    const curriculumProducts = await models.CurriculumProduct.findAll({
      where: { curriculum_item_id: curriculumItemId }
    });

    // Get all associated products with full details
    const productIds = curriculumProducts.map(cp => cp.product_id);

    if (productIds.length === 0) {
      return res.json({
        curriculum_item: curriculumItem.toJSON(),
        products: [],
        total: 0,
        by_type: {}
      });
    }

    // Get products and their associated entities
    const products = await models.Product.findAll({
      where: { id: productIds }
    });

    // Get full product details with entities and purchase info
    const fullProducts = await Promise.all(
      products.map(product => getFullProduct(product, userId))
    );

    // Filter out any files that are asset-only (shouldn't appear in curriculum browsing)
    const browsableProducts = fullProducts.filter(product => {
      if (product.product_type === 'file') {
        return product.is_asset_only === false;
      }
      return true; // Include all non-file products
    });

    // Group products by type for easier frontend consumption
    const productsByType = browsableProducts.reduce((acc, product) => {
      const type = product.product_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(product);
      return acc;
    }, {});

    res.json({
      curriculum_item: curriculumItem.toJSON(),
      products: browsableProducts,
      total: browsableProducts.length,
      by_type: productsByType
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/curriculum/:id/copy-status - Check if a curriculum has been copied to classes
router.get('/curriculum/:id/copy-status', authenticateToken, async (req, res) => {
  try {
    const curriculumId = req.params.id;
    const userId = req.user.id;

    // Get user information
    const user = await models.User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get the curriculum to verify it's a system curriculum
    const curriculum = await models.Curriculum.findByPk(curriculumId);
    if (!curriculum) {
      return res.status(404).json({ error: 'Curriculum not found' });
    }

    // Only check for system curricula (not class-specific ones)
    if (curriculum.teacher_user_id !== null || curriculum.class_id !== null) {
      return res.status(400).json({ error: 'Can only check copy status for system curricula' });
    }

    // Check if this curriculum has been copied by any user (for admin) or by this user (for teachers)
    let whereClause = {
      original_curriculum_id: curriculumId,
      is_active: true
    };

    // If not admin, only show copies for this user's classes
    if (user.role !== 'admin' && user.role !== 'sysadmin') {
      whereClause.teacher_user_id = userId;
    }

    const copiedCurricula = await models.Curriculum.findAll({
      where: whereClause,
      include: [
        {
          model: models.Classroom,
          as: 'classroom',
          attributes: ['id', 'name', 'grade_level', 'year']
        }
      ]
    });

    // Get user's classrooms to check if they have any classes for association
    const userClassrooms = await models.Classroom.findAll({
      where: {
        teacher_id: userId,
        is_active: true
      }
    });

    res.json({
      curriculumId,
      hasCopies: copiedCurricula.length > 0,
      copiedCount: copiedCurricula.length,
      copiedToClasses: copiedCurricula.map(c => ({
        classroomId: c.class_id,
        classroomName: c.classroom?.name || `כיתה ${c.classroom?.grade_level}`,
        copiedAt: c.created_at
      })),
      userHasClassrooms: userClassrooms.length > 0,
      availableClassrooms: userClassrooms.map(c => ({
        id: c.id,
        name: c.name || `כיתה ${c.grade_level}`,
        gradeLevel: c.grade_level,
        year: c.year
      }))
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/lesson-plan/:lessonPlanId/upload-file - Atomic file upload for lesson plans
router.post('/lesson-plan/:lessonPlanId/upload-file', authenticateToken, fileUpload.single('file'), async (req, res) => {
  const lessonPlanId = req.params.lessonPlanId;
  const transaction = await sequelize.transaction();
  let uploadedS3Key = null;

  try {

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if lesson plan exists and get the product
    const product = await models.Product.findOne({
      where: {
        product_type: 'lesson_plan',
        entity_id: lessonPlanId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Lesson plan product not found' });
    }

    // Get file upload data from request
    const { file_role, description = '' } = req.body;
    if (!file_role || !['opening', 'body', 'audio', 'assets'].includes(file_role)) {
      return res.status(400).json({ error: 'Valid file_role is required (opening, body, audio, assets)' });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    let fileName = req.file.originalname;

    // Additional filename encoding fix for database storage (should be already fixed by fileFilter)
    // This is a backup check in case the fileFilter didn't catch it
    try {
      // If filename still looks corrupted, try to decode it properly
      if (fileName.includes('×') || fileName.includes('Ã')) {
        // Try to fix corrupted Hebrew encoding
        const fixedName = Buffer.from(fileName, 'latin1').toString('utf8');
        if (/[\u0590-\u05FF]/.test(fixedName)) {
          fileName = fixedName;
          luderror.api(`✅ Fixed Hebrew filename in upload handler: ${fileName}`);
        }
      }
    } catch (error) {
      luderror.api(`⚠️ Filename encoding fix failed in upload handler: ${error.message}`);
    }

    const fileExtension = fileName.split('.').pop().toLowerCase();
    const fileType = getFileTypeFromExtension(fileExtension);

    // TODO: SVG validation will be added here for new presentation upload system

    // Validate file type restrictions for audio role
    if (file_role === 'audio') {
      const allowedExtensions = ['mp3', 'wav', 'm4a'];
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({
          error: `Only audio files (.mp3, .wav, .m4a) are allowed for ${file_role} sections`,
          details: `Received file type: .${fileExtension}. Expected: ${allowedExtensions.join(', ')}`
        });
      }
    }

    // Generate ID for the File entity

    // 1. Create File entity within transaction
    const fileData = {
      id: generateId(),
      title: description || fileName,
      file_type: fileType,
      is_asset_only: true,
      allow_preview: false,
      add_branding: false,
      creator_user_id: req.user.id
    };

    const fileEntity = await models.File.create(fileData, { transaction });

    // 2. Upload file using unified asset upload method
    const uploadResult = await fileService.uploadAsset({
      file: req.file,
      entityType: 'file',
      entityId: fileEntity.id,
      assetType: 'document',
      userId: req.user.id,
      transaction: transaction,
      preserveOriginalName: true // Keep original filename for documents
    });

    if (!uploadResult.success) {
      throw new Error('File upload failed');
    }

    uploadedS3Key = uploadResult.s3Key;

    // Extract target_format from file analysis
    let targetFormat = 'unknown';
    if (uploadResult.analysis?.success && uploadResult.analysis?.contentMetadata?.target_format) {
      targetFormat = uploadResult.analysis.contentMetadata.target_format;
    } else {
      // PDF orientation detection failed, using default
    }

    // IMPORTANT: For SVG files uploaded to lesson plans, always set target_format to 'svg-lessonplan'
    if (fileExtension === 'svg') {
      targetFormat = 'svg-lessonplan';

    }

    // Update file entity with S3 information and detected target_format
    await fileEntity.update({
      file_name: fileName,
      file_size: req.file.size,
      target_format: targetFormat
    }, { transaction });

    // 3. TODO: SVG slide handling will be implemented here
    let slideCount = 0;

    // 4. Update lesson plan file_configs within same transaction
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
    if (!lessonPlan) {
      throw new Error('Lesson plan entity not found');
    }

    // Get current file configs
    const currentConfigs = lessonPlan.file_configs || { files: [] };

    // Check if opening/body sections already have a file (single file limit)
    if (file_role === 'opening' || file_role === 'body') {
      const existingFilesInRole = currentConfigs.files.filter(f => f.file_role === file_role);
      if (existingFilesInRole.length > 0) {
        // Check if this is a published lesson plan product - allow replacement for published products
        const lessonPlanProduct = await models.Product.findOne({
          where: {
            product_type: 'lesson_plan',
            entity_id: lessonPlanId
          }
        });

        if (!lessonPlanProduct || !lessonPlanProduct.is_published) {
          // For unpublished products, maintain strict single-file policy
          throw new Error(`Section "${file_role}" can only have one file. Remove existing file first.`);
        }

        // For published products, allow replacement by removing the existing file first

        // Remove the existing file from configs and delete the File entity if it's asset-only
        const existingFileConfig = existingFilesInRole[0];

        // Remove from current configs
        const indexToRemove = currentConfigs.files.findIndex(f => f.file_id === existingFileConfig.file_id);
        if (indexToRemove !== -1) {
          currentConfigs.files.splice(indexToRemove, 1);
        }

        // If it's an asset-only file, also delete the File entity
        if (existingFileConfig.is_asset_only) {
          try {
            const existingFileEntity = await models.File.findByPk(existingFileConfig.file_id, { transaction });
            if (existingFileEntity) {
              await existingFileEntity.destroy({ transaction });
            }
          } catch (deleteError) {
            // Continue with replacement even if deletion fails
          }
        }

      }
    }

    // Add new file config (use original Hebrew filename for display, storage key from upload result)
    const newFileConfig = {
      file_id: fileEntity.id,
      file_role: file_role,
      filename: fileName, // Keep original Hebrew filename for display
      file_type: fileType,
      upload_date: new Date().toISOString(),
      description: description || fileName,
      s3_key: uploadedS3Key, // Storage key from upload result
      storage_filename: uploadResult.filename, // Actual storage filename
      size: req.file.size,
      mime_type: req.file.mimetype || 'application/octet-stream',
      is_asset_only: true,
      slide_count: slideCount // Add slide count for PowerPoint files
    };

    currentConfigs.files.push(newFileConfig);

    // 5. TODO: SVG slide counting will be implemented here
    const newTotalSlides = currentConfigs.files.length; // Simple count for now

    // Update lesson plan with new file configs and total slides

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    // Update total_slides field if it has changed
    if (lessonPlan.total_slides !== newTotalSlides) {
      lessonPlan.total_slides = newTotalSlides;
    }

    await lessonPlan.save({ transaction });

    // Force reload to check if update actually persisted
    await lessonPlan.reload({ transaction });

    // Commit transaction - everything succeeded
    await transaction.commit();

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileEntity.id,
        filename: fileName, // Original Hebrew filename for display
        file_role: file_role,
        s3_key: uploadedS3Key, // Storage key
        storage_filename: uploadResult.filename, // Actual storage filename
        size: req.file.size,
        upload_date: newFileConfig.upload_date
      },
      file_config: newFileConfig, // Include the complete file config with slide count
      total_slides: newTotalSlides, // Include the updated total slides
      lesson_plan_id: lessonPlanId
    });

  } catch (error) {

    // Rollback database transaction
    await transaction.rollback();

    // Clean up S3 file if it was uploaded
    if (uploadedS3Key) {
      try {
        await fileService.deleteS3Object(uploadedS3Key);
      } catch (s3Error) {
      }
    }

    res.status(500).json({
      error: 'File upload failed',
      details: error.message
    });
  }
});

// POST /entities/lesson-plan/:lessonPlanId/link-file-product - Link existing File product to lesson plan
router.post('/lesson-plan/:lessonPlanId/link-file-product', authenticateToken, async (req, res) => {
  const lessonPlanId = req.params.lessonPlanId;
  const transaction = await sequelize.transaction();

  try {

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get request data
    const { product_id, file_role, filename, file_type } = req.body;

    if (!product_id || !file_role || !['opening', 'body', 'audio', 'assets'].includes(file_role)) {
      return res.status(400).json({
        error: 'Valid product_id and file_role are required',
        details: 'file_role must be one of: opening, body, audio, assets'
      });
    }

    // Check if lesson plan exists and get the product
    const lessonPlanProduct = await models.Product.findOne({
      where: {
        product_type: 'lesson_plan',
        entity_id: lessonPlanId
      }
    });

    if (!lessonPlanProduct) {
      return res.status(404).json({ error: 'Lesson plan product not found' });
    }

    // Get the File product to link
    const fileProduct = await models.Product.findByPk(product_id);
    if (!fileProduct) {
      return res.status(404).json({ error: 'File product not found' });
    }

    if (fileProduct.product_type !== 'file') {
      return res.status(400).json({ error: 'Product must be of type "file"' });
    }

    // Get the lesson plan entity
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
    if (!lessonPlan) {
      return res.status(404).json({ error: 'Lesson plan entity not found' });
    }

    // Get current file configs and ensure files array exists
    const currentConfigs = lessonPlan.file_configs || { files: [] };
    if (!currentConfigs.files) {
      currentConfigs.files = [];
    }

    // Check if opening/body sections already have a file (single file limit)
    if (file_role === 'opening' || file_role === 'body') {
      const existingFilesInRole = currentConfigs.files.filter(f => f.file_role === file_role);
      if (existingFilesInRole.length > 0) {
        // Check if this is a published lesson plan product - allow replacement for published products
        if (!lessonPlanProduct.is_published) {
          // For unpublished products, maintain strict single-file policy
          return res.status(409).json({
            error: `Section "${file_role}" can only have one file. Remove existing file first.`,
            existing_files: existingFilesInRole.map(f => ({
              file_id: f.file_id,
              filename: f.filename,
              is_asset_only: f.is_asset_only
            }))
          });
        }

        // For published products, allow replacement by removing the existing file first

        // Remove the existing file from configs (don't delete File entities when unlinking)
        const existingFileConfig = existingFilesInRole[0];

        // Remove from current configs
        const indexToRemove = currentConfigs.files.findIndex(f => f.file_id === existingFileConfig.file_id);
        if (indexToRemove !== -1) {
          currentConfigs.files.splice(indexToRemove, 1);
        }

        // If the existing file was asset-only, delete the File entity
        if (existingFileConfig.is_asset_only) {
          try {
            const existingFileEntity = await models.File.findByPk(existingFileConfig.file_id, { transaction });
            if (existingFileEntity) {
              await existingFileEntity.destroy({ transaction });
            }
          } catch (deleteError) {
            // Continue with replacement even if deletion fails
          }
        }

      }

      // For opening/body sections, only allow PPT File products
      const fileEntity = await models.File.findByPk(fileProduct.entity_id);
      if (fileEntity && fileEntity.file_type !== 'ppt') {
        return res.status(400).json({
          error: `Section "${file_role}" only accepts PowerPoint files. This File product is of type "${fileEntity.file_type}".`,
          file_type: fileEntity.file_type,
          required_type: 'ppt'
        });
      }
    }

    // Check if this File product is already linked
    const existingLink = currentConfigs.files.find(f =>
      f.file_id === fileProduct.entity_id && f.file_role === file_role
    );

    if (existingLink) {
      return res.status(409).json({
        error: 'File product is already linked to this lesson plan for this role',
        existing_link: existingLink
      });
    }

    // For PowerPoint file products in opening/body roles, detect slide counts
    let slideCount = 0;
    if ((file_role === 'opening' || file_role === 'body') && (file_type === 'ppt')) {
      const fileEntity = await models.File.findByPk(fileProduct.entity_id);
      if (fileEntity && fileEntity.file_name) {
        try {
          // For linked files, we need to download from S3 to count slides
          const fileBuffer = await fileService.downloadToBuffer(fileEntity.s3_key || fileEntity.file_name);
          slideCount = await countSlidesInPowerPoint(fileBuffer, fileEntity.file_name);
        } catch (slideError) {
          // Continue with slideCount = 0, don't fail the linking
        }
      }
    }

    // Create file config for the File product link
    const newFileConfig = {
      file_id: fileProduct.entity_id, // Use entity_id from the Product
      file_role: file_role,
      filename: filename || fileProduct.title,
      file_type: file_type || 'other',
      upload_date: new Date().toISOString(),
      description: fileProduct.title,
      is_asset_only: false, // This is a File product, not just an asset
      product_id: fileProduct.id, // Store the Product ID for reference
      slide_count: slideCount // Add slide count for PowerPoint files
    };

    // Add the new file config
    currentConfigs.files.push(newFileConfig);

    // Calculate total slides from opening and body files and update lesson plan
    const newTotalSlides = calculateTotalSlides(currentConfigs);

    // Update lesson plan with new file configs

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    // Update total_slides field if it has changed
    if (lessonPlan.total_slides !== newTotalSlides) {
      lessonPlan.total_slides = newTotalSlides;
    }

    const updateResult = await lessonPlan.save({ transaction });

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });

    // Commit transaction - everything succeeded
    await transaction.commit();

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);

    res.status(201).json({
      message: 'File product linked successfully',
      linked_file: {
        file_id: fileProduct.entity_id,
        product_id: fileProduct.id,
        filename: newFileConfig.filename,
        file_role: file_role,
        is_asset_only: false
      },
      lesson_plan_id: lessonPlanId,
      total_files: currentConfigs.files.length
    });

  } catch (error) {

    // Rollback database transaction
    await transaction.rollback();

    res.status(500).json({
      error: 'File product linking failed',
      details: error.message
    });
  }
});

// DELETE /entities/lesson-plan/:lessonPlanId/unlink-file-product/:fileId - Unlink File product from lesson plan
router.delete('/lesson-plan/:lessonPlanId/unlink-file-product/:fileId', authenticateToken, async (req, res) => {
  const lessonPlanId = req.params.lessonPlanId;
  const fileId = req.params.fileId;
  const transaction = await sequelize.transaction();

  try {

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if lesson plan exists and get the product
    const product = await models.Product.findOne({
      where: {
        product_type: 'lesson_plan',
        entity_id: lessonPlanId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Lesson plan product not found' });
    }

    // Get the lesson plan
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
    if (!lessonPlan) {
      return res.status(404).json({ error: 'Lesson plan not found' });
    }

    // Get current file configs
    const currentConfigs = lessonPlan.file_configs || { files: [] };

    // Find the file in the configs
    const fileIndex = currentConfigs.files.findIndex(f => f.file_id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'File not found in lesson plan' });
    }

    const fileConfig = currentConfigs.files[fileIndex];

    // Only allow unlinking File products (not asset-only files)
    if (fileConfig.is_asset_only === true) {
      return res.status(400).json({
        error: 'This endpoint is for unlinking File products only. Use the delete endpoint for asset-only files.',
        file_type: 'asset_only'
      });
    }

    // Remove file from lesson plan configs (the File product itself remains untouched)
    currentConfigs.files.splice(fileIndex, 1);

    // Update lesson plan with new file configs

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    const updateResult = await lessonPlan.save({ transaction });

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });

    // Commit transaction - everything succeeded
    await transaction.commit();

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);

    res.json({
      message: 'File product unlinked successfully',
      unlinked_file: {
        id: fileId,
        filename: fileConfig.filename,
        file_role: fileConfig.file_role,
        product_id: fileConfig.product_id
      },
      lesson_plan_id: lessonPlanId,
      remaining_files: currentConfigs.files.length
    });

  } catch (error) {

    // Rollback database transaction
    await transaction.rollback();

    res.status(500).json({
      error: 'File product unlinking failed',
      details: error.message
    });
  }
});

// DELETE /entities/lesson-plan/:lessonPlanId/file/:fileId - Delete file from lesson plan
router.delete('/lesson-plan/:lessonPlanId/file/:fileId', authenticateToken, async (req, res) => {
  const lessonPlanId = req.params.lessonPlanId;
  const fileId = req.params.fileId;
  const transaction = await sequelize.transaction();

  try {

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if lesson plan exists and get the product
    const product = await models.Product.findOne({
      where: {
        product_type: 'lesson_plan',
        entity_id: lessonPlanId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Lesson plan product not found' });
    }

    // Get the lesson plan
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId, { transaction });
    if (!lessonPlan) {
      return res.status(404).json({ error: 'Lesson plan not found' });
    }

    // Get current file configs
    const currentConfigs = lessonPlan.file_configs || { files: [] };

    // Find the file in the configs
    const fileIndex = currentConfigs.files.findIndex(f => f.file_id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'File not found in lesson plan' });
    }

    const fileConfig = currentConfigs.files[fileIndex];

    // 1. Get the File entity
    const fileEntity = await models.File.findByPk(fileId, { transaction });
    if (!fileEntity) {
    }

    // 2. Delete the File entity (this should also clean up S3 via hooks/triggers)
    if (fileEntity) {
      await fileEntity.destroy({ transaction });
    }

    // 3. Remove file from lesson plan configs
    currentConfigs.files.splice(fileIndex, 1);

    // 4. Update lesson plan with new file configs

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    const updateResult = await lessonPlan.save({ transaction });

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });

    // Commit transaction - everything succeeded
    await transaction.commit();

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);

    res.json({
      message: 'File deleted successfully',
      deleted_file: {
        id: fileId,
        filename: fileConfig.filename,
        file_role: fileConfig.file_role
      },
      lesson_plan_id: lessonPlanId,
      remaining_files: currentConfigs.files.length
    });

  } catch (error) {

    // Rollback database transaction
    await transaction.rollback();

    res.status(500).json({
      error: 'File deletion failed',
      details: error.message
    });
  }
});

// PUT /entities/user/:id/reset-onboarding - Reset user's onboarding completion status (admin only)
router.put('/user/:id/reset-onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id;

    // Get requesting user information
    const requestingUser = await models.User.findOne({ where: { id: requestingUserId } });
    if (!requestingUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Only admins can reset onboarding
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'sysadmin') {
      return res.status(403).json({ error: 'Only admins can reset user onboarding' });
    }

    // Prevent non-admins from resetting their own onboarding
    // Admins can reset their own onboarding for testing purposes
    if (userId === requestingUserId && requestingUser.role !== 'admin' && requestingUser.role !== 'sysadmin') {
      return res.status(400).json({ error: 'Cannot reset your own onboarding status' });
    }

    // Get the target user
    const targetUser = await models.User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Reset only the completion flag to allow re-testing onboarding while preserving data
    const updatedUser = await targetUser.update({
      onboarding_completed: false
      // Keep all existing user data: birth_date, user_type, education_level, phone, etc.
    });

    // Also clear any test subscription history to ensure clean testing
    try {
      await models.SubscriptionHistory.destroy({
        where: {
          user_id: userId,
          action_type: 'onboarding_selection'  // Only remove onboarding test selections
        }
      });
    } catch (subscriptionError) {
      // Could not clear subscription history - not critical
      // Don't fail the reset if subscription cleanup fails
    }

    res.json({
      message: 'User onboarding status reset successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        onboarding_completed: updatedUser.onboarding_completed
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/lesson-plan/:lessonPlanId/presentation - Get lesson plan presentation files with access control
router.get('/lesson-plan/:lessonPlanId/presentation', authenticateToken, async (req, res) => {
  try {
    const { lessonPlanId } = req.params;
    const userId = req.user.id;

    // Check user access to the lesson plan
    const hasAccess = await checkLessonPlanAccess(userId, lessonPlanId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You need to purchase this lesson plan to view the presentation',
        hasAccess: false
      });
    }

    // Get presentation files
    const presentationFiles = await getLessonPlanPresentationFiles(lessonPlanId);

    if (!presentationFiles.hasPresentation) {
      return res.status(404).json({
        error: 'No presentation found',
        message: 'This lesson plan does not have any presentation files',
        hasPresentation: false
      });
    }

    // Get ordered URLs for frontend consumption
    const orderedUrls = getOrderedPresentationUrls(presentationFiles);

    res.json({
      success: true,
      hasAccess: true,
      hasPresentation: true,
      lessonPlan: {
        id: lessonPlanId,
        title: presentationFiles.lessonPlan.title,
        description: presentationFiles.lessonPlan.description,
        totalSlides: presentationFiles.totalSlides
      },
      files: {
        opening: presentationFiles.opening,
        body: presentationFiles.body,
        totalSlides: presentationFiles.totalSlides
      },
      presentation: {
        urls: orderedUrls,
        totalFiles: orderedUrls.length,
        totalSlides: presentationFiles.totalSlides
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get presentation',
      message: error.message
    });
  }
});

export default router;