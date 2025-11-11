'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('📄 Populating target_format for existing files...');

      // First, check if there are any files with null target_format
      const filesWithoutFormat = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM file WHERE target_format IS NULL',
        { type: Sequelize.QueryTypes.SELECT }
      );

      const count = filesWithoutFormat[0].count;
      console.log(`📊 Found ${count} files without target_format`);

      if (count === 0) {
        console.log('✅ No files need target_format population, skipping...');
        return;
      }

      // Update PDF files to default portrait orientation
      const pdfUpdateResult = await queryInterface.sequelize.query(`
        UPDATE file
        SET target_format = 'pdf-a4-portrait', updated_at = NOW()
        WHERE target_format IS NULL
        AND (
          file_type = 'pdf'
          OR file_name ILIKE '%.pdf'
          OR LOWER(file_name) LIKE '%.pdf'
        )
      `);

      console.log(`📄 Updated PDF files to portrait orientation`);

      // Update all other files to 'unknown' - they'll be re-detected on next upload
      const otherUpdateResult = await queryInterface.sequelize.query(`
        UPDATE file
        SET target_format = 'unknown', updated_at = NOW()
        WHERE target_format IS NULL
      `);

      console.log(`❓ Updated non-PDF files to unknown format`);

      // Get final statistics
      const finalStats = await queryInterface.sequelize.query(`
        SELECT
          target_format,
          COUNT(*) as count
        FROM file
        GROUP BY target_format
        ORDER BY count DESC
      `, { type: Sequelize.QueryTypes.SELECT });

      console.log('📊 Final target_format distribution:');
      finalStats.forEach(stat => {
        console.log(`  - ${stat.target_format}: ${stat.count} files`);
      });

      console.log('✅ Successfully populated target_format for existing files');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('📄 Reverting target_format population...');

      // Reset all target_format values to null
      await queryInterface.sequelize.query(`
        UPDATE file
        SET target_format = NULL, updated_at = NOW()
        WHERE target_format IS NOT NULL
      `);

      console.log('✅ Reverted all target_format values to NULL');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};