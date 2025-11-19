import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, schemas } from '../middleware/validation.js';
import EntityService from '../services/EntityService.js';
import models from '../models/index.js';
import { ALL_PRODUCT_TYPES } from '../constants/productTypes.js';

const router = express.Router();

// Helper function to check content creator permissions (copied from entities.js)
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
      return { allowed: false, message: 'Error checking permissions' };
    }
  }

  // For other entity types, allow if signed content creator
  return { allowed: true };
}

// POST /api/products - Create new product with unified endpoint
router.post('/', authenticateToken, validateBody(schemas.entityCreate), async (req, res) => {
  const { product_type, ...productData } = req.body;


  try {
    // Validate product_type is provided
    if (!product_type) {
      return res.status(400).json({ error: 'product_type is required' });
    }

    // Validate product_type is valid
    if (!ALL_PRODUCT_TYPES.includes(product_type)) {
      return res.status(400).json({
        error: `Invalid product_type: ${product_type}`,
        allowedTypes: ALL_PRODUCT_TYPES
      });
    }

    // Get user information
    const user = await models.User.findOne({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check content creator permissions
    const permissionCheck = await checkContentCreatorPermissions(user, product_type);
    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.message });
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

    // Create product using existing EntityService method
    const result = await EntityService.createProductTypeEntity(product_type, {
      product_type,
      ...productData
    }, createdBy);

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products - List products (optional - for future use)
router.get('/', async (req, res) => {
  try {
    // Redirect to existing products list endpoint
    res.redirect('/api/entities/products/list');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;