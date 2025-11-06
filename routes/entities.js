import express from 'express';
import multer from 'multer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import EntityService from '../services/EntityService.js';
import GameDetailsService from '../services/GameDetailsService.js';
import models from '../models/index.js';
import { sequelize } from '../models/index.js';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
import { extractCopyrightText, updateFooterTextContent } from '../utils/footerSettingsHelper.js';
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';
import fileService from '../services/FileService.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import { getLessonPlanPresentationFiles, checkLessonPlanAccess, getOrderedPresentationUrls } from '../utils/lessonPlanPresentationHelper.js';
import { countSlidesInPowerPoint, calculateTotalSlides } from '../utils/slideCountingUtils.js';
import { GAME_TYPES } from '../config/gameTypes.js';

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
  fileFilter: (req, file, cb) => {
    // Log original filename encoding issue
    console.log(`📤 Original filename from multer: "${file.originalname}"`);
    console.log(`📤 Filename buffer: ${Buffer.from(file.originalname, 'latin1').toString('utf8')}`);

    // Try to fix encoding if it's corrupted
    try {
      // If filename looks corrupted (contains replacement characters), try to fix it
      if (file.originalname.includes('�') || file.originalname.includes('×')) {
        const fixedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        file.originalname = fixedName;
        console.log(`📤 Fixed filename: "${fixedName}"`);
      }
    } catch (error) {
      console.log(`📤 Could not fix filename encoding: ${error.message}`);
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
      const settings = await models.Settings.findAll();
      if (!settings || settings.length === 0) {
        return { allowed: false, message: 'System settings not found' };
      }

      const currentSettings = settings[0];
      let permissionKey;

      if (entityType === 'file' || entityType === 'tool') {
        permissionKey = 'allow_content_creator_files';
      } else if (entityType === 'game') {
        permissionKey = 'allow_content_creator_games';
      } else {
        permissionKey = `allow_content_creator_${entityType}s`;
      }

      if (!currentSettings[permissionKey]) {
        return {
          allowed: false,
          message: `Content creators are not allowed to create ${entityType}s`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking content creator permissions:', error);
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
    const entityModel = EntityService.getModel(product.product_type);
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
      console.error(`Error calculating game details for game ${product.entity_id}:`, error);
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

    // Get products with pagination
    const options = {
      where,
      order: [[sortField, sortDirection]],
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };

    const products = await models.Product.findAll(options);

    // Get user ID from auth if available
    const userId = req.user?.uid || null;

    // Get full details for each product
    const fullProducts = await Promise.all(
      products.map(product => getFullProduct(product, userId))
    );

    res.json(fullProducts);
  } catch (error) {
    console.error('Error fetching products list:', error);
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
    const userId = req.user?.uid || null;

    const fullProduct = await getFullProduct(product, userId, includeGameDetails);
    res.json(fullProduct);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/curriculum/available-combinations - Get available subject-grade combinations that have curriculum items
// MUST be before generic /:type route to match correctly
router.get('/curriculum/available-combinations', optionalAuth, async (req, res) => {
  try {
    console.log('🔍 Loading available curriculum combinations...');

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

    console.log(`🔍 Found ${results.length} curricula with items`);

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

    console.log('🔍 Available combinations:', combinations);

    res.json({
      combinations,
      total_subjects: Object.keys(combinations).length,
      total_combinations: Object.values(combinations).reduce((sum, grades) => sum + grades.length, 0)
    });

  } catch (error) {
    console.error('Error fetching available curriculum combinations:', error);
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
      const user = req.user ? await models.User.findOne({ where: { id: req.user.uid } }) : null;
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
      console.log('🔍 Checking find_by_grade condition:', {
        find_by_grade: query.find_by_grade,
        isNaN: isNaN(parseInt(query.find_by_grade)),
        parseInt: parseInt(query.find_by_grade),
        subject: query.subject
      });

      if (query.find_by_grade && !isNaN(parseInt(query.find_by_grade))) {
        console.log('✅ Using special grade-based filtering');
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
        console.log('❌ NOT using special grade-based filtering, falling back to regular EntityService.find');
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
      if (query.add_copyrights_footer !== undefined) {
        query.add_copyrights_footer = query.add_copyrights_footer === 'true' || query.add_copyrights_footer === true;
      }
    }

    const results = await EntityService.find(entityType, query, options);

    // For Settings entity, add file_types_config and backwards compatibility for copyright_footer_text
    if (entityType === 'settings') {
      const enhancedResults = results.map(setting => {
        const settingData = setting.toJSON ? setting.toJSON() : setting;

        // Extract copyright_footer_text from footer_settings for backwards compatibility
        const copyright_footer_text = extractCopyrightText(settingData.footer_settings) || settingData.copyright_footer_text;

        return {
          ...settingData,
          copyright_footer_text, // Backwards compatibility
          file_types_config: getFileTypesForFrontend(),
          study_subjects: STUDY_SUBJECTS,
          audiance_targets: AUDIANCE_TARGETS,
          school_grades: SCHOOL_GRADES,
          game_types: GAME_TYPES
        };
      });
      return res.json(enhancedResults);
    }

    // For GameContent entity, transform S3 keys to API URLs for security
    if (entityType === 'gamecontent') {
      const enhancedResults = results.map(gameContent => {
        const gameContentData = gameContent.toJSON ? gameContent.toJSON() : gameContent;

        // Transform S3 keys to API URLs for image files and complete cards
        if ((gameContentData.semantic_type === 'image' || gameContentData.semantic_type === 'complete_card') && gameContentData.value) {
          // Extract filename from S3 key (format: env/privacy/assetType/entityType/entityId/filename)
          const pathParts = gameContentData.value.split('/');
          const filename = pathParts[pathParts.length - 1];

          // Check if value looks like an S3 key (not already an API URL)
          if (gameContentData.value.includes('/') && !gameContentData.value.startsWith('/api/')) {
            gameContentData.value = `/api/assets/image/gamecontent/${gameContentData.id}/${filename}`;
          }
        }

        return gameContentData;
      });
      return res.json(enhancedResults);
    }

    res.json(results);
  } catch (error) {
    console.error('Error finding entities:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/:type/:id - Find entity by ID
router.get('/:type/:id', optionalAuth, customValidators.validateEntityType, async (req, res) => {
  const entityType = req.params.type;
  const id = req.params.id;

  try {
    const entity = await EntityService.findById(entityType, id);

    // Apply S3 URL transformation for GameContent images and complete cards
    if (entityType === 'gamecontent' && entity && (entity.semantic_type === 'image' || entity.semantic_type === 'complete_card') && entity.value) {
      // Extract filename from S3 key (format: env/privacy/assetType/entityType/entityId/filename)
      const pathParts = entity.value.split('/');
      const filename = pathParts[pathParts.length - 1];

      // Check if value looks like an S3 key (not already an API URL)
      if (entity.value.includes('/') && !entity.value.startsWith('/api/')) {
        entity.value = `/api/assets/image/gamecontent/${entity.id}/${filename}`;
      }
    }

    res.json(entity);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error finding entity by ID:', error);
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

  console.log(`Creating ${entityType} with data:`, JSON.stringify(req.body, null, 2));
  console.log(`User ID: ${req.user.uid}`);

  try {
    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
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
    let createdBy = req.user.uid;

    // Only admins and sysadmins can create products without creator (Ludora products)
    if (req.body.is_ludora_creator === true) {
      if (user.role === 'admin' || user.role === 'sysadmin') {
        createdBy = null; // Don't set creator_user_id - will default to Ludora
      }
      // If non-admin tries to set is_ludora_creator, ignore it and use their ID
    }

    const entity = await EntityService.create(entityType, req.body, createdBy);
    res.status(201).json(entity);
  } catch (error) {
    console.error('Error creating entity:', error);
    console.error('Full error details:', error);
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
  const allFieldsToSanitize = [...numericFieldsToSanitize, ...enumFieldsToSanitize];

  console.log('🧹 Sanitizing fields:', {
    entityType,
    numericFields: numericFieldsToSanitize,
    enumFields: enumFieldsToSanitize,
    beforeSanitization: allFieldsToSanitize.reduce((acc, field) => {
      acc[field] = sanitizedData[field];
      return acc;
    }, {})
  });

  // Handle numeric fields
  numericFieldsToSanitize.forEach(field => {
    if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
      console.log(`🧹 Converting numeric ${field} from '${sanitizedData[field]}' to null`);
      sanitizedData[field] = null;
    } else if (sanitizedData[field] !== null && !isNaN(sanitizedData[field])) {
      // Convert string numbers to proper numbers
      console.log(`🧹 Converting numeric ${field} from '${sanitizedData[field]}' to number`);
      sanitizedData[field] = Number(sanitizedData[field]);
    }
  });

  // Handle enum fields
  enumFieldsToSanitize.forEach(field => {
    if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
      console.log(`🧹 Converting enum ${field} from '${sanitizedData[field]}' to null`);
      sanitizedData[field] = null;
    }
  });

  console.log('🧹 After sanitization:', allFieldsToSanitize.reduce((acc, field) => {
    acc[field] = sanitizedData[field];
    return acc;
  }, {}));

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
    // For settings updates, handle footer_settings and copyright_footer_text synchronization
    if (entityType === 'settings') {
      if (req.body.footer_settings) {
        // If footer_settings provided, extract copyright text for backwards compatibility
        const copyrightText = extractCopyrightText(req.body.footer_settings);
        if (copyrightText) {
          req.body.copyright_footer_text = copyrightText;
        }
      } else if (req.body.copyright_footer_text) {
        // If only copyright_footer_text provided, update footer_settings.text.content
        // Get current settings to preserve other footer settings
        const currentSettings = await models.Settings.findByPk(id);
        if (currentSettings) {
          req.body.footer_settings = updateFooterTextContent(
            currentSettings.footer_settings,
            req.body.copyright_footer_text
          );
        }
      }
    }

    console.log('📝 Backend received update data:', req.body);
    console.log('📝 Video fields received:', {
      marketing_video_type: req.body.marketing_video_type,
      marketing_video_id: req.body.marketing_video_id,
      marketing_video_title: req.body.marketing_video_title,
      marketing_video_duration: req.body.marketing_video_duration,
      video_file_url: req.body.video_file_url
    });

    // Special handling for product updates
    if (entityType === 'product') {
      console.log('🔍 Product update debug:');
      console.log('   req.body.short_description:', req.body.short_description);
      console.log('   req.body.is_published:', req.body.is_published);
      console.log('   req.body.tags:', req.body.tags);
      console.log('   req.body.creator_user_id:', req.body.creator_user_id);
      console.log('   req.body.is_ludora_creator:', req.body.is_ludora_creator);
      console.log('   req.body.marketing_video_title:', req.body.marketing_video_title);

      // Handle is_ludora_creator flag (transform to creator_user_id)
      if (req.body.hasOwnProperty('is_ludora_creator')) {
        const user = await models.User.findOne({ where: { id: req.user.uid } });

        if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
          // Non-admin trying to change Ludora creator status - ignore it
          delete req.body.is_ludora_creator;
          console.log('🚫 Non-admin user tried to change is_ludora_creator - ignored');
        } else {
          // Admin user - transform is_ludora_creator to creator_user_id
          console.log('✅ Admin user updating is_ludora_creator:', req.body.is_ludora_creator);
          req.body.creator_user_id = req.body.is_ludora_creator ? null : req.user.uid;
          console.log('✅ Transformed to creator_user_id:', req.body.creator_user_id);
          delete req.body.is_ludora_creator; // Remove the flag after transformation
        }
      }

      // Only allow admins to change creator_user_id directly
      if (req.body.hasOwnProperty('creator_user_id')) {
        const user = await models.User.findOne({ where: { id: req.user.uid } });

        if (!user || (user.role !== 'admin' && user.role !== 'sysadmin')) {
          // Non-admin trying to change creator_user_id - remove it from update
          delete req.body.creator_user_id;
          console.log('🚫 Non-admin user tried to change creator_user_id - ignored');
        } else {
          console.log('✅ Admin user updating creator_user_id');
        }
      }
    }
    const entity = await EntityService.update(entityType, id, req.body, req.user.uid);
    res.json(entity);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /entities/:type/:id - Delete entity
router.delete('/:type/:id', authenticateToken, customValidators.validateEntityType, async (req, res) => {
  const entityType = req.params.type;
  const id = req.params.id;
  
  try {
    const result = await EntityService.delete(entityType, id);
    res.json({ message: 'Entity deleted successfully', ...result });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error deleting entity:', error);
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
        results = await EntityService.bulkCreate(entityType, data, req.user.uid);
        break;
        
      case 'delete':
        const deleteResult = await EntityService.bulkDelete(entityType, data);
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
    console.error('Error in bulk operation:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/:type/count - Count entities with optional filtering
router.get('/:type/count', optionalAuth, customValidators.validateEntityType, async (req, res) => {
  const entityType = req.params.type;
  
  try {
    const count = await EntityService.count(entityType, req.query);
    res.json({ count });
  } catch (error) {
    console.error('Error counting entities:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities - List all available entity types
router.get('/', optionalAuth, (req, res) => {
  const entityTypes = EntityService.getAvailableEntityTypes();
  res.json({ entityTypes, count: entityTypes.length });
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
    console.error('Error checking product purchases:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /entities/curriculum/create-range - Create a new grade range curriculum
router.post('/curriculum/create-range', authenticateToken, validateBody({
  type: 'object',
  required: ['subject', 'grade_from', 'grade_to'],
  properties: {
    subject: { type: 'string' },
    grade_from: { type: 'integer', minimum: 1, maximum: 12 },
    grade_to: { type: 'integer', minimum: 1, maximum: 12 },
    description: { type: 'string' }
  }
}), async (req, res) => {
  try {
    const { subject, grade_from, grade_to, description } = req.body;
    const userId = req.user.uid;

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
    // Use Sequelize operators from the sequelize instance
    const { Op } = sequelize.Sequelize;

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
    const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

    const curriculumData = {
      id: generateId(),
      subject: subject,
      grade: null, // No single grade for range curricula
      grade_from: grade_from,
      grade_to: grade_to,
      is_grade_range: true,
      teacher_user_id: null, // System curriculum
      class_id: null, // System curriculum
      is_active: true,
      description: description
    };

    const curriculum = await models.Curriculum.create(curriculumData);

    res.status(201).json({
      message: 'Grade range curriculum created successfully',
      curriculum: curriculum,
      grade_range: `${grade_from}-${grade_to}`
    });

  } catch (error) {
    console.error('Error creating grade range curriculum:', error);
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
    const userId = req.user.uid;

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
    const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

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

    // Get all curriculum items from the system curriculum
    const systemItems = await models.CurriculumItem.findAll({
      where: { curriculum_id: systemCurriculumId },
      order: [['mandatory_order', 'ASC'], ['custom_order', 'ASC']]
    });

    // Copy all curriculum items
    const copiedItems = [];
    for (const item of systemItems) {
      const itemData = {
        id: generateId(),
        curriculum_id: classCurriculum.id,
        study_topic: item.study_topic,
        content_topic: item.content_topic,
        is_mandatory: item.is_mandatory,
        mandatory_order: item.mandatory_order,
        custom_order: item.custom_order,
        description: item.description,
        is_completed: false, // Start as not completed for class tracking
        created_at: new Date(),
        updated_at: new Date()
      };

      const copiedItem = await models.CurriculumItem.create(itemData);
      copiedItems.push(copiedItem);
    }

    res.status(201).json({
      message: 'Curriculum copied successfully to class',
      curriculum: classCurriculum,
      items: copiedItems,
      copiedItemsCount: copiedItems.length
    });

  } catch (error) {
    console.error('Error copying curriculum to class:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /entities/curriculum/:id/cascade-update - Update curriculum and all its copies
router.put('/curriculum/:id/cascade-update', authenticateToken, validateBody({
  type: 'object',
  required: ['is_active'],
  properties: {
    is_active: { type: 'boolean' }
  }
}), async (req, res) => {
  try {
    const curriculumId = req.params.id;
    const { is_active } = req.body;
    const userId = req.user.uid;

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
    console.error('Error performing cascade update:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/curriculum/:id/products - Get all products associated with a curriculum item
router.get('/curriculum/:id/products', optionalAuth, async (req, res) => {
  try {
    const curriculumItemId = req.params.id;
    const userId = req.user?.uid || null;

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
    console.error('Error fetching curriculum products:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/curriculum/:id/copy-status - Check if a curriculum has been copied to classes
router.get('/curriculum/:id/copy-status', authenticateToken, async (req, res) => {
  try {
    const curriculumId = req.params.id;
    const userId = req.user.uid;

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
    console.error('Error checking curriculum copy status:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST /entities/lesson-plan/:lessonPlanId/upload-file - Atomic file upload for lesson plans
router.post('/lesson-plan/:lessonPlanId/upload-file', authenticateToken, fileUpload.single('file'), async (req, res) => {
  const lessonPlanId = req.params.lessonPlanId;
  const transaction = await sequelize.transaction();
  let uploadedS3Key = null;

  try {
    console.log(`📤 Starting atomic lesson plan file upload for lesson plan ${lessonPlanId}`);

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
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

    // Additional filename encoding fix for database storage
    try {
      // If filename still looks corrupted, try to decode it properly
      if (fileName.includes('×') || fileName.includes('Ã')) {
        const decodedName = decodeURIComponent(escape(fileName));
        if (decodedName !== fileName && decodedName.length > 0) {
          fileName = decodedName;
          console.log(`📤 Decoded filename from "${req.file.originalname}" to "${fileName}"`);
        }
      }
    } catch (error) {
      console.log(`📤 Filename decoding failed, using original: ${error.message}`);
    }

    const fileExtension = fileName.split('.').pop().toLowerCase();
    const fileType = getFileTypeFromExtension(fileExtension);

    console.log(`📤 Processing file: ${fileName}, role: ${file_role}, extension: ${fileExtension}`);

    // TODO: SVG validation will be added here for new presentation upload system

    // Validate file type restrictions for audio role
    if (file_role === 'audio') {
      const allowedExtensions = ['mp3', 'wav', 'm4a'];
      if (!allowedExtensions.includes(fileExtension)) {
        console.log(`❌ Invalid file type for ${file_role}: ${fileExtension}. Only audio files allowed.`);
        return res.status(400).json({
          error: `Only audio files (.mp3, .wav, .m4a) are allowed for ${file_role} sections`,
          details: `Received file type: .${fileExtension}. Expected: ${allowedExtensions.join(', ')}`
        });
      }
    }

    // Generate ID for the File entity
    const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

    // 1. Create File entity within transaction
    const fileData = {
      id: generateId(),
      title: description || fileName,
      file_type: fileType,
      is_asset_only: true,
      allow_preview: false,
      add_copyrights_footer: false,
      creator_user_id: req.user.uid
    };

    console.log(`📤 Creating File entity with data:`, fileData);
    const fileEntity = await models.File.create(fileData, { transaction });
    console.log(`✅ File entity created: ${fileEntity.id}`);

    console.log(`📤 Original filename: ${fileName}`);

    // 2. Upload file using unified asset upload method
    const uploadResult = await fileService.uploadAsset({
      file: req.file,
      entityType: 'file',
      entityId: fileEntity.id,
      assetType: 'document',
      userId: req.user.uid,
      transaction: transaction,
      preserveOriginalName: true // Keep original filename for documents
    });

    if (!uploadResult.success) {
      throw new Error('File upload failed');
    }

    uploadedS3Key = uploadResult.s3Key;
    console.log(`✅ File uploaded successfully: ${uploadedS3Key}`);

    // Update file entity with S3 information
    await fileEntity.update({
      file_name: fileName,
      file_size: req.file.size
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
        console.log(`📤 Published lesson plan - replacing existing ${file_role} file`);

        // Remove the existing file from configs and delete the File entity if it's asset-only
        const existingFileConfig = existingFilesInRole[0];
        console.log(`📤 Removing existing file:`, existingFileConfig);

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
              console.log(`📤 Deleting existing asset-only File entity: ${existingFileEntity.id}`);
              await existingFileEntity.destroy({ transaction });
              console.log(`✅ Existing File entity deleted during replacement`);
            }
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete existing File entity during replacement:`, deleteError.message);
            // Continue with replacement even if deletion fails
          }
        }

        console.log(`✅ Existing ${file_role} file removed, proceeding with replacement`);
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
    console.log(`📊 Total files count: ${newTotalSlides}`);

    // Update lesson plan with new file configs and total slides
    console.log(`📤 Updating lesson plan with file configs:`, JSON.stringify(currentConfigs, null, 2));
    console.log(`📤 Before update - lessonPlan.file_configs:`, JSON.stringify(lessonPlan.file_configs, null, 2));

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    // Update total_slides field if it has changed
    if (lessonPlan.total_slides !== newTotalSlides) {
      console.log(`📊 Updating total_slides from ${lessonPlan.total_slides} to ${newTotalSlides}`);
      lessonPlan.total_slides = newTotalSlides;
    }

    const updateResult = await lessonPlan.save({ transaction });

    console.log(`📤 Update result:`, updateResult.dataValues?.file_configs ? 'has dataValues' : 'no dataValues in result');

    // Force reload to check if update actually persisted
    await lessonPlan.reload({ transaction });
    console.log(`📤 After reload within transaction - lessonPlan.file_configs:`, JSON.stringify(lessonPlan.file_configs, null, 2));

    // Commit transaction - everything succeeded
    console.log(`📤 Attempting to commit transaction...`);
    await transaction.commit();
    console.log(`✅ Transaction committed successfully`);

    // Verify the update persisted after commit by checking fresh DB query
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    console.log(`📤 Post-commit verification - fresh query file_configs:`, JSON.stringify(verifyLessonPlan?.file_configs, null, 2));

    console.log(`🎉 Atomic file upload completed successfully`);

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
    console.error('❌ Atomic file upload failed:', error);

    // Rollback database transaction
    await transaction.rollback();

    // Clean up S3 file if it was uploaded
    if (uploadedS3Key) {
      try {
        await fileService.deleteS3Object(uploadedS3Key);
        console.log(`🧹 Cleaned up S3 file: ${uploadedS3Key}`);
      } catch (s3Error) {
        console.error('Failed to clean up S3 file:', s3Error);
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
    console.log(`🔗 Starting File product linking for lesson plan ${lessonPlanId}`);

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
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

    // Get current file configs
    const currentConfigs = lessonPlan.file_configs || { files: [] };

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
        console.log(`🔗 Published lesson plan - replacing existing ${file_role} file during linking`);

        // Remove the existing file from configs (don't delete File entities when unlinking)
        const existingFileConfig = existingFilesInRole[0];
        console.log(`🔗 Removing existing file config:`, existingFileConfig);

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
              console.log(`🔗 Deleting existing asset-only File entity during linking: ${existingFileEntity.id}`);
              await existingFileEntity.destroy({ transaction });
              console.log(`✅ Existing asset-only File entity deleted during linking replacement`);
            }
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete existing File entity during linking replacement:`, deleteError.message);
            // Continue with replacement even if deletion fails
          }
        }

        console.log(`✅ Existing ${file_role} file removed, proceeding with File product linking`);
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
        console.log(`📊 Attempting to count slides for linked PowerPoint file: ${fileEntity.file_name}`);
        try {
          // For linked files, we need to download from S3 to count slides
          const fileBuffer = await fileService.downloadToBuffer(fileEntity.s3_key || fileEntity.file_name);
          slideCount = await countSlidesInPowerPoint(fileBuffer, fileEntity.file_name);
          console.log(`📊 Detected ${slideCount} slides in linked file ${fileEntity.file_name}`);
        } catch (slideError) {
          console.warn(`⚠️ Failed to count slides in linked file ${fileEntity.file_name}:`, slideError.message);
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
    console.log(`📊 Calculated total slides after linking: ${newTotalSlides}`);

    // Update lesson plan with new file configs
    console.log(`🔗 Updating lesson plan with file configs:`, JSON.stringify(currentConfigs, null, 2));

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    // Update total_slides field if it has changed
    if (lessonPlan.total_slides !== newTotalSlides) {
      console.log(`📊 Updating total_slides from ${lessonPlan.total_slides} to ${newTotalSlides}`);
      lessonPlan.total_slides = newTotalSlides;
    }

    const updateResult = await lessonPlan.save({ transaction });
    console.log(`🔗 Lesson plan file_configs updated`);

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });
    console.log(`🔗 After reload - lessonPlan.file_configs:`, JSON.stringify(lessonPlan.file_configs, null, 2));

    // Commit transaction - everything succeeded
    console.log(`🔗 Attempting to commit transaction...`);
    await transaction.commit();
    console.log(`✅ File product linking transaction committed successfully`);

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    console.log(`🔗 Post-commit verification - file_configs length:`, verifyLessonPlan?.file_configs?.files?.length || 0);

    console.log(`🎉 File product linking completed successfully`);

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
    console.error('❌ File product linking failed:', error);

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
    console.log(`🔗❌ Starting File product unlinking for lesson plan ${lessonPlanId}, file ${fileId}`);

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
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
    console.log(`🔗❌ Found file config:`, fileConfig);

    // Only allow unlinking File products (not asset-only files)
    if (fileConfig.is_asset_only === true) {
      return res.status(400).json({
        error: 'This endpoint is for unlinking File products only. Use the delete endpoint for asset-only files.',
        file_type: 'asset_only'
      });
    }

    // Remove file from lesson plan configs (the File product itself remains untouched)
    console.log(`🔗❌ Removing File product link from lesson plan configs (index ${fileIndex})`);
    currentConfigs.files.splice(fileIndex, 1);

    // Update lesson plan with new file configs
    console.log(`🔗❌ Updating lesson plan with updated file configs:`, JSON.stringify(currentConfigs, null, 2));

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    const updateResult = await lessonPlan.save({ transaction });
    console.log(`🔗❌ Lesson plan file_configs updated`);

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });
    console.log(`🔗❌ After reload - lessonPlan.file_configs:`, JSON.stringify(lessonPlan.file_configs, null, 2));

    // Commit transaction - everything succeeded
    console.log(`🔗❌ Attempting to commit transaction...`);
    await transaction.commit();
    console.log(`✅ File product unlinking transaction committed successfully`);

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    console.log(`🔗❌ Post-commit verification - file_configs length:`, verifyLessonPlan?.file_configs?.files?.length || 0);

    console.log(`🎉 File product unlinking completed successfully`);

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
    console.error('❌ File product unlinking failed:', error);

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
    console.log(`🗑️ Starting lesson plan file deletion for lesson plan ${lessonPlanId}, file ${fileId}`);

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
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
    console.log(`🗑️ Found file config:`, fileConfig);

    // 1. Get the File entity
    const fileEntity = await models.File.findByPk(fileId, { transaction });
    if (!fileEntity) {
      console.log(`⚠️ File entity ${fileId} not found, continuing with config removal`);
    }

    // 2. Delete the File entity (this should also clean up S3 via hooks/triggers)
    if (fileEntity) {
      console.log(`🗑️ Deleting File entity: ${fileEntity.id}`);
      await fileEntity.destroy({ transaction });
      console.log(`✅ File entity deleted`);
    }

    // 3. Remove file from lesson plan configs
    console.log(`🗑️ Removing file from lesson plan configs (index ${fileIndex})`);
    currentConfigs.files.splice(fileIndex, 1);

    // 4. Update lesson plan with new file configs
    console.log(`🗑️ Updating lesson plan with updated file configs:`, JSON.stringify(currentConfigs, null, 2));

    // CRITICAL: Mark the JSONB field as changed so Sequelize persists the update
    lessonPlan.file_configs = currentConfigs;
    lessonPlan.changed('file_configs', true);

    const updateResult = await lessonPlan.save({ transaction });
    console.log(`🗑️ Lesson plan file_configs updated`);

    // Force reload to verify update persisted
    await lessonPlan.reload({ transaction });
    console.log(`🗑️ After reload - lessonPlan.file_configs:`, JSON.stringify(lessonPlan.file_configs, null, 2));

    // Commit transaction - everything succeeded
    console.log(`🗑️ Attempting to commit transaction...`);
    await transaction.commit();
    console.log(`✅ File deletion transaction committed successfully`);

    // Verify the update persisted after commit
    const verifyLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    console.log(`🗑️ Post-commit verification - file_configs length:`, verifyLessonPlan?.file_configs?.files?.length || 0);

    console.log(`🎉 File deletion completed successfully`);

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
    console.error('❌ File deletion failed:', error);

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
    const requestingUserId = req.user.uid;

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
      console.log(`✅ Cleared test subscription history for user ${targetUser.email}`);
    } catch (subscriptionError) {
      console.warn('Could not clear subscription history:', subscriptionError);
      // Don't fail the reset if subscription cleanup fails
    }

    console.log(`✅ Admin ${requestingUser.email} reset onboarding for user ${targetUser.email}`);

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
    console.error('Error resetting user onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entities/lesson-plan/:lessonPlanId/presentation - Get lesson plan presentation files with access control
router.get('/lesson-plan/:lessonPlanId/presentation', authenticateToken, async (req, res) => {
  try {
    const { lessonPlanId } = req.params;
    const userId = req.user.uid;

    console.log(`🎯 Lesson plan presentation request:`, {
      lessonPlanId,
      userId
    });

    // Check user access to the lesson plan
    const hasAccess = await checkLessonPlanAccess(userId, lessonPlanId);
    if (!hasAccess) {
      console.log(`🚫 Access denied for user ${userId} to lesson plan ${lessonPlanId}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You need to purchase this lesson plan to view the presentation',
        hasAccess: false
      });
    }

    console.log(`✅ Access granted for user ${userId} to lesson plan ${lessonPlanId}`);

    // Get presentation files
    const presentationFiles = await getLessonPlanPresentationFiles(lessonPlanId);

    if (!presentationFiles.hasPresentation) {
      console.log(`📋 No presentation files found for lesson plan ${lessonPlanId}`);
      return res.status(404).json({
        error: 'No presentation found',
        message: 'This lesson plan does not have any presentation files',
        hasPresentation: false
      });
    }

    // Get ordered URLs for frontend consumption
    const orderedUrls = getOrderedPresentationUrls(presentationFiles);

    console.log(`🎯 Returning presentation data for lesson plan ${lessonPlanId}:`, {
      openingFiles: presentationFiles.opening.length,
      bodyFiles: presentationFiles.body.length,
      totalSlides: presentationFiles.totalSlides,
      orderedUrls: orderedUrls.length
    });

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
    console.error('❌ Error getting lesson plan presentation:', error);
    res.status(500).json({
      error: 'Failed to get presentation',
      message: error.message
    });
  }
});

// POST /entities/gamecontent/upload - Atomic file upload for GameContent
router.post('/gamecontent/upload', authenticateToken, fileUpload.single('file'), async (req, res) => {
  const transaction = await sequelize.transaction();
  let uploadedS3Key = null;

  try {
    console.log('📤 Starting atomic GameContent file upload');

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.uid } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get form data
    const { semantic_type, metadata } = req.body;

    // Validate semantic_type
    const validSemanticTypes = ['word', 'question', 'name', 'place', 'text', 'image', 'audio', 'video', 'game_card_bg', 'complete_card'];
    if (!semantic_type || !validSemanticTypes.includes(semantic_type)) {
      return res.status(400).json({
        error: 'Valid semantic_type is required',
        valid_types: validSemanticTypes
      });
    }

    // Validate file upload for file-based types
    const fileTypes = ['image', 'audio', 'video', 'game_card_bg', 'complete_card'];
    if (fileTypes.includes(semantic_type)) {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required for file-based semantic types' });
      }
    } else {
      if (req.file) {
        return res.status(400).json({ error: 'Files are not allowed for text-based semantic types' });
      }
    }

    // Parse metadata if provided
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid metadata JSON format' });
      }
    }

    // For text-based types, get value from metadata or request body
    let contentValue = '';
    let dataType = '';

    if (fileTypes.includes(semantic_type)) {
      // File-based types: value will be set to S3 URL after upload
      if (semantic_type === 'game_card_bg' || semantic_type === 'complete_card') {
        dataType = 'image_url'; // Background cards and complete cards use image_url data type
      } else {
        dataType = `${semantic_type}_url`;
      }
      contentValue = ''; // Will be updated with S3 URL
    } else {
      // Text-based types: get value from request body
      dataType = 'string';
      contentValue = req.body.value || '';
      if (!contentValue.trim()) {
        return res.status(400).json({ error: 'Value is required for text-based semantic types' });
      }
    }

    // Generate ID for the GameContent entity
    const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

    // 1. Create GameContent entity within transaction
    const gameContentData = {
      id: generateId(),
      semantic_type: semantic_type,
      data_type: dataType,
      value: contentValue,
      metadata: parsedMetadata
    };

    console.log('📤 Creating GameContent entity with data:', gameContentData);
    const gameContentEntity = await models.GameContent.create(gameContentData, { transaction });
    console.log('✅ GameContent entity created:', gameContentEntity.id);

    // Declare fileName variable for broader scope
    let fileName = null;

    // 2. If file-based type, upload file and update entity
    if (fileTypes.includes(semantic_type) && req.file) {

      // Initialize fileName for use in response and file processing
      fileName = req.file.originalname;

      // Handle filename encoding
      try {
        if (fileName.includes('×') || fileName.includes('Ã')) {
          const decodedName = decodeURIComponent(escape(fileName));
          if (decodedName !== fileName && decodedName.length > 0) {
            fileName = decodedName;
            console.log(`📤 Decoded filename from "${req.file.originalname}" to "${fileName}"`);
          }
        }
      } catch (error) {
        console.log(`📤 Filename decoding failed, using original: ${error.message}`);
      }

      console.log(`📤 Processing file: ${fileName}, semantic_type: ${semantic_type}`);

      // Map semantic type to asset type for S3 upload
      const assetTypeMap = {
        'image': 'image',
        'audio': 'audio',
        'video': 'video',
        'game_card_bg': 'image',
        'complete_card': 'image'
      };
      const assetType = assetTypeMap[semantic_type];

      // Create predictable S3 path using constructS3Path
      const s3Key = constructS3Path('gamecontent', gameContentEntity.id, assetType, fileName);
      console.log(`📤 Using predictable S3 path: ${s3Key}`);

      // Upload file using unified asset upload method
      const uploadResult = await fileService.uploadAsset({
        file: req.file,
        entityType: 'gamecontent',
        entityId: gameContentEntity.id,
        assetType: assetType,
        userId: req.user.uid,
        transaction: transaction,
        preserveOriginalName: true
      });

      if (!uploadResult.success) {
        throw new Error('File upload failed');
      }

      uploadedS3Key = uploadResult.s3Key;
      console.log('✅ File uploaded successfully:', uploadedS3Key);

      // 3. Update GameContent entity with appropriate value
      let valueToStore = uploadedS3Key; // Default to S3 key for security

      // For image-based types, store API URL for direct access
      if (semantic_type === 'image' || semantic_type === 'game_card_bg') {
        valueToStore = `/api/assets/image/gamecontent/${gameContentEntity.id}/${fileName}`;
      }

      await gameContentEntity.update({
        value: valueToStore
      }, { transaction });

      console.log('✅ GameContent entity updated with value:', valueToStore);
    }

    // Commit transaction - everything succeeded
    console.log('📤 Attempting to commit transaction...');
    await transaction.commit();
    console.log('✅ Transaction committed successfully');

    console.log('🎉 Atomic GameContent upload completed successfully');

    // Prepare response with API URL for image files
    const response = {
      message: 'GameContent created successfully',
      gamecontent: {
        id: gameContentEntity.id,
        semantic_type: gameContentEntity.semantic_type,
        data_type: gameContentEntity.data_type,
        value: fileTypes.includes(semantic_type) && (semantic_type === 'image' || semantic_type === 'game_card_bg')
          ? `/api/assets/image/gamecontent/${gameContentEntity.id}/${fileName}`
          : gameContentEntity.value,
        metadata: gameContentEntity.metadata
      }
    };

    // Add file info for file-based types
    if (fileTypes.includes(semantic_type) && req.file) {
      response.file = {
        filename: fileName,
        s3_key: uploadedS3Key,
        api_url: (semantic_type === 'image' || semantic_type === 'game_card_bg')
          ? `/api/assets/image/gamecontent/${gameContentEntity.id}/${fileName}`
          : undefined,
        size: req.file.size,
        mime_type: req.file.mimetype
      };
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Atomic GameContent upload failed:', error);

    // Rollback database transaction
    await transaction.rollback();

    // Clean up S3 file if it was uploaded
    if (uploadedS3Key) {
      try {
        await fileService.deleteS3Object(uploadedS3Key);
        console.log(`🧹 Cleaned up S3 file: ${uploadedS3Key}`);
      } catch (s3Error) {
        console.error('Failed to clean up S3 file:', s3Error);
      }
    }

    res.status(500).json({
      error: 'GameContent upload failed',
      details: error.message
    });
  }
});

export default router;