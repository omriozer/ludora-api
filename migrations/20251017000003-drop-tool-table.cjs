'use strict';

/**
 * Migration: Drop Tool table entirely
 *
 * Purpose:
 * Removes the Tool table completely since tools will be defined as constants
 * in the Tool model rather than database records. Products will reference
 * tools via polymorphic association with tool keys.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🗑️  Dropping tool table entirely...');

      // Check if table exists
      const tableExists = await queryInterface.tableExists('tool');
      if (!tableExists) {
        console.log('ℹ️  Tool table does not exist, nothing to drop');
        return;
      }

      // Drop all indexes first
      const indexesToRemove = [
        'tool_category_idx',
        'tool_is_published_idx',
        'tool_access_type_idx',
        'tool_creator_user_id_idx',
        'tool_tool_key_unique_idx'
      ];

      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('tool', indexName);
          console.log(`✅ Removed index: ${indexName}`);
        } catch (error) {
          console.log(`ℹ️  Index ${indexName} does not exist or already removed`);
        }
      }

      // Drop the table
      await queryInterface.dropTable('tool');
      console.log('✅ Tool table dropped successfully');
      console.log('📋 Tools will now be defined as constants in the Tool model');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('🔄 Recreating tool table...');

      // Recreate the simplified tool table with just tool_key
      await queryInterface.createTable('tool', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        tool_key: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          comment: 'Unique identifier for the tool type (ALL_CAPS format)'
        }
      });

      // Add unique index for tool_key
      await queryInterface.addIndex('tool', ['tool_key'], {
        unique: true,
        name: 'tool_tool_key_unique_idx'
      });

      console.log('✅ Tool table recreated with tool_key field');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};