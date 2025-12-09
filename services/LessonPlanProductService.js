import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { NORMALIZED_PRODUCT_TYPES } from '../constants/productTypes.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * LessonPlanProductService - Domain-specific service for LessonPlan products
 *
 * Handles:
 * - LessonPlan creation with file configs management
 * - Linked products validation for derived access
 * - File cascade cleanup coordination
 * - Numeric field sanitization (estimated_duration, total_slides)
 * - JSONB file_configs handling
 */
class LessonPlanProductService extends BaseProductService {
  constructor() {
    super('lesson_plan');
  }

  // Create lesson plan with linked products validation
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Creating lesson plan', {
          supportsDerivatedAccess: data.type_attributes?.supports_derived_access,
          linkedProductsCount: data.type_attributes?.linked_products?.length || 0,
          createdBy
        });

        // LESSON PLAN VALIDATION: Validate linked products when publishing with derived access
        if (this.shouldValidateLessonPlan(data)) {
          await this.validateLessonPlan(data, null, createdBy);
        }

        // Sanitize numeric fields before creation
        const sanitizedData = this.sanitizeNumericFields(data);

        // Use normalized product structure
        const result = await this.createProductTypeEntity(sanitizedData, createdBy, { transaction });

        ludlog.generic('Lesson plan created successfully', {
          productId: result.id,
          entityId: result.entity_id,
          linkedProductsCount: data.type_attributes?.linked_products?.length || 0
        });

        return result;
      } catch (error) {
        throw new Error(`Failed to create lesson plan: ${error.message}`);
      }
    });
  }

  // Update lesson plan with linked products validation
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating lesson plan', { lessonPlanId: id, updatedBy });

        // Find the product to get the product ID for validation
        let productId = id;
        let entityId = id;
        let isProductId = false;

        const product = await this.models.Product.findOne({
          where: { id, product_type: 'lesson_plan' },
          transaction
        });

        if (product) {
          entityId = product.entity_id;
          productId = product.id;
          isProductId = true;
        } else {
          // Find product by entity_id
          const productByEntity = await this.models.Product.findOne({
            where: { entity_id: id, product_type: 'lesson_plan' },
            transaction
          });
          if (productByEntity) {
            productId = productByEntity.id;
          }
        }

        // LESSON PLAN VALIDATION: Validate linked products when publishing with derived access
        if (this.shouldValidateLessonPlan(data)) {
          await this.validateLessonPlan(data, productId, updatedBy || (product?.creator_user_id));
        }

        // Sanitize numeric fields before update
        const sanitizedData = this.sanitizeNumericFields(data);

        const result = await this.updateProductTypeEntity(entityId, sanitizedData, updatedBy, { transaction });

        ludlog.generic('Lesson plan updated successfully', {
          lessonPlanId: id,
          productId,
          entityId,
          isProductId
        });

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  // Delete lesson plan with file cascade cleanup
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting lesson plan', { lessonPlanId: id });

        // Check if this is a product deletion or entity deletion
        const product = await this.models.Product.findByPk(id, { transaction });

        if (product && product.product_type === 'lesson_plan') {
          // This is a product deletion - use deleteProductWithEntity
          const result = await this.deleteProductWithEntity(id, { transaction });
          return result;
        } else {
          // This is an entity deletion - handle LessonPlan entity with file cleanup
          const LessonPlanModel = this.getModel('lesson_plan');
          const lessonPlan = await LessonPlanModel.findByPk(id, { transaction });

          if (!lessonPlan) {
            throw new Error('Lesson plan not found');
          }

          // Handle LessonPlan file cascade cleanup
          await this.cleanupLessonPlanFiles(lessonPlan, { transaction });

          // Find and delete any product referencing this entity
          const referencingProduct = await this.models.Product.findOne({
            where: {
              product_type: 'lesson_plan',
              entity_id: id
            },
            transaction
          });

          if (referencingProduct) {
            await referencingProduct.destroy({ transaction });
          }

          // Delete the LessonPlan entity
          await lessonPlan.destroy({ transaction });

          ludlog.generic('Lesson plan entity deleted successfully', {
            lessonPlanId: id,
            productDeleted: !!referencingProduct
          });

          return { id, deleted: true, productDeleted: !!referencingProduct };
        }
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create lesson plans
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk lesson plan creation', {
          count: dataArray.length,
          createdBy
        });

        const results = [];

        for (const data of dataArray) {
          // Validate each lesson plan if needed
          if (this.shouldValidateLessonPlan(data)) {
            await this.validateLessonPlan(data, null, createdBy);
          }

          // Sanitize numeric fields
          const sanitizedData = this.sanitizeNumericFields(data);

          const result = await this.createProductTypeEntity(sanitizedData, createdBy, { transaction });
          results.push(result);
        }

        ludlog.generic('Bulk lesson plan creation completed', { count: results.length });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create lesson plans: ${error.message}`);
      }
    });
  }

  // Bulk delete lesson plans with file cleanup
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk lesson plan deletion', { count: ids.length });

        const LessonPlanModel = this.getModel('lesson_plan');

        // Handle LessonPlan file cascade cleanup for bulk delete
        const lessonPlans = await LessonPlanModel.findAll({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          attributes: ['id', 'file_configs'],
          transaction
        });

        const allFileIds = new Set(); // Use Set to avoid duplicates across lesson plans

        // Collect all file IDs from all lesson plans
        for (const lessonPlan of lessonPlans) {
          await this.collectFileIdsFromLessonPlan(lessonPlan, allFileIds);
        }

        if (allFileIds.size > 0) {
          ludlog.generic('Cleaning up lesson plan files', {
            lessonPlanCount: lessonPlans.length,
            fileCount: allFileIds.size
          });

          // Delete each referenced File entity (this will trigger their S3 cleanup)
          for (const fileId of allFileIds) {
            await this.cleanupFileEntity(fileId, { transaction });
          }
        }

        // Delete products that reference these lesson plan entities
        const deletedProducts = await this.models.Product.destroy({
          where: {
            product_type: 'lesson_plan',
            entity_id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        // Delete the lesson plan entities
        const deletedEntities = await LessonPlanModel.destroy({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        ludlog.generic('Bulk lesson plan deletion completed', {
          deletedEntities,
          deletedProducts,
          cleanedFiles: allFileIds.size
        });

        return {
          deletedCount: deletedEntities,
          productCount: deletedProducts,
          ids: ids.slice(0, deletedEntities)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete lesson plans: ${error.message}`);
      }
    });
  }

  // Sanitize numeric fields (convert empty strings to null, parse integers)
  sanitizeNumericFields(data) {
    const sanitized = { ...data };

    const numericFields = ['estimated_duration', 'total_slides'];
    numericFields.forEach(field => {
      if (sanitized[field] === '' || sanitized[field] === undefined) {
        sanitized[field] = null;
      } else if (sanitized[field] !== null && !isNaN(sanitized[field])) {
        sanitized[field] = parseInt(sanitized[field]);
      }
    });

    return sanitized;
  }

  // Check if lesson plan should be validated
  shouldValidateLessonPlan(data) {
    return data.type_attributes?.supports_derived_access &&
           data.is_published === true &&
           data.type_attributes?.linked_products?.length > 0;
  }

  // Validate lesson plan using LessonPlanValidationService
  async validateLessonPlan(data, productId, createdBy) {
    try {
      // Dynamic import to avoid circular dependencies
      const LessonPlanValidationService = (await import('./LessonPlanValidationService.js')).default;

      ludlog.generic('Validating lesson plan linked products', {
        productId,
        linkedProductsCount: data.type_attributes?.linked_products?.length || 0,
        createdBy
      });

      const validationResult = await LessonPlanValidationService.validateLessonPlan(
        data,
        productId, // Use product ID for update validation, null for create
        createdBy
      );

      if (!validationResult.valid) {
        throw new BadRequestError(
          `Lesson plan validation failed: ${validationResult.errors.join(', ')}`,
          { errors: validationResult.errors }
        );
      }

      ludlog.auth('Lesson plan validation passed', {
        productId,
        linkedProductsCount: validationResult.statistics.linkedProductsCount,
        productTypes: validationResult.statistics.productTypes,
        totalLinkedValue: validationResult.statistics.totalLinkedValue
      });

      return validationResult;
    } catch (error) {
      throw error;
    }
  }

  // Clean up files referenced by lesson plan
  async cleanupLessonPlanFiles(lessonPlan, options = {}) {
    const { transaction } = options;

    try {
      // Get all file IDs referenced in the lesson plan's file_configs
      const fileConfigs = lessonPlan.file_configs || {};
      const files = fileConfigs.files || [];
      const fileIds = files.map(file => file.file_id).filter(Boolean);

      if (fileIds.length > 0) {
        ludlog.generic('Cleaning up lesson plan files', {
          lessonPlanId: lessonPlan.id,
          fileCount: fileIds.length
        });

        // Delete each referenced File entity (this will trigger their S3 cleanup)
        for (const fileId of fileIds) {
          await this.cleanupFileEntity(fileId, { transaction });
        }
      }
    } catch (lessonPlanError) {
      ludlog.generic('Lesson plan file cleanup failed, continuing with entity deletion', {
        lessonPlanId: lessonPlan.id,
        error: lessonPlanError.message
      });
      // Continue with entity deletion even if file cleanup fails
    }
  }

  // Collect file IDs from lesson plan (used in bulk operations)
  async collectFileIdsFromLessonPlan(lessonPlan, fileIdsSet) {
    const fileConfigs = lessonPlan.file_configs || {};
    const files = fileConfigs.files || [];
    const fileIds = files.map(file => file.file_id).filter(Boolean);
    fileIds.forEach(fileId => fileIdsSet.add(fileId));
  }

  // Clean up individual file entity
  async cleanupFileEntity(fileId, options = {}) {
    const { transaction } = options;

    try {
      const FileModel = this.getModel('file');
      const fileEntity = await FileModel.findByPk(fileId, { transaction });

      if (fileEntity) {
        // Delete File entity's S3 assets first
        const { deleteAllFileAssets } = await import('../routes/assets.js');
        await deleteAllFileAssets(fileId);

        // Then delete the File entity
        await fileEntity.destroy({ transaction });

        ludlog.generic('File entity cleaned up', { fileId });
      }
    } catch (fileError) {
      ludlog.generic('File cleanup failed', {
        fileId,
        error: fileError.message
      });
      // Continue with other files even if one fails
    }
  }

  // Create product-type entity with proper Product relationship (inherited from EntityService)
  async createProductTypeEntity(data, createdBy = null, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel();

      // Prepare the type-specific data (entity record)
      const entityFields = {
        ...data,
        id: generateId(), // Generate unique ID for the entity
        created_at: new Date(),
        updated_at: new Date()
      };

      // Remove fields that are definitely Product-only and don't belong in entity tables
      const productOnlyFields = ['product_type', 'short_description', 'is_published', 'price', 'category', 'image_url', 'has_image', 'image_filename', 'youtube_video_id', 'youtube_video_title', 'tags', 'target_audience', 'type_attributes', 'access_days'];
      productOnlyFields.forEach(field => delete entityFields[field]);

      // LessonPlan keeps title, description, and other shared fields

      // Create the type-specific entity first
      const entity = await EntityModel.create(entityFields, { transaction: localTransaction });

      // Extract fields that belong to the Product table
      const productFields = {
        id: data.id || generateId(),
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        product_type: 'lesson_plan',
        entity_id: entity.id,
        price: data.price || 0,
        is_published: data.is_published || false,
        image_url: data.image_url,
        youtube_video_id: data.youtube_video_id,
        youtube_video_title: data.youtube_video_title,
        tags: data.tags || [],
        target_audience: data.target_audience,
        type_attributes: data.type_attributes || {},
        access_days: parseInt(data.access_days) ? parseInt(data.access_days) : null,
        creator_user_id: createdBy,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create the Product record with entity_id reference
      const product = await this.models.Product.create(productFields, { transaction: localTransaction });

      if (!transaction) {
        await localTransaction.commit();
      }

      // Return combined data structure
      return {
        ...product.toJSON(),
        lesson_plan: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw new Error(`Failed to create lesson plan: ${error.message}`);
    }
  }

  // Update product-type entity with proper Product + Entity handling
  async updateProductTypeEntity(entityId, data, updatedBy = null, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel();

      // Find existing entity
      const entity = await EntityModel.findByPk(entityId, { transaction: localTransaction });
      if (!entity) {
        throw new Error('Lesson plan not found');
      }

      // Find the product that references this entity
      const product = await this.models.Product.findOne({
        where: {
          product_type: 'lesson_plan',
          entity_id: entityId
        },
        transaction: localTransaction
      });

      if (!product) {
        throw new Error(`Product not found for lesson plan ${entityId}`);
      }

      // Separate fields that belong to Product vs Entity
      const productFields = {
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        price: data.price,
        is_published: data.is_published,
        image_url: data.image_url,
        has_image: data.has_image,
        image_filename: data.image_filename,
        marketing_video_type: data.marketing_video_type,
        marketing_video_id: data.marketing_video_id,
        marketing_video_title: data.marketing_video_title,
        marketing_video_duration: data.marketing_video_duration,
        tags: data.tags,
        target_audience: data.target_audience,
        type_attributes: data.type_attributes,
        access_days: parseInt(data.access_days) ? parseInt(data.access_days) : null,
        content_topic_id: data.content_topic_id,
        creator_user_id: data.creator_user_id,
        updated_at: new Date(),
        ...(updatedBy && { updated_by: updatedBy })
      };

      // Remove undefined fields from product update
      Object.keys(productFields).forEach(key => {
        if (productFields[key] === undefined) {
          delete productFields[key];
        }
      });

      // Don't allow updating certain Product fields
      delete productFields.id;
      delete productFields.created_at;
      delete productFields.product_type;
      delete productFields.entity_id;

      // Prepare entity update data (everything except Product fields)
      const entityFields = { ...data };
      const productOnlyFields = [
        'title', 'short_description', 'description', 'category', 'product_type',
        'price', 'is_published', 'image_url', 'has_image', 'image_filename',
        'marketing_video_type', 'marketing_video_id', 'marketing_video_title', 'marketing_video_duration',
        'tags', 'target_audience', 'type_attributes', 'access_days', 'content_topic_id', 'creator_user_id'
      ];

      productOnlyFields.forEach(field => delete entityFields[field]);

      entityFields.updated_at = new Date();
      if (updatedBy) entityFields.updated_by = updatedBy;

      // Don't allow updating certain entity fields
      delete entityFields.id;
      delete entityFields.created_at;

      // Update both Product and Entity
      await product.update(productFields, { transaction: localTransaction });
      await entity.update(entityFields, { transaction: localTransaction });

      if (!transaction) {
        await localTransaction.commit();
      }

      // Return combined result
      return {
        ...product.toJSON(),
        lesson_plan: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw error;
    }
  }

  // Delete product with cascade delete to entity
  async deleteProductWithEntity(productId, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      // Find the product
      const product = await this.models.Product.findByPk(productId, { transaction: localTransaction });
      if (!product) {
        throw new Error('Product not found');
      }

      const { product_type, entity_id } = product;

      // Delete the entity first (with file cleanup)
      if (entity_id) {
        const EntityModel = this.getModel();
        const entity = await EntityModel.findByPk(entity_id, { transaction: localTransaction });
        if (entity) {
          // Clean up lesson plan files
          await this.cleanupLessonPlanFiles(entity, { transaction: localTransaction });
          await entity.destroy({ transaction: localTransaction });
        }
      }

      // Delete the product
      await product.destroy({ transaction: localTransaction });

      if (!transaction) {
        await localTransaction.commit();
      }

      return { id: productId, deleted: true, entityDeleted: !!entity_id };
    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw error;
    }
  }
}

export default new LessonPlanProductService();