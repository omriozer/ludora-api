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
    youtube_video_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    youtube_video_title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    marketing_video_title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    marketing_video_duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    target_audience: {
      type: DataTypes.STRING
    },
    difficulty_level: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['beginner', 'intermediate', 'advanced']]
      }
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
      { fields: ['difficulty_level'] },
      { fields: ['access_days'] },
      {
        unique: true,
        fields: ['product_type', 'entity_id'],
        name: 'unique_product_type_entity_id'
      }
    ]
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