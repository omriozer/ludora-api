const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create the tool table with proper structure
    await queryInterface.createTable('tool', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      tool_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique identifier for the tool (e.g., CONTACT_PAGE_GENERATOR)'
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'generators',
        comment: 'Category of the tool (e.g., generators, utilities)'
      },
      default_access_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 365,
        comment: 'Default access duration when purchased'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('tool', ['tool_key'], {
      unique: true,
      name: 'tool_tool_key_unique'
    });

    await queryInterface.addIndex('tool', ['category'], {
      name: 'tool_category_idx'
    });

    console.log('✅ Tool table recreated successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the tool table
    await queryInterface.dropTable('tool');
    console.log('⚠️ Tool table dropped');
  }
};