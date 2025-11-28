/**
 * Migration: Add bundle_purchase_id to Purchase table
 *
 * Purpose: Support bundle products system with auto-purchase pattern.
 * When a bundle is purchased, we create individual Purchase records for
 * each bundled item, all referencing the main bundle purchase via this field.
 *
 * Date: 2025-11-28
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if column already exists to make migration idempotent
    const tableDescription = await queryInterface.describeTable('purchase');

    if (!tableDescription.bundle_purchase_id) {
      // Add bundle_purchase_id column to track individual purchases created from bundle purchases
      await queryInterface.addColumn('purchase', 'bundle_purchase_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'References the main bundle purchase ID when this purchase was auto-created from a bundle'
      });
    }

    // Check if index already exists before creating
    const indexes = await queryInterface.showIndex('purchase');
    const indexExists = indexes.some(index => index.name === 'idx_purchases_bundle_purchase_id');

    if (!indexExists) {
      // Add index for efficient bundle purchase queries
      await queryInterface.addIndex('purchase', ['bundle_purchase_id'], {
        name: 'idx_purchases_bundle_purchase_id'
      });
    }

    // Add setting for bundle creation permissions (check if it exists first)
    const settingId = 'settings_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    const existingSetting = await queryInterface.sequelize.query(
      'SELECT * FROM settings WHERE key = :key',
      {
        replacements: { key: 'allow_content_creator_bundles' },
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );

    if (existingSetting.length === 0) {
      await queryInterface.bulkInsert('settings', [
        {
          id: settingId,
          key: 'allow_content_creator_bundles',
          value: JSON.stringify(true), // JSONB field requires JSON string
          value_type: 'boolean',
          description: 'Allow content creators to create product bundles (admins can always create bundles)',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('purchase', 'idx_purchases_bundle_purchase_id');

    // Remove column
    await queryInterface.removeColumn('purchase', 'bundle_purchase_id');

    // Remove setting
    await queryInterface.bulkDelete('settings', {
      key: 'allow_content_creator_bundles'
    });
  }
};
