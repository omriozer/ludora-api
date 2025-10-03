'use strict';

/**
 * Migration: Rename file_url to file_name in File entity
 *
 * Changes:
 * - Renames column from `file_url` to `file_name`
 * - Extracts just the filename from existing URLs (removes path)
 * - Allows NULL values (NULL = file not yet uploaded)
 *
 * Context:
 * Moving from storing full URLs to storing just filenames.
 * S3 paths are now predictable: {env}/private/document/file/{entityId}/{file_name}
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if column exists before renaming
      const tableDescription = await queryInterface.describeTable('file');

      if (tableDescription.file_url) {
        console.log('📝 Renaming file_url to file_name...');

        // Extract just the filename from existing URLs
        // Example: "https://bucket.s3.region.amazonaws.com/path/to/document.pdf" → "document.pdf"
        await queryInterface.sequelize.query(`
          UPDATE "file"
          SET file_url = regexp_replace(file_url, '^.*/([^/]+)$', '\\1')
          WHERE file_url IS NOT NULL AND file_url != '';
        `);

        console.log('✅ Extracted filenames from URLs');

        // Rename column
        await queryInterface.renameColumn('file', 'file_url', 'file_name');

        console.log('✅ Column renamed to file_name');

        // Ensure NULL is allowed (file not yet uploaded)
        await queryInterface.changeColumn('file', 'file_name', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Original filename of uploaded document (e.g., "my-document.pdf"). NULL if not uploaded yet.'
        });

        console.log('✅ Migration completed successfully');
      } else {
        console.log('ℹ️  Column file_url does not exist, skipping migration');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const tableDescription = await queryInterface.describeTable('file');

      if (tableDescription.file_name) {
        console.log('📝 Reverting file_name back to file_url...');

        await queryInterface.renameColumn('file', 'file_name', 'file_url');

        console.log('✅ Column reverted to file_url');
      } else {
        console.log('ℹ️  Column file_name does not exist, skipping rollback');
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
