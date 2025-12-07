import BaseProductService from './BaseProductService.js';
import { generateId } from '../models/baseModel.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import { ludlog } from '../lib/ludlog.js';
import { Op } from 'sequelize';

/**
 * BundleProductService - Domain-specific service for Bundle products
 *
 * Handles:
 * - Bundle creation without entity table (Product-only)
 * - Bundle validation with BundleValidationService
 * - Bundle composition and pricing validation
 * - Auto-purchase cascade operations
 * - Bundle-specific publishing rules
 */
class BundleProductService extends BaseProductService {
  constructor() {
    super('bundle');
  }

  // Create bundle product (Product-only, no entity table)
  async create(data, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Creating bundle product', {
          itemCount: data.type_attributes?.bundle_items?.length || 0,
          createdBy
        });

        // BUNDLE VALIDATION: Only validate when publishing bundle (is_published: true)
        if (data.type_attributes?.is_bundle && data.is_published === true) {
          await this.validateBundle(data, createdBy);
        }

        // Bundle products only create Product record (no entity table)
        const productFields = {
          id: data.id || generateId(),
          title: data.title,
          description: data.description,
          category: data.category,
          product_type: 'bundle',
          entity_id: null, // Bundles have no entity table
          price: data.price || 0,
          is_published: data.is_published || false,
          image_url: data.image_url,
          youtube_video_id: data.youtube_video_id,
          youtube_video_title: data.youtube_video_title,
          tags: data.tags || [],
          target_audience: data.target_audience,
          type_attributes: data.type_attributes || {}, // Bundle composition and pricing info
          access_days: parseInt(data.access_days) ? parseInt(data.access_days) : null,
          creator_user_id: createdBy,
          created_at: new Date(),
          updated_at: new Date()
        };

        const product = await this.models.Product.create(productFields, { transaction });

        ludlog.generic('Bundle product created successfully', {
          bundleId: product.id,
          itemCount: data.type_attributes?.bundle_items?.length || 0,
          savings: data.type_attributes?.savings || 0
        });

        return product;
      } catch (error) {
        throw new Error(`Failed to create bundle: ${error.message}`);
      }
    });
  }

  // Update bundle product with validation
  async update(id, data, updatedBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Updating bundle product', { bundleId: id, updatedBy });

        // Find the bundle product
        const product = await this.models.Product.findByPk(id, { transaction });
        if (!product) {
          throw new Error('Bundle product not found');
        }

        if (product.product_type !== 'bundle') {
          throw new Error('Product is not a bundle');
        }

        // BUNDLE VALIDATION: Only validate when publishing bundle (is_published: true)
        if (data.type_attributes?.is_bundle && data.is_published === true) {
          await this.validateBundle(data, product.creator_user_id, product);
        }

        // Prepare bundle update data
        const updateData = {
          ...data,
          updated_at: new Date(),
          ...(updatedBy && { updated_by: updatedBy })
        };

        // Remove fields that shouldn't be updated
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.product_type;
        delete updateData.entity_id;

        await product.update(updateData, { transaction });

        ludlog.generic('Bundle product updated successfully', {
          bundleId: id,
          itemCount: data.type_attributes?.bundle_items?.length || 0
        });

        return product;
      } catch (error) {
        throw error;
      }
    });
  }

  // Delete bundle with cascade delete to individual purchases
  async delete(id) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Deleting bundle product', { bundleId: id });

        // Find the bundle product
        const product = await this.models.Product.findByPk(id, { transaction });
        if (!product) {
          throw new Error('Bundle product not found');
        }

        // BUNDLE CASCADE DELETE: If this is a bundle, cascade delete individual purchases
        if (product.type_attributes?.is_bundle) {
          // Find all individual purchases created from this bundle
          const bundlePurchases = await this.models.Purchase.findAll({
            where: {
              purchasable_type: 'bundle',
              purchasable_id: id,
              'metadata.is_bundle_purchase': true
            },
            transaction
          });

          ludlog.generic('Found bundle purchases to cascade delete', {
            bundleId: id,
            purchaseCount: bundlePurchases.length
          });

          for (const bundlePurchase of bundlePurchases) {
            // Find and delete all individual purchases linked to this bundle purchase
            const deletedIndividualCount = await this.models.Purchase.destroy({
              where: {
                bundle_purchase_id: bundlePurchase.id
              },
              transaction
            });

            ludlog.generic('Deleted individual purchases for bundle purchase', {
              bundlePurchaseId: bundlePurchase.id,
              individualCount: deletedIndividualCount
            });

            // Delete the main bundle purchase
            await bundlePurchase.destroy({ transaction });
          }
        }

        // Delete the bundle product (no entity to delete)
        await product.destroy({ transaction });

        ludlog.generic('Bundle product deleted successfully', { bundleId: id });

        return { id, deleted: true, entityDeleted: false }; // No entity table for bundles
      } catch (error) {
        throw error;
      }
    });
  }

  // Bulk create bundles
  async bulkCreate(dataArray, createdBy = null) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk bundle creation', {
          count: dataArray.length,
          createdBy
        });

        const results = [];

        for (const data of dataArray) {
          // Validate each bundle if being published
          if (data.type_attributes?.is_bundle && data.is_published === true) {
            await this.validateBundle(data, createdBy);
          }

          const productFields = {
            id: data.id || generateId(),
            title: data.title,
            description: data.description,
            category: data.category,
            product_type: 'bundle',
            entity_id: null, // Bundles have no entity table
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

          const product = await this.models.Product.create(productFields, { transaction });
          results.push(product);
        }

        ludlog.generic('Bulk bundle creation completed', { count: results.length });

        return results;
      } catch (error) {
        throw new Error(`Failed to bulk create bundles: ${error.message}`);
      }
    });
  }

  // Bulk delete bundles with cascade delete
  async bulkDelete(ids) {
    return await this.withTransaction(async (transaction) => {
      try {
        ludlog.generic('Starting bulk bundle deletion', { count: ids.length });

        // Handle bundle cascade deletes for each bundle
        for (const bundleId of ids) {
          const product = await this.models.Product.findByPk(bundleId, { transaction });

          if (product && product.type_attributes?.is_bundle) {
            // Find all individual purchases created from this bundle
            const bundlePurchases = await this.models.Purchase.findAll({
              where: {
                purchasable_type: 'bundle',
                purchasable_id: bundleId,
                'metadata.is_bundle_purchase': true
              },
              transaction
            });

            for (const bundlePurchase of bundlePurchases) {
              // Delete all individual purchases linked to this bundle purchase
              await this.models.Purchase.destroy({
                where: {
                  bundle_purchase_id: bundlePurchase.id
                },
                transaction
              });

              // Delete the main bundle purchase
              await bundlePurchase.destroy({ transaction });
            }
          }
        }

        // Delete the bundle products
        const deletedCount = await this.models.Product.destroy({
          where: {
            id: {
              [Op.in]: ids
            },
            product_type: 'bundle'
          },
          transaction
        });

        ludlog.generic('Bulk bundle deletion completed', {
          deletedCount,
          requestedCount: ids.length
        });

        return {
          deletedCount,
          ids: ids.slice(0, deletedCount)
        };
      } catch (error) {
        throw new Error(`Failed to bulk delete bundles: ${error.message}`);
      }
    });
  }

  // Bundle validation using BundleValidationService
  async validateBundle(data, createdBy, existingProduct = null) {
    try {
      // Dynamic import to avoid circular dependencies
      const BundleValidationService = (await import('./BundleValidationService.js')).default;

      // Get user role for ownership validation
      const user = createdBy ? await this.models.User.findByPk(createdBy) : null;
      const userRole = user?.role || null;

      // Use existing product's price if not provided in data
      const bundlePrice = data.price !== undefined
        ? data.price
        : existingProduct?.price || 0;

      // Use bundle items from data or existing product
      const bundleItems = data.type_attributes?.bundle_items ||
        existingProduct?.type_attributes?.bundle_items || [];

      ludlog.generic('Validating bundle composition', {
        itemCount: bundleItems.length,
        bundlePrice,
        userRole
      });

      // Validate bundle composition and pricing
      const validationResult = await BundleValidationService.validateBundle(
        bundleItems,
        bundlePrice,
        createdBy,
        userRole
      );

      if (!validationResult.valid) {
        throw new BadRequestError(
          `Bundle validation failed: ${validationResult.errors.join(', ')}`,
          { errors: validationResult.errors }
        );
      }

      // Enrich type_attributes with validated pricing info
      if (data.type_attributes) {
        data.type_attributes = {
          ...data.type_attributes,
          original_total_price: validationResult.pricingInfo.originalTotal,
          bundle_price: validationResult.pricingInfo.bundlePrice,
          savings: validationResult.pricingInfo.savings,
          savings_percentage: validationResult.pricingInfo.savingsPercentage
        };
      }

      ludlog.generic('Bundle validation passed', {
        originalTotal: validationResult.pricingInfo.originalTotal,
        bundlePrice: validationResult.pricingInfo.bundlePrice,
        savings: validationResult.pricingInfo.savings,
        savingsPercentage: validationResult.pricingInfo.savingsPercentage
      });

      return validationResult;
    } catch (error) {
      throw error;
    }
  }

  // Override find method to handle bundle-specific queries
  async find(query = {}, options = {}) {
    try {
      // Add bundle-specific filter
      const bundleQuery = {
        ...query,
        product_type: 'bundle' // Ensure we only get bundle products
      };

      // Use Product model directly since bundles don't have entity tables
      const ProductModel = this.models.Product;

      const { sort, include, ...whereQuery } = bundleQuery;
      const where = this.buildWhereClause(whereQuery, 'bundle');

      let order = [['created_at', 'DESC']];
      if (sort) {
        order = this.processSortParameter(sort);
      }

      const queryOptions = {
        where,
        order,
        ...options
      };

      // Include creator information
      if (this.shouldIncludeCreator()) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }

        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false
        });
      }

      if (options.limit) queryOptions.limit = parseInt(options.limit);
      if (options.offset) queryOptions.offset = parseInt(options.offset);

      const results = await ProductModel.findAll(queryOptions);

      // Post-process creator data
      if (this.shouldIncludeCreator()) {
        results.forEach(bundle => {
          if (!bundle.creator) {
            bundle.dataValues.creator = {
              id: null,
              full_name: 'Ludora',
              email: null
            };
          }
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to find bundles: ${error.message}`);
    }
  }

  // Override findById to use Product model directly
  async findById(id, include = null) {
    try {
      const ProductModel = this.models.Product;

      const queryOptions = {
        where: { id, product_type: 'bundle' }
      };

      // Include creator information
      if (this.shouldIncludeCreator()) {
        if (!queryOptions.include) {
          queryOptions.include = [];
        }

        queryOptions.include.push({
          model: this.models.User,
          as: 'creator',
          attributes: ['id', 'full_name', 'email'],
          required: false
        });
      }

      const bundle = await ProductModel.findOne(queryOptions);

      if (!bundle) {
        throw new Error('Bundle not found');
      }

      // Post-process creator data
      if (this.shouldIncludeCreator() && !bundle.creator) {
        bundle.dataValues.creator = {
          id: null,
          full_name: 'Ludora',
          email: null
        };
      }

      return bundle;
    } catch (error) {
      throw error;
    }
  }

  // Override count method to use Product model
  async count(query = {}) {
    try {
      const ProductModel = this.models.Product;
      const bundleQuery = {
        ...query,
        product_type: 'bundle'
      };
      const where = this.buildWhereClause(bundleQuery, 'bundle');

      return await ProductModel.count({ where });
    } catch (error) {
      throw new Error(`Failed to count bundles: ${error.message}`);
    }
  }

  // Override getModel to return Product model (bundles don't have entity model)
  getModel() {
    return this.models.Product;
  }

  // Override shouldIncludeCreator
  shouldIncludeCreator() {
    return true; // Bundles have creator_user_id in Product table
  }
}

export default new BundleProductService();