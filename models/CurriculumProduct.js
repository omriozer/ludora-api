import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const CurriculumProduct = sequelize.define('CurriculumProduct', {
    curriculum_item_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'curriculum_item',
        key: 'id'
      },
      comment: 'Reference to curriculum item'
    },
    product_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'product',
        key: 'id'
      },
      comment: 'Reference to product'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'curriculum_product',
    timestamps: false, // Manual created_at only
    indexes: [
      {
        fields: ['curriculum_item_id']
      },
      {
        fields: ['product_id']
      },
      {
        unique: true,
        fields: ['curriculum_item_id', 'product_id'],
        name: 'curriculum_product_pkey'
      }
    ]
  });

  CurriculumProduct.associate = function(models) {
    // Belongs to curriculum item
    CurriculumProduct.belongsTo(models.CurriculumItem, {
      foreignKey: 'curriculum_item_id',
      as: 'curriculumItem'
    });

    // Belongs to product
    CurriculumProduct.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product'
    });
  };

  return CurriculumProduct;
};