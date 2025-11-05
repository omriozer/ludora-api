const { DataTypes } = require('sequelize');

/**
 * Migration: Fix GameContent S3 URLs
 *
 * Converts existing GameContent records that store full S3 URLs in the value field
 * to store only the S3 key portion, following the new pattern established by constructS3Path.
 *
 * This migration:
 * 1. Identifies GameContent records with semantic_type='image' that have S3 URLs
 * 2. Extracts filenames from S3 URLs
 * 3. Converts to S3 key format: development/public/image/gamecontent/{entityId}/{filename}
 * 4. Updates the value field to store the S3 key instead of the full URL
 *
 * Background: GameContent upload endpoint was updated to use constructS3Path() and store
 * S3 keys instead of URLs for security. This migration fixes existing records.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting GameContent S3 URL to S3 key conversion...');

      // Step 1: Count total GameContent records to process
      const [totalCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM gamecontent
         WHERE semantic_type = 'image'`,
        { transaction }
      );
      console.log(`📊 Total image GameContent records: ${totalCount[0].count}`);

      // Step 2: Find GameContent records with S3 URLs that need conversion
      const [urlCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM gamecontent
         WHERE semantic_type = 'image'
           AND value IS NOT NULL
           AND value != ''
           AND (value LIKE '%amazonaws.com%'
                OR value LIKE '%s3.%'
                OR value LIKE 'https://%'
                OR value LIKE 'http://%')
           AND value NOT LIKE '/api/assets/%'`,
        { transaction }
      );
      console.log(`📊 Records with S3 URLs needing conversion: ${urlCount[0].count}`);

      if (urlCount[0].count === 0) {
        console.log('✅ No GameContent records found with S3 URLs - migration not needed');
        await transaction.commit();
        return;
      }

      // Step 3: Get the records that need conversion
      const [recordsToConvert] = await queryInterface.sequelize.query(
        `SELECT id, value, metadata
         FROM gamecontent
         WHERE semantic_type = 'image'
           AND value IS NOT NULL
           AND value != ''
           AND (value LIKE '%amazonaws.com%'
                OR value LIKE '%s3.%'
                OR value LIKE 'https://%'
                OR value LIKE 'http://%')
           AND value NOT LIKE '/api/assets/%'`,
        { transaction }
      );

      console.log(`🔄 Converting ${recordsToConvert.length} GameContent records...`);

      // Step 4: Process each record and convert URL to S3 key
      let successCount = 0;
      let errorCount = 0;

      for (const record of recordsToConvert) {
        try {
          let filename = null;

          // Extract filename from various URL patterns
          if (record.value.includes('/')) {
            // Get the last part of the URL path
            const urlParts = record.value.split('/');
            filename = urlParts[urlParts.length - 1];

            // Remove query parameters if present
            if (filename.includes('?')) {
              filename = filename.split('?')[0];
            }

            // Remove hash fragments if present
            if (filename.includes('#')) {
              filename = filename.split('#')[0];
            }
          }

          // If we couldn't extract a filename, try to get it from metadata
          if (!filename || filename === '') {
            if (record.metadata && typeof record.metadata === 'object') {
              if (record.metadata.name) {
                filename = record.metadata.name;
              } else if (record.metadata.filename) {
                filename = record.metadata.filename;
              } else if (record.metadata.original_name) {
                filename = record.metadata.original_name;
              }
            }
          }

          // If still no filename, generate a default one
          if (!filename || filename === '') {
            filename = `image_${record.id}.jpg`;
            console.log(`⚠️  Generated default filename for record ${record.id}: ${filename}`);
          }

          // Ensure filename has an extension
          if (!filename.includes('.')) {
            filename += '.jpg';
          }

          // Construct the S3 key following the constructS3Path pattern
          // Format: {env}/{privacy}/{assetType}/{entityType}/{entityId}/{filename}
          const s3Key = `development/public/image/gamecontent/${record.id}/${filename}`;

          console.log(`🔄 Converting record ${record.id}: "${record.value}" -> "${s3Key}"`);

          // Update the record with the S3 key
          await queryInterface.sequelize.query(
            `UPDATE gamecontent
             SET value = :s3Key
             WHERE id = :id`,
            {
              replacements: { s3Key, id: record.id },
              transaction
            }
          );

          successCount++;

        } catch (error) {
          console.error(`❌ Error converting record ${record.id}:`, error.message);
          errorCount++;
        }
      }

      // Step 5: Verify the conversion results
      console.log('🔍 Verifying conversion results...');

      const [verificationResults] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) as total_images,
           COUNT(CASE WHEN value LIKE 'development/public/image/gamecontent/%' THEN 1 END) as converted_to_s3_key,
           COUNT(CASE WHEN value LIKE '/api/assets/%' THEN 1 END) as api_urls,
           COUNT(CASE WHEN value LIKE '%amazonaws.com%' OR value LIKE '%s3.%' OR value LIKE 'https://%' OR value LIKE 'http://%' THEN 1 END) as remaining_urls
         FROM gamecontent
         WHERE semantic_type = 'image'
           AND value IS NOT NULL
           AND value != ''`,
        { transaction }
      );

      const stats = verificationResults[0];
      console.log('📊 GameContent S3 URL conversion verification:');
      console.log(`   Total image records: ${stats.total_images}`);
      console.log(`   Converted to S3 keys: ${stats.converted_to_s3_key}`);
      console.log(`   API URLs (unchanged): ${stats.api_urls}`);
      console.log(`   Remaining URLs needing attention: ${stats.remaining_urls}`);
      console.log(`   Successfully converted: ${successCount}`);
      console.log(`   Conversion errors: ${errorCount}`);

      await transaction.commit();
      console.log('✅ GameContent S3 URL to S3 key conversion completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Reverting GameContent S3 key to S3 URL conversion...');
      console.log('⚠️  WARNING: This rollback cannot perfectly restore original S3 URLs');
      console.log('⚠️  Original S3 URLs were not preserved during the forward migration');

      // Step 1: Count records that would be affected by rollback
      const [keyCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM gamecontent
         WHERE semantic_type = 'image'
           AND value LIKE 'development/public/image/gamecontent/%'`,
        { transaction }
      );

      console.log(`📊 Records with S3 keys to revert: ${keyCount[0].count}`);

      if (keyCount[0].count === 0) {
        console.log('✅ No GameContent records found with S3 keys - rollback not needed');
        await transaction.commit();
        return;
      }

      // Step 2: Convert S3 keys back to placeholder URLs (cannot restore originals)
      const [rollbackResults] = await queryInterface.sequelize.query(
        `UPDATE gamecontent
         SET value = CONCAT('https://placeholder-s3-url.com/', SUBSTRING(value FROM '[^/]*$'))
         WHERE semantic_type = 'image'
           AND value LIKE 'development/public/image/gamecontent/%'`,
        { transaction }
      );

      console.log(`🔄 Reverted ${rollbackResults.affectedRows || 0} records to placeholder URLs`);

      await transaction.commit();
      console.log('✅ GameContent S3 key rollback completed with placeholder URLs!');
      console.log('⚠️  Note: Original S3 URLs could not be restored - manual intervention may be required');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};