'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Check if coupon table exists
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'coupon'
      );`
    );

    if (!tableExists[0][0].exists) {
      console.log('Coupon table does not exist, skipping migration');
      return;
    }

    console.log('Enhancing coupon table with new fields and improved structure...');

    // Get current table description
    const tableDescription = await queryInterface.describeTable('coupon');

    // Update existing columns with better types and defaults
    if (tableDescription.discount_value) {
      await queryInterface.changeColumn('coupon', 'discount_value', {
        type: DataTypes.DECIMAL(10,2),
        allowNull: true,
      });
    }

    if (tableDescription.minimum_amount) {
      await queryInterface.changeColumn('coupon', 'minimum_amount', {
        type: DataTypes.DECIMAL(10,2),
        allowNull: true,
      });
    }

    if (tableDescription.usage_limit) {
      await queryInterface.changeColumn('coupon', 'usage_limit', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }

    if (tableDescription.usage_count) {
      await queryInterface.changeColumn('coupon', 'usage_count', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (tableDescription.valid_until) {
      await queryInterface.changeColumn('coupon', 'valid_until', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    // Add default values to existing boolean columns
    if (tableDescription.is_visible) {
      await queryInterface.changeColumn('coupon', 'is_visible', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      });
    }

    if (tableDescription.is_admin_only) {
      await queryInterface.changeColumn('coupon', 'is_admin_only', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      });
    }

    if (tableDescription.allow_stacking) {
      await queryInterface.changeColumn('coupon', 'allow_stacking', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      });
    }

    if (tableDescription.is_active) {
      await queryInterface.changeColumn('coupon', 'is_active', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      });
    }

    // Add new columns for base requirements
    if (!tableDescription.targeting_type) {
      await queryInterface.addColumn('coupon', 'targeting_type', {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'general',
      });
    }

    if (!tableDescription.target_product_types) {
      await queryInterface.addColumn('coupon', 'target_product_types', {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: '[]',
      });
    }

    if (!tableDescription.target_product_ids) {
      await queryInterface.addColumn('coupon', 'target_product_ids', {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: '[]',
      });
    }

    if (!tableDescription.visibility) {
      await queryInterface.addColumn('coupon', 'visibility', {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'secret',
      });
    }

    // Add new columns for phase 1 extensions
    if (!tableDescription.user_segments) {
      await queryInterface.addColumn('coupon', 'user_segments', {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: '[]',
      });
    }

    if (!tableDescription.priority_level) {
      await queryInterface.addColumn('coupon', 'priority_level', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5,
      });
    }

    if (!tableDescription.max_discount_cap) {
      await queryInterface.addColumn('coupon', 'max_discount_cap', {
        type: DataTypes.DECIMAL(10,2),
        allowNull: true,
      });
    }

    if (!tableDescription.minimum_quantity) {
      await queryInterface.addColumn('coupon', 'minimum_quantity', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      });
    }

    if (!tableDescription.code_pattern) {
      await queryInterface.addColumn('coupon', 'code_pattern', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.auto_generated) {
      await queryInterface.addColumn('coupon', 'auto_generated', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      });
    }

    // Add new indexes for better performance
    try {
      await queryInterface.addIndex('coupon', {
        fields: ['targeting_type'],
        name: 'idx_coupon_targeting_type'
      });
    } catch (e) {
      console.log('Index idx_coupon_targeting_type already exists or failed to create');
    }

    try {
      await queryInterface.addIndex('coupon', {
        fields: ['visibility'],
        name: 'idx_coupon_visibility'
      });
    } catch (e) {
      console.log('Index idx_coupon_visibility already exists or failed to create');
    }

    try {
      await queryInterface.addIndex('coupon', {
        fields: ['priority_level'],
        name: 'idx_coupon_priority_level'
      });
    } catch (e) {
      console.log('Index idx_coupon_priority_level already exists or failed to create');
    }

    try {
      await queryInterface.addIndex('coupon', {
        fields: ['valid_until'],
        name: 'idx_coupon_valid_until'
      });
    } catch (e) {
      console.log('Index idx_coupon_valid_until already exists or failed to create');
    }

    try {
      await queryInterface.addIndex('coupon', {
        fields: ['is_active', 'visibility'],
        name: 'idx_coupon_active_visibility'
      });
    } catch (e) {
      console.log('Index idx_coupon_active_visibility already exists or failed to create');
    }

    // Migrate existing data to new structure
    await queryInterface.sequelize.query(`
      UPDATE coupon
      SET
        targeting_type = 'general',
        target_product_types = '[]',
        target_product_ids = '[]',
        visibility = 'secret',
        user_segments = '[]',
        priority_level = 5,
        minimum_quantity = 1,
        auto_generated = false
      WHERE
        targeting_type IS NULL
        OR target_product_types IS NULL
        OR target_product_ids IS NULL
        OR visibility IS NULL
        OR user_segments IS NULL
        OR priority_level IS NULL
        OR minimum_quantity IS NULL
        OR auto_generated IS NULL
    `);

    console.log('Successfully enhanced coupon table with new fields and structure');
  },

  async down(queryInterface, Sequelize) {
    console.log('Reverting coupon table enhancements...');

    // Remove new indexes
    const indexesToRemove = [
      'idx_coupon_targeting_type',
      'idx_coupon_visibility',
      'idx_coupon_priority_level',
      'idx_coupon_valid_until',
      'idx_coupon_active_visibility'
    ];

    for (const indexName of indexesToRemove) {
      try {
        await queryInterface.removeIndex('coupon', indexName);
      } catch (e) {
        console.log(`Index ${indexName} does not exist or failed to remove`);
      }
    }

    // Remove new columns
    const columnsToRemove = [
      'targeting_type',
      'target_product_types',
      'target_product_ids',
      'visibility',
      'user_segments',
      'priority_level',
      'max_discount_cap',
      'minimum_quantity',
      'code_pattern',
      'auto_generated'
    ];

    for (const columnName of columnsToRemove) {
      try {
        await queryInterface.removeColumn('coupon', columnName);
      } catch (e) {
        console.log(`Column ${columnName} does not exist or failed to remove`);
      }
    }

    console.log('Successfully reverted coupon table enhancements');
  }
};