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
      type: DataTypes.STRING
    },
    youtube_video_title: {
      type: DataTypes.STRING
    },
    file_url: {
      type: DataTypes.STRING
    },
    preview_file_url: {
      type: DataTypes.STRING
    },
    file_type: {
      type: DataTypes.STRING
    },
    downloads_count: {
      type: DataTypes.DECIMAL,
      defaultValue: 0
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    target_audience: {
      type: DataTypes.STRING
    },
    access_days: {
      type: DataTypes.DECIMAL
    },
    is_lifetime_access: {
      type: DataTypes.BOOLEAN
    },
    workshop_id: {
      type: DataTypes.STRING
    },
    course_modules: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    total_duration_minutes: {
      type: DataTypes.DECIMAL
    },
    is_sample: {
      type: DataTypes.BOOLEAN
    },
    creator_user_id: {
      type: DataTypes.STRING,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    workshop_type: {
      type: DataTypes.STRING
    },
    video_file_url: {
      type: DataTypes.STRING
    },
    scheduled_date: {
      type: DataTypes.DATE
    },
    meeting_link: {
      type: DataTypes.STRING
    },
    meeting_password: {
      type: DataTypes.STRING
    },
    meeting_platform: {
      type: DataTypes.STRING
    },
    max_participants: {
      type: DataTypes.INTEGER
    },
    duration_minutes: {
      type: DataTypes.INTEGER
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
      { fields: ['is_sample'] },
      { fields: ['product_type'] }
    ]
  });

  Product.associate = function(models) {
    Product.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator'
    });
  };

  return Product;
};