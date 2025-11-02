const { DataTypes } = require('sequelize');

/**
 * Migration: Standardize Product Image References
 *
 * Addresses the "HAS_IMAGE" placeholder issue identified in the file reference audit.
 * This migration standardizes how Product entities store image references by:
 *
 * 1. Adding a proper image_filename field
 * 2. Adding a has_image boolean field for clear existence indication
 * 3. Migrating existing "HAS_IMAGE" placeholders to the new format
 * 4. Preserving legacy image_url for backward compatibility during transition
 *
 * This resolves audit issue #3: "Magic String 'HAS_IMAGE' Placeholder"
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting Product image reference standardization...');

      // Step 1: Add new standardized fields
      console.log('📝 Adding image_filename field...');
      await queryInterface.addColumn('product', 'image_filename', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Standardized image filename storage (replaces image_url placeholder)'
      }, { transaction });

      console.log('📝 Adding has_image field...');
      await queryInterface.addColumn('product', 'has_image', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Clear boolean indicator for image existence'
      }, { transaction });

      // Step 2: Migrate existing data
      console.log('🔄 Migrating existing image_url data...');

      // Count records for progress tracking
      const [totalRecords] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM product',
        { transaction }
      );
      console.log(`📊 Processing ${totalRecords[0].count} product records...`);

      // Migrate "HAS_IMAGE" placeholders
      const [hasImageResults] = await queryInterface.sequelize.query(
        `UPDATE product
         SET image_filename = 'image.jpg',
             has_image = true
         WHERE image_url = 'HAS_IMAGE'`,
        { transaction }
      );
      console.log(`✅ Migrated ${hasImageResults.affectedRows || 0} "HAS_IMAGE" records`);

      // Migrate legacy full URLs (extract filename)
      const [urlResults] = await queryInterface.sequelize.query(
        `UPDATE product
         SET image_filename = CASE
           WHEN image_url LIKE '%.jpg%' THEN 'image.jpg'
           WHEN image_url LIKE '%.png%' THEN 'image.png'
           WHEN image_url LIKE '%.gif%' THEN 'image.gif'
           WHEN image_url LIKE '%.webp%' THEN 'image.webp'
           ELSE 'image.jpg'
         END,
         has_image = true
         WHERE image_url IS NOT NULL
           AND image_url != ''
           AND image_url != 'HAS_IMAGE'
           AND (image_url LIKE 'http%' OR image_url LIKE '/%')`,
        { transaction }
      );
      console.log(`✅ Migrated ${urlResults.affectedRows || 0} legacy URL records`);

      // Set has_image = false for empty/null records
      const [emptyResults] = await queryInterface.sequelize.query(
        `UPDATE product
         SET has_image = false,
             image_filename = NULL
         WHERE image_url IS NULL OR image_url = ''`,
        { transaction }
      );
      console.log(`✅ Cleaned up ${emptyResults.affectedRows || 0} empty records`);

      // Step 3: Add database comment for legacy field
      console.log('📝 Adding deprecation comment to image_url field...');
      await queryInterface.changeColumn('product', 'image_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'DEPRECATED: Use image_filename and has_image instead. Kept for backward compatibility.'
      }, { transaction });

      // Step 4: Create indexes for performance
      console.log('📝 Creating performance indexes...');
      await queryInterface.addIndex('product', ['has_image'], {
        name: 'idx_product_has_image',
        transaction
      });

      await queryInterface.addIndex('product', ['image_filename'], {
        name: 'idx_product_image_filename',
        transaction
      });

      // Step 5: Verify migration results
      console.log('🔍 Verifying migration results...');
      const [verificationResults] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN has_image = true THEN 1 END) as with_image,
           COUNT(CASE WHEN image_filename IS NOT NULL THEN 1 END) as with_filename,
           COUNT(CASE WHEN image_url = 'HAS_IMAGE' THEN 1 END) as remaining_placeholders
         FROM product`,
        { transaction }
      );

      const verification = verificationResults[0];
      console.log('📊 Migration verification:');
      console.log(`   Total products: ${verification.total}`);
      console.log(`   With images: ${verification.with_image}`);
      console.log(`   With filenames: ${verification.with_filename}`);
      console.log(`   Remaining placeholders: ${verification.remaining_placeholders}`);

      if (verification.remaining_placeholders > 0) {
        console.warn(`⚠️  ${verification.remaining_placeholders} "HAS_IMAGE" placeholders remaining`);
      }

      await transaction.commit();
      console.log('✅ Product image reference standardization completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting Product image reference standardization...');

      // Step 1: Restore "HAS_IMAGE" placeholders
      console.log('🔄 Restoring "HAS_IMAGE" placeholders...');
      await queryInterface.sequelize.query(
        `UPDATE product
         SET image_url = 'HAS_IMAGE'
         WHERE has_image = true AND image_filename IS NOT NULL`,
        { transaction }
      );

      // Step 2: Clear image_url for products without images
      console.log('🔄 Clearing empty image references...');
      await queryInterface.sequelize.query(
        `UPDATE product
         SET image_url = NULL
         WHERE has_image = false`,
        { transaction }
      );

      // Step 3: Remove new fields
      console.log('🗑️ Removing standardized fields...');

      // Remove indexes first
      try {
        await queryInterface.removeIndex('product', 'idx_product_has_image', { transaction });
      } catch (e) {
        console.log('Index idx_product_has_image not found, skipping...');
      }

      try {
        await queryInterface.removeIndex('product', 'idx_product_image_filename', { transaction });
      } catch (e) {
        console.log('Index idx_product_image_filename not found, skipping...');
      }

      // Remove columns
      await queryInterface.removeColumn('product', 'image_filename', { transaction });
      await queryInterface.removeColumn('product', 'has_image', { transaction });

      // Step 4: Restore original image_url field comment
      await queryInterface.changeColumn('product', 'image_url', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Product marketing image URL or placeholder'
      }, { transaction });

      await transaction.commit();
      console.log('✅ Product image reference standardization reverted successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};