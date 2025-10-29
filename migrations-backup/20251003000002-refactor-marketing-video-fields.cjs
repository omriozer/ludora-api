'use strict';

/**
 * Migration: Refactor Marketing Video Fields
 *
 * This migration transforms the marketing video structure from:
 * - youtube_video_id
 * - youtube_video_title
 * - marketing_video_title
 * - marketing_video_duration
 *
 * To:
 * - marketing_video_type (enum: 'youtube', 'uploaded')
 * - marketing_video_id (YouTube ID or entity ID for uploaded)
 * - marketing_video_title (consolidated title field)
 * - marketing_video_duration (kept as is)
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🎬 Starting marketing video fields refactoring...');

    try {
      // Step 1: Add new fields
      console.log('📝 Adding new marketing_video_type and marketing_video_id columns...');

      await queryInterface.addColumn('product', 'marketing_video_type', {
        type: Sequelize.ENUM('youtube', 'uploaded'),
        allowNull: true,
        comment: 'Type of marketing video: youtube or uploaded file'
      });

      await queryInterface.addColumn('product', 'marketing_video_id', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'YouTube video ID or entity ID for uploaded videos'
      });

      // Step 2: Transform existing data
      console.log('🔄 Transforming existing data...');

      // Get all products with existing video data
      const [products] = await queryInterface.sequelize.query(`
        SELECT id, youtube_video_id, youtube_video_title, marketing_video_title, entity_id
        FROM product
        WHERE youtube_video_id IS NOT NULL
        OR marketing_video_title IS NOT NULL
      `);

      console.log(`📊 Found ${products.length} products with video data to transform`);

      // Transform each product
      for (const product of products) {
        let newType = null;
        let newId = null;
        let consolidatedTitle = null;

        if (product.youtube_video_id && product.youtube_video_id.trim() !== '') {
          // Has YouTube video
          newType = 'youtube';
          newId = product.youtube_video_id.trim();
          consolidatedTitle = product.youtube_video_title || product.marketing_video_title;
        } else if (product.marketing_video_title && product.marketing_video_title.trim() !== '') {
          // Has marketing video title but no YouTube ID - assume uploaded video
          newType = 'uploaded';
          newId = product.entity_id || product.id; // Use entity_id or fallback to product id
          consolidatedTitle = product.marketing_video_title;
        }

        if (newType && newId) {
          await queryInterface.sequelize.query(`
            UPDATE product
            SET
              marketing_video_type = :type,
              marketing_video_id = :id,
              marketing_video_title = :title
            WHERE id = :productId
          `, {
            replacements: {
              type: newType,
              id: newId,
              title: consolidatedTitle,
              productId: product.id
            }
          });

          console.log(`✅ Transformed product ${product.id}: ${newType} video with ID ${newId}`);
        }
      }

      // Step 3: Remove old columns
      console.log('🗑️ Removing old columns...');

      await queryInterface.removeColumn('product', 'youtube_video_id');
      await queryInterface.removeColumn('product', 'youtube_video_title');

      // Note: marketing_video_title is kept as the consolidated title field
      // Note: marketing_video_duration is kept as requested

      console.log('✅ Marketing video fields refactoring completed successfully!');

    } catch (error) {
      console.error('❌ Error during marketing video fields refactoring:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⏪ Reverting marketing video fields refactoring...');

    try {
      // Step 1: Add back old columns
      console.log('📝 Adding back old columns...');

      await queryInterface.addColumn('product', 'youtube_video_id', {
        type: Sequelize.STRING,
        allowNull: true
      });

      await queryInterface.addColumn('product', 'youtube_video_title', {
        type: Sequelize.STRING,
        allowNull: true
      });

      // Step 2: Transform data back
      console.log('🔄 Transforming data back to old structure...');

      const [products] = await queryInterface.sequelize.query(`
        SELECT id, marketing_video_type, marketing_video_id, marketing_video_title
        FROM product
        WHERE marketing_video_type IS NOT NULL
      `);

      console.log(`📊 Found ${products.length} products to revert`);

      for (const product of products) {
        if (product.marketing_video_type === 'youtube') {
          await queryInterface.sequelize.query(`
            UPDATE product
            SET
              youtube_video_id = :id,
              youtube_video_title = :title
            WHERE id = :productId
          `, {
            replacements: {
              id: product.marketing_video_id,
              title: product.marketing_video_title,
              productId: product.id
            }
          });
        }
        // For uploaded videos, just keep the marketing_video_title as is
      }

      // Step 3: Remove new columns
      console.log('🗑️ Removing new columns...');

      await queryInterface.removeColumn('product', 'marketing_video_id');

      // Remove the ENUM type
      await queryInterface.removeColumn('product', 'marketing_video_type');

      // Remove the ENUM type definition
      await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_product_marketing_video_type\"");

      console.log('✅ Marketing video fields reverted successfully!');

    } catch (error) {
      console.error('❌ Error during revert:', error);
      throw error;
    }
  }
};