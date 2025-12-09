import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { NORMALIZED_PRODUCT_TYPES } from '../constants/productTypes.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * FileProductService - Domain-specific service for File products
 *
 * Handles:
 * - File creation with S3 integration
 * - File type validation
 * - Asset cleanup coordination
 * - Hebrew filename support
 * - API-proxied file serving patterns
 */
class FileProductService extends BaseProductService {
  constructor() {
    super('file');
  }

  // Create file product with proper Product-Entity coordination
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Creating file product', { createdBy });

        // File products use normalized product structure
        const result = await this.createProductTypeEntity(data, createdBy, { transaction });

        ludlog.generic('File product created successfully', {
          productId: result.id,
          entityId: result.entity_id
        });

        return result;
      } catch (error) {
        throw new Error(`Failed to create file: ${error.message}`);
      }
    });
  }

  // Update file product with proper Product + Entity handling
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating file product', { fileId: id, updatedBy });

        // For file products, we need to determine if this is a Product ID or Entity ID
        let entityId = id;
        let isProductId = false;

        // Check if this is a Product ID by looking for a product record
        const product = await this.models.Product.findOne({
          where: { id, product_type: 'file' },
          transaction
        });

        if (product) {
          entityId = product.entity_id;
          isProductId = true;
        }

        const result = await this.updateProductTypeEntity(entityId, data, updatedBy, { transaction });

        ludlog.generic('File product updated successfully', {
          fileId: id,
          entityId,
          isProductId
        });

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  // Delete file with S3 asset cleanup
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting file product', { fileId: id });

        // Check if this is a product deletion or entity deletion
        const product = await this.models.Product.findByPk(id, { transaction });

        if (product && product.product_type === 'file') {
          // This is a product deletion - use deleteProductWithEntity
          const result = await this.deleteProductWithEntity(id, { transaction });
          return result;
        } else {
          // This is an entity deletion - handle File entity with S3 cleanup
          const FileModel = this.getModel('file');
          const fileEntity = await FileModel.findByPk(id, { transaction });

          if (!fileEntity) {
            throw new Error('File not found');
          }

          // Delete S3 assets first
          try {
            const { deleteAllFileAssets } = await import('../routes/assets.js');
            await deleteAllFileAssets(id);
          } catch (fileError) {
            ludlog.generic('S3 cleanup failed for file, continuing with deletion', {
              fileId: id,
              error: fileError.message
            });
            // Continue with deletion even if file cleanup fails
          }

          // Find and delete any product referencing this entity
          const referencingProduct = await this.models.Product.findOne({
            where: {
              product_type: 'file',
              entity_id: id
            },
            transaction
          });

          if (referencingProduct) {
            await referencingProduct.destroy({ transaction });
          }

          // Delete the File entity
          await fileEntity.destroy({ transaction });

          ludlog.generic('File entity deleted successfully', {
            fileId: id,
            productDeleted: !!referencingProduct
          });

          return { id, deleted: true, productDeleted: !!referencingProduct };
        }
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create file products
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        const results = [];

        for (const data of dataArray) {
          const result = await this.createProductTypeEntity(data, createdBy, { transaction });
          results.push(result);
        }

        ludlog.generic('Bulk file creation completed', {
          count: results.length,
          createdBy
        });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create files: ${error.message}`);
      }
    });
  }

  // Bulk delete files with S3 cleanup
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk file deletion', { count: ids.length });

        const FileModel = this.getModel('file');

        // Handle File entity S3 cleanup before database deletion
        // Import cleanup function
        const { deleteAllFileAssets } = await import('../routes/assets.js');

        // Clean up S3 assets for each file
        for (const fileId of ids) {
          try {
            await deleteAllFileAssets(fileId);
          } catch (cleanupError) {
            ludlog.generic('S3 cleanup failed for file in bulk delete, continuing', {
              fileId,
              error: cleanupError.message
            });
            // Continue with other files even if one cleanup fails
          }
        }

        // Delete products that reference these file entities
        const deletedProducts = await this.models.Product.destroy({
          where: {
            product_type: 'file',
            entity_id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        // Delete the file entities
        const deletedEntities = await FileModel.destroy({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        ludlog.generic('Bulk file deletion completed', {
          deletedEntities,
          deletedProducts,
          requestedIds: ids.length
        });

        return {
          deletedCount: deletedEntities,
          productCount: deletedProducts,
          ids: ids.slice(0, deletedEntities)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete files: ${error.message}`);
      }
    });
  }

  // Create product-type entity with proper Product relationship (copied from EntityService)
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

      // File keeps title, description, and other shared fields since File model has them

      // Create the type-specific entity first
      const entity = await EntityModel.create(entityFields, { transaction: localTransaction });

      // Extract fields that belong to the Product table
      const productFields = {
        id: data.id || generateId(), // Use provided ID or generate new one
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        product_type: 'file',
        entity_id: entity.id, // Reference to the entity
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
        file: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw new Error(`Failed to create file: ${error.message}`);
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
        throw new Error('File not found');
      }

      // Find the product that references this entity
      const product = await this.models.Product.findOne({
        where: {
          product_type: 'file',
          entity_id: entityId
        },
        transaction: localTransaction
      });

      if (!product) {
        throw new Error(`Product not found for file ${entityId}`);
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
        file: entity.toJSON()
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

      // Delete S3 assets for the file first
      if (entity_id) {
        try {
          const { deleteAllFileAssets } = await import('../routes/assets.js');
          await deleteAllFileAssets(entity_id);
        } catch (fileError) {
          ludlog.generic('S3 cleanup failed during product deletion', {
            productId,
            entityId: entity_id,
            error: fileError.message
          });
          // Continue with deletion even if file cleanup fails
        }
      }

      // Delete the entity first
      if (entity_id) {
        const EntityModel = this.getModel();
        const entity = await EntityModel.findByPk(entity_id, { transaction: localTransaction });
        if (entity) {
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

export default new FileProductService();