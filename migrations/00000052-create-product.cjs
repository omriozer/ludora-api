'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      title: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      category: {
        type: Sequelize.STRING
      },
      product_type: {
        type: Sequelize.STRING
      },
      price: {
        type: Sequelize.DECIMAL
      },
      is_published: {
        type: Sequelize.BOOLEAN
      },
      image_url: {
        type: Sequelize.STRING
      },
      youtube_video_id: {
        type: Sequelize.STRING
      },
      youtube_video_title: {
        type: Sequelize.STRING
      },
      file_url: {
        type: Sequelize.STRING
      },
      preview_file_url: {
        type: Sequelize.STRING
      },
      file_type: {
        type: Sequelize.STRING
      },
      downloads_count: {
        type: Sequelize.DECIMAL
      },
      tags: {
        type: Sequelize.JSONB
      },
      target_audience: {
        type: Sequelize.STRING
      },
      difficulty_level: {
        type: Sequelize.STRING
      },
      access_days: {
        type: Sequelize.DECIMAL
      },
      is_lifetime_access: {
        type: Sequelize.BOOLEAN
      },
      workshop_id: {
        type: Sequelize.STRING
      },
      course_modules: {
        type: Sequelize.JSONB
      },
      total_duration_minutes: {
        type: Sequelize.DECIMAL
      },
      is_sample: {
        type: Sequelize.BOOLEAN
      },
      creator_user_id: {
        type: Sequelize.STRING(255),
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      workshop_type: {
        type: Sequelize.STRING(255)
      },
      video_file_url: {
        type: Sequelize.STRING(255)
      },
      scheduled_date: {
        type: Sequelize.DATE
      },
      meeting_link: {
        type: Sequelize.STRING(255)
      },
      meeting_password: {
        type: Sequelize.STRING(255)
      },
      meeting_platform: {
        type: Sequelize.STRING(255)
      },
      max_participants: {
        type: Sequelize.INTEGER
      },
      duration_minutes: {
        type: Sequelize.INTEGER
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Add indexes
    await queryInterface.addIndex('product', ['category'], { name: 'idx_product_category' });
    await queryInterface.addIndex('product', ['creator_user_id'], { name: 'idx_product_creator_user_id' });
    await queryInterface.addIndex('product', ['is_published'], { name: 'idx_product_published' });
    await queryInterface.addIndex('product', ['is_sample'], { name: 'idx_product_sample' });
    await queryInterface.addIndex('product', ['product_type'], { name: 'idx_product_type' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product');
  }
};