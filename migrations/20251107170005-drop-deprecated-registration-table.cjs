const { DataTypes } = require('sequelize');

/**
 * Migration: Drop Deprecated Registration Table
 *
 * Removes the registration table and related references that are no longer used.
 * The Registration model exists but has no active business functionality.
 * Purchase table handles transaction/registration tracking instead.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Starting removal of deprecated registration table...');

      // Remove any foreign key constraints that reference the registration table
      console.log('🔍 Checking for foreign key references to registration table...');

      // Handle EmailLog table references to registration (though the table might not exist yet)
      try {
        // Check if emaillog table exists and has a foreign key to registration
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS emaillog DROP CONSTRAINT IF EXISTS fk_emaillog_registration CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No foreign key constraint from emaillog to registration, continuing...');
      }

      // Drop any potential foreign key constraints FROM registration table to other tables
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS registration DROP CONSTRAINT IF EXISTS fk_registration_user CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS registration DROP CONSTRAINT IF EXISTS fk_registration_workshop CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No foreign key constraints found on registration table, continuing...');
      }

      // Drop any indexes on the registration table if they exist
      try {
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_registration_user_id CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_registration_workshop_id CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_registration_payment_status CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No indexes found on registration table, continuing...');
      }

      // Drop the registration table if it exists
      console.log('🗑️ Dropping registration table...');
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS registration CASCADE;',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Deprecated registration table cleanup completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Recreating registration table...');
      console.log('⚠️ Note: This table was deprecated and should not be recreated in normal circumstances.');

      // Recreate the registration table based on the model definition
      await queryInterface.createTable('registration', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        workshop_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        participant_name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        participant_phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        payment_amount: {
          type: DataTypes.DECIMAL,
          allowNull: true,
        },
        payment_status: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        access_until: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        environment: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      }, { transaction });

      // Recreate indexes
      await queryInterface.addIndex('registration', ['user_id'], {
        name: 'idx_registration_user_id',
        transaction
      });

      await queryInterface.addIndex('registration', ['workshop_id'], {
        name: 'idx_registration_workshop_id',
        transaction
      });

      await queryInterface.addIndex('registration', ['payment_status'], {
        name: 'idx_registration_payment_status',
        transaction
      });

      // Recreate foreign key constraints
      await queryInterface.addConstraint('registration', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'fk_registration_user',
        references: {
          table: 'user',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addConstraint('registration', {
        fields: ['workshop_id'],
        type: 'foreign key',
        name: 'fk_registration_workshop',
        references: {
          table: 'workshop',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await transaction.commit();
      console.log('✅ Registration table recreated (though it remains deprecated).');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};