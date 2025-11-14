'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creating content_topic table...');

    // Create the main content_topic table
    await queryInterface.createTable('content_topic', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Primary key for content topic'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Unique name of the content topic'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional description of the content topic'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this content topic is active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for better performance
    await queryInterface.addIndex('content_topic', ['name'], {
      unique: true,
      name: 'content_topic_name_unique'
    });

    await queryInterface.addIndex('content_topic', ['is_active'], {
      name: 'content_topic_is_active_idx'
    });

    console.log('✅ Content topic table created successfully');
    console.log('📊 This table stores reusable content topics that can be associated with curriculum items and products');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back content_topic table...');

    // Drop indexes first
    await queryInterface.removeIndex('content_topic', 'content_topic_is_active_idx');
    await queryInterface.removeIndex('content_topic', 'content_topic_name_unique');

    // Drop the table
    await queryInterface.dropTable('content_topic');

    console.log('✅ Content topic table rolled back');
  }
};