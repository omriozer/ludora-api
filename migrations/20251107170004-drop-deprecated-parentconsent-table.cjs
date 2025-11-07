const { DataTypes } = require('sequelize');

/**
 * Migration: Drop Deprecated ParentConsent Table
 *
 * Removes the parentconsent table and related references that are no longer used.
 * The ParentConsent model exists but has no active business functionality.
 * StudentInvitation table handles consent tracking directly.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Starting removal of deprecated parentconsent table...');

      // Remove any foreign key constraints that reference the parentconsent table
      console.log('🔍 Checking for foreign key references to parentconsent table...');

      // Drop any potential foreign key constraints FROM parentconsent table to other tables
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS parentconsent DROP CONSTRAINT IF EXISTS fk_parentconsent_student_user CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS parentconsent DROP CONSTRAINT IF EXISTS fk_parentconsent_parent CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE IF EXISTS parentconsent DROP CONSTRAINT IF EXISTS fk_parentconsent_invitation CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No foreign key constraints found on parentconsent table, continuing...');
      }

      // Drop any indexes on the parentconsent table if they exist
      try {
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_parentconsent_student_user_id CASCADE;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS idx_parentconsent_parent_email CASCADE;`,
          { transaction }
        );
      } catch (e) {
        console.log('No indexes found on parentconsent table, continuing...');
      }

      // Drop the parentconsent table if it exists
      console.log('🗑️ Dropping parentconsent table...');
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS parentconsent CASCADE;',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Deprecated parentconsent table cleanup completed successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Recreating parentconsent table...');
      console.log('⚠️ Note: This table was deprecated and should not be recreated in normal circumstances.');

      // Recreate the parentconsent table based on the model definition
      await queryInterface.createTable('parentconsent', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        student_user_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        student_email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        parent_email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        parent_name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        parent_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        parent_relation: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        consent_text: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        digital_signature: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        signature_ip: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        signature_user_agent: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        consent_version: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        related_invitation_id: {
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
      await queryInterface.addIndex('parentconsent', ['student_user_id'], {
        name: 'idx_parentconsent_student_user_id',
        transaction
      });

      await queryInterface.addIndex('parentconsent', ['parent_email'], {
        name: 'idx_parentconsent_parent_email',
        transaction
      });

      // Recreate foreign key constraints
      await queryInterface.addConstraint('parentconsent', {
        fields: ['student_user_id'],
        type: 'foreign key',
        name: 'fk_parentconsent_student_user',
        references: {
          table: 'user',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addConstraint('parentconsent', {
        fields: ['parent_id'],
        type: 'foreign key',
        name: 'fk_parentconsent_parent',
        references: {
          table: 'user',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addConstraint('parentconsent', {
        fields: ['related_invitation_id'],
        type: 'foreign key',
        name: 'fk_parentconsent_invitation',
        references: {
          table: 'studentinvitation',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await transaction.commit();
      console.log('✅ ParentConsent table recreated (though it remains deprecated).');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};