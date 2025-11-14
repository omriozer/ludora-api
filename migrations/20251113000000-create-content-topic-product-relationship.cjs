'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Creating content topic product relationship...');

    // Create the content_topic_product junction table
    await queryInterface.createTable('content_topic_product', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Primary key for content-topic-product association'
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
      product_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'product',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to product'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for better performance
    await queryInterface.addIndex('content_topic_product', ['content_topic_id'], {
      name: 'content_topic_product_content_topic_id_idx'
    });

    await queryInterface.addIndex('content_topic_product', ['product_id'], {
      name: 'content_topic_product_product_id_idx'
    });

    // Create unique constraint to prevent duplicate associations
    await queryInterface.addIndex('content_topic_product', ['content_topic_id', 'product_id'], {
      unique: true,
      name: 'content_topic_product_unique_constraint'
    });

    console.log('✅ Content topic product relationship created successfully');
    console.log('📊 This allows products to be linked to content topics instead of curriculum items directly');
    console.log('🎯 Products tagged with "Animals" will now be available for any curriculum item using "Animals" theme');

    // Note: We're keeping the existing curriculum_product table for now
    // in case there's legacy data or direct curriculum-product relationships needed
    console.log('ℹ️  Existing curriculum_product table preserved for backward compatibility');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back content topic product relationship...');

    // Drop indexes first
    await queryInterface.removeIndex('content_topic_product', 'content_topic_product_unique_constraint');
    await queryInterface.removeIndex('content_topic_product', 'content_topic_product_product_id_idx');
    await queryInterface.removeIndex('content_topic_product', 'content_topic_product_content_topic_id_idx');

    // Drop the table
    await queryInterface.dropTable('content_topic_product');

    console.log('✅ Content topic product relationship rolled back');
  }
};