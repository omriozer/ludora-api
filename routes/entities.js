import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import EntityService from '../services/EntityService.js';
import models from '../models/index.js';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';
import { getFileTypesForFrontend } from '../constants/fileTypes.js';
import { extractCopyrightText, updateFooterTextContent } from '../utils/footerSettingsHelper.js';
import { STUDY_SUBJECTS, AUDIANCE_TARGETS, SCHOOL_GRADES } from '../constants/info.js';

const router = express.Router();

// Helper function to check content creator permissions
async function checkContentCreatorPermissions(user, entityType) {
  // Admins and sysadmins always have permission
  if (user.role === 'admin' || user.role === 'sysadmin') {
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
async function getFullProduct(product, userId = null) {
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
        payment_status: ['completed', 'pending'] // Include both completed and pending purchases
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

  return {
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
router.get('/product/:id/details', optionalAuth, async (req, res) => {
  const productId = req.params.id;

  try {
    // Get the Product
    const product = await models.Product.findByPk(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get user ID from auth if available
    const userId = req.user?.uid || null;

    const fullProduct = await getFullProduct(product, userId);
    res.json(fullProduct);
  } catch (error) {
    console.error('Error fetching product details:', error);
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
      if (query.is_active !== undefined) {
        query.is_active = query.is_active === 'true' || query.is_active === true;
      }
      if (query.teacher_user_id === 'null') {
        query.teacher_user_id = null;
      }
      if (query.class_id === 'null') {
        query.class_id = null;
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
          school_grades: SCHOOL_GRADES
        };
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
      const permissionCheck = await checkContentCreatorPermissions(user, entityType);
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
      console.log('   req.body.marketing_video_title:', req.body.marketing_video_title);

      // Only allow admins to change creator_user_id
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
    const existingCurriculum = await models.Curriculum.findOne({
      where: {
        class_id: classId,
        subject: systemCurriculum.subject,
        grade: systemCurriculum.grade
      }
    });

    if (existingCurriculum) {
      return res.status(409).json({ error: 'A curriculum already exists for this class and subject/grade combination' });
    }

    // Generate new ID for the class curriculum
    const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

    // Copy the curriculum
    const classCurriculumData = {
      id: generateId(),
      subject: systemCurriculum.subject,
      grade: systemCurriculum.grade,
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

export default router;