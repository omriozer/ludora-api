import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import fileService from './FileService.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * WorkshopProductService - Domain-specific service for Workshop products
 *
 * Handles:
 * - Workshop creation with normalized product structure
 * - Workshop-specific business logic (to be expanded)
 * - Marketing video cleanup
 * - Standard Product-Entity coordination
 */
class WorkshopProductService extends BaseProductService {
  constructor() {
    super('workshop');
  }

  // Create workshop with normalized product structure
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Creating workshop product', { createdBy });

        // Use normalized product structure
        const result = await this.createProductTypeEntity(data, createdBy, { transaction });

        ludlog.generic('Workshop product created successfully', {
          productId: result.id,
          entityId: result.entity_id
        });

        return result;
      } catch (error) {
        throw new Error(`Failed to create workshop: ${error.message}`);
      }
    });
  }

  // Update workshop with normalized product structure
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating workshop product', { workshopId: id, updatedBy });

        // Determine if this is a Product ID or Entity ID
        let entityId = id;
        let isProductId = false;

        const product = await this.models.Product.findOne({
          where: { id, product_type: 'workshop' },
          transaction
        });

        if (product) {
          entityId = product.entity_id;
          isProductId = true;
        }

        const result = await this.updateProductTypeEntity(entityId, data, updatedBy, { transaction });

        ludlog.generic('Workshop product updated successfully', {
          workshopId: id,
          entityId,
          isProductId
        });

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  // Delete workshop with marketing video cleanup
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting workshop product', { workshopId: id });

        // Check if this is a product deletion or entity deletion
        const product = await this.models.Product.findByPk(id, { transaction });

        if (product && product.product_type === 'workshop') {
          // This is a product deletion
          const result = await this.deleteProductWithEntity(id, { transaction });
          return result;
        } else {
          // This is an entity deletion
          const WorkshopModel = this.getModel('workshop');
          const workshop = await WorkshopModel.findByPk(id, { transaction });

          if (!workshop) {
            throw new Error('Workshop not found');
          }

          // Handle marketing video cleanup
          try {
            const marketingVideoKey = constructS3Path('workshop', id, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            ludlog.generic('Marketing video cleanup failed for workshop', {
              workshopId: id,
              error: videoError.message
            });
            // Marketing video might not exist, which is okay
          }

          // Find and delete any product referencing this entity
          const referencingProduct = await this.models.Product.findOne({
            where: {
              product_type: 'workshop',
              entity_id: id
            },
            transaction
          });

          if (referencingProduct) {
            await referencingProduct.destroy({ transaction });
          }

          // Delete the Workshop entity
          await workshop.destroy({ transaction });

          ludlog.generic('Workshop entity deleted successfully', {
            workshopId: id,
            productDeleted: !!referencingProduct
          });

          return { id, deleted: true, productDeleted: !!referencingProduct };
        }
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create workshops
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk workshop creation', {
          count: dataArray.length,
          createdBy
        });

        const results = [];

        for (const data of dataArray) {
          const result = await this.createProductTypeEntity(data, createdBy, { transaction });
          results.push(result);
        }

        ludlog.generic('Bulk workshop creation completed', { count: results.length });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create workshops: ${error.message}`);
      }
    });
  }

  // Bulk delete workshops with marketing video cleanup
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk workshop deletion', { count: ids.length });

        // Handle marketing video cleanup for each workshop
        for (const workshopId of ids) {
          try {
            const marketingVideoKey = constructS3Path('workshop', workshopId, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            ludlog.generic('Marketing video cleanup failed for workshop in bulk delete', {
              workshopId,
              error: videoError.message
            });
            // Continue with other workshops even if one video cleanup fails
          }
        }

        // Delete products that reference these workshop entities
        const deletedProducts = await this.models.Product.destroy({
          where: {
            product_type: 'workshop',
            entity_id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        // Delete the workshop entities
        const WorkshopModel = this.getModel('workshop');
        const deletedEntities = await WorkshopModel.destroy({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        ludlog.generic('Bulk workshop deletion completed', {
          deletedEntities,
          deletedProducts
        });

        return {
          deletedCount: deletedEntities,
          productCount: deletedProducts,
          ids: ids.slice(0, deletedEntities)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete workshops: ${error.message}`);
      }
    });
  }

  // Placeholder: Workshop-specific methods can be added here as the product type evolves

  // Example: Workshop enrollment management (future implementation)
  // async enrollStudent(workshopId, studentId) {
  //   // Implementation for workshop-specific enrollment
  // }

  // Example: Workshop session scheduling (future implementation)
  // async scheduleSession(workshopId, sessionData) {
  //   // Implementation for workshop session management
  // }

  // Use standard normalized product creation pattern
  async createProductTypeEntity(data, createdBy = null, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel();

      const entityFields = {
        ...data,
        id: generateId(),
        created_at: new Date(),
        updated_at: new Date()
      };

      // Remove Product-only fields
      const productOnlyFields = ['product_type', 'short_description', 'is_published', 'price', 'category', 'image_url', 'has_image', 'image_filename', 'youtube_video_id', 'youtube_video_title', 'tags', 'target_audience', 'type_attributes', 'access_days'];
      productOnlyFields.forEach(field => delete entityFields[field]);

      // Workshop doesn't have title in entity table - it uses workshop-specific fields
      delete entityFields.title;

      const entity = await EntityModel.create(entityFields, { transaction: localTransaction });

      const productFields = {
        id: data.id || generateId(),
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        product_type: 'workshop',
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

      const product = await this.models.Product.create(productFields, { transaction: localTransaction });

      if (!transaction) {
        await localTransaction.commit();
      }

      return {
        ...product.toJSON(),
        workshop: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw new Error(`Failed to create workshop: ${error.message}`);
    }
  }

  // Use standard normalized product update pattern
  async updateProductTypeEntity(entityId, data, updatedBy = null, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      const EntityModel = this.getModel();

      const entity = await EntityModel.findByPk(entityId, { transaction: localTransaction });
      if (!entity) {
        throw new Error('Workshop not found');
      }

      const product = await this.models.Product.findOne({
        where: {
          product_type: 'workshop',
          entity_id: entityId
        },
        transaction: localTransaction
      });

      if (!product) {
        throw new Error(`Product not found for workshop ${entityId}`);
      }

      // Separate Product vs Entity fields
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

      Object.keys(productFields).forEach(key => {
        if (productFields[key] === undefined) {
          delete productFields[key];
        }
      });

      delete productFields.id;
      delete productFields.created_at;
      delete productFields.product_type;
      delete productFields.entity_id;

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

      delete entityFields.id;
      delete entityFields.created_at;

      await product.update(productFields, { transaction: localTransaction });
      await entity.update(entityFields, { transaction: localTransaction });

      if (!transaction) {
        await localTransaction.commit();
      }

      return {
        ...product.toJSON(),
        workshop: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw error;
    }
  }

  // Standard product-entity deletion with marketing video cleanup
  async deleteProductWithEntity(productId, options = {}) {
    const { transaction } = options;
    const localTransaction = transaction || await this.models.sequelize.transaction();

    try {
      const product = await this.models.Product.findByPk(productId, { transaction: localTransaction });
      if (!product) {
        throw new Error('Product not found');
      }

      const { entity_id } = product;

      // Handle marketing video cleanup
      if (entity_id) {
        try {
          const marketingVideoKey = constructS3Path('workshop', entity_id, 'marketing-video', 'video.mp4');
          await fileService.deleteS3Object(marketingVideoKey);
        } catch (videoError) {
          // Marketing video might not exist, which is okay
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

export default new WorkshopProductService();