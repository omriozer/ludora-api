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
      // Check if already integer type
      if (tableDescription.usage_limit.type === 'INTEGER') {
        console.log('usage_limit column is already INTEGER type, skipping conversion');
      } else {
        // String type - clean up and convert
        console.log('Converting usage_limit from string to INTEGER type');

        // First, update any non-numeric usage_limit values to NULL
        await queryInterface.sequelize.query(`
          UPDATE coupon
          SET usage_limit = NULL
          WHERE usage_limit IS NOT NULL
          AND (
            usage_limit !~ '^[0-9]+$'
            OR usage_limit = 'unlimited'
            OR usage_limit = ''
            OR trim(usage_limit) = ''
          )
        `);

        // Convert empty strings to NULL
        await queryInterface.sequelize.query(`
          UPDATE coupon
          SET usage_limit = NULL
          WHERE usage_limit = '' OR trim(usage_limit) = ''
        `);

        // For remaining non-null values, ensure they're numeric
        await queryInterface.sequelize.query(`
          UPDATE coupon
          SET usage_limit = CASE
            WHEN usage_limit ~ '^[0-9]+$' THEN usage_limit
            ELSE NULL
          END
          WHERE usage_limit IS NOT NULL
        `);

        // Now use explicit casting approach
        await queryInterface.sequelize.query(`
          ALTER TABLE coupon
          ALTER COLUMN usage_limit TYPE INTEGER
          USING CASE
            WHEN usage_limit IS NULL THEN NULL
            WHEN usage_limit ~ '^[0-9]+$' THEN usage_limit::INTEGER
            ELSE NULL
          END
        `);
      }
    }

    if (tableDescription.usage_count) {
      // Check if already numeric or integer type
      if (tableDescription.usage_count.type === 'NUMERIC' || tableDescription.usage_count.type === 'INTEGER') {
        // Already numeric - just convert to INTEGER if needed
        if (tableDescription.usage_count.type === 'NUMERIC') {
          await queryInterface.sequelize.query(`
            ALTER TABLE coupon
            ALTER COLUMN usage_count TYPE INTEGER
            USING CASE
              WHEN usage_count IS NULL THEN 0
              ELSE usage_count::INTEGER
            END
          `);
        }
      } else {
        // String type - clean up and convert
        await queryInterface.sequelize.query(`
          UPDATE coupon
          SET usage_count = '0'
          WHERE usage_count IS NULL
          OR usage_count = ''
          OR trim(usage_count) = ''
          OR usage_count !~ '^[0-9]+$'
        `);

        // Convert to integer with explicit casting
        await queryInterface.sequelize.query(`
          ALTER TABLE coupon
          ALTER COLUMN usage_count TYPE INTEGER
          USING CASE
            WHEN usage_count IS NULL THEN 0
            WHEN usage_count ~ '^[0-9]+$' THEN usage_count::INTEGER
            ELSE 0
          END
        `);
      }

      // Set default value regardless of original type
      await queryInterface.sequelize.query(`
        ALTER TABLE coupon ALTER COLUMN usage_count SET DEFAULT 0
      `);

      // Set NULL values to 0 if any exist
      await queryInterface.sequelize.query(`
        UPDATE coupon SET usage_count = 0 WHERE usage_count IS NULL
      `);
    }

    if (tableDescription.valid_until) {
      // Check if already timestamp type
      if (tableDescription.valid_until.type.includes('TIMESTAMP') || tableDescription.valid_until.type === 'DATE') {
        console.log('valid_until column is already TIMESTAMP/DATE type, skipping conversion');
      } else {
        console.log('Converting valid_until to TIMESTAMP type');
        // For string-based date columns, use explicit casting
        await queryInterface.sequelize.query(`
          ALTER TABLE coupon
          ALTER COLUMN valid_until TYPE TIMESTAMP WITH TIME ZONE
          USING CASE
            WHEN valid_until IS NULL OR valid_until = '' THEN NULL
            WHEN valid_until ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN valid_until::TIMESTAMP
            ELSE NULL
          END
        `);
      }
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