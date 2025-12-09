import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { constructS3Path } from '../utils/s3PathUtils.js';
import fileService from './FileService.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * CourseProductService - Domain-specific service for Course products
 *
 * Handles:
 * - Course creation with normalized product structure
 * - Course-specific business logic (to be expanded)
 * - Marketing video cleanup
 * - Standard Product-Entity coordination
 */
class CourseProductService extends BaseProductService {
  constructor() {
    super('course');
  }

  // Create course with normalized product structure
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Creating course product', { createdBy });

        // Use normalized product structure
        const result = await this.createProductTypeEntity(data, createdBy, { transaction });

        ludlog.generic('Course product created successfully', {
          productId: result.id,
          entityId: result.entity_id
        });

        return result;
      } catch (error) {
        throw new Error(`Failed to create course: ${error.message}`);
      }
    });
  }

  // Update course with normalized product structure
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating course product', { courseId: id, updatedBy });

        // Determine if this is a Product ID or Entity ID
        let entityId = id;
        let isProductId = false;

        const product = await this.models.Product.findOne({
          where: { id, product_type: 'course' },
          transaction
        });

        if (product) {
          entityId = product.entity_id;
          isProductId = true;
        }

        const result = await this.updateProductTypeEntity(entityId, data, updatedBy, { transaction });

        ludlog.generic('Course product updated successfully', {
          courseId: id,
          entityId,
          isProductId
        });

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  // Delete course with marketing video cleanup
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting course product', { courseId: id });

        // Check if this is a product deletion or entity deletion
        const product = await this.models.Product.findByPk(id, { transaction });

        if (product && product.product_type === 'course') {
          // This is a product deletion
          const result = await this.deleteProductWithEntity(id, { transaction });
          return result;
        } else {
          // This is an entity deletion
          const CourseModel = this.getModel('course');
          const course = await CourseModel.findByPk(id, { transaction });

          if (!course) {
            throw new Error('Course not found');
          }

          // Handle marketing video cleanup
          try {
            const marketingVideoKey = constructS3Path('course', id, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            ludlog.generic('Marketing video cleanup failed for course', {
              courseId: id,
              error: videoError.message
            });
            // Marketing video might not exist, which is okay
          }

          // Find and delete any product referencing this entity
          const referencingProduct = await this.models.Product.findOne({
            where: {
              product_type: 'course',
              entity_id: id
            },
            transaction
          });

          if (referencingProduct) {
            await referencingProduct.destroy({ transaction });
          }

          // Delete the Course entity
          await course.destroy({ transaction });

          ludlog.generic('Course entity deleted successfully', {
            courseId: id,
            productDeleted: !!referencingProduct
          });

          return { id, deleted: true, productDeleted: !!referencingProduct };
        }
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create courses
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk course creation', {
          count: dataArray.length,
          createdBy
        });

        const results = [];

        for (const data of dataArray) {
          const result = await this.createProductTypeEntity(data, createdBy, { transaction });
          results.push(result);
        }

        ludlog.generic('Bulk course creation completed', { count: results.length });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create courses: ${error.message}`);
      }
    });
  }

  // Bulk delete courses with marketing video cleanup
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk course deletion', { count: ids.length });

        // Handle marketing video cleanup for each course
        for (const courseId of ids) {
          try {
            const marketingVideoKey = constructS3Path('course', courseId, 'marketing-video', 'video.mp4');
            await fileService.deleteS3Object(marketingVideoKey);
          } catch (videoError) {
            ludlog.generic('Marketing video cleanup failed for course in bulk delete', {
              courseId,
              error: videoError.message
            });
            // Continue with other courses even if one video cleanup fails
          }
        }

        // Delete products that reference these course entities
        const deletedProducts = await this.models.Product.destroy({
          where: {
            product_type: 'course',
            entity_id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        // Delete the course entities
        const CourseModel = this.getModel('course');
        const deletedEntities = await CourseModel.destroy({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          transaction
        });

        ludlog.generic('Bulk course deletion completed', {
          deletedEntities,
          deletedProducts
        });

        return {
          deletedCount: deletedEntities,
          productCount: deletedProducts,
          ids: ids.slice(0, deletedEntities)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete courses: ${error.message}`);
      }
    });
  }

  // Placeholder: Course-specific methods can be added here as the product type evolves

  // Example: Course lesson management (future implementation)
  // async addLesson(courseId, lessonData) {
  //   // Implementation for course lesson management
  // }

  // Example: Course progress tracking (future implementation)
  // async trackProgress(courseId, studentId, progress) {
  //   // Implementation for course progress tracking
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

      // Course doesn't have title in entity table - it uses course-specific fields
      delete entityFields.title;

      const entity = await EntityModel.create(entityFields, { transaction: localTransaction });

      const productFields = {
        id: data.id || generateId(),
        title: data.title,
        short_description: data.short_description,
        description: data.description,
        category: data.category,
        product_type: 'course',
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
        course: entity.toJSON()
      };

    } catch (error) {
      if (!transaction) {
        await localTransaction.rollback();
      }
      throw new Error(`Failed to create course: ${error.message}`);
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
        throw new Error('Course not found');
      }

      const product = await this.models.Product.findOne({
        where: {
          product_type: 'course',
          entity_id: entityId
        },
        transaction: localTransaction
      });

      if (!product) {
        throw new Error(`Product not found for course ${entityId}`);
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
        course: entity.toJSON()
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
          const marketingVideoKey = constructS3Path('course', entity_id, 'marketing-video', 'video.mp4');
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

export default new CourseProductService();