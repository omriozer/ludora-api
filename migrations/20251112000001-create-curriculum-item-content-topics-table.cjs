'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creating curriculum_item_content_topics junction table...');

    // Create the curriculum_item_content_topics junction table
    await queryInterface.createTable('curriculum_item_content_topics', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Primary key for curriculum_item-content_topic association'
      },
      curriculum_item_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'curriculum_item',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to curriculum item'
      },
      content_topic_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'content_topic',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to content topic'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for better performance
    await queryInterface.addIndex('curriculum_item_content_topics', ['curriculum_item_id'], {
      name: 'curriculum_item_content_topics_curriculum_item_id_idx'
    });

    await queryInterface.addIndex('curriculum_item_content_topics', ['content_topic_id'], {
      name: 'curriculum_item_content_topics_content_topic_id_idx'
    });

    // Create unique constraint to prevent duplicate associations
    await queryInterface.addIndex('curriculum_item_content_topics', ['curriculum_item_id', 'content_topic_id'], {
      unique: true,
      name: 'curriculum_item_content_topics_unique_constraint'
    });

    console.log('✅ Curriculum item content topics junction table created successfully');
    console.log('📊 This allows curriculum items to be associated with multiple content topics');
    console.log('🔗 Enables many-to-many relationship between curriculum items and content topics');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back curriculum_item_content_topics table...');

    // Drop indexes first
    await queryInterface.removeIndex('curriculum_item_content_topics', 'curriculum_item_content_topics_unique_constraint');
    await queryInterface.removeIndex('curriculum_item_content_topics', 'curriculum_item_content_topics_content_topic_id_idx');
    await queryInterface.removeIndex('curriculum_item_content_topics', 'curriculum_item_content_topics_curriculum_item_id_idx');

    // Drop the table
    await queryInterface.dropTable('curriculum_item_content_topics');

    console.log('✅ Curriculum item content topics table rolled back');
  }
};