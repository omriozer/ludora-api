'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Configuration table
    await queryInterface.createTable('configuration', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
        comment: 'Configuration record UUID'
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Configuration key (e.g., subscription_system_enabled, contact_email)'
      },
      value: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Configuration value stored as JSON (supports strings, numbers, booleans, objects, arrays)'
      },
      value_type: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'object', 'array'),
        allowNull: false,
        defaultValue: 'string',
        comment: 'Type hint for value casting'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Human-readable description of this configuration setting'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create indexes
    await queryInterface.addIndex('configuration', ['key'], {
      unique: true,
      name: 'idx_configuration_key'
    });
    await queryInterface.addIndex('configuration', ['value_type'], {
      name: 'idx_configuration_value_type'
    });
    await queryInterface.addIndex('configuration', ['created_at'], {
      name: 'idx_configuration_created_at'
    });

    // Helper function to detect value type
    const detectType = (value) => {
      if (value === null || value === undefined) return 'string';
      if (typeof value === 'boolean') return 'boolean';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'object') {
        return Array.isArray(value) ? 'array' : 'object';
      }
      return 'string';
    };

    // Helper function to generate UUID (simplified for migration)
    const generateUUID = () => {
      return 'config_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    };

    // Read existing Settings record and convert to Configuration records
    try {
      const [settingsResults] = await queryInterface.sequelize.query(
        'SELECT * FROM settings LIMIT 1',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (settingsResults) {
        console.log('📊 Found Settings record, converting to Configuration records...');

        const configRecords = [];
        const baseFields = ['id', 'created_at', 'updated_at'];

        // Convert each column (except base fields) to a configuration record
        for (const [key, value] of Object.entries(settingsResults)) {
          if (!baseFields.includes(key) && value !== null && value !== undefined) {
            const valueType = detectType(value);

            configRecords.push({
              id: generateUUID(),
              key: key,
              value: JSON.stringify(value), // Store as JSON string for JSONB
              value_type: valueType,
              description: `Migrated from Settings.${key}`,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }

        if (configRecords.length > 0) {
          console.log(`🔄 Inserting ${configRecords.length} configuration records...`);

          // Insert records in batches to avoid query size limits
          const batchSize = 20;
          for (let i = 0; i < configRecords.length; i += batchSize) {
            const batch = configRecords.slice(i, i + batchSize);
            await queryInterface.bulkInsert('configuration', batch);
          }

          console.log('✅ Configuration records created successfully!');
        } else {
          console.log('ℹ️ No valid configuration data found in Settings table');
        }
      } else {
        console.log('ℹ️ No Settings record found, creating default configuration...');

        // Create minimal default configuration
        const defaultConfigs = [
          {
            id: generateUUID(),
            key: 'students_access',
            value: JSON.stringify('all'),
            value_type: 'string',
            description: 'Student portal access mode',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: generateUUID(),
            key: 'maintenance_mode',
            value: JSON.stringify(false),
            value_type: 'boolean',
            description: 'System maintenance mode',
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        await queryInterface.bulkInsert('configuration', defaultConfigs);
        console.log('✅ Default configuration created!');
      }

      // Verify the migration worked
      const [configCount] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM configuration',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      console.log(`🎯 Migration complete! ${configCount.count} configuration records created.`);

    } catch (error) {
      console.error('❌ Error during Settings to Configuration migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('configuration', 'idx_configuration_key');
    await queryInterface.removeIndex('configuration', 'idx_configuration_value_type');
    await queryInterface.removeIndex('configuration', 'idx_configuration_created_at');

    // Drop the Configuration table
    await queryInterface.dropTable('configuration');

    // Drop the value_type enum
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_configuration_value_type"');

    console.log('✅ Configuration table and related structures removed');
  }
};