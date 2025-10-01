import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, schemas, customValidators } from '../middleware/validation.js';
import EntityService from '../services/EntityService.js';
import models from '../models/index.js';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';

const router = express.Router();

// Helper function to validate entity type
function validateEntityType(entityType) {
  try {
    EntityService.getModel(entityType);
    return true;
  } catch (error) {
    return false;
  }
}

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

  // Get purchase information if user is authenticated
  let purchase = null;
  if (userId && product.id) {
    purchase = await models.Purchase.findOne({
      where: {
        buyer_user_id: userId,
        purchasable_id: product.entity_id || product.id,
        purchasable_type: product.product_type,
        payment_status: 'completed'
      },
      attributes: ['id', 'payment_status', 'access_expires_at', 'created_at']
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
    creator: creator ? {
      id: creator.id,
      full_name: creator.full_name,
      email: creator.email,
      is_content_creator: !!creator.content_creator_agreement_sign_date
    } : null,
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
    
    const results = await EntityService.find(entityType, query, options);
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

    // Check content creator permissions
    const permissionCheck = await checkContentCreatorPermissions(user, entityType);
    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.message });
    }

    const entity = await EntityService.create(entityType, req.body, req.user.uid);
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

export default router;