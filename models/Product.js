import { DataTypes } from 'sequelize';
import { generateId } from './baseModel.js';

export default (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => generateId()
    },
    title: {
      type: DataTypes.STRING
    },
    short_description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT
    },
    category: {
      type: DataTypes.STRING
    },
    product_type: {
      type: DataTypes.STRING
    },
    price: {
      type: DataTypes.DECIMAL
    },
    is_published: {
      type: DataTypes.BOOLEAN
    },
    image_url: {
      type: DataTypes.STRING
    },
    marketing_video_type: {
      type: DataTypes.ENUM('youtube', 'uploaded'),
      allowNull: true,
      comment: 'Type of marketing video: youtube or uploaded file'
    },
    marketing_video_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'YouTube video ID or entity ID for uploaded videos'
    },
    marketing_video_title: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Title of the marketing video for display'
    },
    marketing_video_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration of the marketing video in seconds'
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    target_audience: {
      type: DataTypes.STRING
    },
    type_attributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Type-specific attributes based on product_type'
    },
    access_days: {
      type: DataTypes.DECIMAL,
      allowNull: true // NULL = lifetime access
    },
    creator_user_id: {
      type: DataTypes.STRING,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    entity_id: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'product',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['category'] },
      { fields: ['creator_user_id'] },
      { fields: ['is_published'] },
      { fields: ['product_type'] },
      { fields: ['entity_id'] },
      { fields: ['access_days'] },
      {
        unique: true,
        fields: ['product_type', 'entity_id'],
        name: 'unique_product_type_entity_id'
      }
    ]
  });

  // Hook to auto-set is_published=false for File products without documents
  Product.addHook('beforeSave', async (product, options) => {
    // Only check File products that are being set to published
    if (product.product_type === 'file' && product.is_published === true) {
      // Get the File entity
      const models = sequelize.models;
      const fileEntity = await models.File.findByPk(product.entity_id);

      // If File has no file_name, force is_published to false
      if (!fileEntity || !fileEntity.file_name) {
        product.is_published = false;
        console.log(`⚠️ Auto-set is_published=false for Product ${product.id} - File entity has no document`);
      }
    }
  });

  Product.associate = function(models) {
    Product.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator'
    });

    // Store models reference for polymorphic lookups
    Product.models = models;
  };

  // Access control methods
  Product.prototype.isLifetimeAccess = function() {
    return this.access_days === null || this.access_days === undefined;
  };

  Product.prototype.hasTimeLimit = function() {
    return !this.isLifetimeAccess();
  };

  Product.prototype.getAccessDuration = function() {
    return this.isLifetimeAccess() ? 'lifetime' : `${this.access_days} days`;
  };

  // Polymorphic association methods
  Product.prototype.getEntity = async function() {
    const models = this.constructor.models;
    const ModelClass = models[this.product_type.charAt(0).toUpperCase() + this.product_type.slice(1)];
    if (!ModelClass) {
      throw new Error(`Model for product_type '${this.product_type}' not found`);
    }
    return await ModelClass.findByPk(this.entity_id);
  };

  Product.prototype.getEntityWithData = async function() {
    const entity = await this.getEntity();
    return {
      ...this.toJSON(),
      [this.product_type]: entity ? entity.toJSON() : null
    };
  };

  // Static method to find product with entity data
  Product.findWithEntity = async function(productId) {
    const product = await this.findByPk(productId);
    if (!product) return null;
    return await product.getEntityWithData();
  };

  // Static method to create product with entity (for EntityService)
  Product.createWithEntity = async function(productData, entityData, transaction) {
    const models = this.models;

    // Create the entity first
    const EntityModel = models[productData.product_type.charAt(0).toUpperCase() + productData.product_type.slice(1)];
    if (!EntityModel) {
      throw new Error(`Model for product_type '${productData.product_type}' not found`);
    }

    const entity = await EntityModel.create(entityData, { transaction });

    // Create the product with entity_id reference
    const product = await this.create({
      ...productData,
      entity_id: entity.id
    }, { transaction });

    return { product, entity };
  };

  return Product;
};